import { isMeshCompareActive } from "@shared/compare";
import type { MeshCompare } from "@shared/types";

/**
 * 比較のために versionId の版の描画を止めるべきか。
 * 比較が有効で、baseVisible が true でなく、versionId が基準で、対象が表示中のときだけ true。
 */
export function isHiddenByCompare(
  compare: MeshCompare,
  hiddenIds: readonly string[],
  versionId: string,
): boolean {
  return isMeshCompareActive(compare)
    && compare.baseVisible !== true
    && versionId === compare.baseId
    && !hiddenIds.includes(compare.targetId);
}
