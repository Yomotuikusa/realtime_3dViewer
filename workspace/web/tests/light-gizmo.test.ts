import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import type { Vec3 } from "@shared/types";
import { lightPosition, MAX_LIGHT_PITCH } from "../src/features/viewer/lighting";
import {
  GIZMO_BOX_SIZE,
  GIZMO_BOX_ROTATION_Y,
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

/**
 * position に置いて原点を向く fov=GIZMO_CAMERA_FOV・アスペクト 1 のカメラで、
 * 全角度のマーカー球の上下左右の縁を投影した NDC の最大絶対値を返す。
 */
function worstMarkerNdc(position: Vec3): number {
  const camera = new PerspectiveCamera(GIZMO_CAMERA_FOV, 1);
  camera.position.set(...position);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  let worst = 0;

  for (let yawDegrees = -180; yawDegrees < 180; yawDegrees += 5) {
    const yaw = (yawDegrees * Math.PI) / 180;
    for (const pitch of [-MAX_LIGHT_PITCH, -MAX_LIGHT_PITCH / 2, 0, MAX_LIGHT_PITCH / 2, MAX_LIGHT_PITCH]) {
      const marker = new Vector3(...gizmoMarkerPosition({ yaw, pitch }));
      for (const direction of [right, right.clone().negate(), up, up.clone().negate()]) {
        const edge = marker.clone().addScaledVector(direction, GIZMO_MARKER_RADIUS).project(camera);
        worst = Math.max(worst, Math.abs(edge.x), Math.abs(edge.y));
      }
    }
  }
  return worst;
}

describe("light gizmo calculations", () => {
  it("defines the fixed gizmo dimensions and camera", () => {
    expect(GIZMO_SIZE_PX).toBe(160);
    expect(GIZMO_BOX_SIZE).toBe(1.4);
    expect(GIZMO_BOX_ROTATION_Y).toBe(Math.PI / 4);
    expect(GIZMO_ORBIT_RADIUS).toBe(2.2);
    expect(GIZMO_MARKER_RADIUS).toBe(0.16);
    expect(GIZMO_CAMERA_POSITION).toEqual([0, 3.5, 6.7]);
    expect(GIZMO_CAMERA_FOV).toBe(40);
    expect(GIZMO_KEY_STEP_PX).toBe(20);
  });

  it("keeps every marker edge inside the new camera view", () => {
    expect(worstMarkerNdc(GIZMO_CAMERA_POSITION)).toBeLessThanOrEqual(0.95);
    expect(worstMarkerNdc([0, 2.4, 4.6])).toBeGreaterThan(1);
  });

  it("rotates only the gizmo cube mesh", () => {
    const sourceUrl = new URL("../src/features/viewer/LightGizmo.tsx", import.meta.url);
    const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
      ? join(process.cwd(), "web", "src")
      : join(process.cwd(), "src");
    const sourcePath = sourceUrl.protocol === "file:"
      ? fileURLToPath(sourceUrl)
      : join(sourceRoot, "features/viewer/LightGizmo.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("rotation={[0, GIZMO_BOX_ROTATION_Y, 0]}");
    expect(source).toContain("settings.lightRotateSensitivity");
    expect(source).toContain("rotate(step.deltaX * sensitivity, 0)");
    expect(source).toContain("rotate(deltaX, 0)");
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
