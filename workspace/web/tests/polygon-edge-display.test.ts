/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BoxGeometry,
  Bone,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Skeleton,
  SkinnedMesh,
  Vector3,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { applyPolygonEdges, hasPolygonEdges } from "../src/features/polygon-edges/polygon-edges";
import {
  applyMeshDisplay,
  createWireframeOverlay,
  isViewerOverlay,
  POLYGON_EDGE_ORIGINAL_MATERIAL_KEY,
  WIREFRAME_OVERLAY_OPACITY,
} from "../src/features/viewer/mesh-display";
import {
  createPolygonEdgeMaterial,
  isPolygonEdgeMaterial,
  POLYGON_EDGE_LINE_WIDTH,
  POLYGON_EDGE_MATERIAL_KEY,
} from "../src/features/viewer/polygon-edge-material";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function polygonGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 1, 1, 0,
    0, 0, 0, 1, 1, 0, 0, 1, 0,
  ], 3));
  expect(applyPolygonEdges(geometry, [4])).toBe(true);
  return geometry;
}

function polygonMesh(material: Material | Material[] = new MeshStandardMaterial()): Mesh {
  return new Mesh(polygonGeometry(), material);
}

function displayOverlays(mesh: Mesh): Mesh[] {
  return mesh.children.filter((child): child is Mesh => child instanceof Mesh && isViewerOverlay(child));
}

function polygonMaterials(mesh: Mesh): MeshBasicMaterial[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.filter((material): material is MeshBasicMaterial => isPolygonEdgeMaterial(material));
}

describe("polygon edge material", () => {
  it("configures opaque and overlay materials", () => {
    const opaque = createPolygonEdgeMaterial(0x112233, 1);
    const overlay = createPolygonEdgeMaterial(0x445566, WIREFRAME_OVERLAY_OPACITY);

    expect(opaque).toBeInstanceOf(MeshBasicMaterial);
    expect(opaque.side).toBe(DoubleSide);
    expect(opaque.toneMapped).toBe(false);
    expect(opaque.transparent).toBe(false);
    expect(opaque.depthWrite).toBe(true);
    expect(opaque.color.getHex()).toBe(0x112233);
    expect(opaque.defines?.POLYGON_EDGE_LINE_WIDTH).toBe("1.0");
    expect(opaque.customProgramCacheKey()).toBe("polygonEdge");
    expect(opaque.userData[POLYGON_EDGE_MATERIAL_KEY]).toBe(true);
    expect(isPolygonEdgeMaterial(opaque)).toBe(true);
    expect(overlay.transparent).toBe(true);
    expect(overlay.depthWrite).toBe(false);
  });

  it("injects attributes, varyings, fwidth, and discard while keeping includes", () => {
    const material = createPolygonEdgeMaterial(0x112233, 1);
    const shader = {
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <clipping_planes_fragment>",
    };
    material.onBeforeCompile(shader as never, undefined as never);

    expect(shader.vertexShader).toContain("#include <common>");
    expect(shader.vertexShader).toContain("attribute vec3 polygonEdgeBarycentric;");
    expect(shader.vertexShader).toContain("attribute vec3 polygonEdgeMask;");
    expect(shader.vertexShader).toContain("varying vec3 vPolygonEdgeBarycentric;");
    expect(shader.vertexShader).toContain("varying vec3 vPolygonEdgeMask;");
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.fragmentShader).toContain("#include <common>");
    expect(shader.fragmentShader).toContain("#include <clipping_planes_fragment>");
    expect(shader.fragmentShader).toContain("fwidth(vPolygonEdgeBarycentric)");
    expect(shader.fragmentShader).toContain("POLYGON_EDGE_LINE_WIDTH");
    expect(shader.fragmentShader).toContain("discard");
    expect(POLYGON_EDGE_LINE_WIDTH).toBe(1);
  });
});

