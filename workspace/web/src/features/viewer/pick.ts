import { Matrix3, Vector2, type Camera, type Object3D, type Raycaster, Vector3 } from "three";
import type { Vec3 } from "@shared/types";

export interface Ndc {
  x: number;
  y: number;
}

export interface PickHit {
  point: Vec3;
  normal: Vec3 | null;
}

/** object 自身から scene root まで、すべて visible な交点だけを採用する。 */
export function isVisibleInScene(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

export function toNdc(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): Ndc {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: 1 - ((clientY - rect.top) / rect.height) * 2,
  };
}

export function pickModel(
  raycaster: Raycaster,
  camera: Camera,
  ndc: Ndc,
  target: Object3D | null,
): PickHit | null {
  if (target === null) {
    return null;
  }

  raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
  const intersection = raycaster.intersectObject(target, true).find((hit) => isVisibleInScene(hit.object));
  if (!intersection) {
    return null;
  }

  const point: Vec3 = [intersection.point.x, intersection.point.y, intersection.point.z];
  if (!intersection.face) {
    return { point, normal: null };
  }

  const normalVector = intersection.face.normal
    .clone()
    .applyMatrix3(new Matrix3().getNormalMatrix(intersection.object.matrixWorld))
    .normalize();
  return { point, normal: [normalVector.x, normalVector.y, normalVector.z] };
}
