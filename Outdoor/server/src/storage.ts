import { readVault, updateVault } from "./vault.js";
import type { Itinerary, OutdoorSettings, OutdoorState } from "./types.js";

const normalizeState = (state: OutdoorState | undefined): OutdoorState => ({
  plans: Array.isArray(state?.plans) ? state.plans : [],
  settings: {
    homeAddress: typeof state?.settings?.homeAddress === "string" ? state.settings.homeAddress : "",
  },
});

export async function readState(): Promise<OutdoorState> {
  const data = await readVault();
  const state = data.outdoor as OutdoorState | undefined;
  return normalizeState(state);
}

export async function saveSettings(settings: OutdoorSettings): Promise<OutdoorSettings> {
  return updateVault((data) => {
    const state = normalizeState(data.outdoor as OutdoorState | undefined);
    state.settings = settings;
    data.outdoor = state;
    return state.settings;
  });
}

export async function savePlan(plan: Itinerary): Promise<Itinerary> {
  return updateVault((data) => {
    const state = normalizeState(data.outdoor as OutdoorState | undefined);
    const savedPlan = { ...plan, saved: true, updatedAt: new Date().toISOString() };
    const index = state.plans.findIndex((item) => item.id === savedPlan.id);
    if (index >= 0) state.plans[index] = savedPlan;
    else state.plans.unshift(savedPlan);
    data.outdoor = state;
    return savedPlan;
  });
}

export async function deletePlan(id: string): Promise<boolean> {
  return updateVault((data) => {
    const state = normalizeState(data.outdoor as OutdoorState | undefined);
    const before = state.plans.length;
    state.plans = state.plans.filter((plan) => plan.id !== id);
    data.outdoor = state;
    return state.plans.length < before;
  });
}
