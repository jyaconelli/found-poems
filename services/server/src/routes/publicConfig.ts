import { Router } from "express";
import { config } from "../config";

const router: Router = Router();

router.get("/api/public-config", (_req, res) => {
  res.json({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
  });
});

export { router as publicConfigRouter };
