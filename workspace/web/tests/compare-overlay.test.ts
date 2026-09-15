import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Skeleton,
  SkinnedMesh,
} from "three";
import { describe, expect, it, vi } from "vitest";
import {
  applyCompareOverlay,
  clearCompareOverlays,
  COMPARE_DISTANCE_ATTRIBUTE,
  createCompareOverlay,
  createCompareOverlayGeometry,
  isMeshCompareOverlay,
  MESH_COMPARE_OVERLAY_KEY,
  writeCompareDistance,
} from "../src/features/compare/overlay";
import { applyMeshDisplay, createWireframeOverlay, MESH_DISPLAY_OVERLAY_KEY, VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";

function mesh(): Mesh {
  return new Mesh(new BoxGeometry(), new MeshStandardMaterial());
}

function skinnedMesh(): SkinnedMesh {
  const geometry = new BoxGeometry();
  geometry.setAttribute("skinIndex", new Float32BufferAttribute(geometry.getAttribute("position").count * 4, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(geometry.getAttribute("position").count * 4, 4));
  geometry.morphAttributes.position = [geometry.getAttribute("position").clone()];
  geometry.morphTargetsRelative = true;
  const bone = new Bone();
  const skeleton = new Skeleton([bone]);
  const result = new SkinnedMesh(geometry, new MeshStandardMaterial());
  result.morphTargetInfluences = [0.5];
  result.add(bone);
  result.bind(skeleton);
  return result;
}

describe("compare overlay", () => {
  it("shares source geometry state and owns only compareDistance", () => {
    const source = mesh();
    const geometry = createCompareOverlayGeometry(source);
    const sourceColor = new Float32BufferAttribute(source.geometry.getAttribute("position").count * 3, 3);
    source.geometry.setAttribute("color", sourceColor);

    expect(geometry).not.toBe(source.geometry);
    expect(geometry.getAttribute("position")).toBe(source.geometry.getAttribute("position"));
    expect(geometry.getIndex()).toBe(source.geometry.getIndex());
    expect(geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE).itemSize).toBe(1);
    expect(geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE).count).toBe(24);
    expect(Array.from(geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE).array as Float32Array).every((value) => value === 0)).toBe(true);
    expect(geometry.getAttribute("normal")).toBeUndefined();
    expect(geometry.getAttribute("uv")).toBeUndefined();
    expect(geometry.getAttribute("color")).toBeUndefined();
    expect(source.geometry.getAttribute("color")).toBe(sourceColor);
  });

  it("shares indexed, skinning, and morph state", () => {
    const source = skinnedMesh();
    const geometry = createCompareOverlayGeometry(source);
    const overlay = createCompareOverlay(source) as SkinnedMesh;

    expect(geometry.getIndex()).toBe(source.geometry.getIndex());
    expect(geometry.getAttribute("skinIndex")).toBe(source.geometry.getAttribute("skinIndex"));
    expect(geometry.getAttribute("skinWeight")).toBe(source.geometry.getAttribute("skinWeight"));
    expect(geometry.morphAttributes.position).toBe(source.geometry.morphAttributes.position);
    expect(geometry.morphTargetsRelative).toBe(source.geometry.morphTargetsRelative);
    expect(overlay).toBeInstanceOf(SkinnedMesh);
    expect(overlay.skeleton).toBe(source.skeleton);
    expect(overlay.bindMatrix.equals(source.bindMatrix)).toBe(true);
    expect(overlay.bindMode).toBe(source.bindMode);
    expect(overlay.morphTargetInfluences).toBe(source.morphTargetInfluences);
  });

  it("supports non-indexed geometry", () => {
    const source = new Mesh(new BoxGeometry().toNonIndexed(), new MeshBasicMaterial());
    const geometry = createCompareOverlayGeometry(source);
    expect(geometry.getIndex()).toBeNull();
    expect(geometry.getAttribute("compareDistance").count).toBe(source.geometry.getAttribute("position").count);
  });

  it("writes finite distances and clears stale values", () => {
    const geometry = createCompareOverlayGeometry(mesh());
    const distance = geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE) as BufferAttribute;
    const version = distance.version;
    writeCompareDistance(geometry, [0.2, -0.2, NaN, Infinity, -Infinity]);
    expect(distance.getX(0)).toBeCloseTo(0.2, 6);
    expect(distance.getX(1)).toBeCloseTo(-0.2, 6);
    expect(Array.from(distance.array as Float32Array).slice(2, 5)).toEqual([0, 0, 0]);
    expect(Array.from(distance.array as Float32Array).slice(5).every((value) => value === 0)).toBe(true);
    expect(distance.version).toBeGreaterThan(version);
    writeCompareDistance(geometry, [0.5]);
    expect(distance.getX(0)).toBe(0.5);
    expect(Array.from(distance.array as Float32Array).slice(1).every((value) => value === 0)).toBe(true);
    expect(() => writeCompareDistance(geometry, new Float32Array(100).fill(-1))).not.toThrow();
    expect(Array.from(distance.array as Float32Array).every((value) => value === -1)).toBe(true);
  });

  it("does nothing when compareDistance is absent", () => {
    expect(() => writeCompareDistance(mesh().geometry, [1])).not.toThrow();
  });

  it("creates a marked, raycast-disabled overlay without attaching it", () => {
    const source = mesh();
    const overlay = createCompareOverlay(source);
    const raycaster = new Raycaster();
    expect(overlay.userData[MESH_COMPARE_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[MESH_DISPLAY_OVERLAY_KEY]).toBeUndefined();
    expect(overlay.renderOrder).toBe(-1);
    expect(source.children).toHaveLength(0);
    expect(raycaster.intersectObject(overlay)).toEqual([]);
    expect(isMeshCompareOverlay(overlay)).toBe(true);
    expect(isMeshCompareOverlay(source)).toBe(false);
  });

  it("reuses one overlay and preserves parent picking", () => {
    const root = new Group();
    const source = mesh();
    root.add(source);
    root.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    raycaster.ray.origin.set(0, 0, 5);
    raycaster.ray.direction.set(0, 0, -1);
    const before = raycaster.intersectObject(source, true).length;
    const first = applyCompareOverlay(source, new Float32Array(24).fill(1), 0.5, { outside: 1, inside: 2 });
    const second = applyCompareOverlay(source, new Float32Array(24).fill(-1), 0.5, { outside: 3, inside: 4 });
    expect(second).toBe(first);
    expect(source.children.filter(isMeshCompareOverlay)).toHaveLength(1);
    expect(raycaster.intersectObject(source, true)).toHaveLength(before);
    expect(first.geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE).getX(0)).toBe(-1);
  });

  it("clears only comparison overlays and releases shared geometry safely", () => {
    const root = new Group();
    const first = mesh();
    const second = mesh();
    const firstOverlay = applyCompareOverlay(first, new Float32Array(24), 0.1, { outside: 1, inside: 2 });
    const secondOverlay = applyCompareOverlay(second, new Float32Array(24), 0.1, { outside: 1, inside: 2 });
    const wireframe = createWireframeOverlay(first);
    first.add(wireframe);
    root.add(first, second);
    const firstDispose = vi.spyOn(firstOverlay.material as MeshBasicMaterial, "dispose");
    const secondDispose = vi.spyOn(secondOverlay.material as MeshBasicMaterial, "dispose");
    const firstGeometryDispose = vi.spyOn(firstOverlay.geometry, "dispose");
    const secondGeometryDispose = vi.spyOn(secondOverlay.geometry, "dispose");
    clearCompareOverlays(root);
    expect(first.children).not.toContain(firstOverlay);
    expect(second.children).not.toContain(secondOverlay);
    expect(first.children).toContain(wireframe);
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(firstGeometryDispose).toHaveBeenCalledOnce();
    expect(secondGeometryDispose).toHaveBeenCalledOnce();
    expect(firstOverlay.geometry.getAttribute("position")).toBeUndefined();
    expect(firstOverlay.geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE)).toBeDefined();
    expect(firstOverlay.geometry.getIndex()).toBeNull();
    expect(first.geometry.getAttribute("position")).toBeDefined();
    expect(first.geometry.getIndex()).not.toBeNull();
    clearCompareOverlays(new Group());
  });

  it("coexists with mesh display without being restyled or removed", () => {
    const root = new Group();
    const source = mesh();
    const comparison = applyCompareOverlay(source, new Float32Array(24).fill(1), 0.1, { outside: 1, inside: 2 });
    root.add(source);
    applyMeshDisplay(root, "solid-wireframe");
    expect((comparison.material as MeshBasicMaterial).wireframe).toBe(false);
    expect(source.children.filter(isMeshCompareOverlay)).toHaveLength(1);
    applyMeshDisplay(root, "solid");
    expect(source.children).toContain(comparison);
  });
});
