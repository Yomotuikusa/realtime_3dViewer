import {
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SkinnedMesh,
} from "three";
import type { Object3D } from "three";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";
import { VIEWER_OVERLAY_KEY, isViewerOverlay } from "../viewer/mesh-display";

/** 選択重ね描きの userData キー。値は true */
export const SELECTION_OVERLAY_KEY = "outlinerSelectionOverlay";
/** 選択重ね描きの既定色。UI の accent(青)や比較の重ね描きと区別できるオレンジ */
export const SELECTION_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.selection);
/** Mesh 重ね描きの不透明度 */
export const SELECTION_MESH_OPACITY = 0.6;

/** userData[SELECTION_OVERLAY_KEY] === true なら選択重ね描き */
export function isSelectionOverlay(object: Object3D): boolean {
  return object.userData[SELECTION_OVERLAY_KEY] === true;
}

function configureOverlay<T extends Object3D>(overlay: T): T {
  overlay.raycast = () => undefined;
  overlay.renderOrder = 1;
  overlay.userData[SELECTION_OVERLAY_KEY] = true;
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  return overlay;
}

function createMeshOverlay(mesh: Mesh, color: number, opacity = SELECTION_MESH_OPACITY): Mesh {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
  });
  const overlay = mesh instanceof SkinnedMesh
    ? new SkinnedMesh(mesh.geometry, material)
    : new Mesh(mesh.geometry, material);

  if (overlay instanceof SkinnedMesh && mesh instanceof SkinnedMesh) {
    overlay.bindMode = mesh.bindMode;
    overlay.bind(mesh.skeleton, mesh.bindMatrix);
  }
  overlay.morphTargetInfluences = mesh.morphTargetInfluences;
  overlay.morphTargetDictionary = mesh.morphTargetDictionary;
  return configureOverlay(overlay);
}

function createLineOverlay(line: Line, color: number): Line {
  const material = new LineBasicMaterial({
    color,
    depthTest: false,
    toneMapped: false,
  });
  if (line instanceof LineLoop) return configureOverlay(new LineLoop(line.geometry, material));
  if (line instanceof LineSegments) return configureOverlay(new LineSegments(line.geometry, material));
  return configureOverlay(new Line(line.geometry, material));
}

function createPointsOverlay(points: Points, color: number): Points {
  const sourceMaterial = points.material instanceof PointsMaterial ? points.material : null;
  return configureOverlay(new Points(points.geometry, new PointsMaterial({
    color,
    size: sourceMaterial?.size ?? 1,
    sizeAttenuation: sourceMaterial?.sizeAttenuation ?? true,
    depthTest: false,
    toneMapped: false,
  })));
}

/** object と同じ geometry を共有する選択重ね描きを作る。color は 0xrrggbb */
export function createSelectionOverlay(object: Object3D, color: number, opacity?: number): Object3D | null {
  if (object instanceof Mesh && !(object instanceof InstancedMesh)) return createMeshOverlay(object, color, opacity);
  if (object instanceof Line) return createLineOverlay(object, color);
  if (object instanceof Points) return createPointsOverlay(object, color);
  return null;
}

/** target 配下の描画対象へ選択重ね描きを追加する。color は 0xrrggbb */
export function applySelectionHighlight(target: Object3D, color: number, opacity?: number): void {
  const objects: Object3D[] = [];
  target.traverse((object) => {
    if (!isViewerOverlay(object)) objects.push(object);
  });

  for (const object of objects) {
    if (object.children.some(isSelectionOverlay)) continue;
    const overlay = createSelectionOverlay(object, color, opacity);
    if (overlay !== null) object.add(overlay);
  }
}

function disposeOverlayMaterial(object: Object3D): void {
  if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) material.dispose();
}

/** root 配下の選択重ね描きを取り外して材質を破棄する。 */
export function clearSelectionHighlight(root: Object3D): void {
  const overlays: Object3D[] = [];
  root.traverse((object) => {
    if (isSelectionOverlay(object)) overlays.push(object);
  });
  for (const overlay of overlays) {
    overlay.parent?.remove(overlay);
    disposeOverlayMaterial(overlay);
  }
}
