import { Button } from "@found-poems/ui";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export default function App() {
	const client = useMemo(() => {
		if (!supabaseUrl || !supabaseKey) {
			return null;
		}

		return createClient(supabaseUrl, supabaseKey, {
			auth: {
				persistSession: false,
			},
		});
	}, []);

	const [status, setStatus] = useState<"disconnected" | "connected">(
		"disconnected",
	);

	useEffect(() => {
		if (!client) return;
		let mounted = true;

		client
			.channel("healthcheck")
			.on("broadcast", { event: "ping" }, () => {
				if (mounted) {
					setStatus("connected");
				}
			})
			.subscribe((event) => {
				if (event === "SUBSCRIBED") {
					client
						.channel("healthcheck")
						.send({ type: "broadcast", event: "ping", payload: {} });
				}
			});

		return () => {
			mounted = false;
			client.removeChannel(client.channel("healthcheck"));
		};
	}, [client]);

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 py-16">
			<h1 className="text-3xl font-semibold">Found Poems Studio</h1>
			<p className="text-base text-ink-600">
				Supabase status:{" "}
				<span className="font-mono">
					{client ? status : "missing env vars"}
				</span>
			</p>
			<Button
				variant="primary"
				onClick={() => alert("Session scaffolding coming soon!")}
			>
				Create Session
			</Button>
		</main>
	);
}
