import { Bone, Camera, Group, Light, Line, Mesh, Object3D, Points } from "three";
import { joinObjectPath, objectPathIndices } from "@shared/object-part";
import { isViewerOverlay } from "../viewer/mesh-display";

export type OutlinerNodeKind = "mesh" | "curve" | "points" | "bone" | "light" | "camera" | "group";

export interface OutlinerNode {
  /** object.uuid(ローカル専用。ルーム共有には使わない) */
  id: string;
  /** 版の scene ルートからの子インデックスのパス(ObjectPath)。ルートは ""。ルーム共有の鍵 */
  path: string;
  /** object.name そのまま(空文字あり)。 */
  name: string;
  kind: OutlinerNodeKind;
  children: OutlinerNode[];
}

/** three の継承関係を利用し、契約で定めた順に種別を判定する。 */
export function classifyObject(object: Object3D): OutlinerNodeKind {
  if (object instanceof Mesh) return "mesh";
  if (object instanceof Line) return "curve";
  if (object instanceof Points) return "points";
  if (object instanceof Bone) return "bone";
  if (object instanceof Light) return "light";
  if (object instanceof Camera) return "camera";
  if (object instanceof Group) return "group";
  return "group";
}

/** 重ね描きを除いた子の配列。配列の順序は scene の子順を保つ。 */
export function plainChildren(object: Object3D): Object3D[] {
  return object.children.filter((child) => !isViewerOverlay(child));
}

/** 親のパスと子インデックスから子のパスを作る。 */
export function childPath(parentPath: string, index: number): string {
  return joinObjectPath(parentPath === "" ? [index] : [...objectPathIndices(parentPath), index]);
}

function buildNode(object: Object3D, path: string): OutlinerNode {
  return {
    id: object.uuid,
    path,
    name: object.name,
    kind: classifyObject(object),
    children: plainChildren(object).map((child, index) => buildNode(child, childPath(path, index))),
  };
}

/** root 自身を含む、three の参照を持たないプレーンな木を作る。 */
export function buildOutlinerTree(root: Object3D): OutlinerNode {
  return buildNode(root, "");
}

/** path が指す重ね描きでないオブジェクト。空文字は root 自身を返す。 */
export function objectAtPath(root: Object3D, path: string): Object3D | null {
  if (path === "") return root;
  if (!/^\d+(\/\d+)*$/.test(path)) return null;

  let object = root;
  for (const index of objectPathIndices(path)) {
    const child = plainChildren(object)[index];
    if (child === undefined) return null;
    object = child;
  }
  return object;
}

/** 展開状態の id を追加または除去する(入力配列は変更しない)。 */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];
}
