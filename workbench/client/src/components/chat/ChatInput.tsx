import { Send, Sparkles, ArrowUp } from "lucide-react";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && ref.current) ref.current.focus();
  }, [disabled]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    ref.current?.focus();
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="p-4">
      <div
        className={`flex items-end gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300
          bg-surface-raised/60 border
          ${focused
            ? "border-accent/40 shadow-[0_0_24px_rgb(99_102_241_/_0.12)]"
            : "border-border/40 hover:border-border/60"
          }`}
      >
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-[14px] text-text placeholder:text-text-dim/50 outline-none py-1.5 disabled:opacity-50 leading-relaxed"
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 p-2 rounded-xl smooth flex items-center justify-center ${
            canSend
              ? "bg-gradient-to-br from-accent to-purple text-white shadow-[0_4px_16px_rgb(99_102_241_/_0.35)] hover:shadow-[0_6px_24px_rgb(99_102_241_/_0.45)] hover:scale-105 active:scale-95"
              : disabled
                ? "bg-accent/10 text-accent-dim/60"
                : "bg-surface text-text-dim/30"
          }`}
        >
          {disabled ? (
            <Sparkles className="w-4 h-4 animate-pulse" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
