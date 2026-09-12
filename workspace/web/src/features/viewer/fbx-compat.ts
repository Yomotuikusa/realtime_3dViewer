import { Bone, Group } from "three";

interface SkinBindable {
  bind?: (...args: unknown[]) => void;
}

/** bind を持たないノードへ skinning が要求されたときに何もしない差し替え */
function ignoreSkinBinding(): void {}

/**
 * three の FBXLoader は attrType が未対応(NurbsSurface / Line など)の Model を Group に、
 * LimbNode / Root を Bone にする。そこへスキンクラスタが繋がっていると bindSkeleton が
 * `model.bind(...)` を呼び、TypeError でファイル全体の読み込みが失敗する。
 * Group / Bone に no-op の bind を生やし、そのノードのスキン適用だけを読み飛ばす。
 * SkinnedMesh は自前の bind を持つため影響を受けない。
 */
export function installFbxSkinCompat(): void {
  for (const prototype of [Group.prototype, Bone.prototype] as unknown as SkinBindable[]) {
    if (typeof prototype.bind !== "function") {
      prototype.bind = ignoreSkinBinding;
    }
  }
}
