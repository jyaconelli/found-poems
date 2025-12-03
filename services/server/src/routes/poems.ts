import { Router } from "express";
import { prisma } from "../clients/prisma";
import { handleError } from "../utils/handleError";

const router: Router = Router();

router.get("/api/poems", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursorRaw = (req.query.cursor as string | undefined) ?? null;
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;
    if (cursorRaw) {
      try {
        const parsed = JSON.parse(Buffer.from(cursorRaw, "base64url").toString("utf8"));
        cursorDate = parsed.createdAt ? new Date(parsed.createdAt) : null;
        cursorId = typeof parsed.id === "string" ? parsed.id : null;
      } catch (err) {
        console.warn("Invalid cursor", err);
      }
    }

    const poems = await prisma.publishedPoem.findMany({
      where:
        cursorDate && cursorId
          ? {
              OR: [
                { createdAt: { lt: cursorDate } },
                { createdAt: cursorDate, id: { lt: cursorId } },
              ],
            }
          : undefined,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      select: {
        id: true,
        title: true,
        body: true,
        publishedAt: true,
        sessionId: true,
        createdAt: true,
      },
    });

    const hasMore = poems.length > limit;
    const items = hasMore ? poems.slice(0, limit) : poems;
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            createdAt: items[items.length - 1].createdAt.toISOString(),
            id: items[items.length - 1].id,
          }),
        ).toString("base64url")
      : null;

    res.json({ poems: items, nextCursor });
  } catch (error) {
    handleError(res, error);
  }
});

export { router as poemsRouter };
