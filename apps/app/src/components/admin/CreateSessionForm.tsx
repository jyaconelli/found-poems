import { Button } from "@found-poems/ui";

type Props = {
  title: string;
  setTitle: (value: string) => void;
  startsAtLocal: string;
  setStartsAtLocal: (value: string) => void;
  durationMinutes: number;
  setDurationMinutes: (value: number) => void;
  inviteList: string;
  setInviteList: (value: string) => void;
  sourceTitle: string;
  setSourceTitle: (value: string) => void;
  sourceBody: string;
  setSourceBody: (value: string) => void;
  status: "idle" | "pending" | "success" | "error";
  errorMessage: string;
  result: null | {
    sessionId: string;
    inviteCount: number;
    wordCount: number;
    startsAt: string;
    endsAt: string;
  };
  onSubmit: () => Promise<void>;
};

function CreateSessionForm({
  title,
  setTitle,
  startsAtLocal,
  setStartsAtLocal,
  durationMinutes,
  setDurationMinutes,
  inviteList,
  setInviteList,
  sourceTitle,
  setSourceTitle,
  sourceBody,
  setSourceBody,
  status,
  errorMessage,
  result,
  onSubmit,
}: Props) {
  return (
    <>
      <section className="grid gap-6 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Title</span>
          <input
            className="rounded border border-ink-200 px-3 py-2"
            value={title}
            placeholder="Evening Lab"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Start time</span>
          <input
            type="datetime-local"
            className="rounded border border-ink-200 px-3 py-2"
            value={startsAtLocal}
            onChange={(event) => setStartsAtLocal(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Duration (minutes)</span>
          <input
            type="number"
            min={1}
            max={60}
            className="rounded border border-ink-200 px-3 py-2"
            value={durationMinutes}
            placeholder="10"
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Invites</span>
          <textarea
            className="rounded border border-ink-200 px-3 py-2"
            rows={3}
            value={inviteList}
            placeholder="poet@example.com, collaborator@example.com"
            onChange={(event) => setInviteList(event.target.value)}
          />
          <span className="text-xs text-ink-500">
            Comma or newline separated emails.
          </span>
        </label>
      </section>

      <section className="grid gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Source title</span>
          <input
            className="rounded border border-ink-200 px-3 py-2"
            value={sourceTitle}
            placeholder="Found Objects"
            onChange={(event) => setSourceTitle(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Source body</span>
          <textarea
            className="rounded border border-ink-200 px-3 py-2"
            rows={6}
            value={sourceBody}
            placeholder="Paste the source text that collaborators will blackout"
            onChange={(event) => setSourceBody(event.target.value)}
          />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          disabled={status === "pending"}
          onClick={onSubmit}
        >
          {status === "pending" ? "Creating…" : "Create Session"}
        </Button>
        {status === "error" && errorMessage && (
          <span className="text-sm text-red-600">{errorMessage}</span>
        )}
      </div>

      {result && (
        <section className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Session created</h2>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Session ID</dt>
              <dd className="font-mono">{result.sessionId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Invites sent</dt>
              <dd>{result.inviteCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Words tracked</dt>
              <dd>{result.wordCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Starts</dt>
              <dd>{new Date(result.startsAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Ends</dt>
              <dd>{new Date(result.endsAt).toLocaleString()}</dd>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}

export default CreateSessionForm;
