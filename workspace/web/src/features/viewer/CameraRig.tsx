import { useCallback, useEffect, useRef, type ReactElement } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useBounds } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CameraState } from "@shared/types";
import { DEFAULT_CAMERA } from "@shared/camera";
import { useCameraStore } from "../../store/camera";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { useLightingStore } from "../../store/lighting";
import { followStep, followTargetCamera } from "./follow";
import {
  startCameraAnimation,
  stepCameraAnimation,
  type CameraAnimation,
} from "./camera-animation";
import { attachViewerPointer, type ViewerControlsLike } from "./viewer-pointer";
import { rotationLocked } from "./view-presets";
import { fitCamera } from "./fit-camera";
import { getModelTarget } from "./model-target";
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
  const animation = useRef<CameraAnimation | null>(null);
  const fitSeq = useCameraStore((state) => state.fitSeq);
  const following = usePresenceStore((state) => state.followingUserId !== null);
  const locked = useCameraStore((state) => rotationLocked(state.selfCamera, following));
  const bounds = useBounds();
  const lastResetSeq = useRef(useCameraStore.getState().resetSeq);
  const lastFitSeq = useRef(fitSeq);

  const handleChange = useCallback((): void => {
    const controls = controlsRef.current;
    if (controls) {
      useCameraStore.getState().setSelfCamera(readCamera(camera, controls));
    }
  }, [camera]);

  const handleUserInteract = useCallback((): void => {
    animation.current = null;
    usePresenceStore.getState().unfollow();
  }, []);

  useEffect(() => {
    if (controls === null) {
      return;
    }
    return attachViewerPointer(controls as unknown as ViewerControlsLike, {
      onUserInteract: handleUserInteract,
      onCameraChange: handleChange,
      onLightRotate: (deltaX, deltaY) => useLightingStore.getState().rotate(deltaX, deltaY),
    });
  }, [controls, handleChange, handleUserInteract]);

  useEffect(() => {
    if (fitSeq === lastFitSeq.current) {
      return;
    }
    lastFitSeq.current = fitSeq;
    const size = bounds.refresh(getModelTarget() ?? undefined).clip().getSize();
    useCameraStore.getState().requestCamera(
      fitCamera([size.center.x, size.center.y, size.center.z], size.distance),
    );
  }, [bounds, fitSeq]);

  useFrame(() => {
    const now = performance.now();
    const cameraStore = useCameraStore.getState();
    if (cameraStore.resetSeq !== lastResetSeq.current) {
      lastResetSeq.current = cameraStore.resetSeq;
      animation.current = null;
      cameraStore.consumePendingCamera();
      const presence = usePresenceStore.getState();
      if (presence.followingUserId !== null) {
        presence.unfollow();
      }
      const controls = controlsRef.current;
      if (controls) {
        applyCamera(camera, controls, DEFAULT_CAMERA);
        cameraStore.setSelfCamera(DEFAULT_CAMERA, true);
      }
      return;
    }

    const controls = controlsRef.current;
    if (cameraStore.pendingCamera !== null) {
      if (!controls) {
        return;
      }
      const target = cameraStore.consumePendingCamera();
      if (target !== null) {
        usePresenceStore.getState().unfollow();
        animation.current = startCameraAnimation(readCamera(camera, controls), target, now);
      }
      return;
    }

    if (!controls) {
      return;
    }

    const current = readCamera(camera, controls);
    const currentAnimation = animation.current;
    if (currentAnimation !== null) {
      const step = stepCameraAnimation(currentAnimation, now);
      applyCamera(camera, controls, step.camera);
      if (step.done) {
        animation.current = null;
        cameraStore.setSelfCamera(step.camera, true);
      } else {
        cameraStore.setSelfCamera(step.camera);
      }
      return;
    }

    const presence = usePresenceStore.getState();
    const followTarget = followTargetCamera(
      presence.users,
      presence.followingUserId,
      useSessionStore.getState().selfId,
    );
    if (followTarget !== null) {
      if (followTarget.focalLength !== null) {
        cameraStore.setFocalLength(followTarget.focalLength);
      }
      const next = followStep(current, followTarget.camera);
      applyCamera(camera, controls, next.camera);
      cameraStore.setSelfCamera(next.camera);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      // 回転を無効にすると start が発火せず、Follow 中に操作で追従を解除できなくなるため、追従中はロックしない。
      enableRotate={!locked}
      enableDamping={false}
      onChange={handleChange}
      onStart={handleUserInteract}
      target={DEFAULT_CAMERA.target}
    />
  );
}
