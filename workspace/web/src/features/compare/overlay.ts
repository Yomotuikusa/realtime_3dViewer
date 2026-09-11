import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SkinnedMesh,
} from "three";
import { VIEWER_OVERLAY_KEY } from "../viewer/mesh-display";

/** 比較重ね描き Mesh の userData キー。値は true */
export const MESH_COMPARE_OVERLAY_KEY = "meshCompareOverlay";
/** 飛び出し(正の距離)の色。赤 */
export const COMPARE_OUTSIDE_COLOR = 0xdc2626;
/** へこみ(負の距離)の色。青 */
export const COMPARE_INSIDE_COLOR = 0x2563eb;
/** 着色部分の不透明度 */
export const COMPARE_OVERLAY_OPACITY = 0.85;

/** userData[MESH_COMPARE_OVERLAY_KEY] === true なら比較重ね描き */
export function isMeshCompareOverlay(object: Object3D): boolean {
  return object.userData[MESH_COMPARE_OVERLAY_KEY] === true;
}

/** 比較重ね描き専用の属性だけを持つ geometry を作る。 */
export function createCompareOverlayGeometry(mesh: Mesh): BufferGeometry {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  for (const name of ["position", "skinIndex", "skinWeight"] as const) {
    const attribute = source.getAttribute(name);
    if (attribute) geometry.setAttribute(name, attribute);
  }
  const index = source.getIndex();
  if (index) geometry.setIndex(index);
  if (source.morphAttributes.position) geometry.morphAttributes.position = source.morphAttributes.position;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.setAttribute("color", new Float32BufferAttribute((source.getAttribute("position")?.count ?? 0) * 4, 4));
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  return geometry;
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

/** 符号付き距離に応じて color 属性を書き直す。 */
export function colorizeDeviation(
  geometry: BufferGeometry,
  signedDistance: Float32Array,
  threshold: number,
): void {
  const color = geometry.getAttribute("color");
  if (!color || color.itemSize !== 4) return;

  for (let vertex = 0; vertex < color.count; vertex += 1) color.setXYZW(vertex, 0, 0, 0, 0);
  const count = Math.min(color.count, signedDistance.length);
  for (let vertex = 0; vertex < count; vertex += 1) {
    const distance = signedDistance[vertex]!;
    if (!Number.isFinite(distance) || distance === 0) continue;
    if (distance >= threshold) {
      color.setXYZW(vertex, outsideColor.r, outsideColor.g, outsideColor.b, COMPARE_OVERLAY_OPACITY);
    } else if (distance <= -threshold) {
      color.setXYZW(vertex, insideColor.r, insideColor.g, insideColor.b, COMPARE_OVERLAY_OPACITY);
    }
  }
  color.needsUpdate = true;
}

/** 比較重ね描きを作成または再利用し、距離で色を塗る。 */
export function applyCompareOverlay(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
): Mesh {
  let overlay = mesh.children.find(
    (child): child is Mesh => child instanceof Mesh && isMeshCompareOverlay(child),
  );
  if (!overlay) {
    overlay = createCompareOverlay(mesh);
    mesh.add(overlay);
  }
  colorizeDeviation(overlay.geometry, signedDistance, threshold);
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
