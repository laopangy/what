import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start msg-enter">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 border border-accent/20 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-accent-dim" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-md glass border border-border/50 flex gap-1.5 items-center">
        <span className="w-2 h-2 rounded-full bg-accent-dim/70 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-accent-dim/70 animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="w-2 h-2 rounded-full bg-accent-dim/70 animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    </div>
  );
}
