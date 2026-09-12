import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Bone } from "three";
import { useDisplayStore } from "../../store/display";
import { useModelScenesStore } from "../compare/model-scenes";
import { useSelectionStore } from "../outliner/selection";
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

  useEffect(() => {
    if (!jointDisplay.visible) return;
    for (const scene of Object.values(scenes)) addJointOverlay(scene);
    return () => {
      for (const scene of Object.values(scenes)) removeJointOverlay(scene);
    };
  }, [scenes, jointDisplay.visible]);

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
    addSelectedJointMarker(scene, target);

    return () => {
      for (const current of Object.values(scenes)) removeSelectedJointMarker(current);
    };
  }, [scenes, jointDisplay.visible, selected]);

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
