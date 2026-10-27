import { create } from "zustand";
import {
  getPetOverview,
  recordPetInteraction,
  updatePetPosition,
  updatePetSettings,
} from "../api/petApi";
import type {
  DesktopPetData,
  PetCatalogEntry,
  PetInteractionType,
  PetPosition,
  PetSettings,
} from "../types/pet";

interface PetStore {
  catalog: PetCatalogEntry[];
  state: DesktopPetData | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  applyState: (state: DesktopPetData) => void;
  saveSettings: (updates: Partial<PetSettings>) => Promise<void>;
  savePosition: (position: PetPosition) => Promise<void>;
  interact: (type: PetInteractionType) => Promise<boolean>;
}

export const usePetStore = create<PetStore>((set) => ({
  catalog: [],
  state: null,
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const overview = await getPetOverview();
      set({ catalog: overview.catalog, state: overview.state, loading: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : "无法加载灵宠", loading: false });
    }
  },
  applyState: (state) => set({ state, error: null }),
  saveSettings: async (updates) => {
    const result = await updatePetSettings(updates);
    set({ state: result.state, error: null });
  },
  savePosition: async (position) => {
    const result = await updatePetPosition(position);
    set({ state: result.state, error: null });
  },
  interact: async (type) => {
    const result = await recordPetInteraction(type);
    set({ state: result.state, error: null });
    return result.rewarded;
  },
}));
