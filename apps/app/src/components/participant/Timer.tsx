import type { SessionPhase } from "../../types/sessions";
import { formatDuration } from "../../utils/datetime";

type Props = { etaMs: number; phase: SessionPhase };

function Timer({ etaMs, phase }: Props) {
  const label = phase === "active" ? "Time remaining" : "Starts in";
  const value =
    etaMs > 0
      ? formatDuration(etaMs)
      : phase === "active"
        ? "Ending"
        : "Starting";
  return (
    <div className="rounded-full border border-ink-200 px-3 py-1 text-sm text-ink-700">
      {label}: {value}
    </div>
  );
}

export default Timer;
