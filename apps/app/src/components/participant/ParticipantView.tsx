import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../constants";
import type {
  ParticipantProps,
  SessionMeta,
  SessionPhase,
  Word,
} from "../../types/sessions";
import { formatPst } from "../../utils/datetime";
import ActiveBoard from "./ActiveBoard";
import Ended from "./Ended";
import Lobby from "./Lobby";
import Timer from "./Timer";

function ParticipantView({
  sessionId,
  token,
  inviteToken,
  supabaseUrl,
  supabaseKey,
}: ParticipantProps) {
  const [phase, setPhase] = useState<SessionPhase>("lobby");
  const [session, setSession] = useState<SessionMeta | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [connected, setConnected] = useState(0);
  const [etaMs, setEtaMs] = useState(0);
  const [busyWord, setBusyWord] = useState<string | null>(null);
  const [atCapacity, setAtCapacity] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
  }, [supabaseKey, supabaseUrl]);

  const updatePhase = useCallback((starts: number, ends: number) => {
    const now = Date.now();
    if (now >= ends) {
      setPhase("ended");
      setEtaMs(0);
      return;
    }
    if (now >= starts) {
      setPhase("active");
      setEtaMs(ends - now);
    } else {
      setPhase("lobby");
      setEtaMs(starts - now);
    }
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    async function loadSession() {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
      if (!response.ok) return;
      const data = await response.json();
      const starts = new Date(data.session.startsAt);
      const ends = new Date(data.session.endsAt);
      setSession({
        title: data.session.title,
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
        totalInvites: data.session.invites.length,
        maxParticipants: data.session.stream?.maxParticipants ?? null,
      });
      updatePhase(starts.getTime(), ends.getTime());
    }
    loadSession();
    interval = window.setInterval(loadSession, 5000);
    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [sessionId, updatePhase]);

  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/invites/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, token: inviteToken }),
        });
        if (!response.ok) {
          console.warn("Failed to mark invite accepted", await response.text());
        }
      } catch (error) {
        console.error("Error marking invite accepted", error);
      }
    })();
  }, [inviteToken, sessionId]);

  useEffect(() => {
    async function loadWords() {
      const response = await fetch(
        `${API_BASE}/api/sessions/${sessionId}/words`,
      );
      if (!response.ok) return;
      const data = await response.json();
      setWords(data.words);
    }
    loadWords();
  }, [sessionId]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`presence:${sessionId}`, {
      config: { presence: { key: token } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Record<string, unknown>>();
      const count = Object.keys(state).length;
      const overCapacity =
        session?.maxParticipants !== undefined &&
        session?.maxParticipants !== null &&
        count >= session.maxParticipants;
      setAtCapacity(Boolean(overCapacity));
      setConnected(count);
    });

    channel.on(
      "broadcast",
      { event: "word:update" },
      (payload: { payload: { id: string; hiddenAt?: string | null } }) => {
        setWords((prev) =>
          prev.map((w) =>
            w.id === payload.payload.id
              ? { ...w, hidden: true, hiddenAt: payload.payload.hiddenAt }
              : w,
          ),
        );
      },
    );

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        const state = channel.presenceState<Record<string, unknown>>();
        const count = Object.keys(state).length;
        if (
          session?.maxParticipants &&
          count >= session.maxParticipants
        ) {
          setAtCapacity(true);
          supabase.removeChannel(channel);
          return;
        }
        channel.track({ joinedAt: new Date().toISOString() });
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, token, session?.maxParticipants]);

  useEffect(() => {
    if (!session) return;
    const starts = new Date(session.startsAt).getTime();
    const ends = new Date(session.endsAt).getTime();
    const id = window.setInterval(() => updatePhase(starts, ends), 1000);
    return () => window.clearInterval(id);
  }, [session, updatePhase]);

  async function handleBlackout(wordId: string) {
    if (phase !== "active" || atCapacity) return;
    setBusyWord(wordId);
    try {
      const response = await fetch(`${API_BASE}/api/words/${wordId}/hide`, {
        method: "PATCH",
        headers: { "x-actor-id": token },
      });
      if (!response.ok) throw new Error("Failed to hide word");
      const data = await response.json();
      setWords((prev) =>
        prev.map((w) =>
          w.id === wordId
            ? { ...w, hidden: true, hiddenAt: data.word.hiddenAt }
            : w,
        ),
      );
      channelRef.current?.send({
        type: "broadcast",
        event: "word:update",
        payload: { id: wordId, hiddenAt: data.word.hiddenAt },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setBusyWord(null);
    }
  }

  const totalWords = words.length;
  const hiddenCount = words.filter((w) => w.hidden).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">
            Found Poems
          </p>
          <h1 className="text-xl font-semibold">
            {session?.title ?? "Loading session"}
          </h1>
          {session && (
            <p className="text-xs text-ink-500">
              Starts (PST): {formatPst(session.startsAt)} · Ends (PST):{" "}
              {formatPst(session.endsAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-600">
          <span>
            Connected {connected}
            {session?.totalInvites ? ` / ${session.totalInvites}` : ""}
          </span>
          {session && <Timer etaMs={etaMs} phase={phase} />}
        </div>
      </header>
      {atCapacity && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This stream is at its max collaborators right now. Try again after a
          spot opens.
        </div>
      )}

      {phase === "lobby" && <Lobby etaMs={etaMs} />}
      {phase === "active" && (
        <ActiveBoard
          words={words}
          onBlackout={handleBlackout}
          busyWord={busyWord}
          hiddenCount={hiddenCount}
          totalWords={totalWords}
        />
      )}
      {phase === "ended" && <Ended />}
    </main>
  );
}

export default ParticipantView;
