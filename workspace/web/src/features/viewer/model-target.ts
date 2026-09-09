import type { Object3D } from "three";

let modelTarget: Object3D | null = null;

export function setModelTarget(obj: Object3D | null): void {
  modelTarget = obj;
}

export function getModelTarget(): Object3D | null {
  return modelTarget;
}
