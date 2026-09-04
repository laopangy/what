import { readVault, updateVault } from "./vault.js";
import type { Journey } from "./journeyTypes.js";
type Section = { journeys?: Journey[] };
export async function readJourneys(): Promise<Journey[]> {
  const data = await readVault();
  return (data.outdoor as Section | undefined)?.journeys || [];
}
export async function saveJourney(journey: Journey): Promise<Journey> {
  return updateVault(data => {
    const section = (data.outdoor || {}) as Section;
    const saved = { ...journey, saved: true };
    section.journeys = [saved, ...(section.journeys || []).filter(item => item.id !== saved.id)];
    data.outdoor = section;
    return saved;
  });
}
export async function deleteJourney(id: string): Promise<void> {
  await updateVault(data => {
    const section = (data.outdoor || {}) as Section;
    section.journeys = (section.journeys || []).filter(item => item.id !== id);
    data.outdoor = section;
  });
}
