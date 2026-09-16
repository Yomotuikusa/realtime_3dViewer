import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useCameraStore } from "../../store/camera";
import { clipPlanesFor } from "./clip-planes";

/** camera ストアのモデルサイズを PerspectiveCamera の near / far へ反映する。 */
export function ClipPlanesRig(): null {
  const camera = useThree((state) => state.camera);
  const modelSize = useCameraStore((state) => state.modelSize);

  useEffect(() => {
    if (!("isPerspectiveCamera" in camera) || camera.isPerspectiveCamera !== true) return;
    const perspective = camera as PerspectiveCamera;
    const { near, far } = clipPlanesFor(modelSize);
    perspective.near = near;
    perspective.far = far;
    perspective.updateProjectionMatrix();
  }, [camera, modelSize]);

  return null;
}
