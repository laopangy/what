import { create } from "zustand";
import { chatApi } from "../api/client";
import type { ChatMessage, ToolConfirmation } from "../types/chat";

const MASKED_CONTENT = "[随手记内容已隐藏]";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  journalToken: string | null;
  lockCount: number;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, "id">>) => void;
  updateConfirmation: (messageId: string, actionId: string, patch: Partial<ToolConfirmation>) => void;
  setLoading: (v: boolean) => void;
  setJournalToken: (token: string | null) => void;
  lockJournal: () => void;
  clear: () => void;
}

const mask = (message: ChatMessage): ChatMessage => ({
  ...message,
  content: MASKED_CONTENT,
  masked: true,
  toolCalls: message.toolCalls?.map((call) => (call.module === "journal" ? { ...call, args: {}, result: undefined } : call)),
});

let nextId = 1;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  journalToken: null,
  lockCount: 0,
  addMessage: (msg) => {
    const id = String(nextId++);
    set((s) => ({ messages: [...s.messages, { ...msg, id, timestamp: Date.now() }] }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  updateConfirmation: (messageId, actionId, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id !== messageId ? m : {
        ...m,
        toolCalls: m.toolCalls?.map((call) =>
          call.confirmation?.actionId === actionId ? { ...call, confirmation: { ...call.confirmation, ...patch } } : call),
      })),
    })),
  setLoading: (v) => set({ isLoading: v }),
  setJournalToken: (token) => set({ journalToken: token }),
  lockJournal: () => {
    const token = get().journalToken;
    if (token) chatApi.lockJournal(token).catch(() => {});
    set((s) => ({
      journalToken: null,
      lockCount: s.lockCount + 1,
      messages: s.messages.map((m) => (m.sensitive && !m.masked ? mask(m) : m)),
    }));
  },
  clear: () => set({ messages: [] }),
}));
