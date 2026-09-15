import { Mesh, Object3D, SkinnedMesh, type Material } from "three";
import { VIEWER_OVERLAY_KEY } from "../viewer/mesh-display";
import {
  COMPARE_DISTANCE_ATTRIBUTE,
  createCompareOverlayGeometry,
  writeCompareDistance,
} from "./overlay-geometry";
import {
  createCompareOverlayMaterial,
  setCompareOverlayUniforms,
} from "./overlay-material";
import type { CompareColors } from "./overlay-material";

export {
  COMPARE_DISTANCE_ATTRIBUTE,
  createCompareOverlayGeometry,
  writeCompareDistance,
} from "./overlay-geometry";
export {
  COMPARE_INSIDE_COLOR,
  COMPARE_OUTSIDE_COLOR,
  COMPARE_OVERLAY_OPACITY,
  COMPARE_OVERLAY_UNIFORMS_KEY,
  COMPARE_PROGRAM_CACHE_KEY,
  compareOverlayUniforms,
  createCompareOverlayMaterial,
  setCompareOverlayUniforms,
} from "./overlay-material";
export type { CompareColors, CompareOverlayUniforms } from "./overlay-material";

/** 比較重ね描き Mesh の userData キー。値は true */
export const MESH_COMPARE_OVERLAY_KEY = "meshCompareOverlay";

/** userData[MESH_COMPARE_OVERLAY_KEY] === true なら比較重ね描き */
export function isMeshCompareOverlay(object: Object3D): boolean {
  return object.userData[MESH_COMPARE_OVERLAY_KEY] === true;
}

/** mesh と同じ変形状態を使う比較重ね描き Mesh を作る。 */
export function createCompareOverlay(mesh: Mesh): Mesh {
  const geometry = createCompareOverlayGeometry(mesh);
  const material = createCompareOverlayMaterial();
  const overlay = mesh instanceof SkinnedMesh
    ? new SkinnedMesh(geometry, material)
    : new Mesh(geometry, material);

  if (overlay instanceof SkinnedMesh && mesh instanceof SkinnedMesh) {
    overlay.bindMode = mesh.bindMode;
    overlay.bind(mesh.skeleton, mesh.bindMatrix);
  }
  overlay.morphTargetInfluences = mesh.morphTargetInfluences;
  overlay.morphTargetDictionary = mesh.morphTargetDictionary;
  overlay.raycast = () => undefined;
  overlay.renderOrder = -1;
  overlay.userData[MESH_COMPARE_OVERLAY_KEY] = true;
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  return overlay;
}

/** 比較重ね描きを作成または再利用し、距離と uniform を更新する。 */
export function applyCompareOverlay(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
): Mesh {
  let overlay = mesh.children.find(
    (child): child is Mesh => child instanceof Mesh && isMeshCompareOverlay(child),
  );
  if (!overlay) {
    overlay = createCompareOverlay(mesh);
    mesh.add(overlay);
  }
  writeCompareDistance(overlay.geometry, signedDistance);
  setCompareOverlayUniforms(overlay.material as Material, threshold, colors);
  return overlay;
}

function disposeCompareOverlay(overlay: Mesh): void {
  const materials = Array.isArray(overlay.material) ? overlay.material : [overlay.material];
  for (const material of materials) material.dispose();

  const geometry = overlay.geometry;
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== COMPARE_DISTANCE_ATTRIBUTE) geometry.deleteAttribute(name);
  }
  geometry.setIndex(null);
  geometry.morphAttributes = {};
  geometry.dispose();
}

/** root 配下の比較重ね描きを取り外して破棄する。 */
export function clearCompareOverlays(root: Object3D): void {
  const overlays: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && isMeshCompareOverlay(object)) overlays.push(object);
  });
  for (const overlay of overlays) {
    overlay.parent?.remove(overlay);
    disposeCompareOverlay(overlay);
  }
}
