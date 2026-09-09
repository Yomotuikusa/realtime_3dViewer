import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster } from "three";
import { pickModel, toNdc } from "../src/features/viewer/pick";

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function createBox(): Mesh<BoxGeometry, MeshBasicMaterial> {
  const box = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  box.updateMatrixWorld();
  return box;
}

describe("viewer picking", () => {
  it("converts client coordinates to canvas NDC", () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    expect(toNdc(rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(toNdc(rect, 200, 0)).toEqual({ x: 1, y: 1 });
    expect(toNdc(rect, 0, 100)).toEqual({ x: -1, y: -1 });
    expect(toNdc({ left: 50, top: 20, width: 100, height: 100 }, 50, 20)).toEqual({ x: -1, y: 1 });
  });

  it("returns the nearest hit and its world-space normal", () => {
    const camera = createCamera();
    const box = createBox();
    const hit = pickModel(new Raycaster(), camera, { x: 0, y: 0 }, box);
    expect(hit).not.toBeNull();
    expect(hit!.point).toEqual(expect.arrayContaining([expect.closeTo(0, 1e-3), expect.closeTo(0, 1e-3), expect.closeTo(0.5, 1e-3)]));
    expect(hit!.normal).toEqual([expect.closeTo(0, 1e-3), expect.closeTo(0, 1e-3), expect.closeTo(1, 1e-3)]);
  });

  it("uses the inverse-transpose normal matrix for non-uniform scale", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(5, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const box = createBox();
    box.scale.set(1, 4, 1);
    box.updateMatrixWorld();

    const hit = pickModel(new Raycaster(), camera, { x: 0, y: 0 }, box);

    expect(hit).not.toBeNull();
    expect(hit!.normal).toEqual([
      expect.closeTo(1, 1e-6),
      expect.closeTo(0, 1e-6),
      expect.closeTo(0, 1e-6),
    ]);
    expect(Math.hypot(...hit!.normal!)).toBeCloseTo(1, 6);
  });

  it("returns null for an outside ray or missing target", () => {
    const camera = createCamera();
    const box = createBox();
    expect(pickModel(new Raycaster(), camera, { x: 0.9, y: 0.9 }, box)).toBeNull();
    expect(pickModel(new Raycaster(), camera, { x: 0, y: 0 }, null)).toBeNull();
  });

  it("uses the target's updated position", () => {
    const camera = createCamera();
    const box = createBox();
    box.position.set(0, 0, -2);
    box.updateMatrixWorld();
    const hit = pickModel(new Raycaster(), camera, { x: 0, y: 0 }, box);
    expect(hit).not.toBeNull();
    expect(hit!.point[2]).toBeCloseTo(-1.5, 3);
  });
});
