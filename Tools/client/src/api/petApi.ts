import type { CustomPetAssetInput, CustomPetSummary, DesktopPetData, PetOverview, PetSettings } from "../types/pet";

const BASE = "/api/pets";

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || "灵宠服务暂时不可用");
  return body as T;
}

export interface CustomPetPayload {
  name: string;
  personality: string;
  description: string;
  asset: CustomPetAssetInput;
}

export const petApi = {
  getOverview: () => request<PetOverview>(),
  createCustom: (payload: CustomPetPayload) => request<{ success: true; state: DesktopPetData; pet: CustomPetSummary }>("/custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),
  updateCustom: (id: string, payload: CustomPetPayload) => request<{ success: true; state: DesktopPetData; pet: CustomPetSummary }>(`/custom/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }),
  deleteCustom: (id: string) => request<{ success: true; state: DesktopPetData }>(`/custom/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getCustomAsset: (id: string) => request<{ success: true; asset: CustomPetAssetInput }>(`/custom/${encodeURIComponent(id)}/asset`),
  updateSettings: (updates: Partial<PetSettings>) => request<{ success: true; state: DesktopPetData }>("/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  }),
  subscribe: (onState: (state: DesktopPetData) => void) => {
    const source = new EventSource(`${BASE}/events`);
    source.addEventListener("state", (event) => {
      onState(JSON.parse((event as MessageEvent<string>).data) as DesktopPetData);
    });
    return () => source.close();
  },
};
