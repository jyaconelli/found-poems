import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient, SessionStatus } from "@prisma/client";
import cors from "cors";
import express from "express";
import { Resend } from "resend";
import { z } from "zod";

const port = Number(process.env.PORT ?? 4000);
const prisma = new PrismaClient();
const resendApiKey = process.env.RESEND_API_KEY;
const mailFrom = process.env.INVITE_EMAIL_FROM;
const inviteBaseUrl = process.env.INVITE_BASE_URL ?? "http://localhost:5173";
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

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
	closed: ["ready"],
	ready: [],
};

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
	res.json({ ok: true, database: Boolean(process.env.DATABASE_URL) });
});

app.post("/api/sessions", async (req, res) => {
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

			if (resendClient && mailFrom) {
				void sendInviteEmails({
					invites,
					session,
					source,
					baseUrl: inviteBaseUrl,
					from: mailFrom,
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

app.get("/api/sessions/:id", async (req, res) => {
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

app.patch("/api/sessions/:id/state", async (req, res) => {
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

app.post("/api/sessions/:id/publish", async (req, res) => {
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

		res.status(201).json({ poem });
	} catch (error) {
		handleError(res, error);
	}
});

app.get("/api/poems", async (_req, res) => {
	try {
		const poems = await prisma.publishedPoem.findMany({
			orderBy: { createdAt: "desc" },
			select: { id: true, title: true, body: true, publishedAt: true },
		});

		res.json({ poems });
	} catch (error) {
		handleError(res, error);
	}
});

app.use(
	(
		err: unknown,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		handleError(res, err);
	},
);

app.listen(port, () => {
	console.log(`[server] listening on http://localhost:${port}`);
});

const shutdown = async () => {
	await prisma.$disconnect();
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function tokenizeSource(body: string) {
	return body
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

function createInviteToken() {
	return randomBytes(16).toString("hex");
}

type InviteEmailInput = {
	invites: { email: string; token: string }[];
	session: { id: string; title: string; startsAt: Date; endsAt: Date };
	source: { title: string };
	baseUrl: string;
	from: string;
};

async function sendInviteEmails(input: InviteEmailInput) {
	if (!resendClient) return;

	const joinUrlFor = (token: string) =>
		`${input.baseUrl}/join?sessionId=${encodeURIComponent(input.session.id)}&token=${encodeURIComponent(token)}`;

	for (const invite of input.invites) {
		await resendClient.emails.send({
			from: input.from,
			to: invite.email,
			subject: `You're invited: ${input.session.title}`,
			html: `
				<p>You have been invited to a Found Poems collaboration.</p>
				<p><strong>Session:</strong> ${input.session.title}</p>
				<p><strong>Source:</strong> ${input.source.title}</p>
				<p><strong>Starts:</strong> ${input.session.startsAt.toISOString()}</p>
				<p><strong>Ends:</strong> ${input.session.endsAt.toISOString()}</p>
				<p><a href="${joinUrlFor(invite.token)}">Join session</a></p>
			`,
			text: `You have been invited to a Found Poems collaboration.
Session: ${input.session.title}
Source: ${input.source.title}
Starts: ${input.session.startsAt.toISOString()}
Ends: ${input.session.endsAt.toISOString()}
Join: ${joinUrlFor(invite.token)}`,
		});
	}
}

function handleError(res: express.Response, error: unknown) {
	if (error instanceof z.ZodError) {
		return res
			.status(400)
			.json({ message: "Validation failed", issues: error.flatten() });
	}

	console.error(error);
	return res.status(500).json({ message: "Unexpected server error" });
}
