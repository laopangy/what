import { useEffect, useRef } from "react";
import { useChat } from "../../hooks/useChat";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";
import { Sparkles, MessageCircle, Zap, Music, Disc3 } from "lucide-react";

const hints = [
  { text: "搜索周杰伦的晴天", icon: Disc3 },
  { text: "播放我喜欢的歌", icon: Music },
  { text: "每日推荐", icon: Sparkles },
  { text: "搜索摇滚歌单", icon: Zap },
];

export default function ChatPanel() {
  const { messages, isLoading, sendMessage } = useChat();
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full max-w-[860px] mx-auto w-full relative">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 pb-8">
          {/* Animated logo */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-2xl bg-accent/10 blur-2xl" />
            <div className="relative w-16 h-16 rounded-xl bg-accent flex items-center justify-center border border-white/20 shadow-[0_14px_32px_rgb(28_47_58_/_0.26)]">
              <Sparkles className="w-8 h-8 text-[#123a2b]" strokeWidth={1.7} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-1.5">
            <p className="text-[9px] uppercase tracking-[0.3em] text-accent-dim/65">Personal operating desk</p>
            <h1 className="text-2xl font-semibold text-text tracking-tight">
              阿潘阿潘潘的<span className="text-accent-dim">工作台</span>
            </h1>
            <p className="text-text-dim/65 text-[12px] max-w-sm leading-relaxed">
              AI 智能助手 · 操控音乐、健身、骑行等模块
            </p>
          </div>

          {/* Hint chips */}
          <div className="grid grid-cols-2 gap-2 max-w-md w-full">
            {hints.map(({ text, icon: Icon }, i) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="group px-3 py-2 rounded-lg bg-surface-raised/65 border border-border/60 text-text-dim text-[11px] text-left
                           hover:bg-accent/[0.08] hover:border-accent/30 hover:text-text smooth"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <Icon className="w-3.5 h-3.5 inline mr-2 text-accent-dim/75 group-hover:text-accent-dim smooth" strokeWidth={1.7} />
                {text}
              </button>
            ))}
          </div>

          {/* Bottom hint */}
          <p className="text-[10px] text-text-dim/35">Shift + Enter 换行 · Enter 发送</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={anchorRef} />
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
