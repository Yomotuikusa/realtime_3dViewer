import { Vector2, type Camera, type Object3D, type Raycaster } from "three";
import { isVisibleInScene, type Ndc } from "../viewer/pick";
import { isViewerOverlay } from "../viewer/mesh-display";
import type { OutlinerSelection } from "./selection";

/** object の祖先から登録済み scene と一致する版を探す。 */
export function versionOfObject(
  scenes: Readonly<Record<string, Object3D>>,
  object: Object3D,
): string | null {
  let current: Object3D | null = object;
  while (current !== null) {
    for (const [versionId, scene] of Object.entries(scenes)) {
      if (scene === current) return versionId;
    }
    current = current.parent;
  }
  return null;
}

/** ndc のレイで最も近い可視・非重ね描きの版全体を選択する。 */
export function pickSelection(
  raycaster: Raycaster,
  camera: Camera,
  ndc: Ndc,
  target: Object3D | null,
  scenes: Readonly<Record<string, Object3D>>,
): OutlinerSelection | null {
  if (target === null) return null;

  raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
  const intersection = raycaster.intersectObject(target, true)
    .find((hit) => isVisibleInScene(hit.object) && !isViewerOverlay(hit.object));
  if (!intersection) return null;

  const versionId = versionOfObject(scenes, intersection.object);
  if (versionId === null) return null;
  const scene = scenes[versionId];
  return scene === undefined ? null : { versionId, objectId: scene.uuid };
}
