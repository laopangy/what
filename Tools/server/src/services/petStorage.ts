import { readVault, updateVault } from "../vault.js";
import {
  PET_CATALOG,
  createDefaultDesktopPetData,
  type DesktopPetData,
  type PetCareState,
  type PetInteractionType,
  type PetPosition,
  type PetSettings,
} from "../types/pet.js";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const finiteOr = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const availablePetIds = new Set(PET_CATALOG.filter((pet) => pet.available).map((pet) => pet.id));

function normalizeCare(value: Partial<PetCareState> | undefined): PetCareState {
  return {
    affection: clamp(finiteOr(value?.affection, 0), 0, 100),
    mood: clamp(finiteOr(value?.mood, 72), 0, 100),
    totalInteractions: Math.max(0, Math.floor(finiteOr(value?.totalInteractions, 0))),
    lastRewardAt: typeof value?.lastRewardAt === "string" ? value.lastRewardAt : null,
  };
}

export function normalizeDesktopPetData(value: Partial<DesktopPetData> | undefined): DesktopPetData {
  const defaults = createDefaultDesktopPetData();
  const settings = value?.settings;
  const activePetId = typeof settings?.activePetId === "string" && availablePetIds.has(settings.activePetId)
    ? settings.activePetId
    : defaults.settings.activePetId;
  const position = value?.position;
  const careEntries = value?.care && typeof value.care === "object" ? value.care : {};
  const care = Object.fromEntries(
    PET_CATALOG.map((pet) => [pet.id, normalizeCare(careEntries[pet.id])]),
  );

  return {
    schemaVersion: 1,
    settings: {
      enabled: typeof settings?.enabled === "boolean" ? settings.enabled : defaults.settings.enabled,
      activePetId,
      customName: typeof settings?.customName === "string" && settings.customName.trim()
        ? settings.customName.trim().slice(0, 24)
        : defaults.settings.customName,
      scale: clamp(Number(settings?.scale) || defaults.settings.scale, 0.65, 1.6),
      opacity: clamp(Number(settings?.opacity) || defaults.settings.opacity, 0.45, 1),
      autonomous: typeof settings?.autonomous === "boolean" ? settings.autonomous : defaults.settings.autonomous,
      activityLevel: settings?.activityLevel === "quiet" || settings?.activityLevel === "lively"
        ? settings.activityLevel
        : "normal",
      dialogueEnabled: typeof settings?.dialogueEnabled === "boolean" ? settings.dialogueEnabled : defaults.settings.dialogueEnabled,
      followCursor: typeof settings?.followCursor === "boolean" ? settings.followCursor : defaults.settings.followCursor,
      eventLinkEnabled: typeof settings?.eventLinkEnabled === "boolean" ? settings.eventLinkEnabled : defaults.settings.eventLinkEnabled,
      soundEnabled: typeof settings?.soundEnabled === "boolean" ? settings.soundEnabled : defaults.settings.soundEnabled,
    },
    position: {
      x: clamp(finiteOr(position?.x, defaults.position.x), 0, 1),
      y: clamp(finiteOr(position?.y, defaults.position.y), 0, 1),
    },
    care,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : defaults.updatedAt,
  };
}

export async function getDesktopPetData(): Promise<DesktopPetData> {
  const data = await readVault();
  return normalizeDesktopPetData(data.desktopPets);
}

export async function updatePetSettings(updates: Partial<PetSettings>): Promise<DesktopPetData> {
  return updateVault((data) => {
    const current = normalizeDesktopPetData(data.desktopPets);
    if (updates.activePetId && !availablePetIds.has(updates.activePetId)) {
      throw new Error("该灵宠尚未开放");
    }
    const next = normalizeDesktopPetData({
      ...current,
      settings: { ...current.settings, ...updates },
      updatedAt: new Date().toISOString(),
    });
    data.desktopPets = next;
    return next;
  });
}

export async function updatePetPosition(position: PetPosition): Promise<DesktopPetData> {
  return updateVault((data) => {
    const current = normalizeDesktopPetData(data.desktopPets);
    const next = normalizeDesktopPetData({
      ...current,
      position,
      updatedAt: new Date().toISOString(),
    });
    data.desktopPets = next;
    return next;
  });
}

export async function recordPetInteraction(
  type: PetInteractionType,
  now = new Date(),
): Promise<{ data: DesktopPetData; rewarded: boolean }> {
  return updateVault((vault) => {
    const current = normalizeDesktopPetData(vault.desktopPets);
    const petId = current.settings.activePetId;
    const care = current.care[petId] ?? normalizeCare(undefined);
    const lastReward = care.lastRewardAt ? Date.parse(care.lastRewardAt) : 0;
    const rewarded = !Number.isFinite(lastReward) || now.getTime() - lastReward >= 30_000;
    const affectionGain = type === "feed" || type === "play" ? 2 : 1;
    const moodGain = type === "feed" || type === "play" ? 4 : 2;
    const nextCare: PetCareState = {
      affection: rewarded ? clamp(care.affection + affectionGain, 0, 100) : care.affection,
      mood: rewarded ? clamp(care.mood + moodGain, 0, 100) : care.mood,
      totalInteractions: care.totalInteractions + 1,
      lastRewardAt: rewarded ? now.toISOString() : care.lastRewardAt,
    };
    const next = normalizeDesktopPetData({
      ...current,
      care: { ...current.care, [petId]: nextCare },
      updatedAt: now.toISOString(),
    });
    vault.desktopPets = next;
    return { data: next, rewarded };
  });
}
