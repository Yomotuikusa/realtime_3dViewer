import { useEffect } from "react";
import { hiddenObjectPaths, useObjectsStore } from "../../store/objects";
import { useModelScenesStore } from "../compare/model-scenes";
import { applyPartVisibility } from "./visibility";

/** Canvas に 1 つだけ置く描画なしの部品。共有された部位の表示状態を scene へ反映する。 */
export function VisibilityRig(): null {
  const hiddenParts = useObjectsStore((state) => state.hiddenParts);
  const scenes = useModelScenesStore((state) => state.scenes);

  useEffect(() => {
    for (const [versionId, scene] of Object.entries(scenes)) {
      applyPartVisibility(scene, hiddenObjectPaths(hiddenParts, versionId));
    }
    return () => {
      for (const scene of Object.values(scenes)) applyPartVisibility(scene, []);
    };
  }, [scenes, hiddenParts]);

  return null;
}
