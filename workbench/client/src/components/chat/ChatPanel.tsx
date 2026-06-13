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
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
          {/* Animated logo */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-accent/20 blur-2xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-[1.75rem] bg-gradient-to-br from-accent via-purple to-pink flex items-center justify-center shadow-[0_8px_40px_rgb(99_102_241_/_0.35)] float">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-text tracking-tight">
              阿潘阿潘潘的<span className="bg-gradient-to-r from-accent via-purple to-pink bg-clip-text text-transparent">工作台</span>
            </h1>
            <p className="text-text-dim/70 text-[15px] max-w-sm leading-relaxed">
              AI 智能助手 · 操控音乐、健身、骑行等模块
            </p>
          </div>

          {/* Hint chips */}
          <div className="flex flex-wrap gap-2.5 justify-center max-w-lg">
            {hints.map(({ text, icon: Icon }, i) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="group px-4 py-2.5 rounded-xl bg-surface-raised/60 border border-border/40 text-text-dim text-sm
                           hover:bg-accent/10 hover:border-accent/30 hover:text-accent-dim smooth
                           hover:shadow-[0_4px_20px_rgb(99_102_241_/_0.1)]"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <Icon className="w-3.5 h-3.5 inline mr-2 group-hover:scale-110 smooth" />
                {text}
              </button>
            ))}
          </div>

          {/* Bottom hint */}
          <p className="text-xs text-text-dim/40">Shift + Enter 换行 · Enter 发送</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
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
