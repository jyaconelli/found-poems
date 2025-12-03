import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  (import.meta as ImportMeta & { env: { VITE_SERVER_URL: string } }).env
    .VITE_SERVER_URL ?? "http://localhost:4000";

type Poem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  sessionId: string;
};

type Word = {
  id: string;
  text: string;
  hidden: boolean;
  index: number;
};

type Stream = {
  id: string;
  title: string;
  slug: string;
  maxParticipants: number;
  minParticipants: number;
  durationMinutes: number;
  timeOfDay: string;
  autoPublish: boolean;
  collaboratorCount?: number;
};

export default function App() {
  const streamSlug = useMemo(() => {
    const match = window.location.pathname.match(/\/poem-streams\/([^/]+)/);
    return match?.[1] ?? null;
  }, []);

  if (streamSlug) {
    return <StreamPage slug={streamSlug} />;
  }

  return <HomePage />;
}

function HomePage() {
  const [poems, setPoems] = useState<Poem[]>([]);
  const [wordsBySession, setWordsBySession] = useState<Record<string, Word[]>>(
    {},
  );
  const [loadingWords, setLoadingWords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadPoems = useCallback(async (cursor?: string, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(
        `${API_BASE}/api/poems?${params.toString()}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to load poems");
      }
      const newPoems: Poem[] = data.poems ?? [];
      setPoems((prev) => (append ? [...prev, ...newPoems] : newPoems));
      setNextCursor(data.nextCursor ?? null);

      if (newPoems.length > 0) {
        setLoadingWords(true);
        const wordResults = await Promise.all(
          newPoems.map(async (poem: Poem) => {
            const resp = await fetch(
              `${API_BASE}/api/sessions/${poem.sessionId}/words`,
            );
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok) return { sessionId: poem.sessionId, words: [] };
            const sorted =
              (json.words ?? []).sort(
                (a: Word, b: Word) => a.index - b.index,
              ) ?? [];
            return { sessionId: poem.sessionId, words: sorted };
          }),
        );
        setWordsBySession((prev) => ({
          ...prev,
          ...wordResults.reduce<Record<string, Word[]>>((acc, item) => {
            acc[item.sessionId] = item.words;
            return acc;
          }, {}),
        }));
        setLoadingWords(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPoems();
  }, [loadPoems]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && nextCursor && !loadingMore) {
          void loadPoems(nextCursor, true);
        }
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loadPoems]);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-black px-6 py-16 text-center">
      <p className="text-sm invert hue-rotate-180 uppercase tracking-wide text-neutral-300">
        Found Poems
      </p>
      <p className="text-sm invert hue-rotate-180 tracking-wide text-neutral-300">
        made together
      </p>

      <section className="mt-10 w-full max-w-3xl text-left">
        {loading && <p className="text-sm text-ink-500">Loading poems…</p>}
        {!loading && poems.length === 0 && (
          <p className="text-sm text-ink-500">
            No poems yet. Publish one from the studio to see it here.
          </p>
        )}
        <div className="grid gap-4">
          {poems.map((poem) => (
            <article key={poem.id} className="bg-white/90 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg text-black font-medium">{poem.title}</h3>
                {poem.publishedAt && (
                  <time className="text-xs text-black/50">
                    {new Date(poem.publishedAt).toLocaleString()}
                  </time>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {loadingWords && (
                  <p className="text-sm text-ink-500">Loading blackout view…</p>
                )}
                {!loadingWords && (
                  <BlackoutPoem words={wordsBySession[poem.sessionId]} />
                )}
              </div>
            </article>
          ))}
          <div ref={loadMoreRef} className="h-1" />
          {loadingMore && (
            <p className="text-sm text-ink-500">Loading more poems…</p>
          )}
        </div>
      </section>
    </main>
  );
}

function StreamPage({ slug }: { slug: string }) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [wordsBySession, setWordsBySession] = useState<Record<string, Word[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [loadingWords, setLoadingWords] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadStreamPoems = useCallback(
    async (cursor?: string, append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(
          `${API_BASE}/api/poem-streams/${slug}?${params.toString()}`,
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message ?? "Failed to load stream");

        if (!append) setStream(data.stream);
        const newPoems: Poem[] = data.poems ?? [];
        setPoems((prev) => (append ? [...prev, ...newPoems] : newPoems));
        setNextCursor(data.nextCursor ?? null);

        if (newPoems.length > 0) {
          setLoadingWords(true);
          const wordResults = await Promise.all(
            newPoems.map(async (poem: Poem) => {
              const resp = await fetch(
                `${API_BASE}/api/sessions/${poem.sessionId}/words`,
              );
              const json = await resp.json().catch(() => ({}));
              if (!resp.ok) return { sessionId: poem.sessionId, words: [] };
              const sorted =
                (json.words ?? []).sort(
                  (a: Word, b: Word) => a.index - b.index,
                ) ?? [];
              return { sessionId: poem.sessionId, words: sorted };
            }),
          );
          setWordsBySession((prev) => ({
            ...prev,
            ...wordResults.reduce<Record<string, Word[]>>((acc, item) => {
              acc[item.sessionId] = item.words;
              return acc;
            }, {}),
          }));
          setLoadingWords(false);
        }
      } catch (err) {
        console.error(err);
        setMessage("Unable to load this stream right now.");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    void loadStreamPoems();
  }, [loadStreamPoems]);

  useEffect(() => {
    if (!nextCursor) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && nextCursor && !loadingMore) {
          void loadStreamPoems(nextCursor, true);
        }
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loadStreamPoems]);

  const joinStream = async () => {
    if (!email.trim()) return;
    setJoining(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/poem-streams/${slug}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? "Unable to join stream");
      setMessage(
        "You're on the collaborator list. Watch your inbox for invites!",
      );
      setEmail("");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Unable to join stream");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-center text-white">
        <p>Loading stream…</p>
      </main>
    );
  }

  if (!stream) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-center text-white">
        <p>Stream not found.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-black px-6 py-16 text-center">
      <p className="text-sm invert hue-rotate-180 uppercase tracking-wide text-neutral-300">
        Poem Stream
      </p>
      <h1 className="text-2xl font-semibold text-white">{stream.title}</h1>
      <p className="text-sm text-neutral-300">
        Daily at {stream.timeOfDay} · Duration {stream.durationMinutes}m ·{" "}
        {stream.autoPublish ? "Auto-publishes" : "Manual publish"}
      </p>
      <p className="text-sm text-neutral-300">
        Collaborators: {stream.collaboratorCount ?? 0} · Min/Max{" "}
        {stream.minParticipants}/{stream.maxParticipants}
      </p>

      <div className="w-full max-w-xl rounded-2xl bg-white/90 p-5 text-left text-black">
        <h2 className="text-lg font-semibold">Join this stream</h2>
        <p className="text-sm text-ink-600">
          Enter your email to get invites when new sessions spin up from the RSS
          feed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="flex-1 rounded border border-ink-200 px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void joinStream()}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
            disabled={joining}
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-ink-600">{message}</p>}
      </div>

      <section className="mt-6 w-full max-w-3xl text-left">
        <h2 className="mb-3 text-lg font-semibold text-white">
          Published poems
        </h2>
        {poems.length === 0 && (
          <p className="text-sm text-neutral-300">
            No poems for this stream yet. Check back after the next session.
          </p>
        )}
        <div className="grid gap-4">
          {poems.map((poem) => (
            <article key={poem.id} className="bg-white/90 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg text-black font-medium">{poem.title}</h3>
                {poem.publishedAt && (
                  <time className="text-xs text-black/50">
                    {new Date(poem.publishedAt).toLocaleString()}
                  </time>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {loadingWords && (
                  <p className="text-sm text-ink-500">Loading blackout view…</p>
                )}
                {!loadingWords && (
                  <BlackoutPoem words={wordsBySession[poem.sessionId]} />
                )}
              </div>
            </article>
          ))}
          <div ref={loadMoreRef} className="h-1" />
          {loadingMore && (
            <p className="text-sm text-neutral-300">Loading more poems…</p>
          )}
        </div>
      </section>
    </main>
  );
}

function BlackoutPoem({ words }: { words?: Word[] }) {
  if (!words || words.length === 0) {
    return (
      <p className="text-sm text-ink-600">
        No poem words available yet. Publish from the admin console to render
        blackout view.
      </p>
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink-500"></p>
        <button type="button"></button>
      </div>
      <div className="bg-black p-3">
        <div className={`flex flex-wrap text-lg leading-relaxed`}>
          {words.map((word) => (
            <span
              key={word.id}
              className={`px-1 py-0.5 transition-all duration-300 ${
                word.hidden
                  ? "bg-black text-black opacity-0"
                  : "bg-transparent text-white"
              }`}
            >
              <span
                className={word.hidden ? "opacity-0" : "invert hue-rotate-180"}
              >
                {word.text}
              </span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
