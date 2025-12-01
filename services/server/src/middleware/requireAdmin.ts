import type express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export function requireAdmin(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	try {
		if (!config.jwtSecret || config.adminEmails.length === 0) {
			return res.status(500).json({ message: "Admin auth not configured" });
		}

		const auth = req.header("authorization") ?? "";
		const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
		if (!token) return res.status(401).json({ message: "Missing token" });

		const decoded = jwt.verify(token, config.jwtSecret) as {
			email?: string;
			role?: string;
		};

		if (!decoded?.email || !config.adminEmails.includes(decoded.email)) {
			return res.status(403).json({ message: "Forbidden" });
		}

		next();
	} catch (error) {
		console.error("Admin auth failed", error);
		return res.status(401).json({ message: "Invalid token" });
	}
}
