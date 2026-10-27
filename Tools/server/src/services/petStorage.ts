import { readVault, updateVault } from "../vault.js";
import {
  PET_CATALOG,
  createDefaultDesktopPetData,
  type CustomPetAsset,
  type CustomPetMode,
  type CustomPetRecord,
  type DesktopPetData,
  type PetCareState,
  type PetInteractionType,
  type PetPosition,
  type PetSettings,
  type PublicDesktopPetData,
} from "../types/pet.js";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const finiteOr = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const builtinPetIds = new Set(PET_CATALOG.filter((pet) => pet.available).map((pet) => pet.id));
const customModes = new Set<CustomPetMode>(["static", "animated-image", "sprite"]);

function normalizeCare(value: Partial<PetCareState> | undefined): PetCareState {
  return {
    affection: clamp(finiteOr(value?.affection, 0), 0, 100),
    mood: clamp(finiteOr(value?.mood, 72), 0, 100),
    totalInteractions: Math.max(0, Math.floor(finiteOr(value?.totalInteractions, 0))),
    lastRewardAt: typeof value?.lastRewardAt === "string" ? value.lastRewardAt : null,
  };
}

function normalizeCustomPets(value: unknown): CustomPetRecord[] {
  if (!Array.isArray(value)) return [];
  const normalized: CustomPetRecord[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<CustomPetRecord>;
    const asset = candidate.asset as Partial<CustomPetAsset> | undefined;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      !asset ||
      !customModes.has(asset.mode as CustomPetMode) ||
      typeof asset.imageDataUrl !== "string" ||
      !asset.imageDataUrl.startsWith("data:image/")
    ) continue;
    const now = new Date().toISOString();
    normalized.push({
      id: candidate.id.slice(0, 64),
      name: candidate.name.trim().slice(0, 24) || "自定义灵宠",
      personality: typeof candidate.personality === "string" ? candidate.personality.slice(0, 120) : "独特、亲近",
      description: typeof candidate.description === "string" ? candidate.description.slice(0, 240) : "由图片创建的专属伙伴",
      asset: {
        mode: asset.mode as CustomPetMode,
        mimeType: asset.mimeType === "image/jpeg" || asset.mimeType === "image/webp" || asset.mimeType === "image/gif" ? asset.mimeType : "image/png",
        imageDataUrl: asset.imageDataUrl,
        referenceDataUrls: Array.isArray(asset.referenceDataUrls) ? asset.referenceDataUrls.filter((source): source is string => typeof source === "string" && source.startsWith("data:image/")).slice(0, 3) : [],
        width: clamp(Math.floor(finiteOr(asset.width, 512)), 1, 4096),
        height: clamp(Math.floor(finiteOr(asset.height, 512)), 1, 4096),
        backgroundRemoved: asset.backgroundRemoved === true,
        animation: asset.animation ? {
          columns: clamp(Math.floor(finiteOr(asset.animation.columns, 1)), 1, 12),
          rows: clamp(Math.floor(finiteOr(asset.animation.rows, 1)), 1, 12),
          fps: clamp(Math.floor(finiteOr(asset.animation.fps, 8)), 1, 30),
          actionRows: asset.animation.actionRows === true,
          frameCount: typeof asset.animation.frameCount === "number"
            ? clamp(Math.floor(asset.animation.frameCount), 1, 144)
            : undefined,
        } : undefined,
      },
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : now,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
    });
  }
  return normalized;
}

export function normalizeDesktopPetData(value: Partial<DesktopPetData> | undefined): DesktopPetData {
  const defaults = createDefaultDesktopPetData();
  const customPets = normalizeCustomPets(value?.customPets);
  const petIds = [...PET_CATALOG.map((pet) => pet.id), ...customPets.map((pet) => pet.id)];
  const settings = value?.settings;
  const activePetId = typeof settings?.activePetId === "string" && petIds.includes(settings.activePetId)
    ? settings.activePetId
    : defaults.settings.activePetId;
  const position = value?.position;
  const careEntries = value?.care && typeof value.care === "object" ? value.care : {};
  const care = Object.fromEntries(petIds.map((petId) => [petId, normalizeCare(careEntries[petId])]));

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
    customPets,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : defaults.updatedAt,
  };
}

export async function getDesktopPetData(): Promise<DesktopPetData> {
  const data = await readVault();
  return normalizeDesktopPetData(data.desktopPets);
}

export function toPublicDesktopPetData(data: DesktopPetData): PublicDesktopPetData {
  return {
    ...data,
    customPets: data.customPets.map(({ asset, ...pet }) => ({
      ...pet,
      source: "custom" as const,
      asset: {
        mode: asset.mode,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        backgroundRemoved: asset.backgroundRemoved,
        animation: asset.animation,
        assetUrl: `/api/pets/custom/${encodeURIComponent(pet.id)}/asset`,
      },
    })),
  };
}

export async function getCustomPetAsset(id: string): Promise<CustomPetAsset | undefined> {
  return (await getDesktopPetData()).customPets.find((pet) => pet.id === id)?.asset;
}

export async function saveCustomPet(record: CustomPetRecord): Promise<DesktopPetData> {
  return updateVault((vault) => {
    const current = normalizeDesktopPetData(vault.desktopPets);
    const index = current.customPets.findIndex((pet) => pet.id === record.id);
    if (index >= 0) current.customPets[index] = record;
    else {
      if (current.customPets.length >= 12) throw new Error("最多保存 12 只自定义灵宠");
      current.customPets.push(record);
    }
    current.care[record.id] ??= normalizeCare(undefined);
    if (current.settings.activePetId === record.id) current.settings.customName = record.name;
    current.updatedAt = new Date().toISOString();
    vault.desktopPets = current;
    return current;
  });
}

export async function deleteCustomPet(id: string): Promise<{ data: DesktopPetData; deleted: boolean }> {
  return updateVault((vault) => {
    const current = normalizeDesktopPetData(vault.desktopPets);
    const nextPets = current.customPets.filter((pet) => pet.id !== id);
    const deleted = nextPets.length !== current.customPets.length;
    if (!deleted) return { data: current, deleted: false };
    current.customPets = nextPets;
    delete current.care[id];
    if (current.settings.activePetId === id) {
      current.settings.activePetId = "mist-cat";
      current.settings.customName = "雾团";
    }
    current.updatedAt = new Date().toISOString();
    vault.desktopPets = current;
    return { data: current, deleted: true };
  });
}

export async function updatePetSettings(updates: Partial<PetSettings>): Promise<DesktopPetData> {
  return updateVault((data) => {
    const current = normalizeDesktopPetData(data.desktopPets);
    const known = updates.activePetId && (builtinPetIds.has(updates.activePetId) || current.customPets.some((pet) => pet.id === updates.activePetId));
    if (updates.activePetId && !known) throw new Error("灵宠不存在或尚未开放");
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
