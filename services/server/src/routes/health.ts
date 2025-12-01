import express from "express";

const router = express.Router();

router.get("/api/health", (_req, res) => {
	res.json({ ok: true, database: Boolean(process.env.DATABASE_URL) });
});

export { router as healthRouter };
