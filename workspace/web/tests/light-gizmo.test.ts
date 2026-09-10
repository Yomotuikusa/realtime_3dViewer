import { describe, expect, it } from "vitest";
import { lightPosition } from "../src/features/viewer/lighting";
import {
  GIZMO_BOX_SIZE,
  GIZMO_CAMERA_FOV,
  GIZMO_CAMERA_POSITION,
  GIZMO_KEY_STEP_PX,
  GIZMO_MARKER_RADIUS,
  GIZMO_ORBIT_RADIUS,
  GIZMO_SIZE_PX,
  gizmoDragStep,
  gizmoKeyDeltaX,
  gizmoMarkerPosition,
  yawDegrees,
  yawText,
} from "../src/features/viewer/light-gizmo";

describe("light gizmo calculations", () => {
  it("defines the fixed gizmo dimensions and camera", () => {
    expect(GIZMO_SIZE_PX).toBe(112);
    expect(GIZMO_BOX_SIZE).toBe(1.4);
    expect(GIZMO_ORBIT_RADIUS).toBe(2.2);
    expect(GIZMO_MARKER_RADIUS).toBe(0.16);
    expect(GIZMO_CAMERA_POSITION).toEqual([0, 2.4, 4.6]);
    expect(GIZMO_CAMERA_FOV).toBe(40);
    expect(GIZMO_KEY_STEP_PX).toBe(20);
  });

  it("uses the lighting spherical coordinates for the marker", () => {
    expect(gizmoMarkerPosition({ yaw: 0, pitch: 0 })).toEqual([0, 0, GIZMO_ORBIT_RADIUS]);
    expect(gizmoMarkerPosition({ yaw: Math.PI / 2, pitch: 0 })[0]).toBeCloseTo(GIZMO_ORBIT_RADIUS);
    expect(gizmoMarkerPosition({ yaw: Math.PI / 2, pitch: 0 })[2]).toBeCloseTo(0);
    expect(gizmoMarkerPosition({ yaw: Math.PI / 4, pitch: Math.PI / 4 }))
      .toEqual(lightPosition({ yaw: Math.PI / 4, pitch: Math.PI / 4 }, GIZMO_ORBIT_RADIUS));
  });

  it("converts only the matching pointer drag to horizontal movement", () => {
    expect(gizmoDragStep(null, 1, 100)).toBeNull();
    expect(gizmoDragStep({ pointerId: 1, clientX: 100 }, 2, 130)).toBeNull();
    expect(gizmoDragStep({ pointerId: 1, clientX: 100 }, 1, 130))
      .toEqual({ deltaX: 30, drag: { pointerId: 1, clientX: 130 } });
    expect(gizmoDragStep({ pointerId: 1, clientX: 100 }, 1, 70))
      .toEqual({ deltaX: -30, drag: { pointerId: 1, clientX: 70 } });
  });

  it("maps only the left and right arrows to key movement", () => {
    expect(gizmoKeyDeltaX("ArrowLeft")).toBe(-GIZMO_KEY_STEP_PX);
    expect(gizmoKeyDeltaX("ArrowRight")).toBe(GIZMO_KEY_STEP_PX);
    expect(gizmoKeyDeltaX("ArrowUp")).toBeNull();
    expect(gizmoKeyDeltaX("a")).toBeNull();
    expect(gizmoKeyDeltaX("")).toBeNull();
  });

  it("formats yaw as rounded degrees", () => {
    expect(yawDegrees(0)).toBe(0);
    expect(yawDegrees(Math.PI / 2)).toBe(90);
    expect(yawDegrees(-Math.PI)).toBe(-180);
    expect(yawDegrees(Math.PI / 4)).toBe(45);
    expect(yawText(Math.PI / 2)).toBe("90°");
  });
});
