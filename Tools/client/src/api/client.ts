import type { Timer, CreateTimerInput, UpdateTimerInput, ExecutionRecord } from "../types/timer";

const BASE = "/api/timer";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const timerApi = {
  getAll: () => request<Timer[]>(BASE),

  getById: (id: string) => request<Timer>(`${BASE}/${id}`),

  create: (data: CreateTimerInput) =>
    request<Timer>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateTimerInput) =>
    request<Timer>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`${BASE}/${id}`, { method: "DELETE" }),

  toggle: (id: string) =>
    request<Timer>(`${BASE}/${id}/toggle`, { method: "POST" }),

  trigger: (id: string) =>
    request<{ success: boolean; message: string }>(`${BASE}/${id}/trigger`, {
      method: "POST",
    }),

  getHistory: (id: string) =>
    request<ExecutionRecord[]>(`${BASE}/${id}/history`),

  getAllHistory: () =>
    request<ExecutionRecord[]>(`${BASE}/history/all`),
};
