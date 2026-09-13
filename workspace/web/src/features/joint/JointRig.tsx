import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Bone } from "three";
import { useDisplayStore } from "../../store/display";
import { selectViewerColor, useThemeStore } from "../../store/theme";
import { useModelScenesStore } from "../compare/model-scenes";
import { useSelectionStore } from "../outliner/selection";
import { hexToNumber } from "../theme/viewer-colors";
import {
  addJointOverlay,
  jointOverlayOf,
  removeJointOverlay,
  setJointOverlayXray,
  updateJointOverlay,
} from "./joint-display";
import {
  addSelectedJointMarker,
  removeSelectedJointMarker,
  selectedJointMarkerOf,
  updateSelectedJointMarker,
} from "./joint-highlight";

/** Canvas に 1 つだけ置く描画なしの部品。ジョイント可視化を管理する。 */
export function JointRig(): null {
  const jointDisplay = useDisplayStore((state) => state.jointDisplay);
  const scenes = useModelScenesStore((state) => state.scenes);
  const selected = useSelectionStore((state) => state.selected);
  const jointColor = useThemeStore(selectViewerColor("joint"));
  const linkColor = useThemeStore(selectViewerColor("jointLink"));
  const selectedColor = useThemeStore(selectViewerColor("jointSelected"));

  useEffect(() => {
    if (!jointDisplay.visible) return;
    for (const scene of Object.values(scenes)) {
      addJointOverlay(scene, { joint: hexToNumber(jointColor), link: hexToNumber(linkColor) });
    }
    return () => {
      for (const scene of Object.values(scenes)) removeJointOverlay(scene);
    };
  }, [scenes, jointDisplay.visible, jointColor, linkColor]);

  useEffect(() => {
    for (const scene of Object.values(scenes)) {
      const overlay = jointOverlayOf(scene);
      if (overlay !== null) setJointOverlayXray(overlay, jointDisplay.xray);
    }
  }, [scenes, jointDisplay.visible, jointDisplay.xray]);

  useEffect(() => {
    for (const scene of Object.values(scenes)) removeSelectedJointMarker(scene);

    if (!jointDisplay.visible || selected === null) return;
    const scene = scenes[selected.versionId];
    const target = scene?.getObjectByProperty("uuid", selected.objectId);
    if (!(target instanceof Bone) || scene === undefined) return;
    addSelectedJointMarker(scene, target, hexToNumber(selectedColor));

    return () => {
      for (const current of Object.values(scenes)) removeSelectedJointMarker(current);
    };
  }, [scenes, jointDisplay.visible, selected, selectedColor]);

  useFrame(() => {
    if (!jointDisplay.visible) return;
    for (const scene of Object.values(scenes)) {
      const overlay = jointOverlayOf(scene);
      if (overlay !== null) updateJointOverlay(overlay, scene);
      const marker = selectedJointMarkerOf(scene);
      if (marker !== null) updateSelectedJointMarker(marker, scene);
    }
  });

  return null;
}
