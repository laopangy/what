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

export function choosePetBehavior(level: PetActivityLevel, previous: PetAction): PetAction {
  const options = profiles[level].filter((item) => item.action !== previous);
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
