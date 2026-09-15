import { DEFAULT_COMPARE_THRESHOLD_PERMILLE, type MeshCompare } from "./types";

/**
 * しきい値スライダーの目盛(千分率)。昇順・長さ 60。
 * 添字 0..9 は 0, 0.1, …, 0.9(0.01% 刻み)、添字 10..59 は 1, 2, …, 50(0.1% 刻み)。
 * `i / 10`(i = 0..9)と `i + 1`(i = 0..49)で生成する。
 */
export const COMPARE_THRESHOLD_STEPS_PERMILLE: readonly number[] = [
  ...Array.from({ length: 10 }, (_, index) => index / 10),
  ...Array.from({ length: 50 }, (_, index) => index + 1),
];

/**
 * 値に最も近い目盛の添字。添字 0 を初期値として昇順に走査し、
 * 距離が真に小さいときだけ更新する(同距離なら小さい添字が残る)。
 * 非有限の値には DEFAULT_COMPARE_THRESHOLD_PERMILLE の添字(14)を返す。
 */
export function nearestCompareThresholdIndex(permille: number): number {
  if (!Number.isFinite(permille)) {
    return COMPARE_THRESHOLD_STEPS_PERMILLE.indexOf(DEFAULT_COMPARE_THRESHOLD_PERMILLE);
  }

  let nearestIndex = 0;
  let nearestDistance = Math.abs(COMPARE_THRESHOLD_STEPS_PERMILLE[0]! - permille);
  for (let index = 1; index < COMPARE_THRESHOLD_STEPS_PERMILLE.length; index += 1) {
    const distance = Math.abs(COMPARE_THRESHOLD_STEPS_PERMILLE[index]! - permille);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  return nearestIndex;
}

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
