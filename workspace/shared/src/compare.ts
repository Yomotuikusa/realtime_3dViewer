import type { MeshCompare } from "./types";

/** baseId と targetId が両方あるときの型 */
export type ActiveMeshCompare = MeshCompare & { baseId: string; targetId: string };

/** baseId と targetId が両方 non-null で、かつ互いに異なるときだけ true */
export function isMeshCompareActive(compare: MeshCompare): compare is ActiveMeshCompare {
  return compare.baseId !== null && compare.targetId !== null && compare.baseId !== compare.targetId;
}

/** 3フィールドの === 比較に加え、baseVisible は未指定を false とみなして等しいとき true */
export function meshCompareEquals(a: MeshCompare, b: MeshCompare): boolean {
  return a.baseId === b.baseId
    && a.targetId === b.targetId
    && a.thresholdPermille === b.thresholdPermille
    && (a.baseVisible ?? false) === (b.baseVisible ?? false);
}

/** 浅い複製(フィールドはプリミティブなので浅くてよい) */
export function cloneMeshCompare(compare: MeshCompare): MeshCompare {
  return { ...compare };
}
