import { Button } from "@found-poems/ui";
import {
	createClient,
	type RealtimeChannel,
	type Session,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";
const INITIAL_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const INITIAL_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

type SupabaseConfigState = {
	url: string;
	anonKey: string;
	status: "loading" | "ready" | "error";
	error: string;
};

function pad(n: number) {
	return n.toString().padStart(2, "0");
}

// Format a Date into the local string that <input type="datetime-local"> expects (no timezone)
function formatLocalDateTimeInput(date: Date) {
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert a datetime-local value (interpreted as local time) into an ISO string in UTC for the API
function toUtcISOStringFromLocalInput(localValue: string) {
	// localValue like "2025-11-26T18:00"
	const date = new Date(localValue);
	return date.toISOString();
}

export default function App() {
	const search = new URLSearchParams(window.location.search);
	const sessionId = search.get("sessionId");
	const token = search.get("token") ?? randomHex();
	const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigState>(
		() => ({
			url: INITIAL_SUPABASE_URL,
			anonKey: INITIAL_SUPABASE_ANON_KEY,
			status:
				INITIAL_SUPABASE_URL && INITIAL_SUPABASE_ANON_KEY
					? ("ready" as const)
					: ("loading" as const),
			error: "",
		}),
	);

	useEffect(() => {
		if (supabaseConfig.status !== "loading") return;
		(async () => {
			try {
				const response = await fetch(`${API_BASE}/api/public-config`);
				const data = await response.json();
				if (!response.ok || !data.supabaseUrl || !data.supabaseAnonKey) {
					setSupabaseConfig((prev) => ({
						...prev,
						status: "error",
						error: "Supabase config not available",
					}));
					return;
				}
				setSupabaseConfig({
					url: data.supabaseUrl,
					anonKey: data.supabaseAnonKey,
					status: "ready",
					error: "",
				});
			} catch (error) {
				console.error("Failed to load public config", error);
				setSupabaseConfig((prev) => ({
					...prev,
					status: "error",
					error: "Unable to load Supabase config",
				}));
			}
		})();
	}, [supabaseConfig.status]);

	const needsConfig = supabaseConfig.status !== "ready";

	if (sessionId) {
		if (needsConfig) {
			return (
				<ConfigState
					status={supabaseConfig.status}
					error={supabaseConfig.error}
				/>
			);
		}
		return (
			<ParticipantView
				sessionId={sessionId}
				token={token}
				supabaseUrl={supabaseConfig.url}
				supabaseKey={supabaseConfig.anonKey}
			/>
		);
	}

	return <AdminGate supabaseConfig={supabaseConfig} />;
}

function ConfigState({
	status,
	error,
}: {
	status: "loading" | "ready" | "error";
	error: string;
}) {
	if (status === "loading") {
		return (
			<main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-3 px-4 py-10">
				<p className="text-sm text-ink-600">Loading configuration…</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-3 px-4 py-10 text-center">
			<h1 className="text-2xl font-semibold">Missing Supabase config</h1>
			<p className="text-sm text-ink-600">
				{error ||
					"Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env, then restart `pnpm dev`."}
			</p>
		</main>
	);
}

function AdminGate({
	supabaseConfig,
}: {
	supabaseConfig: SupabaseConfigState;
}) {
	if (supabaseConfig.status !== "ready") {
		return (
			<ConfigState
				status={supabaseConfig.status}
				error={supabaseConfig.error}
			/>
		);
	}

	return (
		<AdminAuth
			supabaseUrl={supabaseConfig.url}
			supabaseKey={supabaseConfig.anonKey}
		/>
	);
}

function AdminAuth({
	supabaseUrl,
	supabaseKey,
}: {
	supabaseUrl: string;
	supabaseKey: string;
}) {
	const supabase = useMemo(
		() => createClient(supabaseUrl, supabaseKey),
		[supabaseKey, supabaseUrl],
	);
	const [session, setSession] = useState<Session | null>(null);
	const [checkingSession, setCheckingSession] = useState(true);
	const [authError, setAuthError] = useState<string | null>(null);
	const [isSigningIn, setIsSigningIn] = useState(false);

	useEffect(() => {
		let active = true;
		supabase.auth.getSession().then(({ data, error }) => {
			if (!active) return;
			if (error) setAuthError(error.message);
			setSession(data.session ?? null);
			setCheckingSession(false);
		});

		const { data: subscription } = supabase.auth.onAuthStateChange(
			(_event, nextSession) => {
				if (!active) return;
				setSession(nextSession);
				setAuthError(null);
				setCheckingSession(false);
			},
		);

		return () => {
			active = false;
			subscription.subscription.unsubscribe();
		};
	}, [supabase]);

	const handleLogin = async (email: string, password: string) => {
		setIsSigningIn(true);
		setAuthError(null);
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) setAuthError(error.message);
		setIsSigningIn(false);
	};

	const handleLogout = async () => {
		setAuthError(null);
		await supabase.auth.signOut();
	};

	if (checkingSession) {
		return (
			<main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-3 px-4 py-10">
				<p className="text-sm text-ink-600">Checking admin session…</p>
			</main>
		);
	}

	if (!session) {
		return (
			<LoginPage
				onSubmit={handleLogin}
				loading={isSigningIn}
				error={authError}
			/>
		);
	}

	return (
		<AdminScheduler
			configStatus="ready"
			authToken={session.access_token}
			userEmail={session.user.email ?? "Admin"}
			onSignOut={handleLogout}
		/>
	);
}

function LoginPage({
	onSubmit,
	loading,
	error,
}: {
	onSubmit: (email: string, password: string) => Promise<void> | void;
	loading: boolean;
	error: string | null;
}) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		void onSubmit(email, password);
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
			<div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
				<div className="mb-6 space-y-2 text-center">
					<p className="text-xs uppercase tracking-wide text-ink-500">
						Admin Console
					</p>
					<h1 className="text-2xl font-semibold">Sign in</h1>
					<p className="text-sm text-ink-600">
						Use the email + password for an account listed in ADMIN_EMAILS.
					</p>
				</div>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium">Email</span>
						<input
							type="email"
							autoComplete="email"
							className="rounded border border-ink-200 px-3 py-2"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</label>
					<label className="flex flex-col gap-2">
						<span className="text-sm font-medium">Password</span>
						<input
							type="password"
							autoComplete="current-password"
							className="rounded border border-ink-200 px-3 py-2"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</label>
					<Button
						type="submit"
						variant="primary"
						className="w-full"
						disabled={loading}
					>
						{loading ? "Signing in…" : "Continue"}
					</Button>
					{error && <p className="text-sm text-red-600">{error}</p>}
				</form>
			</div>
			<p className="mt-4 text-center text-xs text-ink-500">
				We store your Supabase session locally so authorized API calls include a
				Bearer token.
			</p>
		</main>
	);
}

