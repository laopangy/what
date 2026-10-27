import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { PET_CATALOG, type CustomPetAsset, type CustomPetRecord } from "../types/pet.js";
import { callPetDialogue, getPetAiStatus } from "../services/petAI.js";
import { publishPetState, subscribeToPetEvents } from "../services/petEvents.js";
import {
  deleteCustomPet,
  getCustomPetAsset,
  getDesktopPetData,
  recordPetInteraction,
  saveCustomPet,
  toPublicDesktopPetData,
  updatePetPosition,
  updatePetSettings,
} from "../services/petStorage.js";

export const petRouter = Router();

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  activePetId: z.string().min(1).max(64).optional(),
  customName: z.string().trim().min(1).max(24).optional(),
  scale: z.number().min(0.65).max(1.6).optional(),
  opacity: z.number().min(0.45).max(1).optional(),
  autonomous: z.boolean().optional(),
  activityLevel: z.enum(["quiet", "normal", "lively"]).optional(),
  dialogueEnabled: z.boolean().optional(),
  followCursor: z.boolean().optional(),
  eventLinkEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
}).strict();

const positionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
}).strict();

const interactionSchema = z.object({
  type: z.enum(["click", "double-click", "pet", "feed", "play", "wake", "sleep"]),
}).strict();

const dialogueSchema = z.object({
  message: z.string().trim().min(1).max(500),
  currentAction: z.string().trim().min(1).max(40).default("idle"),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(500),
  }).strict()).max(10).default([]),
}).strict();

const animationSchema = z.object({
  columns: z.number().int().min(1).max(12),
  rows: z.number().int().min(1).max(12),
  fps: z.number().int().min(1).max(30),
  actionRows: z.boolean().default(false),
  frameCount: z.number().int().min(1).max(144).optional(),
}).strict();

const customPetSchema = z.object({
  name: z.string().trim().min(1).max(24),
  personality: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).default(""),
  asset: z.object({
    mode: z.enum(["static", "animated-image", "sprite"]),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    imageDataUrl: z.string().max(8_000_000),
    referenceDataUrls: z.array(z.string().max(2_000_000)).max(3).default([]),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    backgroundRemoved: z.boolean().default(false),
    animation: animationSchema.optional(),
  }).strict(),
}).strict();

