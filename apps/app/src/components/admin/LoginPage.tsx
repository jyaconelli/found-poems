import { Button } from "@found-poems/ui";
import { useState } from "react";

type Props = {
	onSubmit: (email: string, password: string) => Promise<void> | void;
	loading: boolean;
	error: string | null;
};

function LoginPage({ onSubmit, loading, error }: Props) {
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

export default LoginPage;
