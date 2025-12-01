import { Router } from "express";
import { prisma } from "../clients/prisma";
import { handleError } from "../utils/handleError";

const router: Router = Router();

router.get("/api/poems", async (_req, res) => {
  try {
    const poems = await prisma.publishedPoem.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        publishedAt: true,
        sessionId: true,
      },
    });

    res.json({ poems });
  } catch (error) {
    handleError(res, error);
  }
});

export { router as poemsRouter };
