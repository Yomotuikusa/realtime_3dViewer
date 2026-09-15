import {
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SkinnedMesh,
} from "three";
import { VIEWER_OVERLAY_KEY } from "../viewer/mesh-display";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";
import { compareSourceIndex, createCompareOverlayGeometry } from "./overlay-geometry";

export {
  COMPARE_SOURCE_INDEX_KEY,
  compareSourceIndex,
  createCompareOverlayGeometry,
  expandByIndex,
} from "./overlay-geometry";

/** 比較重ね描き Mesh の userData キー。値は true */
export const MESH_COMPARE_OVERLAY_KEY = "meshCompareOverlay";
/** 飛び出し(正の距離)の色。赤 */
export const COMPARE_OUTSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareOutside);
/** へこみ(負の距離)の色。青 */
export const COMPARE_INSIDE_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.compareInside);

/** 比較の色。値は 0xrrggbb */
export interface CompareColors {
  /** 飛び出し(正の距離) */
  outside: number;
  /** へこみ(負の距離) */
  inside: number;
}
/** 着色部分の不透明度 */
export const COMPARE_OVERLAY_OPACITY = 0.85;

/** userData[MESH_COMPARE_OVERLAY_KEY] === true なら比較重ね描き */
export function isMeshCompareOverlay(object: Object3D): boolean {
  return object.userData[MESH_COMPARE_OVERLAY_KEY] === true;
}

/** 頂点色で着色する、共有しない材質を作る。 */
export function createCompareOverlayMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
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

const outsideColor = new Color(COMPARE_OUTSIDE_COLOR);
const insideColor = new Color(COMPARE_INSIDE_COLOR);

/** 符号付き距離に応じて color 属性を三角形単位で書き直す。 */
export function colorizeDeviation(
  geometry: BufferGeometry,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
): void {
  const color = geometry.getAttribute("color");
  if (!color || color.itemSize !== 4) return;

  outsideColor.setHex(colors.outside);
  insideColor.setHex(colors.inside);
  for (let vertex = 0; vertex < color.count; vertex += 1) color.setXYZW(vertex, 0, 0, 0, 0);
  const sourceIndex = compareSourceIndex(geometry);
  const faceCount = Math.floor(color.count / 3);
  for (let face = 0; face < faceCount; face += 1) {
    let best = 0;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = face * 3 + corner;
      const sourceVertex = sourceIndex ? sourceIndex[vertex]! : vertex;
      if (sourceVertex >= signedDistance.length) continue;
      const distance = signedDistance[sourceVertex]!;
      if (Number.isFinite(distance) && Math.abs(distance) > Math.abs(best)) best = distance;
    }
    if (best === 0) continue;
    const paint = best >= threshold ? outsideColor : best <= -threshold ? insideColor : null;
    if (!paint) continue;
    for (let corner = 0; corner < 3; corner += 1) {
      color.setXYZW(face * 3 + corner, paint.r, paint.g, paint.b, COMPARE_OVERLAY_OPACITY);
    }
  }
  color.needsUpdate = true;
}

/** 比較重ね描きを作成または再利用し、距離で色を塗る。 */
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
  colorizeDeviation(overlay.geometry, signedDistance, threshold, colors);
  return overlay;
}

function disposeCompareOverlay(overlay: Mesh): void {
  const materials = Array.isArray(overlay.material) ? overlay.material : [overlay.material];
  for (const material of materials) material.dispose();

  const geometry = overlay.geometry;
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "color") geometry.deleteAttribute(name);
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
