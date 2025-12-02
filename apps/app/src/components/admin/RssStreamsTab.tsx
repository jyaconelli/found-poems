import { Button } from "@found-poems/ui";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../constants";
import type { RssStreamAdminListItem } from "../../types/rssStreams";

type Props = { authToken: string };

type Draft = {
  title: string;
  rssUrl: string;
  maxParticipants: number;
  minParticipants: number;
  durationMinutes: number;
  timeOfDay: string;
  autoPublish: boolean;
};

const emptyDraft: Draft = {
  title: "",
  rssUrl: "",
  maxParticipants: 10,
  minParticipants: 2,
  durationMinutes: 30,
  timeOfDay: "09:00",
  autoPublish: true,
};

function RssStreamsTab({ authToken }: Props) {
  const [streams, setStreams] = useState<RssStreamAdminListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const hasStreams = useMemo(() => streams.length > 0, [streams]);

  useEffect(() => {
    let active = true;
    async function loadStreams() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/admin/rss-streams`, {
          headers: { authorization: `Bearer ${authToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Failed to load streams",
          );
        }
        if (active) setStreams(data.streams ?? []);
      } catch (err) {
        console.error(err);
        if (active) setError("Unable to load streams. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadStreams();
    return () => {
      active = false;
    };
  }, [authToken]);

  const updateDraft = (key: keyof Draft, value: Draft[keyof Draft]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const createStream = async () => {
    if (!draft.title.trim() || !draft.rssUrl.trim()) {
      setError("Title and RSS link are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/rss-streams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Failed to create stream",
        );
      }
      setStreams((prev) => [data.stream, ...prev]);
      setShowModal(false);
      setDraft(emptyDraft);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to create stream right now",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">
            RSS Poem Streams
          </p>
          <p className="text-sm text-ink-600">
            Create streams that convert RSS updates into live collaborations.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>Create new stream</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
        {loading && (
          <p className="px-4 py-3 text-sm text-ink-600">Loading streams…</p>
        )}
        {!loading && !hasStreams && (
          <p className="px-4 py-3 text-sm text-ink-600">
            No RSS poem streams yet. Create one to start ingesting updates.
          </p>
        )}
        <ul className="divide-y divide-ink-100">
          {streams.map((stream) => (
            <li key={stream.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-ink-500">
                    {stream.slug}
                  </p>
                  <h3 className="text-lg font-semibold">{stream.title}</h3>
                  <p className="text-xs text-ink-500">
                    RSS: {stream.rssUrl}
                  </p>
                  <p className="text-xs text-ink-500">
                    Time: {stream.timeOfDay} · Duration: {stream.durationMinutes}
                    m · Min/Max: {stream.minParticipants}/
                    {stream.maxParticipants}
                  </p>
                  <p className="text-xs text-ink-500">
                    Collaborators:{" "}
                    {stream._count?.collaborators ?? stream.collaboratorCount ?? 0}
                    {" · "}Sessions: {stream._count?.sessions ?? stream.sessionsCount ?? 0}
                  </p>
                  {stream.autoPublish && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Auto-publish enabled
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 text-right text-xs text-ink-500">
                  {stream.lastItemPublishedAt && (
                    <span>
                      Last item:{" "}
                      {new Date(stream.lastItemPublishedAt).toLocaleString()}
                    </span>
                  )}
                  <span>Created: {stream.createdAt && new Date(stream.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-ink-500">
                Public page: /poem-streams/{stream.slug}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">
                  New RSS Poem Stream
                </p>
                <h3 className="text-xl font-semibold">Create stream</h3>
              </div>
              <button
                type="button"
                className="text-sm text-ink-500"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink-700">Title</span>
                <input
                  className="rounded border border-ink-200 px-3 py-2"
                  value={draft.title}
                  onChange={(e) => updateDraft("title", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink-700">RSS link</span>
                <input
                  className="rounded border border-ink-200 px-3 py-2"
                  value={draft.rssUrl}
                  onChange={(e) => updateDraft("rssUrl", e.target.value)}
                  placeholder="https://example.com/feed.xml"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink-700">
                    Max participants
                  </span>
                  <input
                    type="number"
                    className="rounded border border-ink-200 px-3 py-2"
                    value={draft.maxParticipants}
                    min={1}
                    onChange={(e) =>
                      updateDraft("maxParticipants", Number(e.target.value))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink-700">
                    Min participants
                  </span>
                  <input
                    type="number"
                    className="rounded border border-ink-200 px-3 py-2"
                    value={draft.minParticipants}
                    min={1}
                    onChange={(e) =>
                      updateDraft("minParticipants", Number(e.target.value))
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink-700">
                    Session duration (minutes)
                  </span>
                  <input
                    type="number"
                    className="rounded border border-ink-200 px-3 py-2"
                    value={draft.durationMinutes}
                    min={1}
                    onChange={(e) =>
                      updateDraft("durationMinutes", Number(e.target.value))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-ink-700">
                    Time of day (HH:MM)
                  </span>
                  <input
                    className="rounded border border-ink-200 px-3 py-2"
                    value={draft.timeOfDay}
                    onChange={(e) => updateDraft("timeOfDay", e.target.value)}
                    placeholder="09:00"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.autoPublish}
                  onChange={(e) => updateDraft("autoPublish", e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-ink-700">
                  Auto-publish when a session ends
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={saving}
                onClick={() => void createStream()}
              >
                {saving ? "Creating…" : "Create stream"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default RssStreamsTab;
