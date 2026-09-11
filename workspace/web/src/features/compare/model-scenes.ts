import type { Object3D } from "three";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ModelScenesState {
  /** versionId → マウント中の ModelMesh が持つ glTF の scene。参照をそのまま保持する(複製しない) */
  scenes: Readonly<Record<string, Object3D>>;
  /** 登録。同じ versionId に同じ scene 参照が既にあれば state を更新しない */
  register(versionId: string, scene: Object3D): void;
  /** 登録中の scene と同じ参照のときだけ削除する(別の scene が登録済みなら触らない) */
  unregister(versionId: string, scene: Object3D): void;
  reset(): void;
}

export const useModelScenesStore: UseBoundStore<StoreApi<ModelScenesState>> = create<ModelScenesState>((set, get) => ({
  scenes: {},

  register(versionId, scene) {
    if (get().scenes[versionId] === scene) return;
    set({ scenes: { ...get().scenes, [versionId]: scene } });
  },

  unregister(versionId, scene) {
    if (get().scenes[versionId] !== scene) return;
    const { [versionId]: removed, ...remaining } = get().scenes;
    void removed;
    set({ scenes: remaining });
  },

  reset() {
    set({ scenes: {} });
  },
}));

/** versionId が null または未登録なら null */
export function selectModelScene(
  scenes: Readonly<Record<string, Object3D>>,
  versionId: string | null,
): Object3D | null {
  return versionId === null || !Object.hasOwn(scenes, versionId) ? null : scenes[versionId] ?? null;
}
