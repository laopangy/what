export type PetActivityLevel = "quiet" | "normal" | "lively";
export type PetInteractionType = "click" | "double-click" | "pet" | "feed" | "play" | "wake" | "sleep";

export interface PetCatalogEntry {
  id: string;
  name: string;
  species: "cat" | "dog" | "fox" | "rabbit" | "red-panda" | "robot" | "custom";
  source?: "builtin" | "custom" | "ai";
  personality: string;
  description: string;
  signatureActions: string[];
  available: boolean;
}

export interface PetSettings {
  enabled: boolean;
  activePetId: string;
  customName: string;
  scale: number;
  opacity: number;
  autonomous: boolean;
  activityLevel: PetActivityLevel;
  dialogueEnabled: boolean;
  followCursor: boolean;
  eventLinkEnabled: boolean;
  soundEnabled: boolean;
}

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetCareState {
  affection: number;
  mood: number;
  totalInteractions: number;
  lastRewardAt: string | null;
}

export type CustomPetMode = "static" | "animated-image" | "sprite";

export interface CustomPetAnimationConfig {
  columns: number;
  rows: number;
  fps: number;
  actionRows: boolean;
  frameCount?: number;
}

export interface CustomPetAsset {
  mode: CustomPetMode;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  imageDataUrl: string;
  referenceDataUrls: string[];
  width: number;
  height: number;
  backgroundRemoved: boolean;
  animation?: CustomPetAnimationConfig;
}

export interface CustomPetRecord {
  id: string;
  name: string;
  personality: string;
  description: string;
  asset: CustomPetAsset;
  createdAt: string;
  updatedAt: string;
}

export interface CustomPetSummary extends Omit<CustomPetRecord, "asset"> {
  source: "custom";
  asset: Omit<CustomPetAsset, "imageDataUrl" | "referenceDataUrls"> & { assetUrl: string };
}

export interface DesktopPetData {
  schemaVersion: 1;
  settings: PetSettings;
  position: PetPosition;
  care: Record<string, PetCareState>;
  customPets: CustomPetRecord[];
  updatedAt: string;
}

export interface PublicDesktopPetData extends Omit<DesktopPetData, "customPets"> {
  customPets: CustomPetSummary[];
}

export const PET_CATALOG: PetCatalogEntry[] = [
  {
    id: "mist-cat",
    name: "雾团",
    species: "cat",
    personality: "慵懒、好奇",
    description: "喜欢安静观察，也会突然追逐光点。",
    signatureActions: ["伸懒腰", "舔爪", "开心跳跃"],
    available: true,
  },
  {
    id: "sunny-dog",
    name: "晴尾",
    species: "dog",
    personality: "活泼、热情",
    description: "热衷陪伴，见到你就会摇尾巴。",
    signatureActions: ["摇尾巴", "邀玩", "嗅闻"],
    available: true,
  },
  {
    id: "ember-fox",
    name: "烬耳",
    species: "fox",
    personality: "灵动、调皮",
    description: "步伐轻快，偶尔会藏起来观察你。",
    signatureActions: ["潜行", "转圈", "卷尾睡觉"],
    available: true,
  },
  {
    id: "cloud-rabbit",
    name: "云芽",
    species: "rabbit",
    personality: "温柔、谨慎",
    description: "会认真倾听周围的动静。",
    signatureActions: ["蹦跳", "竖耳", "鼻尖轻动"],
    available: true,
  },
  {
    id: "bamboo-panda",
    name: "竹丸",
    species: "red-panda",
    personality: "呆萌、悠闲",
    description: "动作慢悠悠，最擅长把自己团起来。",
    signatureActions: ["翻滚", "打哈欠", "抱尾巴"],
    available: true,
  },
  {
    id: "pixel-robot",
    name: "零一",
    species: "robot",
    personality: "理性、可靠",
    description: "会扫描工作台状态并切换电子表情。",
    signatureActions: ["扫描", "充电", "状态灯切换"],
    available: true,
  },
];

export function createDefaultDesktopPetData(now = new Date().toISOString()): DesktopPetData {
  return {
    schemaVersion: 1,
    settings: {
      enabled: false,
      activePetId: "mist-cat",
      customName: "雾团",
      scale: 1,
      opacity: 1,
      autonomous: true,
      activityLevel: "normal",
      dialogueEnabled: true,
      followCursor: false,
      eventLinkEnabled: true,
      soundEnabled: false,
    },
    position: { x: 0.84, y: 0.78 },
    care: {
      "mist-cat": {
        affection: 0,
        mood: 72,
        totalInteractions: 0,
        lastRewardAt: null,
      },
    },
    customPets: [],
    updatedAt: now,
  };
}
