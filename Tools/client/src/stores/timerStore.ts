import { create } from "zustand";
import type { Timer, ExecutionRecord, CreateTimerInput, UpdateTimerInput } from "../types/timer";
import { timerApi } from "../api/client";

interface TimerState {
  timers: Timer[];
  history: ExecutionRecord[];
  loading: boolean;
  error: string | null;

  fetchTimers: () => Promise<void>;
  fetchHistory: (timerId: string) => Promise<void>;
  fetchAllHistory: () => Promise<void>;
  createTimer: (data: CreateTimerInput) => Promise<Timer>;
  updateTimer: (id: string, data: UpdateTimerInput) => Promise<Timer>;
  deleteTimer: (id: string) => Promise<void>;
  toggleTimer: (id: string) => Promise<void>;
  triggerTimer: (id: string) => Promise<string>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  timers: [],
  history: [],
  loading: false,
  error: null,

  fetchTimers: async () => {
    set({ loading: true, error: null });
    try {
      const timers = await timerApi.getAll();
      set({ timers, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch timers";
      set({ error: message, loading: false });
    }
  },

  fetchHistory: async (timerId: string) => {
    try {
      const history = await timerApi.getHistory(timerId);
      set({ history });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch history";
      set({ error: message });
    }
  },

  fetchAllHistory: async () => {
    try {
      const history = await timerApi.getAllHistory();
      set({ history });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch history";
      set({ error: message });
    }
  },

  createTimer: async (data: CreateTimerInput) => {
    const timer = await timerApi.create(data);
    set({ timers: [...get().timers, timer] });
    return timer;
  },

  updateTimer: async (id: string, data: UpdateTimerInput) => {
    const updated = await timerApi.update(id, data);
    set({
      timers: get().timers.map((t) => (t.id === id ? updated : t)),
    });
    return updated;
  },

  deleteTimer: async (id: string) => {
    await timerApi.delete(id);
    set({ timers: get().timers.filter((t) => t.id !== id) });
  },

  toggleTimer: async (id: string) => {
    const toggled = await timerApi.toggle(id);
    set({
      timers: get().timers.map((t) => (t.id === id ? toggled : t)),
    });
  },

  triggerTimer: async (id: string) => {
    const res = await timerApi.trigger(id);
    return res.message;
  },
}));
