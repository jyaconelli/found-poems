import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import express from "express";
import { z } from "zod";

const port = Number(process.env.PORT ?? 4000);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});

const app = express();
app.use(cors());
app.use(express.json());

const scheduleSchema = z.object({
	source_id: z.string().uuid(),
	starts_at: z.coerce.date(),
	ends_at: z.coerce.date(),
	invite_emails: z.array(z.string().email()),
});

app.post("/api/session", async (req, res) => {
	const parse = scheduleSchema.safeParse(req.body);

	if (!parse.success) {
		return res.status(400).json(parse.error.flatten());
	}

	const payload = parse.data;
	const { data, error } = await supabase
		.from("sessions")
		.insert({
			source_id: payload.source_id,
			starts_at: payload.starts_at.toISOString(),
			ends_at: payload.ends_at.toISOString(),
			status: "scheduled",
		})
		.select()
		.single();

	if (error) {
		return res.status(500).json({ message: error.message });
	}

	return res
		.status(201)
		.json({ session: data, invites: payload.invite_emails.length });
});

app.get("/api/health", (_req, res) => {
	res.json({ ok: true, supabaseUrl });
});

app.listen(port, () => {
	console.log(`[server] listening on http://localhost:${port}`);
});
