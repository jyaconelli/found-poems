import { SessionStatus } from "@prisma/client";
import express from "express";
import { z } from "zod";
import { prisma } from "../clients/prisma";
import { resendClient } from "../clients/resend";
import { config } from "../config";
import { sendInviteEmails } from "../email/sendInviteEmails";
import { requireAdmin } from "../middleware/requireAdmin";
import { createInviteToken } from "../utils/createInviteToken";
import { handleError } from "../utils/handleError";
import { tokenizeSource } from "../utils/tokenizeSource";

const router = express.Router();

const createSessionSchema = z.object({
	title: z.string().min(3, "Title must be at least 3 characters"),
	startsAt: z.coerce.date(),
	durationMinutes: z.number().int().min(1).max(60),
	source: z.object({
		title: z.string().min(3),
		body: z
			.string()
			.min(50, "Source body should include enough text for collaboration"),
	}),
	inviteEmails: z.array(z.string().email()).max(100).default([]),
});

const stateSchema = z.object({
	status: z.nativeEnum(SessionStatus),
});

const publishSchema = z.object({
	title: z.string().min(3),
	body: z.string().min(3),
});

const allowedTransitions: Record<SessionStatus, SessionStatus[]> = {
	scheduled: ["active", "closed"],
	active: ["closed"],
	closed: ["published"],
	published: [],
};

router.post("/api/sessions", requireAdmin, async (req, res) => {
	try {
		const payload = createSessionSchema.parse(req.body);
		const endsAt = new Date(
			payload.startsAt.getTime() + payload.durationMinutes * 60_000,
		);

		const source = await prisma.sourceText.create({
			data: {
				title: payload.source.title,
				body: payload.source.body,
			},
		});

		const session = await prisma.session.create({
			data: {
				title: payload.title,
				sourceId: source.id,
				startsAt: payload.startsAt,
				endsAt,
			},
		});

		const invites = payload.inviteEmails.map((email) => ({
			sessionId: session.id,
			email,
			token: createInviteToken(),
		}));

		if (invites.length) {
			await prisma.sessionInvite.createMany({
				data: invites,
				skipDuplicates: true,
			});

			if (resendClient && config.mailFrom) {
				void sendInviteEmails({
					invites,
					session,
					source,
					baseUrl: config.inviteBaseUrl,
					from: config.mailFrom,
				}).catch((error) => {
					console.error("Failed to send invites via Resend", error);
				});
			}
		}

		const tokens = tokenizeSource(payload.source.body);
		if (tokens.length) {
			await prisma.word.createMany({
				data: tokens.map((text, index) => ({
					sessionId: session.id,
					index,
					text,
				})),
			});
		}

		res.status(201).json({
			sessionId: session.id,
			inviteCount: invites.length,
			wordCount: tokens.length,
			startsAt: session.startsAt,
			endsAt: session.endsAt,
		});
	} catch (error) {
		handleError(res, error);
	}
});

router.get("/api/sessions/:id", async (req, res) => {
	try {
		const session = await prisma.session.findUnique({
			where: { id: req.params.id },
			include: {
				invites: {
					select: {
						id: true,
						email: true,
						status: true,
						createdAt: true,
						respondedAt: true,
					},
				},
				source: { select: { id: true, title: true } },
				poem: { select: { id: true, title: true, publishedAt: true } },
			},
		});

		if (!session) {
			return res.status(404).json({ message: "Session not found" });
		}

		const [totalWords, hiddenWords] = await Promise.all([
			prisma.word.count({ where: { sessionId: session.id } }),
			prisma.word.count({ where: { sessionId: session.id, hidden: true } }),
		]);

		res.json({
			session,
			metrics: {
				totalWords,
				hiddenWords,
				remainingWords: totalWords - hiddenWords,
			},
		});
	} catch (error) {
		handleError(res, error);
	}
});

router.patch("/api/sessions/:id/state", requireAdmin, async (req, res) => {
	try {
		const { status: nextStatus } = stateSchema.parse(req.body);
		const session = await prisma.session.findUnique({
			where: { id: req.params.id },
		});

		if (!session) {
			return res.status(404).json({ message: "Session not found" });
		}

		if (session.status === nextStatus) {
			return res.json({ session });
		}

		if (!allowedTransitions[session.status].includes(nextStatus)) {
			return res.status(400).json({
				message: `Cannot transition ${session.status} → ${nextStatus}`,
			});
		}

		const updated = await prisma.session.update({
			where: { id: session.id },
			data: { status: nextStatus },
		});

		res.json({ session: updated });
	} catch (error) {
		handleError(res, error);
	}
});

router.post("/api/sessions/:id/publish", requireAdmin, async (req, res) => {
	try {
		const payload = publishSchema.parse(req.body);

		const poem = await prisma.publishedPoem.upsert({
			where: { sessionId: req.params.id },
			create: {
				sessionId: req.params.id,
				title: payload.title,
				body: payload.body,
				publishedAt: new Date(),
			},
			update: {
				title: payload.title,
				body: payload.body,
				publishedAt: new Date(),
			},
		});

		await prisma.session.update({
			where: { id: req.params.id },
			data: { status: SessionStatus.published },
		});

		res.status(201).json({ poem });
	} catch (error) {
		handleError(res, error);
	}
});

router.get("/api/admin/sessions", requireAdmin, async (req, res) => {
	try {
		const status = req.query.status as SessionStatus | undefined;
		const sessions = await prisma.session.findMany({
			where: status ? { status } : undefined,
			orderBy: { startsAt: "desc" },
			include: {
				invites: { select: { id: true, status: true } },
				source: { select: { title: true } },
			},
		});

		res.json({ sessions });
	} catch (error) {
		handleError(res, error);
	}
});

router.get("/api/sessions/:id/words", async (req, res) => {
	try {
		const words = await prisma.word.findMany({
			where: { sessionId: req.params.id },
			orderBy: { index: "asc" },
			select: {
				id: true,
				index: true,
				text: true,
				hidden: true,
				hiddenAt: true,
				actorId: true,
			},
		});

		return res.json({ words });
	} catch (error) {
		handleError(res, error);
	}
});

router.patch("/api/words/:id/hide", async (req, res) => {
	try {
		const actorId = (req.header("x-actor-id") ?? "anonymous").slice(0, 64);
		const word = await prisma.word.update({
			where: { id: req.params.id },
			data: { hidden: true, hiddenAt: new Date(), actorId },
			select: {
				id: true,
				sessionId: true,
				index: true,
				hidden: true,
				hiddenAt: true,
			},
		});

		res.json({ word });
	} catch (error) {
		handleError(res, error);
	}
});

export { router as sessionsRouter };
