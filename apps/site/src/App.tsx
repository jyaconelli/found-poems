import { useEffect, useState } from "react";

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

export default function App() {
  const [poems, setPoems] = useState<Poem[]>([]);
  const [wordsBySession, setWordsBySession] = useState<Record<string, Word[]>>(
    {}
  );
  const [loadingWords, setLoadingWords] = useState(false);
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
        if (mounted && (data.poems?.length ?? 0) > 0) {
          setLoadingWords(true);
          const wordResults = await Promise.all(
            data.poems.map(async (poem: Poem) => {
              const resp = await fetch(
                `${API_BASE}/api/sessions/${poem.sessionId}/words`
              );
              const json = await resp.json().catch(() => ({}));
              if (!resp.ok) return { sessionId: poem.sessionId, words: [] };
              const sorted =
                (json.words ?? []).sort(
                  (a: Word, b: Word) => a.index - b.index
                ) ?? [];
              return { sessionId: poem.sessionId, words: sorted };
            })
          );
          if (mounted) {
            setWordsBySession(
              wordResults.reduce<Record<string, Word[]>>((acc, item) => {
                acc[item.sessionId] = item.words;
                return acc;
              }, {})
            );
            setLoadingWords(false);
          }
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
    <main className="flex min-h-screen flex-col items-center gap-6 bg-black px-6 py-16 text-center">
      <p className="text-sm invert hue-rotate-180 uppercase tracking-wide text-neutral-300">
        Found Poems
      </p>
      <p className="text-sm invert hue-rotate-180 tracking-wide text-neutral-300">
        made together
      </p>

      <section className="mt-10 w-full max-w-3xl text-left">
        <header className="mb-4 flex items-center justify-between">
          {/* <h2 className="text-xl font-semibold">Recently published</h2> */}
          {/* <span className="text-sm text-ink-500">Powered by {API_BASE}</span> */}
        </header>
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
