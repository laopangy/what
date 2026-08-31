import { readVault, updateVault } from "./vault.js";
import type { Itinerary, OutdoorState } from "./types.js";

const emptyState = (): OutdoorState => ({ plans: [] });

export async function readState(): Promise<OutdoorState> {
  const data = await readVault();
  const state = data.outdoor as OutdoorState | undefined;
  return state && Array.isArray(state.plans) ? state : emptyState();
}

export async function savePlan(plan: Itinerary): Promise<Itinerary> {
  return updateVault((data) => {
    const state = (data.outdoor as OutdoorState | undefined) || emptyState();
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
    const state = (data.outdoor as OutdoorState | undefined) || emptyState();
    const before = state.plans.length;
    state.plans = state.plans.filter((plan) => plan.id !== id);
    data.outdoor = state;
    return state.plans.length < before;
  });
}