describe("polygon edge display", () => {
  it("keeps attributed materials unchanged in solid mode", () => {
    const mesh = polygonMesh();
    const original = mesh.material;

    applyMeshDisplay(mesh, "solid");

    expect(mesh.material).toBe(original);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBeUndefined();
    expect(displayOverlays(mesh)).toHaveLength(0);
  });

  it("replaces one attributed material in wireframe mode", () => {
    const mesh = polygonMesh();
    const original = mesh.material;

    applyMeshDisplay(mesh, "wireframe", 0xabcdef);

    expect(mesh.material).not.toBe(original);
    expect(polygonMaterials(mesh)).toHaveLength(1);
    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0xabcdef);
    expect((mesh.material as MeshBasicMaterial).opacity).toBe(1);
    expect((mesh.material as MeshBasicMaterial).transparent).toBe(false);
    expect((mesh.material as MeshBasicMaterial).depthWrite).toBe(true);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBe(original);
    expect(displayOverlays(mesh)).toHaveLength(0);
  });

  it("replaces every material in an attributed material array", () => {
    const original = [new MeshStandardMaterial(), new MeshStandardMaterial()];
    const mesh = polygonMesh(original);

    applyMeshDisplay(mesh, "wireframe");

    expect(Array.isArray(mesh.material)).toBe(true);
    expect(mesh.material).toHaveLength(2);
    expect((mesh.material as Material[])[0]).not.toBe((mesh.material as Material[])[1]);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBe(original);
    expect(polygonMaterials(mesh)).toHaveLength(2);
  });

  it("restores and disposes replacements when returning to solid", () => {
    const mesh = polygonMesh();
    applyMeshDisplay(mesh, "wireframe");
    const replacement = mesh.material as MeshBasicMaterial;
    const dispose = vi.spyOn(replacement, "dispose");
    const original = mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY];

    applyMeshDisplay(mesh, "solid");

    expect(dispose).toHaveBeenCalledOnce();
    expect(mesh.material).toBe(original);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBeUndefined();
  });

  it("disposes the old replacement when wireframe color changes", () => {
    const mesh = polygonMesh();
    applyMeshDisplay(mesh, "wireframe", 0xff0000);
    const oldMaterial = mesh.material as MeshBasicMaterial;
    const dispose = vi.spyOn(oldMaterial, "dispose");
    const original = mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY];

    applyMeshDisplay(mesh, "wireframe", 0x00ff00);

    expect(dispose).toHaveBeenCalledOnce();
    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0x00ff00);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBe(original);
  });

  it("restores the original material before adding a solid-wireframe overlay", () => {
    const mesh = polygonMesh();
    const original = mesh.material;
    applyMeshDisplay(mesh, "wireframe");

    applyMeshDisplay(mesh, "solid-wireframe", 0x123456);

    expect(mesh.material).toBe(original);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBeUndefined();
    expect(displayOverlays(mesh)).toHaveLength(1);
    const overlayMaterial = displayOverlays(mesh)[0]!.material as MeshBasicMaterial;
    expect(isPolygonEdgeMaterial(overlayMaterial)).toBe(true);
    expect(overlayMaterial.opacity).toBe(WIREFRAME_OVERLAY_OPACITY);
    expect(overlayMaterial.transparent).toBe(true);
    expect(overlayMaterial.depthWrite).toBe(false);
    expect((mesh.material as MeshStandardMaterial).polygonOffset).toBe(true);
  });

  it("keeps one attributed overlay when solid-wireframe is applied twice", () => {
    const mesh = polygonMesh();

    applyMeshDisplay(mesh, "solid-wireframe");
    applyMeshDisplay(mesh, "solid-wireframe");

    expect(displayOverlays(mesh)).toHaveLength(1);
  });

  it("does not replace attributed InstancedMesh materials", () => {
    const material = new MeshStandardMaterial();
    const mesh = new InstancedMesh(polygonGeometry(), material, 1);

    applyMeshDisplay(mesh, "wireframe");

    expect(mesh.material).toBe(material);
    expect(material.wireframe).toBe(true);
    expect(mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]).toBeUndefined();
  });

  it("replaces a SkinnedMesh material without changing skinning state", () => {
    const bone = new Bone();
    const skeleton = new Skeleton([bone]);
    const mesh = new SkinnedMesh(polygonGeometry(), new MeshStandardMaterial());
    mesh.bind(skeleton);
    const bindMatrix = mesh.bindMatrix.clone();

    applyMeshDisplay(mesh, "wireframe");

    expect(isPolygonEdgeMaterial(mesh.material as Material)).toBe(true);
    expect(mesh.skeleton).toBe(skeleton);
    expect(mesh.bindMatrix.equals(bindMatrix)).toBe(true);
  });

  it("keeps raycast hit counts unchanged during replacement", () => {
    const mesh = polygonMesh();
    mesh.updateMatrixWorld(true);
    const raycaster = new Raycaster(new Vector3(0.25, 0.25, 1), new Vector3(0, 0, -1));
    const before = raycaster.intersectObject(mesh).length;

    applyMeshDisplay(mesh, "wireframe");

    expect(raycaster.intersectObject(mesh)).toHaveLength(before);
  });

  it("uses polygon materials only for attributed geometry", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const overlay = createWireframeOverlay(mesh);
    expect(isPolygonEdgeMaterial(overlay.material as Material)).toBe(false);
    expect(hasPolygonEdges(mesh.geometry)).toBe(false);

    const attributed = polygonMesh();
    const attributedOverlay = createWireframeOverlay(attributed);
    expect(isPolygonEdgeMaterial(attributedOverlay.material as Material)).toBe(true);
  });

  it("keeps the original mesh selectable after replacement", () => {
    const root = new Group();
    const mesh = polygonMesh();
    root.add(mesh);
    root.updateMatrixWorld(true);
    const raycaster = new Raycaster(new Vector3(0.25, 0.25, 1), new Vector3(0, 0, -1));
    const before = raycaster.intersectObject(mesh).length;

    applyMeshDisplay(root, "wireframe");

    expect(raycaster.intersectObject(mesh)).toHaveLength(before);
  });
});

describe("polygon edge display wiring", () => {
  it("keeps the shared model scene hook unchanged and selects custom loaders", () => {
    const scene = readSource("features/viewer/useModelScene.ts");
    const model = readSource("features/viewer/ModelMesh.tsx");
    expect(scene).toContain("applyMeshDisplay(scene, meshDisplay,");
    expect(scene).toContain('applyMeshDisplay(scene, "solid",');
    expect(model).toContain("useLoader(PolygonEdgeFBXLoader, src, extendLoader)");
    expect(model).toContain("useLoader(PolygonEdgeOBJLoader, src, extendLoader)");
  });
});
