import { Button } from "@found-poems/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "../../constants";
import type {
  AdminSession,
  SessionStatus,
  SessionWord,
} from "../../types/sessions";
import { formatPst } from "../../utils/datetime";

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

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        filter === "all"
          ? `${API_BASE}/api/admin/sessions`
          : `${API_BASE}/api/admin/sessions?status=${filter}`;
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
        setSessions([]);
        return;
      }
      const sorted = (data.sessions ?? [])
        .slice()
        .sort((a: AdminSession, b: AdminSession) => {
          const aTime = new Date(a.startsAt).getTime();
          const bTime = new Date(b.startsAt).getTime();
          return bTime - aTime;
        });
      setSessions(sorted);
    } catch (_err) {
      setError("Unable to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [authToken, filter]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

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
      </div>
    </section>
  );
}

export default SessionsTab;
