import { Router } from "express";
import RSSParser, { type Item } from "rss-parser";
import { z } from "zod";
import { prisma } from "../clients/prisma";
import { requireAdmin } from "../middleware/requireAdmin";
import { handleError } from "../utils/handleError";
import { slugify } from "../utils/slugify";
import { tokenizeSource } from "../utils/tokenizeSource";

const router: Router = Router();

const contentPathsSchema = z.array(z.string()).optional();

const baseStreamSchema = z.object({
  title: z.string().trim().min(3),
  rssUrl: z.string().trim().url(),
  maxParticipants: z.coerce.number().int().min(1).max(1000),
  minParticipants: z.coerce.number().int().min(1).max(1000),
  durationMinutes: z.coerce.number().int().min(1).max(180),
  timeOfDay: z
    .string()
    .trim()
    .regex(
      /^([0-1]?\d|2[0-3]):[0-5]\d$/,
      "Use HH:MM (24h, e.g. 9:00 or 09:00)",
    ),
  autoPublish: z.coerce.boolean().optional().default(false),
  contentPaths: contentPathsSchema,
});

const createStreamSchema = baseStreamSchema.refine(
  (data) => data.minParticipants <= data.maxParticipants,
  {
    message: "Min participants cannot exceed max participants",
    path: ["minParticipants"],
  },
);

const joinSchema = z.object({
  email: z.string().email(),
});

const updateStreamSchema = baseStreamSchema.partial();

const parser = new RSSParser();

type ParsedItem = {
  guid: string;
  title: string;
  content: string;
  publishedAt: Date;
  raw: Item;
};

function deriveGuid(item: Item) {
  const maybeId = (item as { id?: string }).id;
  return (
    item.guid ??
    maybeId ??
    item.link ??
    `${item.title ?? "item"}-${item.pubDate ?? item.isoDate ?? Date.now()}`
  );
}

function deriveContent(item: Item) {
  const encoded =
    (item as { "content:encoded"?: string })["content:encoded"] ?? "";
  return item.contentSnippet ?? item.content ?? item.summary ?? encoded ?? "";
}

function derivePublishedAt(item: Item) {
  const raw = item.isoDate ?? item.pubDate;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function joinContentFromPaths(item: Item, paths: string[] | null | undefined) {
  if (!paths || !paths.length) return deriveContent(item);

  const values: string[] = [];
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let cursor: unknown = item as unknown;
    for (const segment of parts) {
      if (cursor === undefined || cursor === null) break;
      if (typeof cursor === "object" && cursor !== null && segment in cursor) {
        cursor = (cursor as Record<string, unknown>)[segment];
      } else {
        cursor = undefined;
        break;
      }
    }
    if (typeof cursor === "string" || typeof cursor === "number") {
      values.push(String(cursor));
    }
  }

  return values.join("\n\n");
}

type TreeNode = {
  path: string;
  key: string;
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  preview?: string;
  children?: TreeNode[];
};

function buildTree(
  value: unknown,
  key: string,
  path: string,
  depth = 0,
): TreeNode {
  const nodeType = Array.isArray(value)
    ? "array"
    : value === null
      ? "null"
      : (typeof value as TreeNode["type"]);

  if (depth > 6) {
    return { path, key, type: nodeType, preview: "(depth limit)" };
  }

  if (
    nodeType === "string" ||
    nodeType === "number" ||
    nodeType === "boolean" ||
    nodeType === "null"
  ) {
    const preview =
      typeof value === "string"
        ? value
        : value === null
          ? "null"
          : String(value);
    return { path, key, type: nodeType, preview };
  }

  const children: TreeNode[] = [];
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      const childPath = `${path}/${index}`;
      children.push(buildTree(child, String(index), childPath, depth + 1));
    });
  } else if (typeof value === "object" && value) {
    for (const childKey of Object.keys(value)) {
      const childPath = `${path}/${childKey}`;
      children.push(
        buildTree(
          (value as Record<string, unknown>)[childKey],
          childKey,
          childPath,
          depth + 1,
        ),
      );
    }
  }

  return { path, key, type: nodeType, children };
}

function nextStartTime(timeOfDay: string, anchor: Date) {
  const [hours, minutes] = timeOfDay.split(":").map((part) => Number(part));
  const start = new Date(anchor);
  start.setHours(hours ?? 9, minutes ?? 0, 0, 0);
  if (start.getTime() < anchor.getTime()) {
    start.setDate(start.getDate() + 1);
  }
  return start;
}

