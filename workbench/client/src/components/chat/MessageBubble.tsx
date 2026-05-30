import type { ChatMessage } from "../../types/chat";
import ToolCallCard from "./ToolCallCard";
import { User, Bot } from "lucide-react";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-accent-dim" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {message.toolCalls?.map((tc, i) => (
          <ToolCallCard key={i} toolCall={tc} />
        ))}
        <div className={`px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-accent/15 text-text rounded-br-md"
            : "bg-surface-raised border border-border text-text rounded-bl-md"
        }`}>
          {message.content}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-accent-dim" />
        </div>
      )}
    </div>
  );
}
