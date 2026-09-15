import { useEffect, useState } from "react";
import { isMeshCompareActive } from "@shared/compare";
import type { DeviationResult } from "./deviation";
import { computeDeviation } from "./deviation";
import { clearCompareOverlays, applyCompareOverlay } from "./overlay";
import { useDisplayStore } from "../../store/display";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { hexToNumber } from "../theme/viewer-colors";
import { selectModelScene, useModelScenesStore } from "./model-scenes";

/** しきい値 0 のときにも計算誤差を着色しないための下限。基準サイズに対する比 */
export const ZERO_THRESHOLD_RATIO = 1e-6;

/** 千分率のしきい値をワールド単位へ換算する。 */
export function thresholdWorld(baseSize: number, thresholdPermille: number): number {
  return Math.max(baseSize * thresholdPermille / 1000, baseSize * ZERO_THRESHOLD_RATIO);
}

/** Canvas に1つだけ置く描画なしの部品。比較設定とロード済みシーンから重ね描きを管理する */
export function MeshCompareRig(): null {
  const compare = useDisplayStore((state) => state.meshCompare);
  const outsideColor = useThemeStore(selectViewerColor("compareOutside"));
  const insideColor = useThemeStore(selectViewerColor("compareInside"));
  const scenes = useModelScenesStore((state) => state.scenes);
  const active = isMeshCompareActive(compare);
  const base = active ? selectModelScene(scenes, compare.baseId) : null;
  const target = active ? selectModelScene(scenes, compare.targetId) : null;
  const [result, setResult] = useState<DeviationResult | null>(null);

  useEffect(() => {
    if (base === null || target === null) return;
    setResult(computeDeviation(target, base));
    return () => {
      clearCompareOverlays(target);
      setResult(null);
    };
  }, [base, target]);

  useEffect(() => {
    if (result === null) return;
    const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
    const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) };
    for (const { mesh, signedDistance } of result.meshes) applyCompareOverlay(mesh, signedDistance, threshold, colors);
  }, [result, compare.thresholdPermille, outsideColor, insideColor]);

  return null;
}
