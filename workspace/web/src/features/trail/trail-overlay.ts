import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  PointsMaterial,
  SphereGeometry,
} from "three";
import { VIEWER_OVERLAY_KEY } from "../viewer/mesh-display";
import type { TrailSample } from "./trail-sample";

/** 軌跡グループの userData キー。値は true */
export const TRAIL_OVERLAY_KEY = "motionTrailOverlay";
/** 軌跡の折れ線の色 */
export const TRAIL_LINE_COLOR = 0xfacc15;
/** 各フレームの点の色 */
export const TRAIL_POINT_COLOR = 0xfef3c7;
/** 現在フレームのマーカーの色 */
export const TRAIL_CURRENT_COLOR = 0xf97316;
/** フレーム点の大きさ = markerRadius * この倍率 */
export const TRAIL_POINT_SIZE_SCALE = 1.6;
/** 現在フレームのマーカーの半径 = markerRadius * この倍率 */
export const TRAIL_CURRENT_RADIUS_SCALE = 1.2;
/** 軌跡の renderOrder。メッシュに隠されず手前へ描く */
export const TRAIL_RENDER_ORDER = 998;

/** 軌跡グループ。折れ線・フレーム点・現在位置マーカーを固定順で持つ。 */
export interface TrailOverlay extends Group {
  userData: Group["userData"] & {
    motionTrailOverlay: true;
    viewerOverlay: true;
    /** サンプルのフレーム数。1 以上 */
    frameCount: number;
    /** サンプルの root ローカル座標。長さは frameCount * 3 */
    positions: Float32Array;
  };
}

function markOverlay(object: Object3D): void {
  object.userData[VIEWER_OVERLAY_KEY] = true;
  object.raycast = () => undefined;
  object.renderOrder = TRAIL_RENDER_ORDER;
}

function trailGeometry(positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function disposeTrailObject(object: Object3D): void {
  const mesh = object as Mesh;
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) material.dispose();
}

/** root 直下の軌跡。無ければ null */
export function trailOverlayOf(root: Object3D): TrailOverlay | null {
  const overlay = root.children.find((child) => child.userData[TRAIL_OVERLAY_KEY] === true);
  return (overlay as TrailOverlay | undefined) ?? null;
}

/** sample の座標から軌跡を作って root 直下へ追加する。 */
export function addTrailOverlay(
  root: Object3D,
  sample: TrailSample,
  markerRadius: number,
): TrailOverlay {
  removeTrailOverlay(root);

  const line = new Line(
    trailGeometry(sample.positions),
    new LineBasicMaterial({
      color: TRAIL_LINE_COLOR,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const points = new Points(
    trailGeometry(sample.positions),
    new PointsMaterial({
      color: TRAIL_POINT_COLOR,
      size: markerRadius * TRAIL_POINT_SIZE_SCALE,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const marker = new Mesh(
    new SphereGeometry(markerRadius * TRAIL_CURRENT_RADIUS_SCALE, 12, 8),
    new MeshBasicMaterial({
      color: TRAIL_CURRENT_COLOR,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const overlay = new Group() as TrailOverlay;
  overlay.userData[TRAIL_OVERLAY_KEY] = true;
  overlay.userData[VIEWER_OVERLAY_KEY] = true;
  overlay.userData.frameCount = sample.frameCount;
  overlay.userData.positions = sample.positions;
  markOverlay(overlay);
  markOverlay(line);
  markOverlay(points);
  markOverlay(marker);
  line.frustumCulled = false;
  points.frustumCulled = false;
  marker.frustumCulled = false;
  overlay.add(line, points, marker);
  root.add(overlay);
  setTrailCurrentFrame(overlay, 0);
  return overlay;
}

/** 現在フレームのマーカーを frame 番目のサンプル位置へ移す。 */
export function setTrailCurrentFrame(overlay: TrailOverlay, frame: number): void {
  const frameCount = overlay.userData.frameCount;
  const lastFrame = Math.max(0, frameCount - 1);
  const roundedFrame = Number.isNaN(frame) ? 0 : Math.round(frame);
  const currentFrame = Math.min(lastFrame, Math.max(0, roundedFrame));
  const offset = currentFrame * 3;
  const positions = overlay.userData.positions;
  const marker = overlay.children[2] as Mesh;
  marker.position.set(positions[offset] ?? 0, positions[offset + 1] ?? 0, positions[offset + 2] ?? 0);
}

/** root から軌跡を外し、所有する geometry と material を破棄する。 */
export function removeTrailOverlay(root: Object3D): void {
  const overlay = trailOverlayOf(root);
  if (overlay === null) return;
  root.remove(overlay);
  for (const child of overlay.children) disposeTrailObject(child);
}
