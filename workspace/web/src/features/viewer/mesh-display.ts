import { InstancedMesh, Material, Mesh, MeshBasicMaterial, Object3D, SkinnedMesh } from "three";
import type { MeshDisplayMode } from "@shared/types";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";

/** 重ね描き用オブジェクトの userData キー。値は true */
export const MESH_DISPLAY_OVERLAY_KEY = "meshDisplayOverlay";
/** ビューアが後付けする重ね描き Mesh 共通の userData キー。値は true */
export const VIEWER_OVERLAY_KEY = "viewerOverlay";
/** 重ね描きの線の色(濃いグレー) */
export const WIREFRAME_OVERLAY_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.wireframe);
/** 重ね描きの線の不透明度 */
export const WIREFRAME_OVERLAY_OPACITY = 0.6;

type WireframeMaterial = Material & {
  wireframe: boolean;
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
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
export function createWireframeOverlayMaterial(color?: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: color ?? WIREFRAME_OVERLAY_COLOR,
    wireframe: true,
    transparent: true,
    opacity: WIREFRAME_OVERLAY_OPACITY,
    depthWrite: false,
    toneMapped: false,
  });
}

/** mesh と同じ geometry を使う重ね描き用 Mesh を作る。color は 0xrrggbb。 */
export function createWireframeOverlay(mesh: Mesh, color?: number): Mesh {
  const material = createWireframeOverlayMaterial(color);
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

/** root 配下の Mesh へ表示方法を適用する。wireframeColor は 0xrrggbb。 */
export function applyMeshDisplay(root: Object3D, mode: MeshDisplayMode, wireframeColor?: number): void {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && !isViewerOverlay(object)) meshes.push(object);
  });

  for (const mesh of meshes) {
    for (const material of wireframeMaterials(mesh)) {
      material.wireframe = mode === "wireframe";
      material.polygonOffset = mode === "solid-wireframe";
      material.polygonOffsetFactor = 1;
      material.polygonOffsetUnits = 1;
    }

    const overlays = overlayChildren(mesh);
    if (mode === "solid-wireframe" && !(mesh instanceof InstancedMesh)) {
      if (overlays.length === 0) mesh.add(createWireframeOverlay(mesh, wireframeColor));
      continue;
    }
    for (const overlay of overlays) {
      mesh.remove(overlay);
      disposeOverlay(overlay);
    }
  }
}
