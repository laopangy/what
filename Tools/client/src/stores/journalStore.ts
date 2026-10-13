import { create } from "zustand";
import type { JournalEntry } from "../types/journal";

const BASE = "/api/journal";
const LOCK_BASE = "/api/journal-lock";
const TOKEN_HEADER = "X-Journal-Token";

export class JournalUnlockError extends Error {
  constructor(message: string, readonly retryAfter?: number) {
    super(message);
  }
}

interface EditDraft {
  id: string;
  text: string;
}

interface JournalState {
  token: string | null;
  draft: string;
  editDraft: EditDraft | null;
  entries: JournalEntry[];
  currentEntry: JournalEntry | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;

  unlock: (password: string) => Promise<void>;
  lock: (keepDrafts: boolean) => void;
  setDraft: (draft: string) => void;
  setEditDraft: (editDraft: EditDraft | null) => void;
  fetchEntries: () => Promise<void>;
  fetchByDate: (date: string) => Promise<void>;
  createEntry: (rawText: string) => Promise<JournalEntry>;
  updateEntry: (id: string, rawText: string) => Promise<JournalEntry>;
  reprocessEntry: (id: string) => Promise<JournalEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useJournalStore = create<JournalState>((set, get) => {
  // Bumped on every lock/unlock so responses from an earlier session never touch the current one.
  let session = 0;

  const forSession = () => {
    const started = session;
    return (partial: Partial<JournalState>) => {
      if (session === started) set(partial);
    };
  };

  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const started = session;
    const headers = new Headers(init.headers);
    const { token } = get();
    if (token) headers.set(TOKEN_HEADER, token);
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 401 && err.code === "JOURNAL_LOCKED" && session === started) get().lock(true);
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  const revoke = (token: string) => {
    fetch(`${LOCK_BASE}/lock`, { method: "POST", headers: { [TOKEN_HEADER]: token }, keepalive: true }).catch(() => {});
  };

  return {
    token: null,
    draft: "",
    editDraft: null,
    entries: [],
    currentEntry: null,
    loading: false,
    submitting: false,
    error: null,

    unlock: async (password: string) => {
      const started = session;
      const res = await fetch(`${LOCK_BASE}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.token !== "string") {
        throw new JournalUnlockError(data.error || `解锁失败（HTTP ${res.status}）`, data.retryAfter);
      }
      if (session !== started) {
        revoke(data.token);
        return;
      }
      session += 1;
      set({ token: data.token, error: null });
    },

    lock: (keepDrafts: boolean) => {
      session += 1;
      const { token } = get();
      if (token) revoke(token);
      set({
        token: null,
        entries: [],
        currentEntry: null,
        loading: false,
        submitting: false,
        error: null,
        ...(keepDrafts ? {} : { draft: "", editDraft: null }),
      });
    },

    setDraft: (draft: string) => set({ draft }),
    setEditDraft: (editDraft: EditDraft | null) => set({ editDraft }),

    fetchEntries: async () => {
      const apply = forSession();
      apply({ loading: true, error: null });
      try {
        const entries = await request<JournalEntry[]>(BASE);
        apply({ entries, loading: false });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "加载失败";
        apply({ error: msg, loading: false });
      }
    },

    fetchByDate: async (date: string) => {
      const apply = forSession();
      apply({ loading: true, error: null });
      try {
        const entry = await request<JournalEntry>(`${BASE}/date/${date}`);
        apply({ currentEntry: entry, loading: false });
      } catch {
        apply({ currentEntry: null, loading: false });
      }
    },

    createEntry: async (rawText: string) => {
      const apply = forSession();
      apply({ submitting: true, error: null });
      try {
        const data = await request<JournalEntry & { aiError?: string }>(BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText }),
        });
        if (get().draft.trim() === rawText) set({ draft: "" });
        apply({ entries: [data, ...get().entries], currentEntry: data, submitting: false });
        // Show AI error as a non-blocking warning
        if (data.aiError) {
          apply({ error: `AI 整理失败（日记已保存）: ${data.aiError}` });
        }
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "提交失败";
        apply({ error: msg, submitting: false });
        throw err;
      }
    },

    updateEntry: async (id: string, rawText: string) => {
      const apply = forSession();
      apply({ submitting: true, error: null });
      try {
        const data = await request<JournalEntry & { aiError?: string }>(`${BASE}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText }),
        });
        const { editDraft } = get();
        if (editDraft?.id === id && editDraft.text.trim() === rawText) set({ editDraft: null });
        apply({
          entries: get().entries.map((e) => (e.id === id ? data : e)),
          currentEntry: data,
          submitting: false,
        });
        if (data.aiError) {
          apply({ error: `AI 整理失败（日记已保存）: ${data.aiError}` });
        }
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "更新失败";
        apply({ error: msg, submitting: false });
        throw err;
      }
    },

    reprocessEntry: async (id: string) => {
      const apply = forSession();
      apply({ submitting: true, error: null });
      try {
        const data = await request<JournalEntry & { aiError?: string }>(`${BASE}/${id}/reprocess`, {
          method: "POST",
        });
        apply({
          entries: get().entries.map((e) => (e.id === id ? data : e)),
          currentEntry: data,
          submitting: false,
        });
        if (data.aiError) {
          apply({ error: `AI 重新分析失败: ${data.aiError}` });
        }
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "重新分析失败";
        apply({ error: msg, submitting: false });
        throw err;
      }
    },

    deleteEntry: async (id: string) => {
      const apply = forSession();
      try {
        await request(`${BASE}/${id}`, { method: "DELETE" });
        apply({
          entries: get().entries.filter((e) => e.id !== id),
          currentEntry: get().currentEntry?.id === id ? null : get().currentEntry,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "删除失败";
        apply({ error: msg });
      }
    },
  };
});
