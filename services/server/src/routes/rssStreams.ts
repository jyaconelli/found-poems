import { Router } from "express";
import { z } from "zod";
import { prisma } from "../clients/prisma";
import { requireAdmin } from "../middleware/requireAdmin";
import { handleError } from "../utils/handleError";
import { slugify } from "../utils/slugify";

const router = Router();

const createStreamSchema = z
  .object({
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
  })
  .refine(
    (data) => data.minParticipants <= data.maxParticipants,
    {
      message: "Min participants cannot exceed max participants",
      path: ["minParticipants"],
    },
  );

const joinSchema = z.object({
  email: z.string().email(),
});

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
    const streams = await prisma.rssPoemStream.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { collaborators: true, sessions: true } } },
    });
    res.json({ streams });
  } catch (error) {
    handleError(res, error);
  }
});

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

router.get("/api/poem-streams/:slug", async (req, res) => {
  try {
    const stream = await prisma.rssPoemStream.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { collaborators: true } } },
    });
    if (!stream) {
      return res.status(404).json({ message: "Stream not found" });
    }

    const poems = await prisma.publishedPoem.findMany({
      where: { session: { streamId: stream.id } },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        publishedAt: true,
        sessionId: true,
      },
    });

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
      poems,
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
