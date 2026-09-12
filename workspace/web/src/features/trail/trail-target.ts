import type { Object3D } from "three";
import type { ObjectPartRef } from "@shared/types";
import { childPath, objectAtPath, plainChildren } from "../outliner/outliner-tree";

export interface ResolvedTrailTarget {
  versionId: string;
  /** scenes に登録されている版の scene ルート */
  root: Object3D;
  /** target.objectPath が指すオブジェクト */
  object: Object3D;
}

/**
 * object から親をたどって scenes に登録された root を探し、
 * root からの子インデックス(重ね描きを数えない)を繋いだ ObjectPartRef を返す。
 */
export function objectPartRefOf(
  scenes: Readonly<Record<string, Object3D>>,
  object: Object3D,
): ObjectPartRef | null {
  const indices: number[] = [];
  let current: Object3D | null = object;

  while (current !== null) {
    for (const [versionId, root] of Object.entries(scenes)) {
      if (current !== root) continue;
      if (indices.length === 0) return null;
      const path = indices.reverse().reduce((parentPath, index) => childPath(parentPath, index), "");
      return { versionId, objectPath: path };
    }

    const parent: Object3D | null = current.parent;
    if (parent === null) return null;
    const index = plainChildren(parent).indexOf(current);
    if (index < 0) return null;
    indices.push(index);
    current = parent;
  }

  return null;
}

/** target が null、版が未登録、path が解決できないときは null */
export function resolveTrailTarget(
  scenes: Readonly<Record<string, Object3D>>,
  target: ObjectPartRef | null,
): ResolvedTrailTarget | null {
  if (target === null || !Object.hasOwn(scenes, target.versionId)) return null;
  const root = scenes[target.versionId];
  if (root === undefined) return null;
  const object = objectAtPath(root, target.objectPath);
  return object === null ? null : { versionId: target.versionId, root, object };
}
