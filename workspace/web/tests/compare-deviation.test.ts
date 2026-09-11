import {
  Bone,
  BoxGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
} from "three";
import { describe, expect, it } from "vitest";
import {
  bakeWorldTriangles,
  collectComparableMeshes,
  computeDeviation,
  isComparableMesh,
} from "../src/features/compare/deviation";
import { VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";

function box(size = 2): Mesh {
  return new Mesh(new BoxGeometry(size, size, size), new MeshStandardMaterial());
}

function distances(target: Mesh, base: Group): Float32Array {
  return computeDeviation(target, base)!.meshes[0]!.signedDistance;
}

describe("compare deviation", () => {
  it("recognizes and collects only comparable meshes in traversal order", () => {
    const root = new Group();
    const first = box();
    const nested = new Group();
    const second = box();
    const overlay = box();
    overlay.userData[VIEWER_OVERLAY_KEY] = true;
    const instanced = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 1);
    const line = new Line(new BoxGeometry(), new LineBasicMaterial());
    nested.add(second, line, overlay, instanced);
    root.add(first, nested);

    expect(isComparableMesh(first)).toBe(true);
    expect(isComparableMesh(new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial()))).toBe(true);
    expect(isComparableMesh(instanced)).toBe(false);
    expect(isComparableMesh(root)).toBe(false);
    expect(isComparableMesh(line)).toBe(false);
    expect(isComparableMesh(overlay)).toBe(false);
    expect(collectComparableMeshes(root)).toEqual([first, second]);
  });

  it("bakes transformed indexed and non-indexed positions without mutating input", () => {
    const mesh = new Mesh(new BoxGeometry(1), new MeshStandardMaterial());
    mesh.position.set(5, 0, 0);
    mesh.scale.setScalar(2);
    const originalX = mesh.geometry.getAttribute("position").getX(0);
    const baked = bakeWorldTriangles(mesh)!;
    const bakedPosition = baked.getAttribute("position");
    const xs = Array.from({ length: bakedPosition.count }, (_, i) => bakedPosition.getX(i));
    expect(Math.min(...xs)).toBe(4);
    expect(Math.max(...xs)).toBe(6);
    expect(baked.getIndex()!.count).toBe(mesh.geometry.getIndex()!.count);
    expect(mesh.geometry.getAttribute("position").getX(0)).toBe(originalX);

    const second = box();
    const two = new Group();
    two.add(box(), second);
    const combined = bakeWorldTriangles(two)!;
    const combinedIndex = combined.getIndex()!;
    expect(combined.getAttribute("position").count).toBe(48);
    expect(combinedIndex.count).toBe(72);
    expect(Math.min(...Array.from({ length: 36 }, (_, i) => combinedIndex.getX(i + 36)))).toBe(24);

    const nonIndexed = new Mesh(new BoxGeometry().toNonIndexed(), new MeshStandardMaterial());
    const nonIndexedBaked = bakeWorldTriangles(nonIndexed)!;
    expect(nonIndexedBaked.getIndex()!.count).toBe(36);
    expect(Array.from({ length: 36 }, (_, i) => nonIndexedBaked.getIndex()!.getX(i))).toEqual(
      Array.from({ length: 36 }, (_, i) => i),
    );
  });

  it("returns null for bases without comparable meshes and empty results for empty targets", () => {
    const line = new Line(new BoxGeometry(), new LineBasicMaterial());
    expect(bakeWorldTriangles(line)).toBeNull();
    expect(computeDeviation(box(), line)).toBeNull();
    const base = new Group();
    base.add(box());
    expect(computeDeviation(new Group(), base)).toEqual({ baseSize: 2, meshes: [] });
  });

  it("computes signed distances and the base size for boxes", () => {
    const base = new Group();
    base.add(box());
    expect(Array.from(distances(box(1), base)).every((value) => value === -0.5)).toBe(true);
    expect(Array.from(distances(box(4), base)).every((value) => Math.abs(value - Math.sqrt(3)) < 1e-5)).toBe(true);
    expect(Array.from(distances(box(), base)).every((value) => Math.abs(value) < 1e-6)).toBe(true);

    const shiftedBase = new Group();
    shiftedBase.position.set(10, 0, 0);
    shiftedBase.add(box());
    const shiftedTarget = box(1);
    shiftedTarget.position.set(10, 0, 0);
    expect(Array.from(distances(shiftedTarget, shiftedBase)).every((value) => value === -0.5)).toBe(true);
    const originTarget = box(1);
    expect(Array.from(distances(originTarget, shiftedBase)).every((value) => value >= 8.5)).toBe(true);

    const largeBase = new Group();
    largeBase.add(new Mesh(new BoxGeometry(2, 4, 6), new MeshStandardMaterial()));
    expect(computeDeviation(new Group(), largeBase)!.baseSize).toBe(6);
  });

  it("measures sphere changes, ignores excluded meshes, and supports skinned meshes", () => {
    const base = new Group();
    base.add(new Mesh(new SphereGeometry(1, 64, 64), new MeshStandardMaterial()));
    const targetGeometry = new SphereGeometry(1, 64, 64);
    const targetPosition = targetGeometry.getAttribute("position");
    const originalX = Array.from({ length: targetPosition.count }, (_, i) => targetPosition.getX(i));
    for (let i = 0; i < targetPosition.count; i += 1) {
      const factor = originalX[i]! > 0.5 ? 1.1 : originalX[i]! < -0.5 ? 0.9 : 1;
      targetPosition.setXYZ(i, targetPosition.getX(i) * factor, targetPosition.getY(i) * factor, targetPosition.getZ(i) * factor);
    }
    const sphereTarget = new Mesh(targetGeometry, new MeshStandardMaterial());
    const sphereResult = computeDeviation(sphereTarget, base)!.meshes[0]!.signedDistance;
    for (let i = 0; i < targetPosition.count; i += 1) {
      const value = sphereResult[i]!;
      if (originalX[i]! > 0.5) expect(value).toBeGreaterThan(0.08);
      else if (originalX[i]! < -0.5) expect(value).toBeLessThan(-0.08);
      else expect(Math.abs(value)).toBeLessThan(0.02);
    }

    const excludedTarget = new Group();
    excludedTarget.add(new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 1));
    const overlay = box();
    overlay.userData[VIEWER_OVERLAY_KEY] = true;
    excludedTarget.add(overlay);
    expect(computeDeviation(excludedTarget, base)!.meshes).toEqual([]);

    const bone = new Bone();
    const skeleton = new Skeleton([bone]);
    const skinned = new SkinnedMesh(new BoxGeometry(1), new MeshStandardMaterial());
    skinned.add(bone);
    skinned.bind(skeleton);
    const skinnedBase = new Group();
    skinnedBase.add(box());
    const skinnedResult = computeDeviation(skinned, skinnedBase);
    expect(skinnedResult).not.toBeNull();
    expect(Array.from(skinnedResult!.meshes[0]!.signedDistance).every((value) => value === -0.5)).toBe(true);
    expect(skinnedResult!.meshes[0]!.mesh).toBe(skinned);
  });
});
