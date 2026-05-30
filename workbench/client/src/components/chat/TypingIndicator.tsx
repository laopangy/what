export default function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
        <span className="text-accent-dim text-xs">●</span>
      </div>
      <div className="px-4 py-3 rounded-xl bg-surface-raised border border-border flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-dim animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-dim animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-dim animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    </div>
  );
}
