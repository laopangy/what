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
    <div className="px-4 pb-3 pt-2">
      <div
        className={`flex items-end gap-3 px-3.5 py-2 rounded-xl transition-all duration-200
          bg-surface-raised/80 border shadow-[0_10px_28px_rgb(0_0_0_/_0.22)]
          ${focused
            ? "border-accent/45 shadow-[0_10px_30px_rgb(28_47_58_/_0.24),0_0_0_1px_rgb(0_232_137_/_0.10)]"
            : "border-border/70 hover:border-border-glow/70"
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
          className="flex-1 resize-none bg-transparent text-[12px] text-text placeholder:text-text-dim/45 outline-none py-1.5 disabled:opacity-50 leading-relaxed"
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 p-2 rounded-lg smooth flex items-center justify-center ${
            canSend
              ? "bg-accent text-[#123a2b] shadow-[0_4px_14px_rgb(0_232_137_/_0.18)] hover:bg-accent-dim"
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
