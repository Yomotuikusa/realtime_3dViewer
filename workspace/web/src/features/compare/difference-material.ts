import { DoubleSide, MeshStandardMaterial } from "three";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 飛び出し(正の距離)の既定色。VIEWER_COLOR_DEFAULTS.light.compareOutside */
export const COMPARE_OUTSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside);
/** へこみ(負の距離)の既定色。VIEWER_COLOR_DEFAULTS.light.compareInside */
export const COMPARE_INSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside);
/** 対象本体と同一面での z ファイトを避けるための polygonOffsetFactor / polygonOffsetUnits */
export const DIFFERENCE_POLYGON_OFFSET = -1;

/** 比較の色。値は 0xrrggbb */
export interface CompareColors {
  outside: number;
  inside: number;
}

/** [飛び出し用, へこみ用] の材質を新しく作る。 */
export function createDifferenceMaterials(): [MeshStandardMaterial, MeshStandardMaterial] {
  const createMaterial = (color: number): MeshStandardMaterial => new MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: DIFFERENCE_POLYGON_OFFSET,
    polygonOffsetUnits: DIFFERENCE_POLYGON_OFFSET,
  });
  return [createMaterial(COMPARE_OUTSIDE_COLOR), createMaterial(COMPARE_INSIDE_COLOR)];
}

/** 材質へ比較色を書き込む。 */
export function setDifferenceColors(
  materials: readonly MeshStandardMaterial[],
  colors: CompareColors,
): void {
  if (materials.length < 2) return;
  materials[0]!.color.setHex(colors.outside);
  materials[1]!.color.setHex(colors.inside);
}
