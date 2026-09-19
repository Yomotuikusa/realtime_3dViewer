import type { Mesh } from "three";

/**
 * meshes の layer 0 を外す(hidden = true)/戻す(false)。
 * 描画とレイキャストの両方から外れる。他の layer ビットと子オブジェクト(比較重ね描き)は触らない。
 * 何度呼んでも同じ結果になる(冪等)。
 */
export function setCompareSurfacesHidden(meshes: readonly Mesh[], hidden: boolean): void {
  for (const mesh of meshes) {
    if (hidden) mesh.layers.disable(0);
    else mesh.layers.enable(0);
  }
}
