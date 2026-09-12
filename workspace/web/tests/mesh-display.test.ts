/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  Bone,
  BoxGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Skeleton,
  SkinnedMesh,
} from "three";
import {
  applyMeshDisplay,
  createWireframeOverlay,
  isMeshDisplayOverlay,
  isViewerOverlay,
  MESH_DISPLAY_OVERLAY_KEY,
  VIEWER_OVERLAY_KEY,
  WIREFRAME_OVERLAY_COLOR,
  WIREFRAME_OVERLAY_OPACITY,
} from "../src/features/viewer/mesh-display";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function overlays(mesh: Mesh): Mesh[] {
  return mesh.children.filter((child): child is Mesh => child instanceof Mesh && isMeshDisplayOverlay(child));
}

function createScene() {
  const root = new Group();
  const meshMaterials = [new MeshStandardMaterial(), new MeshStandardMaterial()];
  const mesh = new Mesh(new BoxGeometry(), meshMaterials);
  const bone = new Bone();
  const skeleton = new Skeleton([bone]);
  const skinnedMaterial = new MeshStandardMaterial();
  const skinned = new SkinnedMesh(new BoxGeometry(), skinnedMaterial);
  skinned.morphTargetInfluences = [0.5];
  skinned.add(bone);
  skinned.bind(skeleton);
  const group = new Group();
  const lineMaterial = new LineBasicMaterial();
  const line = new Line(new BoxGeometry(), lineMaterial);
  group.add(line);
  root.add(mesh, skinned, group);
  root.updateMatrixWorld(true);
  return { root, mesh, meshMaterials, skinned, skinnedMaterial, bone, line, lineMaterial, group };
}

