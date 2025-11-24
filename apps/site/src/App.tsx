import { Button } from "@found-poems/ui";

export default function App() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 py-16 text-center">
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
		</main>
	);
}