const signatures: Record<CustomPetAsset["mimeType"], (bytes: Buffer) => boolean> = {
  "image/png": (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
  "image/webp": (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
  "image/gif": (bytes) => bytes.length >= 6 && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a"),
};

function readUInt24LE(bytes: Buffer, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readImageDimensions(bytes: Buffer, mimeType: CustomPetAsset["mimeType"]): { width: number; height: number } {
  if (mimeType === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mimeType === "image/gif" && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const chunk = bytes.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X") return { width: readUInt24LE(bytes, 24) + 1, height: readUInt24LE(bytes, 27) + 1 };
    if (chunk === "VP8L" && bytes[20] === 47) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
        height: 1 + ((bytes[22] & 192) >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10),
      };
    }
    if (chunk === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      return { width: bytes.readUInt16LE(26) & 16383, height: bytes.readUInt16LE(28) & 16383 };
    }
  }
  if (mimeType === "image/jpeg") {
    const startOfFrame = new Set([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (startOfFrame.has(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      if (marker === 216 || marker === 217) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += length + 2;
    }
  }
  throw new Error("无法读取图片尺寸，请确认文件未损坏");
}

function decodeImageDataUrl(source: string, mimeType: CustomPetAsset["mimeType"]): Buffer {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match || match[1] !== mimeType) throw new Error("图片内容与声明格式不一致");
  const bytes = Buffer.from(match[2], "base64");
  if (!signatures[mimeType](bytes)) throw new Error("图片文件签名无效");
  return bytes;
}

function validateCustomAsset(asset: CustomPetAsset): void {
  const sources = [asset.imageDataUrl, ...asset.referenceDataUrls];
  const decoded = sources.map((source) => decodeImageDataUrl(source, asset.mimeType));
  const total = decoded.reduce((sum, bytes) => sum + bytes.byteLength, 0);
  if (total > 8 * 1024 * 1024) throw new Error("单只灵宠的加密图片资源不能超过 8 MB");
  const dimensions = decoded.map((bytes) => readImageDimensions(bytes, asset.mimeType));
  if (dimensions.some(({ width, height }) => width < 1 || height < 1 || width > 4096 || height > 4096)) {
    throw new Error("图片实际尺寸必须在 1-4096 像素之间");
  }
  if (dimensions[0].width !== asset.width || dimensions[0].height !== asset.height) {
    throw new Error("图片实际尺寸与声明尺寸不一致");
  }
  if (asset.mode === "sprite") {
    if (!asset.animation) throw new Error("Sprite Sheet 需要帧列数、行数和帧率");
    if (asset.width % asset.animation.columns !== 0 || asset.height % asset.animation.rows !== 0) {
      throw new Error("Sprite Sheet 尺寸必须能被帧列数和行数整除");
    }
    if (asset.animation.frameCount && asset.animation.frameCount > asset.animation.columns * asset.animation.rows) {
      throw new Error("Sprite Sheet 有效帧数不能超过图集容量");
    }
  }
  if (asset.mode === "animated-image" && asset.mimeType !== "image/gif" && asset.mimeType !== "image/webp") {
    throw new Error("动画图片仅支持 GIF 或 WebP");
  }
}

const customCatalog = (state: Awaited<ReturnType<typeof getDesktopPetData>>) => state.customPets.map((pet) => ({
  id: pet.id,
  name: pet.name,
  species: "custom" as const,
  source: "custom" as const,
  personality: pet.personality,
  description: pet.description || "由图片创建的专属伙伴",
  signatureActions: pet.asset.mode === "sprite" ? ["自定义分帧动作"] : pet.asset.mode === "animated-image" ? ["原始动画"] : ["呼吸", "轻微互动"],
  available: true,
}));

petRouter.get("/", async (_req, res) => {
  const state = await getDesktopPetData();
  res.json({
    success: true,
    catalog: [...PET_CATALOG, ...customCatalog(state)],
    state: toPublicDesktopPetData(state),
    capabilities: {
      customImage: true,
      imageGeneration: false,
      aiDialogue: getPetAiStatus().configured,
    },
  });
});

petRouter.get("/events", async (req, res) => {
  subscribeToPetEvents(req, res, toPublicDesktopPetData(await getDesktopPetData()));
});

petRouter.get("/custom/:id/asset", async (req, res) => {
  const asset = await getCustomPetAsset(req.params.id);
  if (!asset) {
    res.status(404).json({ success: false, error: "自定义灵宠不存在" });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json({ success: true, asset });
});

petRouter.post("/custom", async (req, res) => {
  const parsed = customPetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  try {
    validateCustomAsset(parsed.data.asset);
    const now = new Date().toISOString();
    const record: CustomPetRecord = { id: uuidv4(), ...parsed.data, createdAt: now, updatedAt: now };
    const data = await saveCustomPet(record);
    const state = toPublicDesktopPetData(data);
    publishPetState(state);
    res.status(201).json({ success: true, state, pet: state.customPets.find((pet) => pet.id === record.id) });
  } catch (error: unknown) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "保存失败" });
  }
});

petRouter.put("/custom/:id", async (req, res) => {
  const parsed = customPetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  try {
    validateCustomAsset(parsed.data.asset);
    const current = await getDesktopPetData();
    const existing = current.customPets.find((pet) => pet.id === req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: "自定义灵宠不存在" });
      return;
    }
    const record: CustomPetRecord = {
      id: existing.id,
      ...parsed.data,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const data = await saveCustomPet(record);
    const state = toPublicDesktopPetData(data);
    publishPetState(state);
    res.json({ success: true, state, pet: state.customPets.find((pet) => pet.id === record.id) });
  } catch (error: unknown) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : "保存失败" });
  }
});

petRouter.delete("/custom/:id", async (req, res) => {
  const result = await deleteCustomPet(req.params.id);
  if (!result.deleted) {
    res.status(404).json({ success: false, error: "自定义灵宠不存在" });
    return;
  }
  const state = toPublicDesktopPetData(result.data);
  publishPetState(state);
  res.json({ success: true, state });
});

petRouter.get("/ai/status", (_req, res) => {
  res.json({ success: true, dialogue: getPetAiStatus(), imageGeneration: { configured: false } });
});

petRouter.post("/dialogue", async (req, res) => {
  const parsed = dialogueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  try {
    const state = await getDesktopPetData();
    const petId = state.settings.activePetId;
    const builtin = PET_CATALOG.find((pet) => pet.id === petId);
    const custom = state.customPets.find((pet) => pet.id === petId);
    const reply = await callPetDialogue({
      petName: state.settings.customName,
      personality: custom?.personality ?? builtin?.personality ?? "温柔、亲近",
      currentAction: parsed.data.currentAction,
      mood: state.care[petId]?.mood ?? 72,
      message: parsed.data.message,
      history: parsed.data.history,
    });
    res.json({ success: true, reply });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "灵宠对话失败";
    res.status(message.includes("未配置") ? 503 : 502).json({ success: false, error: message });
  }
});

petRouter.put("/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  try {
    const state = await updatePetSettings(parsed.data);
    const publicState = toPublicDesktopPetData(state);
    publishPetState(publicState);
    res.json({ success: true, state: publicState });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "保存失败";
    res.status(message === "灵宠不存在或尚未开放" ? 409 : 500).json({ success: false, error: message });
  }
});

petRouter.put("/position", async (req, res) => {
  const parsed = positionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  const state = toPublicDesktopPetData(await updatePetPosition(parsed.data));
  publishPetState(state);
  res.json({ success: true, state });
});

petRouter.post("/interactions", async (req, res) => {
  const parsed = interactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  const result = await recordPetInteraction(parsed.data.type);
  const state = toPublicDesktopPetData(result.data);
  publishPetState(state);
  res.json({ success: true, state, rewarded: result.rewarded });
});
