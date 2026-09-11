import { cloneMeshCompare, meshCompareEquals } from "@shared/compare";
import { DEFAULT_MESH_COMPARE, DEFAULT_MESH_DISPLAY, type MeshCompare, type MeshDisplayMode } from "@shared/types";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface DisplayStoreState {
  /** メッシュの表示方法。初期値は DEFAULT_MESH_DISPLAY */
  meshDisplay: MeshDisplayMode;
  /** 同値なら state を更新しない(購読者を再描画させない) */
  setMeshDisplay(mode: MeshDisplayMode): void;
  /** メッシュ比較の設定。初期値は DEFAULT_MESH_COMPARE の複製 */
  meshCompare: MeshCompare;
  /** meshCompareEquals で同値なら state を更新しない。複製して保持する */
  setMeshCompare(compare: MeshCompare): void;
  reset(): void;
}

export const useDisplayStore: UseBoundStore<StoreApi<DisplayStoreState>> = create<DisplayStoreState>((set, get) => ({
  meshDisplay: DEFAULT_MESH_DISPLAY,
  meshCompare: cloneMeshCompare(DEFAULT_MESH_COMPARE),

  setMeshDisplay(mode) {
    if (get().meshDisplay === mode) return;
    set({ meshDisplay: mode });
  },

  setMeshCompare(compare) {
    if (meshCompareEquals(get().meshCompare, compare)) return;
    set({ meshCompare: cloneMeshCompare(compare) });
  },

  reset() {
    set({ meshDisplay: DEFAULT_MESH_DISPLAY, meshCompare: cloneMeshCompare(DEFAULT_MESH_COMPARE) });
  },
}));
