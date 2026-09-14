import { isFbxBinary, readFbxBinaryPolygons } from "./fbx-binary";
import { readFbxAsciiPolygons } from "./fbx-ascii";

export interface FbxPolygonInfo {
  /** Geometry ノード id → 多角形ごとの頂点数(file 順) */
  geometries: Map<number, number[]>;
  /** Model ノード id → 接続された Geometry ノード id(接続の並び順で後勝ち) */
  modelToGeometry: Map<number, number>;
}

/** PolygonVertexIndex の終端値から、完結した面の頂点数だけを取り出す。 */
export function polygonSizesFromVertexIndex(indices: ArrayLike<number>): number[] {
  const sizes: number[] = [];
  let size = 0;
  for (let index = 0; index < indices.length; index += 1) {
    size += 1;
    if (indices[index]! < 0) {
      sizes.push(size);
      size = 0;
    }
  }
  return sizes;
}

/** FBX の形式を判定し、必要な PolygonVertexIndex 情報を読み取る。 */
export function readFbxPolygons(data: ArrayBuffer | string): FbxPolygonInfo {
  if (typeof data === "string") return readFbxAsciiPolygons(data);
  if (isFbxBinary(data)) return readFbxBinaryPolygons(data);
  return readFbxAsciiPolygons(new TextDecoder().decode(new Uint8Array(data)));
}
