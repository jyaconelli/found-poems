import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { API_BASE } from "../../constants";
import {
  formatLocalDateTimeInput,
  toUtcISOStringFromLocalInput,
} from "../../utils/datetime";
import type { AdminOutletContext } from "./AdminScheduler";
import CreateSessionForm from "./CreateSessionForm";

function CreateSessionPage() {
  const { authToken } = useOutletContext<AdminOutletContext>();
  const [title, setTitle] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(() =>
    formatLocalDateTimeInput(new Date(Date.now() + 3_600_000)),
  );
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceBody, setSourceBody] = useState("");
  const [inviteList, setInviteList] = useState("");
  const [status, setStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<null | {
    sessionId: string;
    inviteCount: number;
    wordCount: number;
    startsAt: string;
    endsAt: string;
  }>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const inviteEmails = useMemo(
    () =>
      inviteList
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    [inviteList],
  );

  async function handleCreate() {
    if (!authToken) {
      setStatus("error");
      setErrorMessage("You need to sign in again before creating a session.");
      return;
    }

    setStatus("pending");
    setResult(null);
    setErrorMessage("");

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
        setStatus("error");
        setErrorMessage(message);
        return;
      }

      setResult({
        sessionId: data.sessionId,
        inviteCount: data.inviteCount,
        wordCount: data.wordCount,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      });
      setStatus("success");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage("Something went wrong. Check server logs.");
    }
  }

  return (
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
      status={status}
      errorMessage={errorMessage}
      result={result}
      onSubmit={handleCreate}
    />
  );
}

export default CreateSessionPage;
