import { create } from "zustand";
import { themeApi } from "../api/client";
import { extractColors } from "../utils/colorExtractor";
import { mapColorsToTokens } from "../utils/colorMapper";
import { applyTheme, resetTheme } from "../utils/themeApplier";
import type { ThemeTokens } from "../utils/colorMapper";

interface ThemeStore {
  selectedImage: string | null;
  availableImages: string[];
  colors: ThemeTokens | null;
  isApplying: boolean;
  error: string | null;

  fetchImages: () => Promise<void>;
  selectImage: (filename: string) => Promise<void>;
  resetToDefault: () => void;
  _hydrate: () => void;
}

const STORAGE_KEY_IMAGE = "theme-selected-image";
const STORAGE_KEY_COLORS = "theme-colors";

function imageUrl(filename: string): string {
  return `/images/${filename}`;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  selectedImage: null,
  availableImages: [],
  colors: null,
  isApplying: false,
  error: null,

  fetchImages: async () => {
    try {
      const res = await themeApi.images();
      if (res.success && res.data) {
        set({ availableImages: res.data });
      }
    } catch {
      // Server might not be running yet — ignore
    }
  },

  selectImage: async (filename: string) => {
    set({ isApplying: true, error: null });
    try {
      const url = imageUrl(filename);
      const clusters = await extractColors(url, 10);
      if (clusters.length === 0) {
        set({ isApplying: false, error: "未能提取颜色" });
        return;
      }
      const tokens = mapColorsToTokens(clusters);
      applyTheme(tokens, url);
      localStorage.setItem(STORAGE_KEY_IMAGE, filename);
      localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(tokens));
      set({ selectedImage: filename, colors: tokens, isApplying: false });
    } catch (e) {
      set({ isApplying: false, error: e instanceof Error ? e.message : "主题应用失败" });
    }
  },

  resetToDefault: () => {
    resetTheme();
    localStorage.removeItem(STORAGE_KEY_IMAGE);
    localStorage.removeItem(STORAGE_KEY_COLORS);
    set({ selectedImage: null, colors: null, error: null });
  },

  _hydrate: () => {
    const stored = localStorage.getItem(STORAGE_KEY_IMAGE);
    const storedColors = localStorage.getItem(STORAGE_KEY_COLORS);
    if (stored && storedColors) {
      try {
        const tokens = JSON.parse(storedColors) as ThemeTokens;
        applyTheme(tokens, imageUrl(stored));
        set({ selectedImage: stored, colors: tokens });
      } catch {
        localStorage.removeItem(STORAGE_KEY_IMAGE);
        localStorage.removeItem(STORAGE_KEY_COLORS);
      }
    }
    get().fetchImages();
  },
}));
