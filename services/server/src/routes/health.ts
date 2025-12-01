import { Router } from "express";

const router: Router = Router();

router.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: Boolean(process.env.DATABASE_URL) });
});

export { router as healthRouter };
