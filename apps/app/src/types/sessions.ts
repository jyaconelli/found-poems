export type SessionStatus = "scheduled" | "active" | "closed" | "published";

export type AdminSession = {
  id: string;
  title: string;
  status: SessionStatus;
  startsAt: string;
  endsAt: string;
  source: { title: string };
  invites: { id: string; status: string }[];
  poem?: { id: string; title: string; publishedAt: string | null } | null;
};

export type SessionWord = {
  id: string;
  text: string;
  hidden: boolean;
  index: number;
  hiddenAt?: string | null;
};

export type SessionPhase = "lobby" | "active" | "ended";

export type Word = {
  id: string;
  text: string;
  hidden: boolean;
  index: number;
  hiddenAt?: string | null;
};

export type SessionMeta = {
  title: string;
  startsAt: string;
  endsAt: string;
  totalInvites: number;
};

export type ParticipantProps = {
  sessionId: string;
  token: string;
  supabaseUrl: string;
  supabaseKey: string;
};