describe("mesh display", () => {
  it("sets every wireframe material and does not add overlays in wireframe mode", () => {
    const scene = createScene();

    applyMeshDisplay(scene.root, "wireframe");

    expect(scene.meshMaterials.every((material) => material.wireframe)).toBe(true);
    expect(scene.meshMaterials.every((material) => !material.polygonOffset)).toBe(true);
    expect(scene.skinnedMaterial.wireframe).toBe(true);
    expect(overlays(scene.mesh)).toHaveLength(0);
    expect(overlays(scene.skinned)).toHaveLength(0);
  });

  it("adds one overlay per non-instanced mesh and applies polygon offset", () => {
    const scene = createScene();

    applyMeshDisplay(scene.root, "solid-wireframe");

    expect(scene.meshMaterials.every((material) => !material.wireframe)).toBe(true);
    expect(scene.meshMaterials.every((material) => material.polygonOffset)).toBe(true);
    expect(scene.meshMaterials.every((material) => material.polygonOffsetFactor === 1)).toBe(true);
    expect(scene.meshMaterials.every((material) => material.polygonOffsetUnits === 1)).toBe(true);
    expect(scene.skinnedMaterial.polygonOffset).toBe(true);
    expect(overlays(scene.mesh)).toHaveLength(1);
    expect(overlays(scene.skinned)).toHaveLength(1);
  });

  it("creates a configured overlay with shared geometry and material", () => {
    const scene = createScene();
    const overlay = createWireframeOverlay(scene.mesh);
    const material = overlay.material as MeshBasicMaterial;

    expect(overlay.userData[MESH_DISPLAY_OVERLAY_KEY]).toBe(true);
    expect(overlay.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(isViewerOverlay(overlay)).toBe(true);
    expect(scene.mesh.children).toHaveLength(0);
    expect(overlay.geometry).toBe(scene.mesh.geometry);
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.wireframe).toBe(true);
    expect(material.color.getHex()).toBe(WIREFRAME_OVERLAY_COLOR);
    expect(material.opacity).toBe(WIREFRAME_OVERLAY_OPACITY);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.toneMapped).toBe(false);
  });

  it("shares skinning state with a SkinnedMesh overlay", () => {
    const scene = createScene();
    applyMeshDisplay(scene.root, "solid-wireframe");
    const overlay = overlays(scene.skinned)[0]!;

    expect(overlay).toBeInstanceOf(SkinnedMesh);
    const skinnedOverlay = overlay as SkinnedMesh;
    expect(skinnedOverlay.skeleton).toBe(scene.skinned.skeleton);
    expect(skinnedOverlay.bindMatrix.equals(scene.skinned.bindMatrix)).toBe(true);
    expect(skinnedOverlay.bindMode).toBe(scene.skinned.bindMode);
    expect(skinnedOverlay.morphTargetInfluences).toBe(scene.skinned.morphTargetInfluences);
  });

  it("disables overlay raycasting without changing parent hit count", () => {
    const scene = createScene();
    const pickMesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    scene.root.add(pickMesh);
    scene.root.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    raycaster.ray.origin.set(0, 0, 5);
    raycaster.ray.direction.set(0, 0, -1);
    const before = raycaster.intersectObject(pickMesh, true).length;
    applyMeshDisplay(scene.root, "solid-wireframe");
    const overlay = overlays(pickMesh)[0]!;

    expect(new Raycaster().intersectObject(overlay)).toEqual([]);
    pickMesh.updateMatrixWorld(true);
    expect(raycaster.intersectObject(pickMesh, true)).toHaveLength(before);
  });

  it("is idempotent and never creates nested overlays", () => {
    const scene = createScene();

    applyMeshDisplay(scene.root, "solid-wireframe");
    applyMeshDisplay(scene.root, "solid-wireframe");

    expect(overlays(scene.mesh)).toHaveLength(1);
    expect(overlays(scene.skinned)).toHaveLength(1);
    expect(overlays(scene.mesh)[0]!.children).toHaveLength(0);
    expect(overlays(scene.skinned)[0]!.children).toHaveLength(0);
  });

  it("removes and disposes overlays when returning to solid", () => {
    const scene = createScene();
    const dispose = vi.spyOn(MeshBasicMaterial.prototype, "dispose");
    applyMeshDisplay(scene.root, "solid-wireframe");
    applyMeshDisplay(scene.root, "solid");

    expect(overlays(scene.mesh)).toHaveLength(0);
    expect(overlays(scene.skinned)).toHaveLength(0);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(scene.meshMaterials.every((material) => !material.wireframe && !material.polygonOffset)).toBe(true);
    expect(scene.skinned.children).toContain(scene.bone);
    dispose.mockRestore();
  });

  it("removes overlays before switching to wireframe", () => {
    const scene = createScene();

    applyMeshDisplay(scene.root, "solid-wireframe");
    applyMeshDisplay(scene.root, "wireframe");

    expect(overlays(scene.mesh)).toHaveLength(0);
    expect(overlays(scene.skinned)).toHaveLength(0);
    expect(scene.meshMaterials.every((material) => material.wireframe)).toBe(true);
  });

  it("leaves groups and lines unchanged", () => {
    const scene = createScene();

    applyMeshDisplay(scene.root, "solid-wireframe");

    expect(scene.group.children).toContain(scene.line);
    expect("wireframe" in scene.lineMaterial).toBe(false);
  });

  it("handles a mesh root, materials without wireframe, and InstancedMesh", () => {
    const rootMesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    applyMeshDisplay(rootMesh, "wireframe");
    expect((rootMesh.material as MeshStandardMaterial).wireframe).toBe(true);

    const plainMaterial = new Material();
    const plainMesh = new Mesh(new BoxGeometry(), plainMaterial);
    expect(() => applyMeshDisplay(plainMesh, "solid-wireframe")).not.toThrow();
    expect(plainMaterial.polygonOffset).toBe(false);
    expect(overlays(plainMesh)).toHaveLength(1);

    const instancedMaterial = new MeshStandardMaterial();
    const instanced = new InstancedMesh(new BoxGeometry(), instancedMaterial, 1);
    applyMeshDisplay(instanced, "solid-wireframe");
    expect(instancedMaterial.polygonOffset).toBe(true);
    expect(overlays(instanced)).toHaveLength(0);
  });

  it("recognizes only marked overlay objects", () => {
    const group = new Group();
    expect(isMeshDisplayOverlay(group)).toBe(false);
    expect(isViewerOverlay(group)).toBe(false);
    group.userData[MESH_DISPLAY_OVERLAY_KEY] = true;
    expect(isMeshDisplayOverlay(group)).toBe(true);
    group.userData[VIEWER_OVERLAY_KEY] = false;
    expect(isViewerOverlay(group)).toBe(false);
  });

  it("ignores viewer overlays without removing them", () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const comparisonOverlay = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    comparisonOverlay.userData[VIEWER_OVERLAY_KEY] = true;
    mesh.add(comparisonOverlay);
    root.add(mesh);

    applyMeshDisplay(root, "wireframe");
    expect((comparisonOverlay.material as MeshStandardMaterial).wireframe).toBe(false);
    applyMeshDisplay(root, "solid-wireframe");
    expect(overlays(mesh)).toHaveLength(1);
    expect(mesh.children).toContain(comparisonOverlay);
    applyMeshDisplay(root, "solid");
    expect(mesh.children).toContain(comparisonOverlay);
  });

  it("connects ModelMesh and ViewerCanvas to mesh display state", () => {
    const modelScene = readSource("features/viewer/useModelScene.ts");
    const canvas = readSource("features/viewer/ViewerCanvas.tsx");

    expect(modelScene).toContain("applyMeshDisplay(scene, meshDisplay)");
    expect(modelScene).toContain('applyMeshDisplay(scene, "solid")');
    expect(canvas).toContain("useDisplayStore");
    expect(canvas).toContain("meshDisplay={meshDisplay}");
  });
});