async function uniqueSlugFromTitle(title: string) {
  const base = slugify(title);
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.rssPoemStream.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

router.get("/api/admin/rss-streams", requireAdmin, async (_req, res) => {
  try {
    const limit = Math.min(Number(_req.query.limit) || 20, 50);
    const cursorRaw = (_req.query.cursor as string | undefined) ?? null;
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;
    if (cursorRaw) {
      try {
        const parsed = JSON.parse(
          Buffer.from(cursorRaw, "base64url").toString("utf8"),
        );
        cursorDate = parsed.createdAt ? new Date(parsed.createdAt) : null;
        cursorId = typeof parsed.id === "string" ? parsed.id : null;
      } catch (err) {
        console.warn("Invalid cursor", err);
      }
    }

    const streams = await prisma.rssPoemStream.findMany({
      where:
        cursorDate && cursorId
          ? {
              OR: [
                { createdAt: { lt: cursorDate } },
                { createdAt: cursorDate, id: { lt: cursorId } },
              ],
            }
          : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        _count: { select: { collaborators: true, sessions: true } },
      },
    });

    const hasMore = streams.length > limit;
    const items = hasMore ? streams.slice(0, limit) : streams;
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            createdAt: items[items.length - 1].createdAt.toISOString(),
            id: items[items.length - 1].id,
          }),
        ).toString("base64url")
      : null;

    res.json({ streams: items, nextCursor });
  } catch (error) {
    handleError(res, error);
  }
});

