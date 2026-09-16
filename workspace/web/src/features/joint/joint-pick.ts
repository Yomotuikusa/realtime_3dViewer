import { Vector3, type Bone, type Camera, type Object3D } from "three";
import { isVisibleInScene, type Ndc } from "../viewer/pick";
import type { OutlinerSelection } from "../outliner/selection";
import { jointOverlayOf } from "./joint-display";

/** クリック点からこのピクセル数以内のジョイントだけを拾う */
export const JOINT_PICK_RADIUS_PX = 12;

export interface JointHit {
  versionId: string;
  bone: Bone;
}

const worldPosition = new Vector3();

/** 各 scene のジョイントを投影し、クリックに最も近いものを返す。 */
export function pickJoint(
  camera: Camera,
  ndc: Ndc,
  viewport: { width: number; height: number },
  scenes: Readonly<Record<string, Object3D>>,
  radiusPx = JOINT_PICK_RADIUS_PX,
): JointHit | null {
  let closest: JointHit | null = null;
  let closestDistance = radiusPx;

  for (const [versionId, scene] of Object.entries(scenes)) {
    const overlay = jointOverlayOf(scene);
    if (overlay === null || !isVisibleInScene(overlay)) continue;

    for (const bone of overlay.userData.joints) {
      worldPosition.setFromMatrixPosition(bone.matrixWorld).project(camera);
      if (worldPosition.z < -1 || worldPosition.z > 1) continue;

      const pixelX = (worldPosition.x - ndc.x) * viewport.width / 2;
      const pixelY = (worldPosition.y - ndc.y) * viewport.height / 2;
      const distance = Math.hypot(pixelX, pixelY);
      if (distance <= closestDistance && (distance < closestDistance || closest === null)) {
        closest = { versionId, bone };
        closestDistance = distance;
      }
    }
  }

  return closest;
}

/** ピック結果を選択ストアの選択へ変換する。 */
export function jointSelectionOf(hit: JointHit | null): OutlinerSelection | null {
  return hit === null ? null : { versionId: hit.versionId, objectId: hit.bone.uuid };
}
