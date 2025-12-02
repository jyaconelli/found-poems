import RSSParser, { type Item } from "rss-parser";
import { prisma } from "../clients/prisma";
import { config } from "../config";
import { sendInviteEmails } from "../email/sendInviteEmails";
import { createInviteToken } from "../utils/createInviteToken";
import { tokenizeSource } from "../utils/tokenizeSource";

type ParsedItem = {
  guid: string;
  title: string;
  content: string;
  publishedAt: Date;
};

const parser = new RSSParser();

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
  return (
    item.contentSnippet ??
    item.content ??
    item.summary ??
    encoded ??
    ""
  );
}

function derivePublishedAt(item: Item) {
  const raw = item.isoDate ?? item.pubDate;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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

async function createSessionFromItem(
  stream: {
    id: string;
    title: string;
    maxParticipants: number;
    durationMinutes: number;
    timeOfDay: string;
    collaborators: { email: string }[];
  },
  item: ParsedItem,
) {
  const startsAt = nextStartTime(stream.timeOfDay, item.publishedAt);
  const endsAt = new Date(
    startsAt.getTime() + stream.durationMinutes * 60_000,
  );

  const source = await prisma.sourceText.create({
    data: { title: item.title || stream.title, body: item.content },
  });

  const session = await prisma.session.create({
    data: {
      title: item.title || stream.title,
      sourceId: source.id,
      startsAt,
      endsAt,
      streamId: stream.id,
    },
  });

  const invites = stream.collaborators.map((collaborator) => ({
    sessionId: session.id,
    email: collaborator.email,
    token: createInviteToken(),
  }));

  if (invites.length) {
    await prisma.sessionInvite.createMany({
      data: invites,
      skipDuplicates: true,
    });

    if (config.mailFrom && config.inviteBaseUrl) {
      void sendInviteEmails({
        invites,
        session,
        source,
        baseUrl: config.inviteBaseUrl,
        from: config.mailFrom,
      }).catch((error) => {
        console.error("[rss-stream] failed to send invites", error);
      });
    }
  }

  const tokens = tokenizeSource(item.content);
  if (tokens.length) {
    await prisma.word.createMany({
      data: tokens.map((text, index) => ({
        sessionId: session.id,
        index,
        text,
      })),
    });
  }

  console.log("[rss-stream] created session from feed item", {
    streamId: stream.id,
    sessionId: session.id,
    title: item.title,
    startsAt: startsAt.toISOString(),
  });
}

export async function syncRssStreams() {
  const streams = await prisma.rssPoemStream.findMany({
    include: { collaborators: true },
  });

  for (const stream of streams) {
    try {
      const feed = await parser.parseURL(stream.rssUrl);
      const items: ParsedItem[] =
        (feed.items ?? [])
          .map((item) => ({
            guid: deriveGuid(item),
            title: item.title ?? stream.title,
            content: deriveContent(item),
            publishedAt: derivePublishedAt(item),
          }))
          .filter((item) => item.content.trim().length > 0) ?? [];

      if (!items.length) continue;

      const lastTime = stream.lastItemPublishedAt
        ? new Date(stream.lastItemPublishedAt).getTime()
        : null;

      const newItems = items
        .sort(
          (a, b) =>
            (a.publishedAt?.getTime() ?? 0) -
            (b.publishedAt?.getTime() ?? 0),
        )
        .filter((item) => {
          if (stream.lastItemGuid && item.guid === stream.lastItemGuid) {
            return (
              lastTime !== null &&
              item.publishedAt.getTime() > (lastTime ?? 0)
            );
          }
          if (lastTime !== null) {
            return item.publishedAt.getTime() > lastTime;
          }
          return true;
        });

      if (!newItems.length) continue;

      for (const item of newItems) {
        await createSessionFromItem(stream, item);
      }

      const latest = newItems[newItems.length - 1];
      await prisma.rssPoemStream.update({
        where: { id: stream.id },
        data: {
          lastItemGuid: latest.guid,
          lastItemPublishedAt: latest.publishedAt,
        },
      });
    } catch (error) {
      console.error("[rss-stream] failed to sync stream", {
        streamId: stream.id,
        error,
      });
    }
  }
}

export function startRssStreamPoller() {
  void syncRssStreams();
  return setInterval(syncRssStreams, config.rssPollIntervalMs);
}
