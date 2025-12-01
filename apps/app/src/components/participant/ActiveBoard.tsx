import type { Word } from "../../types/sessions";

type Props = {
  words: Word[];
  onBlackout: (id: string) => void;
  busyWord: string | null;
  hiddenCount: number;
  totalWords: number;
};

function ActiveBoard({
  words,
  onBlackout,
  busyWord,
  hiddenCount,
  totalWords,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-600">
        <span>Words remaining: {totalWords - hiddenCount}</span>
        <span>Blacked out: {hiddenCount}</span>
      </div>
      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 text-lg leading-relaxed">
          {words.map((word) => (
            <button
              key={word.id}
              disabled={word.hidden || busyWord === word.id}
              type="button"
              onClick={() => onBlackout(word.id)}
              className={`rounded px-1 py-0.5 transition-colors ${
                word.hidden ? "bg-ink-900 text-ink-900" : "hover:bg-ink-100"
              }`}
            >
              <span className={word.hidden ? "opacity-0" : ""}>
                {word.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ActiveBoard;
