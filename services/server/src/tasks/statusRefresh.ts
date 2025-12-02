import { SessionStatus } from "@prisma/client";
import { prisma } from "../clients/prisma";
import { config } from "../config";
import { tokenizeSource } from "../utils/tokenizeSource";

async function autoPublishClosedStreamSessions() {
  const candidates = await prisma.session.findMany({
    where: {
      status: SessionStatus.closed,
      poem: null,
      stream: { autoPublish: true },
    },
    include: {
      stream: { select: { autoPublish: true } },
      words: { select: { text: true, hidden: true, index: true } },
    },
  });

  for (const session of candidates) {
    const visibleBody = session.words
      .filter((w) => !w.hidden)
      .sort((a, b) => a.index - b.index)
      .map((w) => w.text)
      .join(" ");

    const body = visibleBody.trim().length
      ? visibleBody
      : tokenizeSource(visibleBody).join(" ");

    await prisma.$transaction([
      prisma.publishedPoem.create({
        data: {
          sessionId: session.id,
          title: session.title,
          body,
          publishedAt: new Date(),
        },
      }),
      prisma.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.published },
      }),
    ]);

    console.log("[sessions] auto-published closed stream session", {
      sessionId: session.id,
    });
  }
}

export async function refreshSessionStatuses() {
  const now = new Date();

  console.log("[sessions] status refresh beginning");

  const [activated, closed] = await Promise.all([
    prisma.session.updateMany({
      where: {
        status: SessionStatus.scheduled,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      data: { status: SessionStatus.active },
    }),
    prisma.session.updateMany({
      where: {
        status: { in: [SessionStatus.scheduled, SessionStatus.active] },
        endsAt: { lte: now },
      },
      data: { status: SessionStatus.closed },
    }),
  ]);

  if (activated.count || closed.count) {
    console.log("[sessions] status refresh", {
      now: now.toISOString(),
      activated: activated.count,
      closed: closed.count,
    });
  }

  await autoPublishClosedStreamSessions();
}

export function startStatusRefresh() {
  void refreshSessionStatuses();
  return setInterval(refreshSessionStatuses, config.statusRefreshIntervalMs);
}
