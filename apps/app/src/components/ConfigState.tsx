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

export default ConfigState;
