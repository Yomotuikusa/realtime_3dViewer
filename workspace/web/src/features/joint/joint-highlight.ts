import { Bone, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from "three";
import { VIEWER_COLOR_DEFAULTS, hexToNumber } from "../theme/viewer-colors";
import { VIEWER_OVERLAY_KEY } from "../viewer/mesh-display";
import { jointRadius } from "./joint-display";

/** 選択ジョイントのマーカーの userData キー。値は true */
export const SELECTED_JOINT_MARKER_KEY = "selectedJointMarker";
export const SELECTED_JOINT_COLOR = hexToNumber(VIEWER_COLOR_DEFAULTS.light.jointSelected);
/** マーカーの半径 = jointRadius(root) * この倍率 */
export const SELECTED_JOINT_RADIUS_SCALE = 1.8;
/** ジョイントの x-ray(999)より手前へ描く */
export const SELECTED_JOINT_RENDER_ORDER = 1000;

export interface SelectedJointMarker extends Mesh {
  userData: Mesh["userData"] & {
    selectedJointMarker: true;
    viewerOverlay: true;
    bone: Bone;
  };
}

const localPosition = new Vector3();

function isSelectedJointMarker(object: Object3D): object is SelectedJointMarker {
  return object.userData[SELECTED_JOINT_MARKER_KEY] === true && object instanceof Mesh;
}

/** root 直下のマーカー。無ければ null */
export function selectedJointMarkerOf(root: Object3D): SelectedJointMarker | null {
  return root.children.find(isSelectedJointMarker) ?? null;
}

/** root 直下へマーカーを追加して返す。color は 0xrrggbb */
export function addSelectedJointMarker(
  root: Object3D,
  bone: Bone,
  color: number,
  radiusScale = 1,
): SelectedJointMarker {
  const existing = selectedJointMarkerOf(root);
  if (existing !== null) {
    existing.userData.bone = bone;
    (existing.material as MeshBasicMaterial).color.setHex(color);
    return existing;
  }

  const material = new MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const marker = new Mesh(
    new SphereGeometry(jointRadius(root, radiusScale) * SELECTED_JOINT_RADIUS_SCALE, 12, 8),
    material,
  ) as unknown as SelectedJointMarker;
  marker.userData[SELECTED_JOINT_MARKER_KEY] = true;
  marker.userData[VIEWER_OVERLAY_KEY] = true;
  marker.userData.bone = bone;
  marker.renderOrder = SELECTED_JOINT_RENDER_ORDER;
  marker.raycast = () => undefined;
  marker.frustumCulled = false;
  root.add(marker);
  return marker;
}

/** userData.bone の現在のワールド位置を root ローカルへ反映する。 */
export function updateSelectedJointMarker(marker: SelectedJointMarker, root: Object3D): void {
  localPosition.setFromMatrixPosition(marker.userData.bone.matrixWorld);
  root.worldToLocal(localPosition);
  marker.position.copy(localPosition);
}

/** root からマーカーを外し、所有する geometry と material を破棄する。 */
export function removeSelectedJointMarker(root: Object3D): void {
  const marker = selectedJointMarkerOf(root);
  if (marker === null) return;
  root.remove(marker);
  marker.geometry.dispose();
  (marker.material as MeshBasicMaterial).dispose();
}
