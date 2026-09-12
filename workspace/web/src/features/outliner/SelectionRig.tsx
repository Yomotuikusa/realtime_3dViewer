import { useEffect } from "react";
import { selectModelScene, useModelScenesStore } from "../compare/model-scenes";
import { applySelectionHighlight, clearSelectionHighlight } from "./selection-highlight";
import { useSelectionStore } from "./selection";

/** Canvas に 1 つだけ置く描画なしの部品。選択と scene から重ね描きを管理する */
export function SelectionRig(): null {
  const selected = useSelectionStore((state) => state.selected);
  const scenes = useModelScenesStore((state) => state.scenes);
  const scene = selectModelScene(scenes, selected?.versionId ?? null);

  useEffect(() => {
    if (scene === null || selected === null) return;
    const target = scene.getObjectByProperty("uuid", selected.objectId);
    if (target === undefined) return;
    applySelectionHighlight(target);
    return () => clearSelectionHighlight(scene);
  }, [scene, selected]);

  return null;
}
