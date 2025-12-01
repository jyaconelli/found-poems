import { Button } from "@found-poems/ui";
import { useMemo, useState } from "react";
import { API_BASE } from "../../constants";
import {
	formatLocalDateTimeInput,
	toUtcISOStringFromLocalInput,
} from "../../utils/datetime";
import CreateSessionForm from "./CreateSessionForm";
import SessionsTab from "./SessionsTab";

type Props = {
	configStatus: "loading" | "ready" | "error";
	authToken: string;
	userEmail: string;
	onSignOut: () => void;
};

function AdminScheduler({
	configStatus,
	authToken,
	userEmail,
	onSignOut,
}: Props) {
	const defaultSource = `We stood at the shoreline, collecting words that felt half-remembered and
half-new. Thunderheads gathered to the west, but the workshop continued and we
kept striking lines, trusting that the time-box would carry us through.`;

	const [activeTab, setActiveTab] = useState<"create" | "sessions">("create");

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

export default AdminScheduler;
