import { Button } from "@found-poems/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "../../constants";
import type {
  AdminSession,
  SessionStatus,
  SessionWord,
} from "../../types/sessions";
import {
  formatLocalDateTimeInput,
  formatPst,
  toUtcISOStringFromLocalInput,
} from "../../utils/datetime";
import CreateSessionForm from "./CreateSessionForm";

type Props = { authToken: string };

const STATUS_FILTERS: Array<SessionStatus | "all"> = [
  "all",
  "scheduled",
  "active",
  "closed",
  "published",
];

function SessionsTab({ authToken }: Props) {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPublishId, setOpenPublishId] = useState<string | null>(null);
  const [publishDraft, setPublishDraft] = useState<{
    title: string;
    body: string;
  }>({
    title: "",
    body: "",
  });
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [wordsBySession, setWordsBySession] = useState<
    Record<string, SessionWord[]>
  >({});
  const [loadingWordsFor, setLoadingWordsFor] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStatus, setCreateStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [createError, setCreateError] = useState("");
  const [createResult, setCreateResult] = useState<null | {
    sessionId: string;
    inviteCount: number;
    wordCount: number;
    startsAt: string;
    endsAt: string;
  }>(null);
  const [title, setTitle] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(() =>
    formatLocalDateTimeInput(new Date(Date.now() + 3_600_000)),
  );
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceBody, setSourceBody] = useState("");
  const [inviteList, setInviteList] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const inviteEmails = useMemo(
    () =>
      inviteList
        .split(/[\n,]/)
        .map((v) => v.trim())
        .filter(Boolean),
    [inviteList],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = useMemo<SessionStatus | "all">(() => {
    const statusParam = searchParams.get("status");
    if (
      statusParam &&
      STATUS_FILTERS.includes(statusParam as SessionStatus | "all")
    ) {
      return statusParam as SessionStatus | "all";
    }
    return "all";
  }, [searchParams]);

  const updateFilter = (next: SessionStatus | "all") => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "all") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const loadSessions = useCallback(
    async (cursor?: string, append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      if (!append) setSessions([]);
      if (!append) setNextCursor(null);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (filter !== "all") params.set("status", filter);
        if (cursor) params.set("cursor", cursor);
        const url = `${API_BASE}/api/admin/sessions?${params.toString()}`;
        const response = await fetch(url, {
          headers: { authorization: `Bearer ${authToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(
            typeof data.message === "string"
              ? data.message
              : "Failed to load sessions",
          );
          if (!append) setSessions([]);
          return;
        }
        setSessions((prev) =>
          append ? [...prev, ...(data.sessions ?? [])] : data.sessions ?? [],
        );
        setNextCursor(data.nextCursor ?? null);
      } catch (_err) {
        setError("Unable to load sessions.");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [authToken, filter],
  );

  const resetCreateForm = () => {
    setTitle("");
    setStartsAtLocal(formatLocalDateTimeInput(new Date(Date.now() + 3_600_000)));
    setDurationMinutes(10);
    setSourceTitle("");
    setSourceBody("");
    setInviteList("");
    setCreateStatus("idle");
    setCreateError("");
    setCreateResult(null);
  };

  const handleCreate = async () => {
    if (!authToken) {
      setCreateStatus("error");
      setCreateError("You need to sign in again before creating a session.");
      return false;
    }
    setCreateStatus("pending");
    setCreateResult(null);
    setCreateError("");

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
        setCreateStatus("error");
        setCreateError(message);
        return false;
      }

      setCreateResult({
        sessionId: data.sessionId,
        inviteCount: data.inviteCount,
        wordCount: data.wordCount,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      });
      setCreateStatus("success");
      await loadSessions();
      return true;
    } catch (error) {
      console.error(error);
      setCreateStatus("error");
      setCreateError("Something went wrong. Check server logs.");
      return false;
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!nextCursor) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && nextCursor && !loadingMore) {
          void loadSessions(nextCursor, true);
        }
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loadSessions, loadingMore]);

  const toggleDetails = (session: AdminSession) => {
    setOpenPublishId((prev) => {
      const next = prev === session.id ? null : session.id;
      if (next) {
        void loadWordsForSession(session);
      }
      return next;
    });
  };

  const submitPublish = async (sessionId: string) => {
    if (!publishDraft.title.trim()) {
      setError("Title is required to publish.");
      return;
    }
    if (!publishDraft.body.trim()) {
      setError("Body is required to publish.");
      return;
    }
    setPublishingId(sessionId);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/sessions/${sessionId}/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: publishDraft.title,
            body: publishDraft.body,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Failed to publish session",
        );
        return;
      }
      setOpenPublishId(null);
      setPublishDraft({ title: "", body: "" });
      await loadSessions();
    } finally {
      setPublishingId(null);
    }
  };

  const unpublish = async (sessionId: string) => {
    setPublishingId(sessionId);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/api/sessions/${sessionId}/publish`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${authToken}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Failed to unpublish session",
        );
        return;
      }
      setOpenPublishId(null);
      setPublishDraft({ title: "", body: "" });
      await loadSessions();
    } finally {
      setPublishingId(null);
    }
  };

  const setPublishDraftFromWords = (
    sessionId: string,
    title: string,
    words?: SessionWord[],
  ) => {
    const list = words ?? wordsBySession[sessionId] ?? [];
    const visibleText = list
      .filter((w) => !w.hidden)
      .map((w) => w.text)
      .join(" ");
    setPublishDraft({
      title,
      body: visibleText,
    });
  };

  const loadWordsForSession = async (session: AdminSession) => {
    if (wordsBySession[session.id]) {
      setPublishDraftFromWords(session.id, session.title);
      return;
    }
    setLoadingWordsFor(session.id);
    try {
      const response = await fetch(
        `${API_BASE}/api/sessions/${session.id}/words`,
        {
          headers: { authorization: `Bearer ${authToken}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Unable to load session details",
        );
        return;
      }
      const words: SessionWord[] = (data.words ?? []).sort(
        (a: SessionWord, b: SessionWord) => a.index - b.index,
      );
      setWordsBySession((prev) => ({ ...prev, [session.id]: words }));
      setPublishDraftFromWords(session.id, session.title, words);
    } catch (_err) {
      setError("Unable to load session details.");
    } finally {
      setLoadingWordsFor(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-ink-700">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateFilter(s as SessionStatus | "all")}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  filter === s
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetCreateForm();
            setShowCreateModal(true);
          }}
        >
          Create session
        </Button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">
                  New Session
                </p>
                <h3 className="text-xl font-semibold">Create session</h3>
              </div>
              <button
                type="button"
                className="text-sm text-ink-500"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                Close
              </button>
            </div>

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
              status={createStatus}
              errorMessage={createError}
              result={createResult}
              onSubmit={async () => {
                const ok = await handleCreate();
                if (ok) {
                  resetCreateForm();
                  setShowCreateModal(false);
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
        {loading && (
          <p className="px-4 py-3 text-sm text-ink-600">Loading sessions…</p>
        )}
        {error && (
          <p className="px-4 py-3 text-sm text-red-600">
            {error} — try refreshing.
          </p>
        )}
        {!loading && !sessions.length && !error && (
          <p className="px-4 py-3 text-sm text-ink-600">No sessions found.</p>
        )}
        <ul className="divide-y divide-ink-100">
          {sessions.map((session) => {
            const invited = session.invites.length;
            const accepted = session.invites.filter(
              (invite) => invite.status === "accepted",
            ).length;
            const publishOpen = openPublishId === session.id;
            const words = wordsBySession[session.id];
            const canPublish =
              session.status === "closed" || session.status === "published";
            return (
              <li key={session.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-wide text-ink-500">
                        {session.status}
                      </p>
                      {session.poem?.publishedAt && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Published
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold">{session.title}</h3>
                    <p className="text-xs text-ink-500">
                      Starts: {formatPst(session.startsAt)} · Ends:{" "}
                      {formatPst(session.endsAt)}
                    </p>
                    {session.stream && (
                      <p className="text-xs text-ink-500">
                        Stream: {session.stream.title} ({session.stream.slug})
                      </p>
                    )}
                    <p className="text-xs text-ink-500">
                      Invites accepted {accepted}/{invited}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canPublish && (
                      <Button
                        variant="primary"
                        disabled={publishingId === session.id}
                        onClick={() =>
                          void (session.poem?.publishedAt
                            ? unpublish(session.id)
                            : submitPublish(session.id))
                        }
                      >
                        {publishingId === session.id
                          ? session.poem?.publishedAt
                            ? "Unpublishing…"
                            : "Publishing…"
                          : session.poem?.publishedAt
                            ? "Unpublish"
                            : "Publish"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={publishingId === session.id}
                      onClick={() => toggleDetails(session)}
                    >
                      {publishOpen ? "Close" : "Details"}
                    </Button>
                  </div>
                </div>
                {publishOpen && (
                  <div className="mt-4 space-y-3 rounded-lg border border-ink-200 bg-ink-50 p-4">
                    {loadingWordsFor === session.id && (
                      <p className="text-sm text-ink-600">Loading words…</p>
                    )}
                    {!loadingWordsFor && !words && (
                      <p className="text-sm text-ink-600">
                        Fetching final poem state…
                      </p>
                    )}
                    {words && (
                      <div className="rounded-xl border border-ink-200 bg-white p-3 shadow-inner">
                        <p className="text-xs uppercase tracking-wide text-ink-500">
                          Final poem (non-editable)
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-lg leading-relaxed">
                          {words.map((word) => (
                            <span
                              key={word.id}
                              className={`rounded px-1 py-0.5 ${
                                word.hidden
                                  ? "bg-ink-900 text-ink-900"
                                  : "bg-ink-100 text-ink-900"
                              }`}
                            >
                              <span className={word.hidden ? "opacity-0" : ""}>
                                {word.text}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-ink-600">
                        Publish title
                      </span>
                      <input
                        className="rounded border border-ink-200 px-3 py-2"
                        value={publishDraft.title}
                        onChange={(e) =>
                          setPublishDraft((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-ink-600">
                        Publish body (auto-generated)
                      </span>
                      <textarea
                        className="rounded border border-ink-200 px-3 py-2"
                        rows={4}
                        value={publishDraft.body}
                        readOnly
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      {canPublish && (
                        <Button
                          variant="primary"
                          disabled={publishingId === session.id}
                          onClick={() =>
                            void (session.poem?.publishedAt
                              ? unpublish(session.id)
                              : submitPublish(session.id))
                          }
                        >
                          {publishingId === session.id
                            ? session.poem?.publishedAt
                              ? "Unpublishing…"
                              : "Publishing…"
                            : session.poem?.publishedAt
                              ? "Unpublish poem"
                              : "Publish poem"}
                        </Button>
                      )}
                      {session.poem?.publishedAt && (
                        <span className="text-xs text-ink-600">
                          Last published:{" "}
                          {new Date(session.poem.publishedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div ref={loadMoreRef} className="h-1" />
        {loadingMore && (
          <p className="px-4 py-3 text-sm text-ink-600">Loading more…</p>
        )}
      </div>
    </section>
  );
}

export default SessionsTab;
