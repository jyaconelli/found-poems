import { formatDuration } from "../../utils/datetime";

type Props = { etaMs: number };

function Lobby({ etaMs }: Props) {
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm text-ink-600">Your session will begin soon.</p>
      <p className="text-4xl font-semibold">
        {etaMs > 0 ? formatDuration(etaMs) : "Starting now"}
      </p>
      <p className="text-sm text-ink-500">
        Stay on this page; it will start automatically.
      </p>
    </section>
  );
}

export default Lobby;
