import { Button } from "@found-poems/ui";
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

type Poem = {
	id: string;
	title: string;
	body: string;
	publishedAt: string | null;
};

export default function App() {
	const [poems, setPoems] = useState<Poem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		async function loadPoems() {
			try {
				const response = await fetch(`${API_BASE}/api/poems`);
				const data = await response.json();
				if (!response.ok) {
					throw new Error(data.message ?? "Failed to load poems");
				}
				if (mounted) {
					setPoems(data.poems ?? []);
				}
			} catch (error) {
				console.error(error);
			} finally {
				if (mounted) setLoading(false);
			}
		}

		loadPoems();
		return () => {
			mounted = false;
		};
	}, []);

	return (
		<main className="flex min-h-screen flex-col items-center gap-6 bg-white px-6 py-16 text-center">
			<p className="text-sm uppercase tracking-wide text-ink-500">
				Found Poems
			</p>
			<h1 className="max-w-2xl text-4xl font-semibold leading-tight">
				Collaborative blackout poetry sessions for classrooms, festivals, and
				creative labs.
			</h1>
			<p className="max-w-xl text-base text-ink-600">
				Schedule ten-minute sessions, invite your collaborators, and publish the
				finished poems with a single click.
			</p>
			<div className="flex gap-3">
				<Button variant="primary">Notify Me</Button>
				<Button variant="ghost">See Sample Poem</Button>
			</div>

			<section className="mt-10 w-full max-w-3xl text-left">
				<header className="mb-4 flex items-center justify-between">
					<h2 className="text-xl font-semibold">Recently published</h2>
					<span className="text-sm text-ink-500">Powered by {API_BASE}</span>
				</header>
				{loading && <p className="text-sm text-ink-500">Loading poems…</p>}
				{!loading && poems.length === 0 && (
					<p className="text-sm text-ink-500">
						No poems yet. Publish one from the studio to see it here.
					</p>
				)}
				<div className="grid gap-4">
					{poems.map((poem) => (
						<article
							key={poem.id}
							className="rounded-xl border border-ink-200 bg-ink-50/60 p-4"
						>
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium">{poem.title}</h3>
								{poem.publishedAt && (
									<time className="text-xs text-ink-500">
										{new Date(poem.publishedAt).toLocaleString()}
									</time>
								)}
							</div>
							<p className="mt-2 whitespace-pre-line text-sm text-ink-700">
								{poem.body}
							</p>
						</article>
					))}
				</div>
			</section>
		</main>
	);
}
