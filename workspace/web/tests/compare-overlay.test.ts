import {
  Bone,
  BoxGeometry,
  Color,
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
  colorizeDeviation,
  COMPARE_INSIDE_COLOR,
  COMPARE_OUTSIDE_COLOR,
  COMPARE_OVERLAY_OPACITY,
  createCompareOverlay,
  createCompareOverlayGeometry,
  createCompareOverlayMaterial,
  isMeshCompareOverlay,
  MESH_COMPARE_OVERLAY_KEY,
} from "../src/features/compare/overlay";
import { applyMeshDisplay, createWireframeOverlay, MESH_DISPLAY_OVERLAY_KEY, VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";

function mesh(): Mesh {
  return new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
}

function skinnedMesh(): SkinnedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
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

function rgba(geometry: Mesh["geometry"], vertex: number): number[] {
  const color = geometry.getAttribute("color") as Float32BufferAttribute;
  return [color.getX(vertex), color.getY(vertex), color.getZ(vertex), color.getW(vertex)];
}

function expectRgba(geometry: Mesh["geometry"], vertex: number, expected: number[]): void {
  rgba(geometry, vertex).forEach((value, component) => expect(value).toBeCloseTo(expected[component]!, 6));
}

const DEFAULT_COLORS = { outside: COMPARE_OUTSIDE_COLOR, inside: COMPARE_INSIDE_COLOR };

describe("compare overlay", () => {
  it("creates an index-expanded geometry with separate color attributes", () => {
    const source = mesh();
    const geometry = createCompareOverlayGeometry(source);

    expect(geometry).not.toBe(source.geometry);
    expect(geometry.getAttribute("position")).not.toBe(source.geometry.getAttribute("position"));
    expect(geometry.getAttribute("position").count).toBe(36);
    expect(geometry.getIndex()).toBeNull();
    expect(geometry.getAttribute("normal")).toBeUndefined();
    expect(geometry.getAttribute("uv")).toBeUndefined();
    expect(geometry.getAttribute("color").itemSize).toBe(4);
    expect(geometry.getAttribute("color").count).toBe(36);
    expect(Array.from(geometry.getAttribute("color").array as Float32Array).every((value) => value === 0)).toBe(true);
    expect(source.geometry.getAttribute("color")).toBeUndefined();

    const sourceColor = new Float32BufferAttribute(source.geometry.getAttribute("position").count * 3, 3);
    source.geometry.setAttribute("color", sourceColor);
    const withSourceColor = createCompareOverlayGeometry(source);
    expect(withSourceColor.getAttribute("color")).not.toBe(sourceColor);
    expect(withSourceColor.getAttribute("color").itemSize).toBe(4);
    expect(source.geometry.getAttribute("color")).toBe(sourceColor);
  });

  it("shares skinning and morph state for SkinnedMesh", () => {
    const source = skinnedMesh();
    const geometry = createCompareOverlayGeometry(source);
    const overlay = createCompareOverlay(source) as SkinnedMesh;

    expect(geometry.getAttribute("skinIndex")).not.toBe(source.geometry.getAttribute("skinIndex"));
    expect(geometry.getAttribute("skinIndex").count).toBe(36);
    expect(geometry.getAttribute("skinWeight")).not.toBe(source.geometry.getAttribute("skinWeight"));
    expect(geometry.getAttribute("skinWeight").count).toBe(36);
    expect(geometry.morphAttributes.position).not.toBe(source.geometry.morphAttributes.position);
    expect(geometry.morphAttributes.position![0]).not.toBe(source.geometry.morphAttributes.position![0]);
    expect(geometry.morphAttributes.position![0]!.count).toBe(36);
    expect(geometry.morphTargetsRelative).toBe(source.geometry.morphTargetsRelative);
    expect(overlay).toBeInstanceOf(SkinnedMesh);
    expect(overlay.skeleton).toBe(source.skeleton);
    expect(overlay.bindMatrix.equals(source.bindMatrix)).toBe(true);
    expect(overlay.bindMode).toBe(source.bindMode);
    expect(overlay.morphTargetInfluences).toBe(source.morphTargetInfluences);
  });

  it("creates a marked, raycast-disabled material overlay", () => {
    const source = mesh();
    const overlay = createCompareOverlay(source);
    const material = overlay.material as MeshBasicMaterial;
    const standaloneMaterial = createCompareOverlayMaterial();
    const raycaster = new Raycaster();

    expect(overlay).toBeInstanceOf(Mesh);
    expect(overlay.userData[MESH_COMPARE_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[MESH_DISPLAY_OVERLAY_KEY]).toBeUndefined();
    expect(overlay.renderOrder).toBe(-1);
    expect(source.children).toHaveLength(0);
    expect(raycaster.intersectObject(overlay)).toEqual([]);
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
    expect(standaloneMaterial).toBeInstanceOf(MeshBasicMaterial);
    expect(standaloneMaterial.vertexColors).toBe(true);
    expect(standaloneMaterial.color.getHex()).toBe(0xffffff);
    expect(standaloneMaterial.transparent).toBe(true);
    expect(standaloneMaterial.depthWrite).toBe(false);
    expect(standaloneMaterial.toneMapped).toBe(false);
    expect(isMeshCompareOverlay(overlay)).toBe(true);
    expect(isMeshCompareOverlay(source)).toBe(false);
    expect(isMeshCompareOverlay(createWireframeOverlay(source))).toBe(false);
  });

  it("colorizes finite distances and clears stale colors", () => {
    const geometry = createCompareOverlayGeometry(mesh());
    const color = geometry.getAttribute("color") as Float32BufferAttribute;
    const version = color.version;
    const distances = new Float32Array([0.2, -0.2, 0.05, -0.05, 0.1, -0.1, NaN, Infinity, -Infinity]);
    colorizeDeviation(geometry, distances, 0.1, DEFAULT_COLORS);
    const outside = new Color(COMPARE_OUTSIDE_COLOR);
    const inside = new Color(COMPARE_INSIDE_COLOR);

    for (const vertex of [0, 1, 2]) {
      expectRgba(geometry, vertex, [outside.r, outside.g, outside.b, COMPARE_OVERLAY_OPACITY]);
    }
    for (const vertex of [3, 4, 5]) {
      expectRgba(geometry, vertex, [inside.r, inside.g, inside.b, COMPARE_OVERLAY_OPACITY]);
    }
    for (const vertex of [6, 7, 8]) {
      expectRgba(geometry, vertex, [outside.r, outside.g, outside.b, COMPARE_OVERLAY_OPACITY]);
    }
    expect(color.version).toBeGreaterThan(version);

    colorizeDeviation(geometry, new Float32Array([0.2, -0.2, 0]), 0, DEFAULT_COLORS);
    for (const vertex of [0, 1, 2]) {
      expectRgba(geometry, vertex, [outside.r, outside.g, outside.b, COMPARE_OVERLAY_OPACITY]);
    }
    for (const vertex of [3, 4, 5]) {
      expectRgba(geometry, vertex, [inside.r, inside.g, inside.b, COMPARE_OVERLAY_OPACITY]);
    }
    colorizeDeviation(geometry, new Float32Array([0.01]), 0.1, DEFAULT_COLORS);
    expectRgba(geometry, 0, [0, 0, 0, 0]);
  });

  it("limits coloring to the shorter of the two arrays", () => {
    const geometry = createCompareOverlayGeometry(mesh());
    expect(() => colorizeDeviation(geometry, new Float32Array([1]), 0, DEFAULT_COLORS)).not.toThrow();
    for (const vertex of [0, 1, 2]) {
      expect(rgba(geometry, vertex)[3]).toBeCloseTo(COMPARE_OVERLAY_OPACITY, 6);
    }
    expectRgba(geometry, 3, [0, 0, 0, 0]);
    expect(() => colorizeDeviation(geometry, new Float32Array(100).fill(-1), 0, DEFAULT_COLORS)).not.toThrow();
  });

  it("adds one reusable overlay and preserves parent picking", () => {
    const root = new Group();
    const source = mesh();
    root.add(source);
    root.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    raycaster.ray.origin.set(0, 0, 5);
    raycaster.ray.direction.set(0, 0, -1);
    const before = raycaster.intersectObject(source, true).length;
    const first = applyCompareOverlay(source, new Float32Array(24).fill(1), 0.5, DEFAULT_COLORS);
    const second = applyCompareOverlay(source, new Float32Array(24).fill(0), 0.5, DEFAULT_COLORS);

    expect(second).toBe(first);
    expect(source.children.filter(isMeshCompareOverlay)).toHaveLength(1);
    expect(raycaster.intersectObject(source, true)).toHaveLength(before);
    expect(rgba(first.geometry, 0)).toEqual([0, 0, 0, 0]);
  });

  it("clears only comparison overlays and releases shared geometry safely", () => {
    const root = new Group();
    const first = mesh();
    const second = mesh();
    const firstOverlay = applyCompareOverlay(first, new Float32Array(24), 0.1, DEFAULT_COLORS);
    const secondOverlay = applyCompareOverlay(second, new Float32Array(24), 0.1, DEFAULT_COLORS);
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
    expect(firstOverlay.geometry.getAttribute("skinIndex")).toBeUndefined();
    expect(firstOverlay.geometry.getIndex()).toBeNull();
    expect(first.geometry.getAttribute("position")).toBeDefined();
    expect(first.geometry.getIndex()).not.toBeNull();
    clearCompareOverlays(new Group());
  });

  it("coexists with mesh display without being restyled or removed", () => {
    const root = new Group();
    const source = mesh();
    const comparison = applyCompareOverlay(source, new Float32Array(24).fill(1), 0.1, DEFAULT_COLORS);
    root.add(source);

    applyMeshDisplay(root, "solid-wireframe");
    expect((comparison.material as MeshBasicMaterial).wireframe).toBe(false);
    expect(source.children.filter(isMeshCompareOverlay)).toHaveLength(1);
    expect(source.children.some((child) => child.userData[MESH_DISPLAY_OVERLAY_KEY] === true)).toBe(true);
    applyMeshDisplay(root, "solid");
    expect(source.children).toContain(comparison);
  });
});
