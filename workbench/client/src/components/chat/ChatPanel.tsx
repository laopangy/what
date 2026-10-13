import { useEffect, useRef } from "react";
import { Flame, History, LockOpen, Mountain, Music, NotebookPen, Sparkles, Utensils } from "lucide-react";
import { useChat } from "../../hooks/useChat";
import { useJournalSession } from "../../hooks/useJournalSession";
import { useChatStore } from "../../stores/chatStore";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";
import JournalUnlockCard from "./JournalUnlockCard";

const hints = [
  { text: "午饭吃了一碗牛肉面，帮我记一下", icon: Utensils },
  { text: "今天还能吃多少热量？", icon: Flame },
  { text: "定时任务最近执行得怎么样？", icon: History },
  { text: "我最近保存的行程有哪些？", icon: Mountain },
  { text: "播放周杰伦的晴天", icon: Music },
  { text: "帮我写今天的随手记", icon: NotebookPen },
];

export default function ChatPanel() {
  const { messages, isLoading, sendMessage, continueAfterUnlock } = useChat();
  const journalToken = useChatStore((s) => s.journalToken);
  const lockJournal = useChatStore((s) => s.lockJournal);
  const anchorRef = useRef<HTMLDivElement>(null);
  useJournalSession();

  const lastUser = messages.map((message) => message.role).lastIndexOf("user");
  // Confirmation outcomes can follow a locked reply, so look at the whole latest turn rather than only the last message.
  const showUnlock = !isLoading && !journalToken
    && messages.slice(lastUser + 1).some((message) => message.journalLocked && !message.masked);

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
              你的私人助手 · 饮食训练、定时任务、户外行程、音乐与随手记
            </p>
          </div>

          {/* Hint chips */}
          <div className="grid grid-cols-2 gap-2 max-w-md w-full">
            {hints.map(({ text, icon: Icon }) => (
              <button
                key={text}
                type="button"
                onClick={() => sendMessage(text)}
                className="group px-3 py-2 rounded-lg bg-surface-raised/65 border border-border/60 text-text-dim text-[11px] text-left
                           hover:bg-accent/[0.08] hover:border-accent/30 hover:text-text smooth"
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
          {showUnlock && <JournalUnlockCard onUnlocked={() => void continueAfterUnlock()} />}
          {isLoading && <TypingIndicator />}
          <div ref={anchorRef} />
        </div>
      )}

      {journalToken && (
        <div className="px-4 -mb-1 flex">
          <div className="flex items-center gap-2 rounded-lg bg-accent/[0.07] border border-accent/20 pl-2.5 pr-1 py-1 text-[10px] text-accent-dim/85">
            <LockOpen className="w-3 h-3" strokeWidth={1.8} />
            随手记已解锁 · 5 分钟无操作自动锁定
            <button
              type="button"
              onClick={lockJournal}
              className="rounded-md px-2 py-0.5 text-text-dim hover:bg-white/[0.06] hover:text-text smooth"
            >
              立即锁定
            </button>
          </div>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={isLoading} autoFocus={!showUnlock} />
    </div>
  );
}
