import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useCameraStore } from "../../store/camera";
import { fovFromFocalLength } from "./focal-length";

/** camera ストアの焦点距離を three.js の PerspectiveCamera へ反映する。 */
export function FocalLengthRig(): null {
  const camera = useThree((state) => state.camera);
  const focalLength = useCameraStore((state) => state.focalLength);

  useEffect(() => {
    if (!("isPerspectiveCamera" in camera) || camera.isPerspectiveCamera !== true) return;
    const perspective = camera as PerspectiveCamera;
    perspective.fov = fovFromFocalLength(focalLength);
    perspective.updateProjectionMatrix();
  }, [camera, focalLength]);

  return null;
}
