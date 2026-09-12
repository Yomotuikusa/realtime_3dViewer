import { Bone, Camera, Group, Light, Line, Mesh, Object3D, Points } from "three";
import { isViewerOverlay } from "../viewer/mesh-display";

export type OutlinerNodeKind = "mesh" | "curve" | "points" | "bone" | "light" | "camera" | "group";

export interface OutlinerNode {
  /** object.uuid */
  id: string;
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

function buildNode(object: Object3D): OutlinerNode {
  return {
    id: object.uuid,
    name: object.name,
    kind: classifyObject(object),
    children: object.children.filter((child) => !isViewerOverlay(child)).map(buildNode),
  };
}

/** root 自身を含む、three の参照を持たないプレーンな木を作る。 */
export function buildOutlinerTree(root: Object3D): OutlinerNode {
  return buildNode(root);
}

/** 展開状態の id を追加または除去する(入力配列は変更しない)。 */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];
}
