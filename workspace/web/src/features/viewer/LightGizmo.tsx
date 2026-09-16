import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactElement } from "react";
import { useLightingStore } from "../../store/lighting";
import { useViewSettingsStore } from "../../store/view-settings";
import { LIGHT_DIRECTION_LABEL, LIGHT_RESET_LABEL } from "./hud-labels";
import {
  GIZMO_BOX_SIZE,
  GIZMO_BOX_ROTATION_Y,
  GIZMO_CAMERA_FOV,
  GIZMO_CAMERA_POSITION,
  GIZMO_MARKER_RADIUS,
  gizmoDragStep,
  gizmoKeyDeltaX,
  gizmoMarkerPosition,
  type GizmoDrag,
  yawDegrees,
  yawText,
} from "./light-gizmo";

function GizmoCamera(): null {
  const camera = useThree(({ camera }) => camera);

  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function GizmoScene(): ReactElement {
  const angles = useLightingStore((state) => state.angles);
  const markerPosition = gizmoMarkerPosition(angles);

  return (
    <>
      <GizmoCamera />
      <ambientLight intensity={0.35} />
      <directionalLight position={markerPosition} intensity={2.0} />
      <mesh rotation={[0, GIZMO_BOX_ROTATION_Y, 0]}>
        <boxGeometry args={[GIZMO_BOX_SIZE, GIZMO_BOX_SIZE, GIZMO_BOX_SIZE]} />
        <meshStandardMaterial color="#d0d5dd" />
      </mesh>
      <mesh position={markerPosition}>
        <sphereGeometry args={[GIZMO_MARKER_RADIUS, 16, 16]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
    </>
  );
}

export function LightGizmo(): ReactElement {
  const angles = useLightingStore((state) => state.angles);
  const dragRef = useRef<GizmoDrag | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const step = gizmoDragStep(dragRef.current, event.pointerId, event.clientX);
    if (step === null) {
      return;
    }
    const sensitivity = useViewSettingsStore.getState().settings.lightRotateSensitivity;
    useLightingStore.getState().rotate(step.deltaX * sensitivity, 0);
    dragRef.current = step.drag;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const deltaX = gizmoKeyDeltaX(event.key);
    if (deltaX === null) {
      return;
    }
    event.preventDefault();
    useLightingStore.getState().rotate(deltaX, 0);
  }

  return (
    <div className="light-gizmo" role="group" aria-label={LIGHT_DIRECTION_LABEL}>
      <div
        className="light-gizmo__stage"
        role="slider"
        tabIndex={0}
        aria-label={LIGHT_DIRECTION_LABEL}
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={yawDegrees(angles.yaw)}
        aria-valuetext={yawText(angles.yaw)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        <Canvas
          camera={{ position: GIZMO_CAMERA_POSITION, fov: GIZMO_CAMERA_FOV }}
          gl={{ alpha: true }}
          frameloop="demand"
          style={{ width: "100%", height: "100%" }}
        >
          <GizmoScene />
        </Canvas>
      </div>
      <button
        className="btn btn--quiet light-gizmo__reset"
        type="button"
        aria-label={LIGHT_RESET_LABEL}
        title={LIGHT_RESET_LABEL}
        onClick={() => useLightingStore.getState().reset()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 8a8 8 0 1 1-1 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M5 3v5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
