import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start msg-enter">
      <div className="w-7 h-7 rounded-lg bg-accent/12 border border-accent/20 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-accent-dim" />
      </div>
      <div className="px-3.5 py-2.5 rounded-xl rounded-bl-sm glass border border-border/50 flex gap-1.5 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-dim/70 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-dim/70 animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-accent-dim/70 animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    </div>
  );
}
