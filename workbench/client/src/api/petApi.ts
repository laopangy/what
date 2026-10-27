import type {
  DesktopPetData,
  PetInteractionType,
  PetOverview,
  PetPosition,
  PetSettings,
} from "../types/pet";

const PET_API = "http://localhost:3002/api/pets";

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`${PET_API}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || "灵宠服务暂时不可用");
  return body as T;
}

export const getPetOverview = () => request<PetOverview>();

export const updatePetSettings = (updates: Partial<PetSettings>) =>
  request<{ success: true; state: DesktopPetData }>("/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });

export const updatePetPosition = (position: PetPosition) =>
  request<{ success: true; state: DesktopPetData }>("/position", {
    method: "PUT",
    body: JSON.stringify(position),
  });

export const recordPetInteraction = (type: PetInteractionType) =>
  request<{ success: true; state: DesktopPetData; rewarded: boolean }>("/interactions", {
    method: "POST",
    body: JSON.stringify({ type }),
  });

export function subscribeToPetState(onState: (state: DesktopPetData) => void): () => void {
  const source = new EventSource(`${PET_API}/events`);
  source.addEventListener("state", (event) => {
    try {
      onState(JSON.parse((event as MessageEvent<string>).data) as DesktopPetData);
    } catch {
      source.close();
    }
  });
  return () => source.close();
}
