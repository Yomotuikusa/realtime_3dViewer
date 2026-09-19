import { BufferGeometry, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from "three";
import { VIEWER_OVERLAY_KEY } from "../viewer/mesh-display";
import { buildDifferenceGeometry } from "./difference-geometry";
import {
  createDifferenceMaterials,
  setDifferenceColors,
  type CompareColors,
} from "./difference-material";

/** 差分 Mesh の見え方。 */
export interface CompareDifferenceOptions {
  /** 差分 Mesh の visible。未指定は true */
  visible?: boolean;
}

/** 差分 Mesh の userData キー。値は true */
export const MESH_COMPARE_DIFFERENCE_KEY = "meshCompareDifference";
/** 前回 geometry を作った入力を覚える userData キー。 */
export const MESH_COMPARE_DIFFERENCE_SOURCE_KEY = "meshCompareDifferenceSource";

/** userData[MESH_COMPARE_DIFFERENCE_KEY] === true なら差分 Mesh */
export function isMeshCompareDifference(object: Object3D): boolean {
  return object.userData[MESH_COMPARE_DIFFERENCE_KEY] === true;
}

/** 差分 Mesh を空の geometry と材質で作る。 */
export function createCompareDifference(mesh: Mesh): Mesh {
  const geometry = new BufferGeometry();
  const materials = createDifferenceMaterials();
  const difference = mesh instanceof SkinnedMesh
    ? new SkinnedMesh(geometry, materials)
    : new Mesh(geometry, materials);

  if (difference instanceof SkinnedMesh && mesh instanceof SkinnedMesh) {
    difference.bindMode = mesh.bindMode;
    difference.bind(mesh.skeleton, mesh.bindMatrix);
  }
  difference.morphTargetInfluences = mesh.morphTargetInfluences;
  difference.morphTargetDictionary = mesh.morphTargetDictionary;
  difference.raycast = () => undefined;
  difference.frustumCulled = false;
  difference.userData[MESH_COMPARE_DIFFERENCE_KEY] = true;
  difference.userData[VIEWER_OVERLAY_KEY] = true;
  return difference;
}

interface DifferenceSource {
  signedDistance: Float32Array;
  threshold: number;
}

function differenceChildren(mesh: Mesh): Mesh[] {
  return mesh.children.filter(
    (child): child is Mesh => child instanceof Mesh && isMeshCompareDifference(child),
  );
}

function differenceMaterials(mesh: Mesh): MeshStandardMaterial[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
}

/** 差分 Mesh を作成または再利用し、必要な geometry と表示状態を更新する。 */
export function applyCompareDifference(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
  options: CompareDifferenceOptions = {},
): Mesh {
  let difference = differenceChildren(mesh)[0];
  if (!difference) {
    difference = createCompareDifference(mesh);
    mesh.add(difference);
  }

  const previous = difference.userData[MESH_COMPARE_DIFFERENCE_SOURCE_KEY] as DifferenceSource | undefined;
  if (previous?.signedDistance !== signedDistance || previous.threshold !== threshold) {
    const geometry = buildDifferenceGeometry(mesh.geometry, signedDistance, threshold);
    difference.geometry.dispose();
    difference.geometry = geometry;
    difference.userData[MESH_COMPARE_DIFFERENCE_SOURCE_KEY] = { signedDistance, threshold } satisfies DifferenceSource;
  }

  setDifferenceColors(differenceMaterials(difference), colors);
  difference.visible = options.visible ?? true;
  return difference;
}

function disposeDifference(difference: Mesh): void {
  difference.geometry.dispose();
  const materials = Array.isArray(difference.material) ? difference.material : [difference.material];
  for (const material of materials) material.dispose();
}

/** root 配下の差分 Mesh を取り外して破棄する。 */
export function clearCompareDifferences(root: Object3D): void {
  const differences: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh && isMeshCompareDifference(object)) differences.push(object);
  });
  for (const difference of differences) {
    difference.parent?.remove(difference);
    disposeDifference(difference);
  }
}