function AdminScheduler({
	configStatus,
	authToken,
	userEmail,
	onSignOut,
}: {
	configStatus: "loading" | "ready" | "error";
	authToken: string;
	userEmail: string;
	onSignOut: () => void;
}) {
	const defaultSource = `We stood at the shoreline, collecting words that felt half-remembered and
half-new. Thunderheads gathered to the west, but the workshop continued and we
kept striking lines, trusting that the time-box would carry us through.`;

	const [activeTab, setActiveTab] = useState<"create" | "sessions">("create");

	// Create tab state
	const [title, setTitle] = useState("Evening Lab");
	const [startsAtLocal, setStartsAtLocal] = useState(() =>
		formatLocalDateTimeInput(new Date(Date.now() + 3_600_000)),
	);
	const [durationMinutes, setDurationMinutes] = useState(10);
	const [sourceTitle, setSourceTitle] = useState("Found Objects");
	const [sourceBody, setSourceBody] = useState(defaultSource);
	const [inviteList, setInviteList] = useState(
		"poet@example.com, collaborator@example.com",
	);
	const [status, setStatus] = useState<
		"idle" | "pending" | "success" | "error"
	>("idle");
	const [result, setResult] = useState<null | {
		sessionId: string;
		inviteCount: number;
		wordCount: number;
		startsAt: string;
		endsAt: string;
	}>(null);
	const [errorMessage, setErrorMessage] = useState("");
	const inviteEmails = useMemo(
		() =>
			inviteList
				.split(/[,\n]/)
				.map((value) => value.trim())
				.filter(Boolean),
		[inviteList],
	);

	async function handleCreate() {
		if (!authToken) {
			setStatus("error");
			setErrorMessage("You need to sign in again before creating a session.");
			return;
		}

		setStatus("pending");
		setResult(null);
		setErrorMessage("");

		try {
      console.log('invite emails:', inviteEmails)
			const response = await fetch(`${API_BASE}/api/sessions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify({
					title,
					startsAt: toUtcISOStringFromLocalInput(startsAtLocal),
					durationMinutes,
					source: { title: sourceTitle, body: sourceBody },
					inviteEmails,
				}),
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				const message =
					typeof data.message === "string"
						? data.message
						: "Unable to schedule session";
				setStatus("error");
				setErrorMessage(message);
				return;
			}

			setResult({
				sessionId: data.sessionId,
				inviteCount: data.inviteCount,
				wordCount: data.wordCount,
				startsAt: data.startsAt,
				endsAt: data.endsAt,
			});
			setStatus("success");
		} catch (error) {
			console.error(error);
			setStatus("error");
			setErrorMessage("Something went wrong. Check server logs.");
		}
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
			<div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
				<div>
					<p className="text-xs uppercase tracking-wide text-ink-500">
						Signed in
					</p>
					<p className="text-sm font-semibold text-ink-900">{userEmail}</p>
				</div>
				<div className="flex items-center gap-3">
					<Button variant="ghost" onClick={onSignOut}>
						Sign out
					</Button>
				</div>
			</div>
			{configStatus !== "ready" && (
				<div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					Supabase config is {configStatus}. Invites will still work, but
					presence requires the public config endpoint.
				</div>
			)}
			<header className="space-y-2">
				<p className="text-sm uppercase tracking-wide text-ink-500">
					Admin Console
				</p>
				<h1 className="text-3xl font-semibold">Dashboard</h1>
				<p className="text-base text-ink-600">
					Manage collaboration sessions and publish completed poems.
				</p>
			</header>

			<div className="flex gap-2 rounded-full bg-ink-50 p-1 text-sm font-semibold text-ink-700">
				<button
					className={`rounded-full px-4 py-2 transition ${
						activeTab === "create"
							? "bg-ink-900 text-white shadow-sm"
							: "hover:bg-white"
					}`}
					onClick={() => setActiveTab("create")}
					type="button"
				>
					Create Session
				</button>
				<button
					className={`rounded-full px-4 py-2 transition ${
						activeTab === "sessions"
							? "bg-ink-900 text-white shadow-sm"
							: "hover:bg-white"
					}`}
					onClick={() => setActiveTab("sessions")}
					type="button"
				>
					View Sessions
				</button>
			</div>

			{activeTab === "create" ? (
				<CreateSessionForm
					title={title}
					setTitle={setTitle}
					startsAtLocal={startsAtLocal}
					setStartsAtLocal={setStartsAtLocal}
					durationMinutes={durationMinutes}
					setDurationMinutes={setDurationMinutes}
					inviteList={inviteList}
					setInviteList={setInviteList}
					sourceTitle={sourceTitle}
					setSourceTitle={setSourceTitle}
					sourceBody={sourceBody}
					setSourceBody={setSourceBody}
					status={status}
					errorMessage={errorMessage}
					result={result}
					onSubmit={handleCreate}
				/>
			) : (
				<SessionsTab authToken={authToken} />
			)}
		</main>
	);
}

function CreateSessionForm({
	title,
	setTitle,
	startsAtLocal,
	setStartsAtLocal,
	durationMinutes,
	setDurationMinutes,
	inviteList,
	setInviteList,
	sourceTitle,
	setSourceTitle,
	sourceBody,
	setSourceBody,
	status,
	errorMessage,
	result,
	onSubmit,
}: {
	title: string;
	setTitle: (value: string) => void;
	startsAtLocal: string;
	setStartsAtLocal: (value: string) => void;
	durationMinutes: number;
	setDurationMinutes: (value: number) => void;
	inviteList: string;
	setInviteList: (value: string) => void;
	sourceTitle: string;
	setSourceTitle: (value: string) => void;
	sourceBody: string;
	setSourceBody: (value: string) => void;
	status: "idle" | "pending" | "success" | "error";
	errorMessage: string;
	result: null | {
		sessionId: string;
		inviteCount: number;
		wordCount: number;
		startsAt: string;
		endsAt: string;
	};
	onSubmit: () => Promise<void>;
}) {
	return (
		<>
			<section className="grid gap-6 md:grid-cols-2">
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Title</span>
					<input
						className="rounded border border-ink-200 px-3 py-2"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
					/>
				</label>
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Start time</span>
					<input
						type="datetime-local"
						className="rounded border border-ink-200 px-3 py-2"
						value={startsAtLocal}
						onChange={(event) => setStartsAtLocal(event.target.value)}
					/>
				</label>
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Duration (minutes)</span>
					<input
						type="number"
						min={1}
						max={60}
						className="rounded border border-ink-200 px-3 py-2"
						value={durationMinutes}
						onChange={(event) => setDurationMinutes(Number(event.target.value))}
					/>
				</label>
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Invites</span>
					<textarea
						className="rounded border border-ink-200 px-3 py-2"
						rows={3}
						value={inviteList}
						onChange={(event) => setInviteList(event.target.value)}
					/>
					<span className="text-xs text-ink-500">
						Comma or newline separated emails.
					</span>
				</label>
			</section>

			<section className="grid gap-4">
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Source title</span>
					<input
						className="rounded border border-ink-200 px-3 py-2"
						value={sourceTitle}
						onChange={(event) => setSourceTitle(event.target.value)}
					/>
				</label>
				<label className="flex flex-col gap-2">
					<span className="text-sm font-medium">Source body</span>
					<textarea
						className="rounded border border-ink-200 px-3 py-2"
						rows={6}
						value={sourceBody}
						onChange={(event) => setSourceBody(event.target.value)}
					/>
				</label>
			</section>

			<div className="flex items-center gap-3">
				<Button
					variant="primary"
					disabled={status === "pending"}
					onClick={onSubmit}
				>
					{status === "pending" ? "Creating…" : "Create Session"}
				</Button>
				{status === "error" && errorMessage && (
					<span className="text-sm text-red-600">{errorMessage}</span>
				)}
			</div>

			{result && (
				<section className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
					<h2 className="text-lg font-semibold">Session created</h2>
					<dl className="mt-2 grid gap-1 text-sm">
						<div className="flex justify-between">
							<dt className="text-ink-500">Session ID</dt>
							<dd className="font-mono">{result.sessionId}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-ink-500">Invites sent</dt>
							<dd>{result.inviteCount}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-ink-500">Words tracked</dt>
							<dd>{result.wordCount}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-ink-500">Starts</dt>
							<dd>{new Date(result.startsAt).toLocaleString()}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-ink-500">Ends</dt>
							<dd>{new Date(result.endsAt).toLocaleString()}</dd>
						</div>
					</dl>
				</section>
			)}
		</>
	);
}

type SessionStatus = "scheduled" | "active" | "closed" | "published";
type AdminSession = {
	id: string;
	title: string;
	status: SessionStatus;
	startsAt: string;
	endsAt: string;
	source: { title: string };
	invites: { id: string; status: string }[];
	poem?: { id: string; title: string; publishedAt: string | null } | null;
};

type SessionWord = {
	id: string;
	text: string;
	hidden: boolean;
	index: number;
};

function SessionsTab({ authToken }: { authToken: string }) {
	const [sessions, setSessions] = useState<AdminSession[]>([]);
	const [filter, setFilter] = useState<SessionStatus | "all">("all");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [openPublishId, setOpenPublishId] = useState<string | null>(null);
	const [publishDraft, setPublishDraft] = useState<{
		title: string;
		body: string;
	}>({
		title: "",
		body: "",
	});
	const [publishingId, setPublishingId] = useState<string | null>(null);
	const [wordsBySession, setWordsBySession] = useState<
		Record<string, SessionWord[]>
	>({});
	const [loadingWordsFor, setLoadingWordsFor] = useState<string | null>(null);

	const loadSessions = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const url =
				filter === "all"
					? `${API_BASE}/api/admin/sessions`
					: `${API_BASE}/api/admin/sessions?status=${filter}`;
			const response = await fetch(url, {
				headers: { authorization: `Bearer ${authToken}` },
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				setError(
					typeof data.message === "string"
						? data.message
						: "Failed to load sessions",
				);
				setSessions([]);
				return;
			}
			const sorted = (data.sessions ?? []).slice().sort((a: AdminSession, b: AdminSession) => {
				const aTime = new Date(a.startsAt).getTime();
				const bTime = new Date(b.startsAt).getTime();
				return bTime - aTime; // newest first
			});
			setSessions(sorted);
		} catch (_err) {
			setError("Unable to load sessions.");
		} finally {
			setLoading(false);
		}
	}, [authToken, filter]);

	useEffect(() => {
		void loadSessions();
	}, [loadSessions]);

	const startPublish = (session: AdminSession) => {
		setOpenPublishId(session.id);
		void loadWordsForSession(session);
	};

	const toggleDetails = (session: AdminSession) => {
		setOpenPublishId((prev) => {
			const next = prev === session.id ? null : session.id;
			if (next) {
				void loadWordsForSession(session);
			}
			return next;
		});
	};

	const submitPublish = async (sessionId: string) => {
		if (!publishDraft.title.trim()) {
			setError("Title is required to publish.");
			return;
		}
		if (!publishDraft.body.trim()) {
			setError("Body is required to publish.");
			return;
		}
		console.log("[publish] submitting", {
			sessionId,
			title: publishDraft.title,
			bodyLength: publishDraft.body.length,
		});
		setPublishingId(sessionId);
		setError(null);
		try {
			const response = await fetch(
				`${API_BASE}/api/sessions/${sessionId}/publish`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						authorization: `Bearer ${authToken}`,
					},
					body: JSON.stringify({
						title: publishDraft.title,
						body: publishDraft.body,
					}),
				},
			);
			const data = await response.json().catch(() => ({}));
			console.log("[publish] response", {
				status: response.status,
				ok: response.ok,
				bodyKeys: Object.keys(data ?? {}),
				data,
			});
			if (!response.ok) {
				setError(
					typeof data.message === "string"
						? data.message
						: "Failed to publish session",
				);
				return;
			}
			setOpenPublishId(null);
			setPublishDraft({ title: "", body: "" });
			await loadSessions();
		} finally {
			setPublishingId(null);
		}
	};

	const setPublishDraftFromWords = (
		sessionId: string,
		title: string,
		words?: SessionWord[],
	) => {
		const list = words ?? wordsBySession[sessionId] ?? [];
		const visibleText = list
			.filter((w) => !w.hidden)
			.map((w) => w.text)
			.join(" ");
		setPublishDraft({
			title,
			body: visibleText,
		});
	};

	const loadWordsForSession = async (session: AdminSession) => {
		if (wordsBySession[session.id]) {
			console.log("[publish] words cached, using existing", {
				sessionId: session.id,
			});
			setPublishDraftFromWords(session.id, session.title);
			return;
		}
		setLoadingWordsFor(session.id);
		try {
			const response = await fetch(
				`${API_BASE}/api/sessions/${session.id}/words`,
				{
					headers: { authorization: `Bearer ${authToken}` },
				},
			);
			const data = await response.json().catch(() => ({}));
			console.log("[publish] load words", {
				sessionId: session.id,
				status: response.status,
				ok: response.ok,
				wordCount: (data.words ?? []).length,
			});
			if (!response.ok) {
				setError(
					typeof data.message === "string"
						? data.message
						: "Unable to load session details",
				);
				return;
			}
			const words: SessionWord[] = (data.words ?? []).sort(
				(a: SessionWord, b: SessionWord) => a.index - b.index,
			);
			setWordsBySession((prev) => ({ ...prev, [session.id]: words }));
			setPublishDraftFromWords(session.id, session.title, words);
		} catch (_err) {
			console.error("[publish] load words failed", _err);
			setError("Unable to load session details.");
		} finally {
			setLoadingWordsFor(null);
		}
	};

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center gap-3">
				<p className="text-sm font-semibold text-ink-700">Status</p>
				<div className="flex flex-wrap gap-2">
					{["all", "scheduled", "active", "closed", "published"].map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setFilter(s as SessionStatus | "all")}
							className={`rounded-full border px-3 py-1 text-sm transition ${
								filter === s
									? "border-ink-900 bg-ink-900 text-white"
									: "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
							}`}
						>
							{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
						</button>
					))}
				</div>
			</div>

			<div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
				{loading && (
					<p className="px-4 py-3 text-sm text-ink-600">Loading sessions…</p>
				)}
				{error && (
					<p className="px-4 py-3 text-sm text-red-600">
						{error} — try refreshing.
					</p>
				)}
				{!loading && !sessions.length && !error && (
					<p className="px-4 py-3 text-sm text-ink-600">No sessions found.</p>
				)}
				<ul className="divide-y divide-ink-100">
					{sessions.map((session) => {
						const invited = session.invites.length;
						const accepted = session.invites.filter(
							(invite) => invite.status === "accepted",
						).length;
						const publishOpen = openPublishId === session.id;
						const words = wordsBySession[session.id];
						return (
							<li key={session.id} className="p-4">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<p className="text-xs uppercase tracking-wide text-ink-500">
												{session.status}
											</p>
											{session.poem?.publishedAt && (
												<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
													Published
												</span>
											)}
										</div>
										<h3 className="text-lg font-semibold">{session.title}</h3>
										<p className="text-xs text-ink-500">
											Starts: {formatPst(session.startsAt)} · Ends:{" "}
											{formatPst(session.endsAt)}
										</p>
										<p className="text-xs text-ink-500">
											Invites accepted {accepted}/{invited}
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<Button
											variant="ghost"
											onClick={() => startPublish(session)}
										>
											{session.poem?.publishedAt ? "Republish" : "Publish"}
										</Button>
										<Button
											variant="ghost"
											disabled={publishingId === session.id}
											onClick={() => toggleDetails(session)}
										>
											{publishOpen ? "Close" : "Details"}
										</Button>
									</div>
								</div>
								{publishOpen && (
									<div className="mt-4 space-y-3 rounded-lg border border-ink-200 bg-ink-50 p-4">
										{loadingWordsFor === session.id && (
											<p className="text-sm text-ink-600">Loading words…</p>
										)}
										{!loadingWordsFor && !words && (
											<p className="text-sm text-ink-600">
												Fetching final poem state…
											</p>
										)}
										{words && (
											<div className="rounded-xl border border-ink-200 bg-white p-3 shadow-inner">
												<p className="text-xs uppercase tracking-wide text-ink-500">
													Final poem (non-editable)
												</p>
												<div className="mt-2 flex flex-wrap gap-2 text-lg leading-relaxed">
													{words.map((word) => (
														<span
															key={word.id}
															className={`rounded px-1 py-0.5 ${
																word.hidden
																	? "bg-ink-900 text-ink-900"
																	: "bg-ink-100 text-ink-900"
															}`}
														>
															<span className={word.hidden ? "opacity-0" : ""}>
																{word.text}
															</span>
														</span>
													))}
												</div>
											</div>
										)}
										<label className="flex flex-col gap-2">
											<span className="text-xs font-semibold text-ink-600">
												Publish title
											</span>
											<input
												className="rounded border border-ink-200 px-3 py-2"
												value={publishDraft.title}
												onChange={(e) =>
													setPublishDraft((prev) => ({
														...prev,
														title: e.target.value,
													}))
												}
											/>
										</label>
										<label className="flex flex-col gap-2">
											<span className="text-xs font-semibold text-ink-600">
												Publish body (auto-generated)
											</span>
											<textarea
												className="rounded border border-ink-200 px-3 py-2"
												rows={4}
												value={publishDraft.body}
												readOnly
											/>
										</label>
										<div className="flex items-center gap-3">
											<Button
												variant="primary"
												disabled={publishingId === session.id}
												onClick={() => void submitPublish(session.id)}
											>
												{publishingId === session.id
													? "Publishing…"
													: "Publish poem"}
											</Button>
											{session.poem?.publishedAt && (
												<span className="text-xs text-ink-600">
													Last published:{" "}
													{new Date(session.poem.publishedAt).toLocaleString()}
												</span>
											)}
										</div>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}

// Participant experience

type ParticipantProps = {
	sessionId: string;
	token: string;
	supabaseUrl: string;
	supabaseKey: string;
};

type SessionPhase = "lobby" | "active" | "ended";

type Word = {
	id: string;
	text: string;
	hidden: boolean;
	index: number;
	hiddenAt?: string | null;
};

type SessionMeta = {
	title: string;
	startsAt: string;
	endsAt: string;
	totalInvites: number;
};

function ParticipantView({
	sessionId,
	token,
	supabaseUrl,
	supabaseKey,
}: ParticipantProps) {
	const [phase, setPhase] = useState<SessionPhase>("lobby");
	const [session, setSession] = useState<SessionMeta | null>(null);
	const [words, setWords] = useState<Word[]>([]);
	const [connected, setConnected] = useState(0);
	const [etaMs, setEtaMs] = useState(0);
	const [busyWord, setBusyWord] = useState<string | null>(null);
	const channelRef = useRef<RealtimeChannel | null>(null);

	const supabase = useMemo(() => {
		if (!supabaseUrl || !supabaseKey) return null;
		console.info("[presence] creating supabase client", {
			supabaseUrl,
			hasKey: Boolean(supabaseKey),
		});
		return createClient(supabaseUrl, supabaseKey);
	}, [supabaseKey, supabaseUrl]);

	const updatePhase = useCallback((starts: number, ends: number) => {
		const now = Date.now();
		if (now >= ends) {
			setPhase("ended");
			setEtaMs(0);
			return;
		}
		if (now >= starts) {
			setPhase("active");
			setEtaMs(ends - now);
		} else {
			setPhase("lobby");
			setEtaMs(starts - now);
		}
	}, []);

	// Load session and update phase
	useEffect(() => {
		let interval: number | undefined;
		async function loadSession() {
			const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
			if (!response.ok) return;
			const data = await response.json();
			const starts = new Date(data.session.startsAt);
			const ends = new Date(data.session.endsAt);
			setSession({
				title: data.session.title,
				startsAt: starts.toISOString(),
				endsAt: ends.toISOString(),
				totalInvites: data.session.invites.length,
			});
			updatePhase(starts.getTime(), ends.getTime());
		}
		loadSession();
		interval = window.setInterval(loadSession, 5000);
		return () => {
			if (interval !== undefined) {
				window.clearInterval(interval);
			}
		};
	}, [sessionId, updatePhase]);

	// Load words
	useEffect(() => {
		async function loadWords() {
			const response = await fetch(
				`${API_BASE}/api/sessions/${sessionId}/words`,
			);
			if (!response.ok) return;
			const data = await response.json();
			setWords(data.words);
		}
		loadWords();
	}, [sessionId]);

	// Presence + broadcasts
	useEffect(() => {
		if (!supabase) {
			console.warn("[presence] Supabase not configured; presence disabled");
			return;
		}
		const channel = supabase.channel(`presence:${sessionId}`, {
			config: { presence: { key: token } },
		});
		channelRef.current = channel;
		console.info("[presence] subscribing", { sessionId, token });

		channel.on("presence", { event: "sync" }, () => {
			const state = channel.presenceState<Record<string, unknown>>();
			const count = Object.keys(state).length;
			console.info("[presence] sync", { count, state });
			setConnected(count);
		});

		channel.on(
			"broadcast",
			{ event: "word:update" },
			(payload: { payload: { id: string; hiddenAt?: string | null } }) => {
				setWords((prev) =>
					prev.map((w) =>
						w.id === payload.payload.id
							? { ...w, hidden: true, hiddenAt: payload.payload.hiddenAt }
							: w,
					),
				);
			},
		);

		channel.subscribe((status: string) => {
			console.info("[presence] status", { status });
			if (status === "SUBSCRIBED") {
				channel.track({ joinedAt: new Date().toISOString() });
			}
		});

		return () => {
			console.info("[presence] unsubscribing", { sessionId });
			channelRef.current = null;
			supabase.removeChannel(channel);
		};
	}, [sessionId, supabase, token]);

	// Countdown updater
	useEffect(() => {
		if (!session) return;
		const starts = new Date(session.startsAt).getTime();
		const ends = new Date(session.endsAt).getTime();
		const id = window.setInterval(() => updatePhase(starts, ends), 1000);
		return () => window.clearInterval(id);
	}, [session, updatePhase]);

	async function handleBlackout(wordId: string) {
		if (phase !== "active") return;
		setBusyWord(wordId);
		try {
			const response = await fetch(`${API_BASE}/api/words/${wordId}/hide`, {
				method: "PATCH",
				headers: { "x-actor-id": token },
			});
			if (!response.ok) throw new Error("Failed to hide word");
			const data = await response.json();
			setWords((prev) =>
				prev.map((w) =>
					w.id === wordId
						? { ...w, hidden: true, hiddenAt: data.word.hiddenAt }
						: w,
				),
			);
			channelRef.current?.send({
				type: "broadcast",
				event: "word:update",
				payload: { id: wordId, hiddenAt: data.word.hiddenAt },
			});
		} catch (error) {
			console.error(error);
		} finally {
			setBusyWord(null);
		}
	}

	const totalWords = words.length;
	const hiddenCount = words.filter((w) => w.hidden).length;

	return (
		<main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-wide text-ink-500">
						Found Poems
					</p>
					<h1 className="text-xl font-semibold">
						{session?.title ?? "Loading session"}
					</h1>
					{session && (
						<p className="text-xs text-ink-500">
							Starts (PST): {formatPst(session.startsAt)} · Ends (PST):{" "}
							{formatPst(session.endsAt)}
						</p>
					)}
				</div>
				<div className="flex items-center gap-4 text-sm text-ink-600">
					<span>
						Connected {connected}
						{session?.totalInvites ? ` / ${session.totalInvites}` : ""}
					</span>
					{session && <Timer etaMs={etaMs} phase={phase} />}
				</div>
			</header>

			{phase === "lobby" && <Lobby etaMs={etaMs} />}
			{phase === "active" && (
				<ActiveBoard
					words={words}
					onBlackout={handleBlackout}
					busyWord={busyWord}
					hiddenCount={hiddenCount}
					totalWords={totalWords}
				/>
			)}
			{phase === "ended" && <Ended />}
		</main>
	);
}

function Lobby({ etaMs }: { etaMs: number }) {
	return (
		<section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
			<p className="text-sm text-ink-600">Your session will begin soon.</p>
			<p className="text-4xl font-semibold">
				{etaMs > 0 ? formatDuration(etaMs) : "Starting now"}
			</p>
			<p className="text-sm text-ink-500">
				Stay on this page; it will start automatically.
			</p>
		</section>
	);
}

function ActiveBoard({
	words,
	onBlackout,
	busyWord,
	hiddenCount,
	totalWords,
}: {
	words: Word[];
	onBlackout: (id: string) => void;
	busyWord: string | null;
	hiddenCount: number;
	totalWords: number;
}) {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between text-sm text-ink-600">
				<span>Words remaining: {totalWords - hiddenCount}</span>
				<span>Blacked out: {hiddenCount}</span>
			</div>
			<div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap gap-2 text-lg leading-relaxed">
					{words.map((word) => (
						<button
							key={word.id}
							disabled={word.hidden || busyWord === word.id}
							type="button"
							onClick={() => onBlackout(word.id)}
							className={`rounded px-1 py-0.5 transition-colors ${
								word.hidden ? "bg-ink-900 text-ink-900" : "hover:bg-ink-100"
							}`}
						>
							<span className={word.hidden ? "opacity-0" : ""}>
								{word.text}
							</span>
						</button>
					))}
				</div>
			</div>
		</section>
	);
}

function Ended() {
	return (
		<section className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-ink-200 bg-white p-10 text-center shadow-sm">
			<h2 className="text-2xl font-semibold">Time's up!</h2>
			<p className="text-sm text-ink-600">
				Thank you for participating. Your found poem has been captured.
			</p>
		</section>
	);
}

function Timer({ etaMs, phase }: { etaMs: number; phase: SessionPhase }) {
	const label = phase === "active" ? "Time remaining" : "Starts in";
	const value =
		etaMs > 0
			? formatDuration(etaMs)
			: phase === "active"
				? "Ending"
				: "Starting";
	return (
		<div className="rounded-full border border-ink-200 px-3 py-1 text-sm text-ink-700">
			{label}: {value}
		</div>
	);
}

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60)
		.toString()
		.padStart(2, "0");
	const seconds = (totalSeconds % 60).toString().padStart(2, "0");
	return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function formatPst(iso: string) {
	return new Date(iso).toLocaleString("en-US", {
		timeZone: "America/Los_Angeles",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});
}

function randomHex() {
	return crypto
		.getRandomValues(new Uint8Array(8))
		.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}
