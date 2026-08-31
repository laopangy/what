import type { Itinerary, OutdoorSettings, TransportMode, TripIntent } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `请求失败 (${response.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const api = {
  generate: (query: string, mode?: TransportMode, overrides?: Partial<TripIntent>) => request<Itinerary>("/api/outdoor/generate", json("POST", { query, mode, overrides })),
  settings: () => request<OutdoorSettings>("/api/outdoor/settings"),
  saveSettings: (settings: OutdoorSettings) => request<OutdoorSettings>("/api/outdoor/settings", json("PUT", settings)),
  plans: () => request<Itinerary[]>("/api/outdoor/plans"),
  save: (plan: Itinerary) => request<Itinerary>(plan.saved ? `/api/outdoor/plans/${plan.id}` : "/api/outdoor/plans", json(plan.saved ? "PUT" : "POST", plan)),
  remove: (id: string) => request<{ success: boolean }>(`/api/outdoor/plans/${id}`, { method: "DELETE" }),
};
