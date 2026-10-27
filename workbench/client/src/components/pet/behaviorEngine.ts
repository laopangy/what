import type { PetAction, PetActivityLevel } from "../../types/pet";

interface WeightedBehavior {
  action: PetAction;
  weight: number;
}

const profiles: Record<PetActivityLevel, WeightedBehavior[]> = {
  quiet: [
    { action: "idle", weight: 38 },
    { action: "curious", weight: 18 },
    { action: "groom", weight: 18 },
    { action: "stretch", weight: 12 },
    { action: "walk", weight: 8 },
    { action: "sleep-enter", weight: 20 },
  ],
  normal: [
    { action: "idle", weight: 28 },
    { action: "curious", weight: 18 },
    { action: "groom", weight: 14 },
    { action: "stretch", weight: 14 },
    { action: "walk", weight: 20 },
    { action: "sleep-enter", weight: 12 },
  ],
  lively: [
    { action: "idle", weight: 16 },
    { action: "curious", weight: 20 },
    { action: "groom", weight: 8 },
    { action: "stretch", weight: 16 },
    { action: "walk", weight: 34 },
    { action: "happy", weight: 12 },
    { action: "sleep-enter", weight: 5 },
  ],
};

const petBias: Record<string, Partial<Record<PetAction, number>>> = {
  "sunny-dog": { walk: 1.55, happy: 1.7, "sleep-enter": 0.55, groom: 0.65 },
  "ember-fox": { walk: 1.7, stretch: 1.65, curious: 1.3, "sleep-enter": 0.7 },
  "cloud-rabbit": { walk: 1.25, curious: 1.7, happy: 1.25, groom: 0.7 },
  "bamboo-panda": { walk: 0.6, groom: 1.5, stretch: 1.45, "sleep-enter": 2 },
  "pixel-robot": { walk: 1.2, curious: 1.55, happy: 1.4, groom: 0.45, "sleep-enter": 0.75 },
};

export function choosePetBehavior(level: PetActivityLevel, previous: PetAction, petId: string): PetAction {
  const bias = petBias[petId] ?? {};
  const options = profiles[level]
    .filter((item) => item.action !== previous)
    .map((item) => ({ ...item, weight: item.weight * (bias[item.action] ?? 1) }));
  const total = options.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.action;
  }
  return "idle";
}

export function nextBehaviorDelay(level: PetActivityLevel): number {
  const range = level === "quiet" ? [8_000, 14_000] : level === "lively" ? [3_500, 7_000] : [5_500, 10_000];
  return range[0] + Math.random() * (range[1] - range[0]);
}
