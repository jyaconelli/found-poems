import { Button } from "@found-poems/ui";
import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

const defaultSource = `We stood at the shoreline, collecting words that felt half-remembered and
half-new. Thunderheads gathered to the west, but the workshop continued and we
kept striking lines, trusting that the time-box would carry us through.`;

export default function App() {
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
	const inviteEmails = useMemo(
		() =>
			inviteList
				.split(/[,\n]/)
				.map((value) => value.trim())
				.filter(Boolean),
		[inviteList],
	);

	async function handleCreate() {
		setStatus("pending");
		setResult(null);

		try {
			const response = await fetch(`${API_BASE}/api/sessions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					startsAt,
					durationMinutes,
					source: { title: sourceTitle, body: sourceBody },
					inviteEmails,
				}),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message ?? "Unable to schedule session");
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
		}
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
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
				{status === "error" && (
					<span className="text-sm text-red-600">
						Something went wrong. Check server logs.
					</span>
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
