import type { ObjectPartRef, ObjectPath } from "./types";

/** ObjectPath を子インデックスの配列にする。"0/2/1" → [0, 2, 1] */
export function objectPathIndices(path: ObjectPath): number[] {
  return path.split("/").map(Number);
}

/** 子インデックスの配列を ObjectPath にする。[0, 2, 1] → "0/2/1"。 */
export function joinObjectPath(indices: readonly number[]): ObjectPath {
  if (indices.length === 0) throw new Error("ObjectPath must not be empty");
  return indices.join("/");
}

/** Map / Set のキーに使う一意文字列。`${versionId}:${objectPath}` */
export function objectPartKey(part: ObjectPartRef): string {
  return `${part.versionId}:${part.objectPath}`;
}

/** versionId と objectPath がともに === で等しい */
export function isSameObjectPart(a: ObjectPartRef, b: ObjectPartRef): boolean {
  return a.versionId === b.versionId && a.objectPath === b.objectPath;
}
