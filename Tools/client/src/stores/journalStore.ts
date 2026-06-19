import { create } from "zustand";
import type { JournalEntry } from "../types/journal";

const BASE = "/api/journal";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

interface JournalState {
  entries: JournalEntry[];
  currentEntry: JournalEntry | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;

  fetchEntries: () => Promise<void>;
  fetchByDate: (date: string) => Promise<void>;
  createEntry: (rawText: string) => Promise<JournalEntry>;
  updateEntry: (id: string, rawText: string) => Promise<JournalEntry>;
  reprocessEntry: (id: string) => Promise<JournalEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  currentEntry: null,
  loading: false,
  submitting: false,
  error: null,

  fetchEntries: async () => {
    set({ loading: true, error: null });
    try {
      const entries = await request<JournalEntry[]>(BASE);
      set({ entries, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载失败";
      set({ error: msg, loading: false });
    }
  },

  fetchByDate: async (date: string) => {
    set({ loading: true, error: null });
    try {
      const entry = await request<JournalEntry>(`${BASE}/date/${date}`);
      set({ currentEntry: entry, loading: false });
    } catch {
      set({ currentEntry: null, loading: false });
    }
  },

  createEntry: async (rawText: string) => {
    set({ submitting: true, error: null });
    try {
      const data = await request<JournalEntry & { aiError?: string }>(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      set({ entries: [data, ...get().entries], currentEntry: data, submitting: false });
      // Show AI error as a non-blocking warning
      if (data.aiError) {
        set({ error: `AI 整理失败（日记已保存）: ${data.aiError}` });
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "提交失败";
      set({ error: msg, submitting: false });
      throw err;
    }
  },

  updateEntry: async (id: string, rawText: string) => {
    set({ submitting: true, error: null });
    try {
      const data = await request<JournalEntry & { aiError?: string }>(`${BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      set({
        entries: get().entries.map((e) => (e.id === id ? data : e)),
        currentEntry: data,
        submitting: false,
      });
      if (data.aiError) {
        set({ error: `AI 整理失败（日记已保存）: ${data.aiError}` });
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "更新失败";
      set({ error: msg, submitting: false });
      throw err;
    }
  },

  reprocessEntry: async (id: string) => {
    set({ submitting: true, error: null });
    try {
      const data = await request<JournalEntry & { aiError?: string }>(`${BASE}/${id}/reprocess`, {
        method: "POST",
      });
      set({
        entries: get().entries.map((e) => (e.id === id ? data : e)),
        currentEntry: data,
        submitting: false,
      });
      if (data.aiError) {
        set({ error: `AI 重新分析失败: ${data.aiError}` });
      }
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "重新分析失败";
      set({ error: msg, submitting: false });
      throw err;
    }
  },

  deleteEntry: async (id: string) => {
    try {
      await request(`${BASE}/${id}`, { method: "DELETE" });
      set({
        entries: get().entries.filter((e) => e.id !== id),
        currentEntry: get().currentEntry?.id === id ? null : get().currentEntry,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败";
      set({ error: msg });
    }
  },
}));
