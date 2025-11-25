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

	const [title, setTitle] = useState("Evening Lab");
	const [startsAt, setStartsAt] = useState(() =>
		new Date(Date.now() + 3_600_000).toISOString().slice(0, 16),
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
			const response = await fetch(`${API_BASE}/api/sessions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authorization: `Bearer ${authToken}`,
				},
				body: JSON.stringify({
					title,
					startsAt,
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
				<h1 className="text-3xl font-semibold">
					Schedule a collaboration session
				</h1>
				<p className="text-base text-ink-600">
					This form hits the Express server (`{API_BASE}`) which orchestrates
					Supabase (Postgres + invites + words).
				</p>
			</header>

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
						value={startsAt}
						onChange={(event) => setStartsAt(event.target.value)}
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
					onClick={handleCreate}
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
		</main>
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
		return () => interval && window.clearInterval(interval);
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
