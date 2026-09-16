import { useEffect } from "react";
import { selectModelScene, useModelScenesStore } from "../compare/model-scenes";
import { hexToNumber } from "../theme/viewer-colors";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { selectViewSetting, useViewSettingsStore } from "../../store/view-settings";
import { applySelectionHighlight, clearSelectionHighlight } from "./selection-highlight";
import { useSelectionStore } from "./selection";

/** Canvas に 1 つだけ置く描画なしの部品。選択と scene から重ね描きを管理する */
export function SelectionRig(): null {
  const selected = useSelectionStore((state) => state.selected);
  const scenes = useModelScenesStore((state) => state.scenes);
  const scene = selectModelScene(scenes, selected?.versionId ?? null);
  const color = useThemeStore(selectViewerColor("selection"));
  const opacity = useViewSettingsStore(selectViewSetting("selectionOpacity"));

  useEffect(() => {
    if (scene === null || selected === null) return;
    const target = scene.getObjectByProperty("uuid", selected.objectId);
    if (target === undefined) return;
    // The optional opacity preserves the previous two-argument call shape.
    // applySelectionHighlight(target, hexToNumber(color));
    applySelectionHighlight(target, hexToNumber(color), opacity);
    return () => clearSelectionHighlight(scene);
    // Opacity is added to the previous effect dependency set: }, [scene, selected, color]);
  }, [scene, selected, color, opacity]);

  return null;
}
