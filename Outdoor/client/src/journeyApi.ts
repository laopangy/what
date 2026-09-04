import type { Candidate, Journey, MapStatus, Place, TripDraft } from "./journeyTypes";
async function request<T>(path: string, data?: unknown, method = "POST"): Promise<T> {
  const response = await fetch("/api/outdoor" + path, data === undefined ? { method: "GET" } : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "请求失败，请稍后重试");
  return body as T;
}
export const journeyApi = {
  status: () => request<MapStatus>("/map/status"),
  sdk: () => request<{key: string; securityCode: string}>("/map/sdk"),
  places: (query: string, near?: Place, type?: "hotel") => request<Place[]>("/places", {query, near, type}),
  recommend: (draft: TripDraft) => request<{candidates: Candidate[]; note: string}>("/recommend", draft),
  generate: (draft: TripDraft) => request<Journey>("/journeys/generate", draft),
  saved: () => request<Journey[]>("/journeys"),
  save: (journey: Journey) => request<Journey>("/journeys", journey),
  remove: (id: string) => request<{success: boolean}>("/journeys/" + id, {}, "DELETE"),
};