router.post(
  "/api/admin/rss-streams/validate",
  requireAdmin,
  async (req, res) => {
    try {
      const payload = createStreamSchema.parse(req.body);

      const feed = await parser.parseURL(payload.rssUrl);
      const items: ParsedItem[] =
        (feed.items ?? [])
          .map((item) => ({
            guid: deriveGuid(item),
            title: item.title ?? payload.title,
            content: joinContentFromPaths(item, payload.contentPaths),
            publishedAt: derivePublishedAt(item),
            raw: item,
          }))
          .filter((item) => item.content.trim().length > 0) ?? [];

      if (!items.length) {
        return res
          .status(400)
          .json({ message: "Feed has no items with usable content" });
      }

      const latest = items
        .slice()
        .sort(
          (a, b) =>
            (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        )[0];

      if (!latest) {
        return res
          .status(400)
          .json({ message: "Unable to find a recent item in the feed" });
      }

      const startsAt = nextStartTime(payload.timeOfDay, latest.publishedAt);
      const endsAt = new Date(
        startsAt.getTime() + payload.durationMinutes * 60_000,
      );

      const wordCount = tokenizeSource(latest.content).length;
      const tree = buildTree(latest.raw, "item", "");

      return res.json({
        preview: {
          sessionTitle: latest.title || payload.title,
          itemTitle: latest.title,
          itemGuid: latest.guid,
          itemPublishedAt: latest.publishedAt.toISOString(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          durationMinutes: payload.durationMinutes,
          timeOfDay: payload.timeOfDay,
          sourceTitle: latest.title || payload.title,
          sourceBody: latest.content,
          wordCount,
          autoPublish: payload.autoPublish ?? false,
        },
        tree,
        selectedPaths: payload.contentPaths ?? [],
      });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post("/api/admin/rss-streams", requireAdmin, async (req, res) => {
  try {
    console.log("[rss-streams] create request body", req.body);
    const payload = createStreamSchema.parse(req.body);
    console.log("[rss-streams] create validated payload", payload);
    const slug = await uniqueSlugFromTitle(payload.title);

    const stream = await prisma.rssPoemStream.create({
      data: {
        title: payload.title,
        slug,
        rssUrl: payload.rssUrl,
        maxParticipants: payload.maxParticipants,
        minParticipants: payload.minParticipants,
        durationMinutes: payload.durationMinutes,
        timeOfDay: payload.timeOfDay,
        autoPublish: payload.autoPublish ?? false,
        contentPaths: payload.contentPaths ?? [],
      },
    });

    console.log("[rss-streams] stream created", {
      id: stream.id,
      slug: stream.slug,
    });

    res.status(201).json({ stream });
  } catch (error) {
    handleError(res, error);
  }
});

router.patch("/api/admin/rss-streams/:id", requireAdmin, async (req, res) => {
  try {
    const payload = updateStreamSchema.parse(req.body);

    const existing = await prisma.rssPoemStream.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Stream not found" });
    }

    const updated = await prisma.rssPoemStream.update({
      where: { id: req.params.id },
      data: {
        title: payload.title ?? existing.title,
        rssUrl: payload.rssUrl ?? existing.rssUrl,
        maxParticipants: payload.maxParticipants ?? existing.maxParticipants,
        minParticipants: payload.minParticipants ?? existing.minParticipants,
        durationMinutes: payload.durationMinutes ?? existing.durationMinutes,
        timeOfDay: payload.timeOfDay ?? existing.timeOfDay,
        autoPublish:
          payload.autoPublish === undefined
            ? existing.autoPublish
            : payload.autoPublish,
        contentPaths:
          payload.contentPaths === undefined
            ? existing.contentPaths
            : payload.contentPaths,
      },
    });

    res.json({ stream: updated });
  } catch (error) {
    handleError(res, error);
  }
});

router.delete("/api/admin/rss-streams/:id", requireAdmin, async (req, res) => {
  try {
    const stream = await prisma.rssPoemStream.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!stream) {
      return res.status(404).json({ message: "Stream not found" });
    }

    await prisma.$transaction([
      prisma.rssStreamCollaborator.deleteMany({
        where: { streamId: req.params.id },
      }),
      prisma.session.updateMany({
        where: { streamId: req.params.id },
        data: { streamId: null },
      }),
      prisma.rssPoemStream.delete({ where: { id: req.params.id } }),
    ]);

    res.json({ message: "Stream deleted" });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/api/poem-streams/:slug", async (req, res) => {
  try {
    const stream = await prisma.rssPoemStream.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { collaborators: true } } },
    });
    if (!stream) {
      return res.status(404).json({ message: "Stream not found" });
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursorRaw = (req.query.cursor as string | undefined) ?? null;
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;
    if (cursorRaw) {
      try {
        const parsed = JSON.parse(
          Buffer.from(cursorRaw, "base64url").toString("utf8"),
        );
        cursorDate = parsed.publishedAt ? new Date(parsed.publishedAt) : null;
        cursorId = typeof parsed.id === "string" ? parsed.id : null;
      } catch (err) {
        console.warn("Invalid cursor", err);
      }
    }

    const poems = await prisma.publishedPoem.findMany({
      where: {
        session: { streamId: stream.id },
        ...(cursorDate && cursorId
          ? {
              OR: [
                { publishedAt: { lt: cursorDate } },
                { publishedAt: cursorDate, id: { lt: cursorId } },
              ],
            }
          : undefined),
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        body: true,
        publishedAt: true,
        sessionId: true,
      },
    });

    const hasMore = poems.length > limit;
    const items = hasMore ? poems.slice(0, limit) : poems;
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            publishedAt: items[items.length - 1].publishedAt,
            id: items[items.length - 1].id,
          }),
        ).toString("base64url")
      : null;

    return res.json({
      stream: {
        id: stream.id,
        title: stream.title,
        slug: stream.slug,
        rssUrl: stream.rssUrl,
        maxParticipants: stream.maxParticipants,
        minParticipants: stream.minParticipants,
        durationMinutes: stream.durationMinutes,
        timeOfDay: stream.timeOfDay,
        autoPublish: stream.autoPublish,
        collaboratorCount: stream._count.collaborators,
      },
      poems: items,
      nextCursor,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/api/poem-streams/:slug/join", async (req, res) => {
  try {
    const payload = joinSchema.parse(req.body);
    const stream = await prisma.rssPoemStream.findUnique({
      where: { slug: req.params.slug },
    });
    if (!stream) {
      return res.status(404).json({ message: "Stream not found" });
    }

    await prisma.rssStreamCollaborator.upsert({
      where: { streamId_email: { streamId: stream.id, email: payload.email } },
      update: {},
      create: { streamId: stream.id, email: payload.email },
    });

    return res
      .status(201)
      .json({ message: "Joined stream collaborators list" });
  } catch (error) {
    handleError(res, error);
  }
});

export { router as rssStreamsRouter };
