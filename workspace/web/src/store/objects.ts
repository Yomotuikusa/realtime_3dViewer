import type { ModelVersion } from "@shared/types";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ObjectsStoreState {
  /** シーンのオブジェクト。number 昇順。要素は複製して保持 */
  objects: ModelVersion[];
  /** 非表示の versionId。追加順。objects に無い id も保持してよい */
  hiddenIds: string[];
  /** 全置換。number 昇順に並べ替えて複製。hiddenIds は維持する */
  setObjects(versions: readonly ModelVersion[]): void;
  /** 追加。同じ id が既にあれば何もしない。挿入後も number 昇順 */
  append(version: ModelVersion): void;
  /** visible=false なら hiddenIds に追加、true なら除去する */
  setVisible(versionId: string, visible: boolean): void;
  /** welcome の hiddenObjectIds で hiddenIds を全置換する */
  applyWelcome(hiddenIds: readonly string[]): void;
  reset(): void;
}

const INITIAL_STATE = { objects: [] as ModelVersion[], hiddenIds: [] as string[] };

function copyAndSort(versions: readonly ModelVersion[]): ModelVersion[] {
  return versions
    .map((version) => ({ ...version }))
    .sort((left, right) => left.number - right.number);
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export const useObjectsStore: UseBoundStore<StoreApi<ObjectsStoreState>> = create<ObjectsStoreState>((set, get) => ({
  ...INITIAL_STATE,

  setObjects(versions) {
    set({ objects: copyAndSort(versions) });
  },

  append(version) {
    const { objects } = get();
    if (objects.some((current) => current.id === version.id)) return;
    set({ objects: copyAndSort([...objects, version]) });
  },

  setVisible(versionId, visible) {
    const { hiddenIds } = get();
    const index = hiddenIds.indexOf(versionId);
    if (visible) {
      if (index < 0) return;
      set({ hiddenIds: hiddenIds.filter((id) => id !== versionId) });
      return;
    }
    if (index >= 0) return;
    set({ hiddenIds: [...hiddenIds, versionId] });
  },

  applyWelcome(hiddenIds) {
    const nextIds = uniqueIds(hiddenIds);
    const currentIds = get().hiddenIds;
    if (currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])) return;
    set({ hiddenIds: nextIds });
  },

  reset() {
    set({ objects: [], hiddenIds: [] });
  },
}));

/** hiddenIds に含まれなければ表示中とみなす。 */
export function isObjectVisible(hiddenIds: readonly string[], versionId: string): boolean {
  return !hiddenIds.includes(versionId);
}

/** number が最小の版を再生、Fit、サイズ計測の基準にする。 */
export function primaryObjectId(objects: readonly ModelVersion[]): string | null {
  let primary: ModelVersion | undefined;
  for (const object of objects) {
    if (primary === undefined || object.number < primary.number) primary = object;
  }
  return primary?.id ?? null;
}
