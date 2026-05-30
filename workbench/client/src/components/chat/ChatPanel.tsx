import { useEffect, useRef } from "react";
import { useChat } from "../../hooks/useChat";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";
import { Sparkles, MessageCircle } from "lucide-react";

const hints = [
  "搜索周杰伦的晴天",
  "播放我喜欢的歌",
  "每日推荐",
  "搜索摇滚歌单",
];

export default function ChatPanel() {
  const { messages, isLoading, sendMessage } = useChat();
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-purple flex items-center justify-center bounce-in">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-text mb-2">阿潘阿潘潘的工作台</h2>
            <p className="text-text-dim text-sm">AI 助手，帮我操控音乐、健身、骑行等多个模块</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {hints.map((hint) => (
              <button
                key={hint}
                onClick={() => sendMessage(hint)}
                className="px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent-dim text-sm hover:bg-accent/15 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" />
                {hint}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
