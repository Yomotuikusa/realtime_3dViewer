import { DEFAULT_MESH_DISPLAY, type MeshDisplayMode } from "@shared/types";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface DisplayStoreState {
  /** メッシュの表示方法。初期値は DEFAULT_MESH_DISPLAY */
  meshDisplay: MeshDisplayMode;
  /** 同値なら state を更新しない(購読者を再描画させない) */
  setMeshDisplay(mode: MeshDisplayMode): void;
  reset(): void;
}

export const useDisplayStore: UseBoundStore<StoreApi<DisplayStoreState>> = create<DisplayStoreState>((set, get) => ({
  meshDisplay: DEFAULT_MESH_DISPLAY,

  setMeshDisplay(mode) {
    if (get().meshDisplay === mode) return;
    set({ meshDisplay: mode });
  },

  reset() {
    set({ meshDisplay: DEFAULT_MESH_DISPLAY });
  },
}));
