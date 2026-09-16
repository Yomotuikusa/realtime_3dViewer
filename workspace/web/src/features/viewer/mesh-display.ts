import { InstancedMesh, Material, Mesh, MeshBasicMaterial, Object3D, SkinnedMesh } from "three";
import type { MeshDisplayMode } from "@shared/types";
import { hasPolygonEdges } from "../polygon-edges/polygon-edges";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";
import { createPolygonEdgeMaterial } from "./polygon-edge-material";

/** 重ね描き用オブジェクトの userData キー。値は true */
export const MESH_DISPLAY_OVERLAY_KEY = "meshDisplayOverlay";
/** ビューアが後付けする重ね描き Mesh 共通の userData キー。値は true */
export const VIEWER_OVERLAY_KEY = "viewerOverlay";
/** 重ね描きの線の色(濃いグレー) */
export const WIREFRAME_OVERLAY_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.wireframe);
/** 重ね描きの線の不透明度 */
export const WIREFRAME_OVERLAY_OPACITY = 0.6;
/** wireframe モードで差し替える前の材質を退避する userData キー。 */
export const POLYGON_EDGE_ORIGINAL_MATERIAL_KEY = "polygonEdgeOriginalMaterial";

type WireframeMaterial = Material & {
  wireframe: boolean;
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
};

type OverlayMaterial = Material & {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

/** userData[MESH_DISPLAY_OVERLAY_KEY] === true なら重ね描き用オブジェクト */
export function isMeshDisplayOverlay(object: Object3D): boolean {
  return object.userData[MESH_DISPLAY_OVERLAY_KEY] === true;
}

/** userData[VIEWER_OVERLAY_KEY] === true ならビューアが後付けした重ね描き */
export function isViewerOverlay(object: Object3D): boolean {
  return object.userData[VIEWER_OVERLAY_KEY] === true;
}

/** 重ね描きの線を描くための共有しない材質を作る。color は 0xrrggbb。 */
export function createWireframeOverlayMaterial(color?: number, opacity = WIREFRAME_OVERLAY_OPACITY): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: color ?? WIREFRAME_OVERLAY_COLOR,
    wireframe: true,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    toneMapped: false,
  });
}

/** mesh と同じ geometry を使う重ね描き用 Mesh を作る。color は 0xrrggbb。 */
export function createWireframeOverlay(mesh: Mesh, color?: number, opacity = WIREFRAME_OVERLAY_OPACITY): Mesh {
  const material = hasPolygonEdges(mesh.geometry)
    ? createPolygonEdgeMaterial(color ?? WIREFRAME_OVERLAY_COLOR, opacity)
    : createWireframeOverlayMaterial(color, opacity);
  const overlay = mesh instanceof SkinnedMesh
    ? new SkinnedMesh(mesh.geometry, material)
    : new Mesh(mesh.geometry, material);

  if (overlay instanceof SkinnedMesh && mesh instanceof SkinnedMesh) {
    overlay.bindMode = mesh.bindMode;
    overlay.bind(mesh.skeleton, mesh.bindMatrix);
  }
  overlay.morphTargetInfluences = mesh.morphTargetInfluences;
  overlay.morphTargetDictionary = mesh.morphTargetDictionary;
  overlay.raycast = () => undefined;
  overlay.userData[MESH_DISPLAY_OVERLAY_KEY] = true;
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  return overlay;
}

function wireframeMaterials(mesh: Mesh): WireframeMaterial[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.filter((material): material is WireframeMaterial => "wireframe" in material);
}

function overlayChildren(mesh: Mesh): Mesh[] {
  return mesh.children.filter((child): child is Mesh => isMeshDisplayOverlay(child) && child instanceof Mesh);
}

function disposeOverlay(overlay: Mesh): void {
  const materials = Array.isArray(overlay.material) ? overlay.material : [overlay.material];
  for (const material of materials) material.dispose();
}

function disposeMaterials(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) entry.dispose();
}

function restorePolygonEdgeMaterial(mesh: Mesh): void {
  const original = mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY] as Material | Material[] | undefined;
  if (original === undefined) return;
  disposeMaterials(mesh.material);
  mesh.material = original;
  delete mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY];
}

function replaceWithPolygonEdgeMaterial(mesh: Mesh, color: number): void {
  const original = mesh.material;
  mesh.userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY] = original;
  if (Array.isArray(original)) {
    mesh.material = original.map(() => createPolygonEdgeMaterial(color, 1));
  } else {
    mesh.material = createPolygonEdgeMaterial(color, 1);
  }
}

function updateOverlayMaterial(overlay: Mesh, opacity: number): void {
  const material = overlay.material as OverlayMaterial;
  material.opacity = opacity;
  material.transparent = opacity < 1;
  material.depthWrite = opacity >= 1;
}

/** root 配下の Mesh へ表示方法を適用する。wireframeColor は 0xrrggbb。 */
export function applyMeshDisplay(
  root: Object3D,
  mode: MeshDisplayMode,
  wireframeColor?: number,
  overlayOpacity = WIREFRAME_OVERLAY_OPACITY,
): void {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && !isViewerOverlay(object)) meshes.push(object);
  });

  for (const mesh of meshes) {
    restorePolygonEdgeMaterial(mesh);
    for (const material of wireframeMaterials(mesh)) {
      material.wireframe = mode === "wireframe";
      material.polygonOffset = mode === "solid-wireframe";
      material.polygonOffsetFactor = 1;
      material.polygonOffsetUnits = 1;
    }

    const overlays = overlayChildren(mesh);
    if (mode === "solid-wireframe" && !(mesh instanceof InstancedMesh)) {
      if (overlays.length === 0) {
        mesh.add(createWireframeOverlay(mesh, wireframeColor, overlayOpacity));
      } else if (overlays[0] !== undefined) {
        updateOverlayMaterial(overlays[0], overlayOpacity);
      }
      continue;
    }
    for (const overlay of overlays) {
      mesh.remove(overlay);
      disposeOverlay(overlay);
    }

    if (mode === "wireframe" && hasPolygonEdges(mesh.geometry) && !(mesh instanceof InstancedMesh)) {
      replaceWithPolygonEdgeMaterial(mesh, wireframeColor ?? WIREFRAME_OVERLAY_COLOR);
    }
  }
}
