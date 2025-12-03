import { Button } from "@found-poems/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../constants";
import type {
  RssStreamAdminListItem,
  StreamValidationPreview,
  StreamValidationTree,
} from "../../types/rssStreams";

type Props = { authToken: string };

type Draft = {
  title: string;
  rssUrl: string;
  maxParticipants: number;
  minParticipants: number;
  durationMinutes: number;
  timeOfDay: string;
  autoPublish: boolean;
  contentPaths: string[];
};

const emptyDraft: Draft = {
  title: "",
  rssUrl: "",
  maxParticipants: 10,
  minParticipants: 2,
  durationMinutes: 30,
  timeOfDay: "09:00",
  autoPublish: true,
  contentPaths: [],
};

type TreeViewProps = {
  node: StreamValidationTree;
  expanded: Set<string>;
  toggleExpanded: (path: string) => void;
  selectedPaths: string[];
  toggleSelectedPath: (path: string) => void;
};

function TreeView({
  node,
  expanded,
  toggleExpanded,
  selectedPaths,
  toggleSelectedPath,
}: TreeViewProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(node.path) || node.path === "";
  const selectable = node.type === "string" || node.type === "number";
  return (
    <div className="pl-2">
      <div className="flex items-start gap-2 py-0.5">
        {hasChildren ? (
          <button
            type="button"
            className="text-xs text-ink-600"
            onClick={() => toggleExpanded(node.path)}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="text-xs text-ink-300">•</span>
        )}
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-2 text-xs">
            {selectable && (
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={selectedPaths.includes(node.path)}
                onChange={() => toggleSelectedPath(node.path)}
              />
            )}
            <span className="font-mono text-ink-700">{node.key}</span>
            <span className="text-ink-400">({node.type})</span>
          </div>
          {node.preview && (
            <div className="rounded bg-ink-50 px-2 py-1 text-xs text-ink-700">
              {node.preview}
            </div>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="border-l border-ink-100 pl-3">
          {node.children?.map((child) => (
            <TreeView
              key={child.path}
              node={child}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              selectedPaths={selectedPaths}
              toggleSelectedPath={toggleSelectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RssStreamsTab({ authToken }: Props) {
  const [streams, setStreams] = useState<RssStreamAdminListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] =
    useState<StreamValidationPreview | null>(null);
  const [tree, setTree] = useState<StreamValidationTree | null>(null);
  const [phase, setPhase] = useState<"edit" | "preview">("edit");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [editingStream, setEditingStream] =
    useState<RssStreamAdminListItem | null>(null);

  const hasStreams = useMemo(() => streams.length > 0, [streams]);

  useEffect(() => {
    let active = true;
    async function loadStreams(cursor?: string, append = false) {
      append ? setLoadingMore(true) : setLoading(true);
      if (!append) setNextCursor(null);
      if (!append) setStreams([]);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(
          `${API_BASE}/api/admin/rss-streams?${params.toString()}`,
          {
            headers: { authorization: `Bearer ${authToken}` },
          },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Failed to load streams",
          );
        }
        if (active) {
          setStreams((prev) =>
            append ? [...prev, ...(data.streams ?? [])] : data.streams ?? [],
          );
          setNextCursor(data.nextCursor ?? null);
        }
      } catch (err) {
        console.error(err);
        if (active) setError("Unable to load streams. Try again.");
      } finally {
        if (active) {
          append ? setLoadingMore(false) : setLoading(false);
        }
      }
    }
    void loadStreams();
    return () => {
      active = false;
    };
  }, [authToken]);

  useEffect(() => {
    if (!nextCursor) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && nextCursor && !loadingMore) {
          // reuse load logic by calling fetch again via fetch API
          void (async () => {
            const params = new URLSearchParams();
            params.set("limit", "20");
            params.set("cursor", nextCursor);
            try {
              setLoadingMore(true);
              const response = await fetch(
                `${API_BASE}/api/admin/rss-streams?${params.toString()}`,
                { headers: { authorization: `Bearer ${authToken}` } },
              );
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.message ?? "Failed");
              setStreams((prev) => [...prev, ...(data.streams ?? [])]);
              setNextCursor(data.nextCursor ?? null);
            } catch (err) {
              console.error(err);
              setError("Unable to load more streams.");
            } finally {
              setLoadingMore(false);
            }
          })();
        }
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, authToken, loadingMore]);

  const updateDraft = (key: keyof Draft, value: Draft[keyof Draft]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (validation) setValidation(null);
    if (phase !== "edit") setPhase("edit");
    if (tree) setTree(null);
  };

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleSelectedPath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      setDraft((prevDraft) => ({ ...prevDraft, contentPaths: next }));
      return next;
    });
  };

  const resetModal = () => {
    setShowModal(false);
    setDraft(emptyDraft);
    setValidation(null);
    setTree(null);
    setPhase("edit");
    setSelectedPaths([]);
    setExpanded(new Set());
    setEditingStream(null);
    setError(null);
    setSaving(false);
    setValidating(false);
  };

  const validateStream = async () => {
    if (!draft.title.trim() || !draft.rssUrl.trim()) {
      setError("Title and RSS link are required.");
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/rss-streams/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ ...draft, contentPaths: selectedPaths }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Failed to validate stream",
        );
      }
      setValidation(data.preview ?? null);
      setTree(data.tree ?? null);
      const nextPaths = data.selectedPaths ?? selectedPaths;
      setSelectedPaths(nextPaths);
      setDraft((prevDraft) => ({ ...prevDraft, contentPaths: nextPaths }));
      setPhase("preview");
    } catch (err) {
      console.error(err);
      setValidation(null);
      setTree(null);
      setPhase("edit");
      setError(err instanceof Error ? err.message : "Unable to validate stream");
    } finally {
      setValidating(false);
    }
  };

  const createStream = async () => {
    if (!validation) {
      setError("Run validation before creating the stream.");
      return;
    }
    if (!draft.title.trim() || !draft.rssUrl.trim()) {
      setError("Title and RSS link are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingStream
        ? `${API_BASE}/api/admin/rss-streams/${editingStream.id}`
        : `${API_BASE}/api/admin/rss-streams`;
      const method = editingStream ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ ...draft, contentPaths: selectedPaths }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Failed to create stream",
        );
      }
      if (editingStream) {
        setStreams((prev) =>
          prev.map((s) => (s.id === data.stream.id ? data.stream : s)),
        );
      } else {
        setStreams((prev) => [data.stream, ...prev]);
      }
      resetModal();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : editingStream
            ? "Unable to update stream right now"
            : "Unable to create stream right now",
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
        <Button
          onClick={() => {
            setShowModal(true);
            setDraft(emptyDraft);
            setValidation(null);
            setPhase("edit");
            setError(null);
            setSelectedPaths([]);
            setTree(null);
            setExpanded(new Set());
            setEditingStream(null);
          }}
        >
          Create new stream
        </Button>
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
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Button
                  className="text-xs"
                  variant="ghost"
                  onClick={() => {
                    setEditingStream(stream);
                    setDraft({
                      title: stream.title,
                      rssUrl: stream.rssUrl,
                      maxParticipants: stream.maxParticipants,
                      minParticipants: stream.minParticipants,
                      durationMinutes: stream.durationMinutes,
                      timeOfDay: stream.timeOfDay,
                      autoPublish: stream.autoPublish,
                      contentPaths: stream.contentPaths ?? [],
                    });
                    setSelectedPaths(stream.contentPaths ?? []);
                    setValidation(null);
                    setTree(null);
                    setPhase("edit");
                    setExpanded(new Set());
                    setShowModal(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  className="text-xs"
                  variant="ghost"
                  onClick={async () => {
                    if (!window.confirm("Delete this stream?")) return;
                    try {
                      const response = await fetch(
                        `${API_BASE}/api/admin/rss-streams/${stream.id}`,
                        {
                          method: "DELETE",
                          headers: { authorization: `Bearer ${authToken}` },
                        },
                      );
                      if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(
                          typeof data.message === "string"
                            ? data.message
                            : "Failed to delete stream",
                        );
                      }
                      setStreams((prev) => prev.filter((s) => s.id !== stream.id));
                    } catch (err) {
                      console.error(err);
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Unable to delete stream right now",
                      );
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div ref={loadMoreRef} className="h-1" />
        {loadingMore && (
          <p className="px-4 py-3 text-sm text-ink-600">Loading more…</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">
                  {editingStream ? "Edit RSS Poem Stream" : "New RSS Poem Stream"}
                </p>
                <h3 className="text-xl font-semibold">
                  {editingStream ? "Update stream" : "Create stream"}
                </h3>
              </div>
              <button
                type="button"
                className="text-sm text-ink-500"
                onClick={resetModal}
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

            {tree && (
              <div className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-500">
                      Latest feed item tree
                    </p>
                    <p className="text-sm text-ink-600">
                      Check the parts to include (concatenated in order).
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedPaths([]);
                      setDraft((prev) => ({ ...prev, contentPaths: [] }));
                    }}
                  >
                    Clear selection
                  </Button>
                </div>

                <div className="max-h-64 overflow-auto rounded border border-ink-200 bg-white p-3 text-sm">
                  <TreeView
                    node={tree}
                    expanded={expanded}
                    toggleExpanded={toggleExpanded}
                    selectedPaths={selectedPaths}
                    toggleSelectedPath={toggleSelectedPath}
                  />
                </div>
              </div>
            )}

            {phase === "preview" && validation && (
              <div className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-ink-500">
                      Validation preview
                    </p>
                    <h4 className="text-lg font-semibold">
                      {validation.sessionTitle || validation.itemTitle}
                    </h4>
                    <p className="text-xs text-ink-600">
                      Latest feed item published {" "}
                      {new Date(validation.itemPublishedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-ink-600">
                      Next session starts at {" "}
                      {new Date(validation.startsAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1 text-right text-xs text-ink-600">
                    <p>Duration: {validation.durationMinutes} minutes</p>
                    <p>Time of day: {validation.timeOfDay}</p>
                    <p>Words detected: {validation.wordCount}</p>
                    {validation.autoPublish && (
                      <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Auto-publish enabled
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-ink-500">
                    Source preview
                  </p>
                  <div className="max-h-60 overflow-auto rounded border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed text-ink-800">
                    {validation.sourceBody}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="ghost" onClick={resetModal}>
                Cancel
              </Button>
                  {phase === "preview" ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setPhase("edit");
                          setValidation(null);
                          setTree(null);
                        }}
                      >
                        Back to edit
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={validating}
                        onClick={() => void validateStream()}
                      >
                        {validating ? "Updating…" : "Update preview"}
                      </Button>
                      <Button
                        variant="primary"
                        disabled={saving}
                        onClick={() => void createStream()}
                      >
                        {saving
                          ? editingStream
                            ? "Saving…"
                            : "Creating…"
                          : editingStream
                            ? "Save changes"
                            : "Create stream"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                  disabled={validating}
                  onClick={() => void validateStream()}
                >
                      {validating ? "Validating…" : "Validate stream"}
                    </Button>
                  )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default RssStreamsTab;
