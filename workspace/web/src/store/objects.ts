import type { ModelVersion, ObjectPartRef, ObjectPath } from "@shared/types";
import { isSameObjectPart } from "@shared/object-part";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ObjectsStoreState {
  /** シーンのオブジェクト。number 昇順。要素は複製して保持 */
  objects: ModelVersion[];
  /** 非表示の versionId。追加順。objects に無い id も保持してよい */
  hiddenIds: string[];
  /** 非表示の部位。追加順。同じ部位は 1 つだけ。objects に無い versionId も保持してよい */
  hiddenParts: ObjectPartRef[];
  /** 全置換。number 昇順に並べ替えて複製。hiddenIds は維持する */
  setObjects(versions: readonly ModelVersion[]): void;
  /** 追加。同じ id が既にあれば何もしない。挿入後も number 昇順 */
  append(version: ModelVersion): void;
  /** visible=false なら hiddenIds に追加、true なら除去する */
  setVisible(versionId: string, visible: boolean): void;
  /** visible=false なら hiddenParts に追加、true なら除去する。変化が無ければ state を更新しない */
  setPartVisible(versionId: string, objectPath: ObjectPath, visible: boolean): void;
  /** welcome の hiddenObjectIds / hiddenObjectParts で両方を全置換する */
  applyWelcome(hiddenIds: readonly string[], hiddenParts?: readonly ObjectPartRef[]): void;
  reset(): void;
}

const INITIAL_STATE = {
  objects: [] as ModelVersion[],
  hiddenIds: [] as string[],
  hiddenParts: [] as ObjectPartRef[],
};

function copyAndSort(versions: readonly ModelVersion[]): ModelVersion[] {
  return versions
    .map((version) => ({ ...version }))
    .sort((left, right) => left.number - right.number);
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function copyAndUniqueParts(parts: readonly ObjectPartRef[]): ObjectPartRef[] {
  const unique: ObjectPartRef[] = [];
  for (const part of parts) {
    if (unique.some((current) => isSameObjectPart(current, part))) continue;
    unique.push({ versionId: part.versionId, objectPath: part.objectPath });
  }
  return unique;
}

function sameParts(left: readonly ObjectPartRef[], right: readonly ObjectPartRef[]): boolean {
  return left.length === right.length && left.every((part, index) => {
    const other = right[index];
    return other !== undefined && isSameObjectPart(part, other);
  });
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

  setPartVisible(versionId, objectPath, visible) {
    const { hiddenParts } = get();
    const part = { versionId, objectPath };
    const index = hiddenParts.findIndex((current) => isSameObjectPart(current, part));
    if (visible) {
      if (index < 0) return;
      set({ hiddenParts: hiddenParts.filter((_, currentIndex) => currentIndex !== index) });
      return;
    }
    if (index >= 0) return;
    set({ hiddenParts: [...hiddenParts, { ...part }] });
  },

  applyWelcome(hiddenIds, hiddenParts = []) {
    const nextIds = uniqueIds(hiddenIds);
    const nextParts = copyAndUniqueParts(hiddenParts);
    const currentIds = get().hiddenIds;
    const currentParts = get().hiddenParts;
    const sameIds = currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index]);
    if (sameIds && sameParts(currentParts, nextParts)) return;
    set({ hiddenIds: nextIds, hiddenParts: nextParts });
  },

  reset() {
    set({ objects: [], hiddenIds: [], hiddenParts: [] });
  },
}));

/** hiddenIds に含まれなければ表示中とみなす。 */
export function isObjectVisible(hiddenIds: readonly string[], versionId: string): boolean {
  return !hiddenIds.includes(versionId);
}

/** hiddenParts に同じ部位が無ければ表示中。 */
export function isObjectPartVisible(
  hiddenParts: readonly ObjectPartRef[],
  versionId: string,
  objectPath: ObjectPath,
): boolean {
  return !hiddenParts.some((part) => isSameObjectPart(part, { versionId, objectPath }));
}

/** versionId の非表示部位の objectPath を追加順で返す。 */
export function hiddenObjectPaths(hiddenParts: readonly ObjectPartRef[], versionId: string): ObjectPath[] {
  return hiddenParts.filter((part) => part.versionId === versionId).map((part) => part.objectPath);
}

/** number が最小の版を Fit、サイズ計測の基準にする。 */
export function primaryObjectId(objects: readonly ModelVersion[]): string | null {
  let primary: ModelVersion | undefined;
  for (const object of objects) {
    if (primary === undefined || object.number < primary.number) primary = object;
  }
  return primary?.id ?? null;
}
