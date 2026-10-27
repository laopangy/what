export type PetActivityLevel = "quiet" | "normal" | "lively";
export type PetInteractionType = "click" | "double-click" | "pet" | "feed" | "play" | "wake" | "sleep";
export type PetAction = "idle" | "walk" | "sleep-enter" | "sleep" | "happy" | "curious" | "stretch" | "groom" | "wake" | "dragging";

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

export interface CustomPetSummary {
  id: string;
  name: string;
  personality: string;
  description: string;
  source: "custom";
  asset: Omit<CustomPetAsset, "imageDataUrl" | "referenceDataUrls"> & { assetUrl: string };
  createdAt: string;
  updatedAt: string;
}

export interface DesktopPetData {
  schemaVersion: 1;
  settings: PetSettings;
  position: PetPosition;
  care: Record<string, PetCareState>;
  customPets: CustomPetSummary[];
  updatedAt: string;
}

export interface PetOverview {
  success: true;
  catalog: PetCatalogEntry[];
  state: DesktopPetData;
  capabilities: {
    customImage: boolean;
    imageGeneration: boolean;
    aiDialogue: boolean;
  };
}

export interface PetAnimationClip {
  sheet: string;
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface PetSpriteManifest {
  id: string;
  frameWidth: number;
  frameHeight: number;
  sheets: Record<string, string>;
  animations: Record<PetAction, PetAnimationClip>;
}
