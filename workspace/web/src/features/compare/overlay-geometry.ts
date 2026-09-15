import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";

/** 頂点ごとの符号付き距離(ワールド単位)を持つ float 属性の名前。itemSize 1 */
export const COMPARE_DISTANCE_ATTRIBUTE = "compareDistance";

/** 比較重ね描き専用の geometry を作る。元 geometry の変形属性は共有する。 */
export function createCompareOverlayGeometry(mesh: Mesh): BufferGeometry {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  const position = source.getAttribute("position");

  for (const name of ["position", "skinIndex", "skinWeight"] as const) {
    const attribute = source.getAttribute(name);
    if (attribute) geometry.setAttribute(name, attribute);
  }
  const index = source.getIndex();
  if (index) geometry.setIndex(index);
  if (source.morphAttributes.position) geometry.morphAttributes.position = source.morphAttributes.position;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  geometry.setAttribute(
    COMPARE_DISTANCE_ATTRIBUTE,
    new Float32BufferAttribute(position?.count ?? 0, 1),
  );
  return geometry;
}

/** signedDistance を比較重ね描き用の頂点属性へ書く。 */
export function writeCompareDistance(
  geometry: BufferGeometry,
  signedDistance: ArrayLike<number>,
): void {
  const distance = geometry.getAttribute(COMPARE_DISTANCE_ATTRIBUTE);
  if (!distance) return;

  const count = Math.min(distance.count, signedDistance.length);
  for (let vertex = 0; vertex < distance.count; vertex += 1) {
    const value = vertex < count ? signedDistance[vertex]! : 0;
    distance.setX(vertex, Number.isFinite(value) ? value : 0);
  }
  distance.needsUpdate = true;
}
