import { Send, Sparkles } from "lucide-react";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
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

  return (
    <div className="flex items-end gap-3 p-4 glass-strong">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="输入消息，Enter 发送..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-dim outline-none py-2 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="p-2 rounded-xl bg-accent/20 text-accent-dim hover:bg-accent/30 disabled:opacity-40 transition-all"
      >
        {disabled ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}
