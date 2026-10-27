import type { PetAction } from "../../types/pet";

const INTERRUPTIBLE = new Set<PetAction>(["idle", "walk", "curious", "sleep", "groom"]);

export function canEnterPetAction(current: PetAction, next: PetAction, userInitiated = false): boolean {
  if (next === "dragging") return true;
  if (current === "dragging") return next === "idle" || next === "happy";
  if (userInitiated) return true;
  return INTERRUPTIBLE.has(current);
}

export function actionDuration(action: PetAction): number {
  switch (action) {
    case "happy": return 700;
    case "curious": return 1_150;
    case "stretch": return 1_000;
    case "groom": return 1_350;
    case "sleep-enter": return 1_200;
    case "wake": return 900;
    case "walk": return 2_000;
    default: return 0;
  }
}
