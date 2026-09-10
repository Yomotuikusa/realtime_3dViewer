import { useCallback, useEffect, useRef, type ReactElement } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useBounds } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CameraState } from "@shared/types";
import { cameraEquals, DEFAULT_CAMERA, lerpCamera } from "@shared/camera";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { useLightingStore } from "../../store/lighting";
import { followStep, followTargetCamera } from "./follow";
import { attachViewerPointer, type ViewerControlsLike } from "./viewer-pointer";
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
  const controls = useThree((state) => state.controls);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const pendingTarget = useRef<CameraState | null>(null);
  const fitSeq = useCameraStore((state) => state.fitSeq);
  const bounds = useBounds();
  const lastResetSeq = useRef(useCameraStore.getState().resetSeq);
  const lastFitSeq = useRef(fitSeq);

  const handleChange = useCallback((): void => {
    const controls = controlsRef.current;
    if (controls) {
      useCameraStore.getState().setSelfCamera(readCamera(camera, controls));
    }
  }, [camera]);

  useEffect(() => {
    if (controls === null) {
      return;
    }
    return attachViewerPointer(controls as unknown as ViewerControlsLike, {
      onUserInteract: () => usePresenceStore.getState().unfollow(),
      onCameraChange: handleChange,
      onLightRotate: (deltaX, deltaY) => useLightingStore.getState().rotate(deltaX, deltaY),
    });
  }, [controls, handleChange]);

  useEffect(() => {
    if (fitSeq === lastFitSeq.current) {
      return;
    }
    lastFitSeq.current = fitSeq;
    bounds.refresh().clip().fit();
  }, [bounds, fitSeq]);

  useFrame(() => {
    const cameraStore = useCameraStore.getState();
    if (cameraStore.resetSeq !== lastResetSeq.current) {
      lastResetSeq.current = cameraStore.resetSeq;
      pendingTarget.current = null;
      cameraStore.consumePendingCamera();
      const presence = usePresenceStore.getState();
      if (presence.followingUserId !== null) {
        presence.unfollow();
      }
      const controls = controlsRef.current;
      if (controls) {
        applyCamera(camera, controls, DEFAULT_CAMERA);
        cameraStore.setSelfCamera(DEFAULT_CAMERA);
      }
      return;
    }

    if (cameraStore.pendingCamera !== null) {
      const target = cameraStore.consumePendingCamera();
      if (target !== null) {
        pendingTarget.current = target;
        usePresenceStore.getState().unfollow();
      }
      return;
    }

    const controls = controlsRef.current;
    const target = pendingTarget.current;
    if (!controls) {
      return;
    }

    const current = readCamera(camera, controls);
    if (target !== null) {
      const next = lerpCamera(current, target, 0.2);
      if (cameraEquals(next, target)) {
        applyCamera(camera, controls, target);
        pendingTarget.current = null;
        cameraStore.setSelfCamera(target);
        return;
      }
      applyCamera(camera, controls, next);
      cameraStore.setSelfCamera(next);
      return;
    }

    const presence = usePresenceStore.getState();
    const followTarget = followTargetCamera(
      presence.users,
      presence.followingUserId,
      useSessionStore.getState().selfId,
    );
    if (followTarget !== null) {
      const next = followStep(current, followTarget);
      applyCamera(camera, controls, next.camera);
      cameraStore.setSelfCamera(next.camera);
    }
  });

  const handleStart = (): void => {
    usePresenceStore.getState().unfollow();
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      onChange={handleChange}
      onStart={handleStart}
      target={DEFAULT_CAMERA.target}
    />
  );
}
