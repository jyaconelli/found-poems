import express from "express";
import { config } from "../config";

const router = express.Router();

router.get("/api/public-config", (_req, res) => {
	res.json({
		supabaseUrl: config.supabaseUrl,
		supabaseAnonKey: config.supabaseAnonKey,
	});
});

export { router as publicConfigRouter };
