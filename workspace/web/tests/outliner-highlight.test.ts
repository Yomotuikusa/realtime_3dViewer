/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  Bone,
  BoxGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Skeleton,
  SkinnedMesh,
} from "three";
import {
  applySelectionHighlight,
  clearSelectionHighlight,
  createSelectionOverlay,
  isSelectionOverlay,
  SELECTION_COLOR,
  SELECTION_MESH_OPACITY,
  SELECTION_OVERLAY_KEY,
} from "../src/features/outliner/selection-highlight";
import { applyMeshDisplay, isViewerOverlay, VIEWER_OVERLAY_KEY } from "../src/features/viewer/mesh-display";

const sourceRoot = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

function selectionOverlays(object: { children: Array<{ userData: Record<string, unknown> }> }) {
  return object.children.filter((child) => child.userData[SELECTION_OVERLAY_KEY] === true);
}

describe("outliner selection highlight", () => {
  it("exports the selection highlight constants", () => {
    expect(SELECTION_OVERLAY_KEY).toBe("outlinerSelectionOverlay");
    expect(SELECTION_COLOR).toBe(0x60a5fa);
    expect(SELECTION_MESH_OPACITY).toBe(0.6);
  });

  it("creates a configured mesh overlay with shared geometry", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const overlay = createSelectionOverlay(mesh);
    expect(overlay).toBeInstanceOf(Mesh);
    expect((overlay as Mesh).geometry).toBe(mesh.geometry);
    const material = (overlay as Mesh).material as MeshBasicMaterial;
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.color.getHex()).toBe(SELECTION_COLOR);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(SELECTION_MESH_OPACITY);
    expect(material.depthWrite).toBe(false);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBe(-1);
    expect(material.polygonOffsetUnits).toBe(-1);
    expect(material.toneMapped).toBe(false);
    expect(overlay?.renderOrder).toBe(1);
    expect(overlay && isSelectionOverlay(overlay)).toBe(true);
    expect(overlay && isViewerOverlay(overlay)).toBe(true);
    expect(overlay?.userData[SELECTION_OVERLAY_KEY]).toBe(true);
    expect(overlay?.userData[VIEWER_OVERLAY_KEY]).toBe(true);
    expect(() => (overlay as Mesh).raycast(new Raycaster(), [])).not.toThrow();
  });

  it("shares skinning state with a SkinnedMesh overlay", () => {
    const bone = new Bone();
    const skeleton = new Skeleton([bone]);
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
    mesh.add(bone);
    mesh.bind(skeleton);
    mesh.morphTargetInfluences = [0.25];
    mesh.morphTargetDictionary = { shape: 0 };
    const overlay = createSelectionOverlay(mesh) as SkinnedMesh;

    expect(overlay).toBeInstanceOf(SkinnedMesh);
    expect(overlay.skeleton).toBe(mesh.skeleton);
    expect(overlay.bindMode).toBe(mesh.bindMode);
    expect(overlay.bindMatrix.equals(mesh.bindMatrix)).toBe(true);
    expect(overlay.morphTargetInfluences).toBe(mesh.morphTargetInfluences);
    expect(overlay.morphTargetDictionary).toBe(mesh.morphTargetDictionary);
  });

  it("does not create an InstancedMesh overlay", () => {
    const object = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 2);
    expect(createSelectionOverlay(object)).toBeNull();
  });

  it("creates matching line classes with shared geometry", () => {
    for (const source of [
      new Line(new BoxGeometry(), new LineBasicMaterial()),
      new LineSegments(new BoxGeometry(), new LineBasicMaterial()),
      new LineLoop(new BoxGeometry(), new LineBasicMaterial()),
    ]) {
      const overlay = createSelectionOverlay(source);
      expect(overlay?.constructor).toBe(source.constructor);
      expect((overlay as Line).geometry).toBe(source.geometry);
      expect((overlay as Line).material).toBeInstanceOf(LineBasicMaterial);
      expect(((overlay as Line).material as LineBasicMaterial).depthTest).toBe(false);
      expect(((overlay as Line).material as LineBasicMaterial).toneMapped).toBe(false);
      expect(((overlay as Line).material as LineBasicMaterial).color.getHex()).toBe(SELECTION_COLOR);
    }
  });

  it("copies point size settings only from PointsMaterial", () => {
    const points = new Points(new BoxGeometry(), new PointsMaterial({ size: 3, sizeAttenuation: false }));
    const overlay = createSelectionOverlay(points) as Points;
    expect(overlay).toBeInstanceOf(Points);
    expect(overlay.geometry).toBe(points.geometry);
    expect(overlay.material).toBeInstanceOf(PointsMaterial);
    expect((overlay.material as PointsMaterial).size).toBe(3);
    expect((overlay.material as PointsMaterial).sizeAttenuation).toBe(false);
    expect((overlay.material as PointsMaterial).depthTest).toBe(false);
    expect((overlay.material as PointsMaterial).color.getHex()).toBe(SELECTION_COLOR);

    const fallback = new Points(new BoxGeometry(), new MeshBasicMaterial());
    const fallbackOverlay = createSelectionOverlay(fallback) as Points;
    expect((fallbackOverlay.material as PointsMaterial).color.getHex()).toBe(SELECTION_COLOR);
    expect((fallbackOverlay.material as PointsMaterial).size).toBe(1);
    expect((fallbackOverlay.material as PointsMaterial).sizeAttenuation).toBe(true);
  });

  it("returns null for non-renderable objects", () => {
    expect(createSelectionOverlay(new Group())).toBeNull();
    expect(createSelectionOverlay(new Bone())).toBeNull();
    expect(createSelectionOverlay(new DirectionalLight())).toBeNull();
    expect(createSelectionOverlay(new PerspectiveCamera())).toBeNull();
  });

  it("adds overlays to renderable descendants and skips viewer overlays", () => {
    const root = new Group();
    const meshA = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const meshB = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const line = new Line(new BoxGeometry(), new LineBasicMaterial());
    const bone = new Bone();
    const viewerOverlay = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    viewerOverlay.userData[VIEWER_OVERLAY_KEY] = true;
    meshA.add(meshB, viewerOverlay);
    root.add(meshA, line, bone);

    applySelectionHighlight(root);

    expect(selectionOverlays(meshA)).toHaveLength(1);
    expect(selectionOverlays(meshB)).toHaveLength(1);
    expect(selectionOverlays(line)).toHaveLength(1);
    expect(selectionOverlays(root)).toHaveLength(0);
    expect(selectionOverlays(bone)).toHaveLength(0);
    expect(selectionOverlays(viewerOverlay)).toHaveLength(0);
  });

  it("is idempotent and applies to a mesh target itself", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    applySelectionHighlight(mesh);
    applySelectionHighlight(mesh);
    expect(selectionOverlays(mesh)).toHaveLength(1);
  });

  it("clears only selection overlays and disposes their materials", () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const viewerOverlay = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    viewerOverlay.userData[VIEWER_OVERLAY_KEY] = true;
    mesh.add(viewerOverlay);
    root.add(mesh, new Line(new BoxGeometry(), new LineBasicMaterial()));
    applySelectionHighlight(root);
    const selectionMaterial = (selectionOverlays(mesh)[0] as Mesh).material as Material;
    const dispose = vi.spyOn(selectionMaterial, "dispose");
    const originalDispose = vi.spyOn(mesh.material as Material, "dispose");

    clearSelectionHighlight(root);

    let count = 0;
    root.traverse((object) => {
      if (isSelectionOverlay(object)) count += 1;
    });
    expect(count).toBe(0);
    expect(dispose).toHaveBeenCalledOnce();
    expect(originalDispose).not.toHaveBeenCalled();
    expect(mesh.children).toContain(viewerOverlay);
  });

  it("is safe when there are no selection overlays", () => {
    expect(() => clearSelectionHighlight(new Group())).not.toThrow();
  });

  it("survives mesh display changes without touching selection overlays", () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    applySelectionHighlight(mesh);
    const selection = selectionOverlays(mesh)[0] as Mesh;

    applyMeshDisplay(mesh, "wireframe");
    applyMeshDisplay(mesh, "solid");

    expect(selectionOverlays(mesh)).toHaveLength(1);
    expect((selection.material as MeshBasicMaterial).wireframe).toBe(false);
  });

  it("keeps the Rig on the store and scene effect path", () => {
    const rig = readSource("features/outliner/SelectionRig.tsx");
    expect(rig).toContain("export function SelectionRig(): null");
    expect(rig).toContain('getObjectByProperty("uuid"');
    expect(rig).toContain("applySelectionHighlight(");
    expect(rig).toContain("clearSelectionHighlight(");
    expect(rig).toContain("useSelectionStore(");
    expect(rig).toContain("useModelScenesStore(");
    expect(rig).toContain("selectModelScene(");
    expect(rig).not.toContain("send");
    expect(rig).not.toContain("useFrame");
  });

  it("keeps overlay ownership in the outliner module", () => {
    const source = readSource("features/outliner/selection-highlight.ts");
    expect(source).toContain('VIEWER_OVERLAY_KEY, isViewerOverlay } from "../viewer/mesh-display"');
    expect(readSource("features/viewer/ViewerCanvas.tsx")).not.toContain("SelectionRig");
    expect(readSource("features/viewer/mesh-display.ts")).not.toContain("SELECTION_OVERLAY_KEY");
    expect(readSource("features/compare/overlay.ts")).not.toContain("SELECTION_OVERLAY_KEY");
  });
});
