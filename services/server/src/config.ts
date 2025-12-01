export const config = {
	port: Number(process.env.PORT ?? 4000),
	resendApiKey: process.env.RESEND_API_KEY,
	mailFrom: process.env.INVITE_EMAIL_FROM,
	inviteBaseUrl: process.env.INVITE_BASE_URL ?? "http://localhost:5173",
	adminEmails: (process.env.ADMIN_EMAILS ?? "")
		.split(/[,\\s]+/)
		.map((email) => email.trim())
		.filter(Boolean),
	jwtSecret: process.env.SUPABASE_JWT_SECRET,
	statusRefreshIntervalMs: 60_000,
	supabaseUrl: process.env.SUPABASE_URL ?? null,
	supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? null,
	herokuReleaseVersion: process.env.HEROKU_RELEASE_VERSION ?? "<UNKNOWN>",
};
