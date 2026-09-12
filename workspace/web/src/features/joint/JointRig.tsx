import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useDisplayStore } from "../../store/display";
import { useModelScenesStore } from "../compare/model-scenes";
import {
  addJointOverlay,
  jointOverlayOf,
  removeJointOverlay,
  setJointOverlayXray,
  updateJointOverlay,
} from "./joint-display";

/** Canvas に 1 つだけ置く描画なしの部品。ジョイント可視化を管理する。 */
export function JointRig(): null {
  const jointDisplay = useDisplayStore((state) => state.jointDisplay);
  const scenes = useModelScenesStore((state) => state.scenes);

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

  useFrame(() => {
    if (!jointDisplay.visible) return;
    for (const scene of Object.values(scenes)) {
      const overlay = jointOverlayOf(scene);
      if (overlay !== null) updateJointOverlay(overlay, scene);
    }
  });

  return null;
}
