import { create } from "zustand";
import type { ChatMessage } from "../types/chat";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
}

let nextId = 1;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: String(nextId++), timestamp: Date.now() },
      ],
    })),
  setLoading: (v) => set({ isLoading: v }),
  clear: () => set({ messages: [] }),
}));
