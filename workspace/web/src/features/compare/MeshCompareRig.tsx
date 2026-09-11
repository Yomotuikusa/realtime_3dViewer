import { useEffect, useState } from "react";
import { isMeshCompareActive } from "@shared/compare";
import type { DeviationResult } from "./deviation";
import { computeDeviation } from "./deviation";
import { clearCompareOverlays, applyCompareOverlay } from "./overlay";
import { useDisplayStore } from "../../store/display";
import { selectModelScene, useModelScenesStore } from "./model-scenes";

/** 千分率のしきい値をワールド単位へ換算する。baseSize * permille / 1000 */
export function thresholdWorld(baseSize: number, thresholdPermille: number): number {
  return baseSize * thresholdPermille / 1000;
}

/** Canvas に1つだけ置く描画なしの部品。比較設定とロード済みシーンから重ね描きを管理する */
export function MeshCompareRig(): null {
  const compare = useDisplayStore((state) => state.meshCompare);
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
    for (const { mesh, signedDistance } of result.meshes) applyCompareOverlay(mesh, signedDistance, threshold);
  }, [result, compare.thresholdPermille]);

  return null;
}
