import type express from "express";
import { z } from "zod";

export function handleError(res: express.Response, error: unknown) {
	if (error instanceof z.ZodError) {
		return res
			.status(400)
			.json({ message: "Validation failed", issues: error.flatten() });
	}

	console.error(error);
	return res.status(500).json({ message: "Unexpected server error" });
}
