import {
  BoxGeometry,
  Bone,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { isViewerOverlay, VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";
import { collectJoints } from "../src/features/joint/joint-display";
import {
  addTrailOverlay,
  removeTrailOverlay,
  setTrailCurrentFrame,
  TRAIL_CURRENT_RADIUS_SCALE,
  TRAIL_CURRENT_COLOR,
  TRAIL_LINE_COLOR,
  TRAIL_OVERLAY_KEY,
  TRAIL_POINT_COLOR,
  TRAIL_POINT_SIZE_SCALE,
  TRAIL_RENDER_ORDER,
  trailOverlayOf,
} from "../src/features/trail/trail-overlay";

const sample = {
  positions: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
  frameCount: 3,
};
const defaultColors = {
  line: TRAIL_LINE_COLOR,
  point: TRAIL_POINT_COLOR,
  current: TRAIL_CURRENT_COLOR,
};

describe("trail overlay", () => {
  it("creates a marked line, points, and current marker", () => {
    const root = new Group();
    const visibleJoint = new Bone();
    root.add(visibleJoint);
    const overlay = addTrailOverlay(root, sample, 2, defaultColors);
    const line = overlay.children[0] as Line;
    const points = overlay.children[1] as Points;
    const marker = overlay.children[2] as Mesh;
    line.add(new Bone());

    expect(root.children).toHaveLength(2);
    expect(overlay.children).toHaveLength(3);
    expect(overlay.userData[TRAIL_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData.frameCount).toBe(3);
    expect(overlay.userData.positions).toBe(sample.positions);
    expect(line).toBeInstanceOf(Line);
    expect(points).toBeInstanceOf(Points);
    expect(marker).toBeInstanceOf(Mesh);
    expect(Array.from(line.geometry.getAttribute("position").array as Float32Array)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(Array.from(points.geometry.getAttribute("position").array as Float32Array)).toEqual(
      Array.from(line.geometry.getAttribute("position").array as Float32Array),
    );
    expect(marker.position.toArray()).toEqual([0, 1, 2]);
    expect((marker.geometry as SphereGeometry).parameters.radius).toBe(2 * TRAIL_CURRENT_RADIUS_SCALE);
    expect((line.material as LineBasicMaterial).color.getHex()).toBe(TRAIL_LINE_COLOR);
    expect((points.material as PointsMaterial).color.getHex()).toBe(TRAIL_POINT_COLOR);
    expect((points.material as PointsMaterial).size).toBe(2 * TRAIL_POINT_SIZE_SCALE);
    expect((marker.material as MeshBasicMaterial).color.getHex()).toBe(TRAIL_CURRENT_COLOR);
    for (const object of [overlay, line, points, marker]) {
      expect(object.userData[VIEWER_OVERLAY_KEY]).toBe(true);
      expect(isViewerOverlay(object)).toBe(true);
      expect(object.raycast).toBeTypeOf("function");
      expect(object.raycast(null as never, [])).toBeUndefined();
      expect(object.renderOrder).toBe(TRAIL_RENDER_ORDER);
    }
    const materials = [
      line.material as LineBasicMaterial,
      points.material as PointsMaterial,
      marker.material as MeshBasicMaterial,
    ];
    for (const material of materials) {
      expect(material.depthTest).toBe(false);
      expect(material.depthWrite).toBe(false);
      expect(material.toneMapped).toBe(false);
    }
    expect(collectJoints(root)).toEqual([visibleJoint]);
  });

  it("uses the supplied color for each overlay child", () => {
    const overlay = addTrailOverlay(new Group(), sample, 2, {
      line: 0xff0000,
      point: 0x00ff00,
      current: 0x0000ff,
    });

    expect(((overlay.children[0] as Line).material as LineBasicMaterial).color.getHex()).toBe(0xff0000);
    expect(((overlay.children[1] as Points).material as PointsMaterial).color.getHex()).toBe(0x00ff00);
    expect(((overlay.children[2] as Mesh).material as MeshBasicMaterial).color.getHex()).toBe(0x0000ff);
    expect(overlay.children).toHaveLength(3);
  });

  it("updates and clamps the current marker frame", () => {
    const overlay = addTrailOverlay(new Group(), sample, 1, defaultColors);
    setTrailCurrentFrame(overlay, 1.6);
    expect(overlay.children[2]!.position.toArray()).toEqual([6, 7, 8]);
    setTrailCurrentFrame(overlay, -5);
    expect(overlay.children[2]!.position.toArray()).toEqual([0, 1, 2]);
    setTrailCurrentFrame(overlay, 999);
    expect(overlay.children[2]!.position.toArray()).toEqual([6, 7, 8]);
    setTrailCurrentFrame(overlay, Number.NaN);
    expect(overlay.children[2]!.position.toArray()).toEqual([0, 1, 2]);
    setTrailCurrentFrame(overlay, Number.POSITIVE_INFINITY);
    expect(overlay.children[2]!.position.toArray()).toEqual([6, 7, 8]);
  });

  it("replaces an existing overlay and disposes resources", () => {
    const root = new Group();
    const first = addTrailOverlay(root, sample, 1, defaultColors);
    const firstLine = first.children[0] as Line;
    const firstPoints = first.children[1] as Points;
    const firstMarker = first.children[2] as Mesh;
    const disposals = [
      vi.spyOn(firstLine.geometry as { dispose: () => void }, "dispose"),
      vi.spyOn(firstLine.material as { dispose: () => void }, "dispose"),
      vi.spyOn(firstPoints.geometry as { dispose: () => void }, "dispose"),
      vi.spyOn(firstPoints.material as { dispose: () => void }, "dispose"),
      vi.spyOn(firstMarker.geometry as { dispose: () => void }, "dispose"),
      vi.spyOn(firstMarker.material as { dispose: () => void }, "dispose"),
    ];

    const second = addTrailOverlay(
      root,
      { ...sample, frameCount: 1, positions: sample.positions.slice(0, 3) },
      1,
      defaultColors,
    );
    expect(root.children).toEqual([second]);
    expect(trailOverlayOf(root)).toBe(second);
    for (const disposal of disposals) expect(disposal).toHaveBeenCalledOnce();

    const secondLine = second.children[0] as Line;
    const secondPoints = second.children[1] as Points;
    const secondMarker = second.children[2] as Mesh;
    const secondDisposals = [
      vi.spyOn(secondLine.geometry as { dispose: () => void }, "dispose"),
      vi.spyOn(secondLine.material as { dispose: () => void }, "dispose"),
      vi.spyOn(secondPoints.geometry as { dispose: () => void }, "dispose"),
      vi.spyOn(secondPoints.material as { dispose: () => void }, "dispose"),
      vi.spyOn(secondMarker.geometry as { dispose: () => void }, "dispose"),
      vi.spyOn(secondMarker.material as { dispose: () => void }, "dispose"),
    ];
    removeTrailOverlay(root);
    expect(trailOverlayOf(root)).toBeNull();
    for (const disposal of secondDisposals) expect(disposal).toHaveBeenCalledOnce();
    expect(() => removeTrailOverlay(root)).not.toThrow();
  });

  it("handles a single-frame sample", () => {
    const overlay = addTrailOverlay(
      new Group(),
      { frameCount: 1, positions: new Float32Array([4, 5, 6]) },
      1,
      defaultColors,
    );
    expect(overlay.children).toHaveLength(3);
    expect(() => setTrailCurrentFrame(overlay, 999)).not.toThrow();
    expect(overlay.children[2]!.position.toArray()).toEqual([4, 5, 6]);
  });

  it("does not confuse another child with a trail", () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    expect(trailOverlayOf(root)).toBeNull();
    expect(() => removeTrailOverlay(root)).not.toThrow();
  });
});
