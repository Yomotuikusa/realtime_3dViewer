import type { AnimationClip } from "three";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ModelClipsState {
  /** versionId → マウント中のモデルが持つ AnimationClip。参照をそのまま保持する(複製しない) */
  clips: Readonly<Record<string, readonly AnimationClip[]>>;
  /** 登録。同じ versionId に同じ配列参照が既にあれば state を更新しない */
  register(versionId: string, clips: readonly AnimationClip[]): void;
  /** 登録中の配列と同じ参照のときだけ削除する(別の配列が登録済みなら触らない) */
  unregister(versionId: string, clips: readonly AnimationClip[]): void;
  reset(): void;
}

export const useModelClipsStore: UseBoundStore<StoreApi<ModelClipsState>> = create<ModelClipsState>((set, get) => ({
  clips: {},

  register(versionId, clips) {
    const registered = get().clips;
    if (Object.hasOwn(registered, versionId) && registered[versionId] === clips) return;
    set({ clips: { ...registered, [versionId]: clips } });
  },

  unregister(versionId, clips) {
    const registered = get().clips;
    if (!Object.hasOwn(registered, versionId) || registered[versionId] !== clips) return;
    const { [versionId]: removed, ...remaining } = registered;
    void removed;
    set({ clips: remaining });
  },

  reset() {
    set({ clips: {} });
  },
}));

/** versionId が null または未登録なら null。空配列は空配列のまま返す */
export function selectModelClips(
  clips: Readonly<Record<string, readonly AnimationClip[]>>,
  versionId: string | null,
): readonly AnimationClip[] | null {
  return versionId === null || !Object.hasOwn(clips, versionId) ? null : clips[versionId] ?? null;
}
