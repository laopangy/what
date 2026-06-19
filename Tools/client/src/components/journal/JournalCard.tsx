import type { JournalEntry } from "../../types/journal";
import { cn } from "../../utils/cn";

interface JournalCardProps {
  entry: JournalEntry;
  onClick: () => void;
}

const moodGradients: Record<string, string> = {
  "😊": "from-amber-500/10 to-yellow-500/5",
  "😫": "from-slate-500/10 to-slate-500/5",
  "😐": "from-blue-500/10 to-slate-500/5",
  "🤩": "from-pink-500/10 to-purple-500/5",
  "😢": "from-blue-500/10 to-indigo-500/5",
  "😰": "from-red-500/10 to-orange-500/5",
  "😌": "from-emerald-500/10 to-teal-500/5",
};

export default function JournalCard({ entry, onClick }: JournalCardProps) {
  const { structured, date } = entry;
  const gradient = moodGradients[structured.moodEmoji] || "from-slate-500/10";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/30 transition-all hover:bg-slate-900/80",
        "bg-gradient-to-r",
        gradient
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{structured.moodEmoji}</span>
          <div>
            <h3 className="font-semibold text-slate-200">
              {structured.title}
            </h3>
            <p className="text-xs text-slate-500">{date}</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
          {structured.mood}
        </span>
      </div>

      <p className="text-sm text-slate-400 line-clamp-2 mb-3">
        {structured.summary}
      </p>

      <div className="flex flex-wrap gap-2">
        {structured.highlights.map((h, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-md text-xs bg-indigo-500/10 text-indigo-400"
          >
            {h}
          </span>
        ))}
      </div>
    </button>
  );
}
