import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  InterleavedBufferAttribute,
  Mesh,
} from "three";

/** 展開元 index の配列を持つ geometry.userData のキー。元 geometry に index が無ければ未設定 */
export const COMPARE_SOURCE_INDEX_KEY = "meshCompareSourceIndex";

/** attribute を index の順に並べ直した新しい属性を返す。 */
export function expandByIndex(
  attribute: BufferAttribute | InterleavedBufferAttribute,
  index: BufferAttribute,
): Float32BufferAttribute {
  const values = new Float32Array(index.count * attribute.itemSize);
  for (let vertex = 0; vertex < index.count; vertex += 1) {
    const sourceVertex = index.getComponent(vertex, 0);
    for (let component = 0; component < attribute.itemSize; component += 1) {
      values[vertex * attribute.itemSize + component] = attribute.getComponent(sourceVertex, component);
    }
  }
  return new Float32BufferAttribute(values, attribute.itemSize);
}

/** 重ね描きの頂点番号から元 geometry の頂点番号を取得する。 */
export function compareSourceIndex(geometry: BufferGeometry): ArrayLike<number> | null {
  return geometry.userData[COMPARE_SOURCE_INDEX_KEY] ?? null;
}

/** 比較重ね描き専用の、index を持たない geometry を作る。 */
export function createCompareOverlayGeometry(mesh: Mesh): BufferGeometry {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  const index = source.getIndex();

  for (const name of ["position", "skinIndex", "skinWeight"] as const) {
    const attribute = source.getAttribute(name);
    if (attribute) geometry.setAttribute(name, index ? expandByIndex(attribute, index) : attribute);
  }
  if (source.morphAttributes.position) {
    geometry.morphAttributes.position = index
      ? source.morphAttributes.position.map((attribute) => expandByIndex(attribute, index))
      : source.morphAttributes.position;
  }
  geometry.morphTargetsRelative = source.morphTargetsRelative;

  const position = geometry.getAttribute("position");
  geometry.setAttribute("color", new Float32BufferAttribute((position?.count ?? 0) * 4, 4));
  if (index) geometry.userData[COMPARE_SOURCE_INDEX_KEY] = index.array;
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  return geometry;
}
