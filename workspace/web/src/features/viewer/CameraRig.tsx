import { useEffect, useRef, type ReactElement } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useBounds } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CameraState } from "@shared/types";
import { cameraEquals, DEFAULT_CAMERA, lerpCamera } from "@shared/camera";
import { useCameraStore } from "../../store/camera";
import type { Camera } from "three";

function readCamera(camera: Camera, controls: OrbitControlsImpl): CameraState {
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
  };
}

function applyCamera(camera: Camera, controls: OrbitControlsImpl, state: CameraState): void {
  camera.position.set(...state.position);
  controls.target.set(...state.target);
  controls.update();
}

export function CameraRig(): ReactElement {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const pendingTarget = useRef<CameraState | null>(null);
  const resetSeq = useCameraStore((state) => state.resetSeq);
  const fitSeq = useCameraStore((state) => state.fitSeq);
  const pendingCamera = useCameraStore((state) => state.pendingCamera);
  const bounds = useBounds();
  const lastResetSeq = useRef(resetSeq);
  const lastFitSeq = useRef(fitSeq);

  const handleChange = (): void => {
    const controls = controlsRef.current;
    if (controls) {
      useCameraStore.getState().setSelfCamera(readCamera(camera, controls));
    }
  };

  useEffect(() => {
    if (resetSeq === lastResetSeq.current) {
      return;
    }
    lastResetSeq.current = resetSeq;
    pendingTarget.current = null;
    const controls = controlsRef.current;
    if (controls) {
      applyCamera(camera, controls, DEFAULT_CAMERA);
      useCameraStore.getState().setSelfCamera(DEFAULT_CAMERA);
    }
  }, [camera, resetSeq]);

  useEffect(() => {
    if (fitSeq === lastFitSeq.current) {
      return;
    }
    lastFitSeq.current = fitSeq;
    bounds.refresh().clip().fit();
  }, [bounds, fitSeq]);

  useEffect(() => {
    if (pendingCamera !== null) {
      pendingTarget.current = useCameraStore.getState().consumePendingCamera();
    }
  }, [pendingCamera]);

  useFrame(() => {
    const controls = controlsRef.current;
    const target = pendingTarget.current;
    if (!controls || target === null) {
      return;
    }

    const current = readCamera(camera, controls);
    const next = lerpCamera(current, target, 0.2);
    if (cameraEquals(next, target)) {
      applyCamera(camera, controls, target);
      pendingTarget.current = null;
      useCameraStore.getState().setSelfCamera(target);
      return;
    }
    applyCamera(camera, controls, next);
    useCameraStore.getState().setSelfCamera(next);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      onChange={handleChange}
      target={DEFAULT_CAMERA.target}
    />
  );
}
