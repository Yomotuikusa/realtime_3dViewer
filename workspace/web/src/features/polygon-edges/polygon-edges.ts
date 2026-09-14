import { Float32BufferAttribute } from "three";
import type { BufferGeometry } from "three";

/** 三角形の各頂点の重心座標を格納する属性名。 */
export const POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE = "polygonEdgeBarycentric";

/** 三角形の各頂点から見た対辺が輪郭かどうかを格納する属性名。 */
export const POLYGON_EDGE_MASK_ATTRIBUTE = "polygonEdgeMask";

function edgeKey(
  position: BufferGeometry["attributes"][string],
  first: number,
  second: number,
): string {
  const firstX = position.getX(first);
  const firstY = position.getY(first);
  const firstZ = position.getZ(first);
  const secondX = position.getX(second);
  const secondY = position.getY(second);
  const secondZ = position.getZ(second);
  const firstKey = `${firstX}\u0000${firstY}\u0000${firstZ}`;
  const secondKey = `${secondX}\u0000${secondY}\u0000${secondZ}`;
  return firstKey < secondKey ? `${firstKey}\u0001${secondKey}` : `${secondKey}\u0001${firstKey}`;
}

function addTriangleEdges(
  position: BufferGeometry["attributes"][string],
  triangleStart: number,
  edgeCounts: Map<string, number>,
): void {
  for (let vertex = 0; vertex < 3; vertex += 1) {
    const first = triangleStart + ((vertex + 1) % 3);
    const second = triangleStart + ((vertex + 2) % 3);
    const key = edgeKey(position, first, second);
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }
}

function appendTriangleAttributes(
  position: BufferGeometry["attributes"][string],
  triangleStart: number,
  edgeCounts: Map<string, number>,
  barycentric: number[],
  mask: number[],
): void {
  const triangleMask: number[] = [];
  for (let vertex = 0; vertex < 3; vertex += 1) {
    const first = triangleStart + ((vertex + 1) % 3);
    const second = triangleStart + ((vertex + 2) % 3);
    triangleMask.push(edgeCounts.get(edgeKey(position, first, second)) === 1 ? 1 : 0);
  }

  for (let vertex = 0; vertex < 3; vertex += 1) {
    barycentric.push(vertex === 0 ? 1 : 0, vertex === 1 ? 1 : 0, vertex === 2 ? 1 : 0);
    mask.push(...triangleMask);
  }
}

/** 両属性が geometry に付いているかを返す。 */
export function hasPolygonEdges(geometry: BufferGeometry): boolean {
  return geometry.getAttribute(POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE) !== undefined
    && geometry.getAttribute(POLYGON_EDGE_MASK_ATTRIBUTE) !== undefined;
}

/** file 順の多角形分割に対応する輪郭辺属性を geometry に付ける。 */
export function applyPolygonEdges(geometry: BufferGeometry, polygonSizes: readonly number[]): boolean {
  const position = geometry.getAttribute("position");
  if (geometry.index !== null || position === undefined || polygonSizes.length === 0) return false;

  let expectedVertexCount = 0;
  for (const polygonSize of polygonSizes) {
    if (!Number.isInteger(polygonSize) || polygonSize < 3) return false;
    expectedVertexCount += 3 * (polygonSize - 2);
  }
  if (expectedVertexCount !== position.count) return false;
  if (hasPolygonEdges(geometry)) return true;

  const barycentric: number[] = [];
  const mask: number[] = [];
  let triangleStart = 0;

  for (const polygonSize of polygonSizes) {
    const triangleCount = polygonSize - 2;
    const edgeCounts = new Map<string, number>();
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      addTriangleEdges(position, triangleStart + triangle * 3, edgeCounts);
    }
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      appendTriangleAttributes(position, triangleStart + triangle * 3, edgeCounts, barycentric, mask);
    }
    triangleStart += triangleCount * 3;
  }

  geometry.setAttribute(
    POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE,
    new Float32BufferAttribute(barycentric, 3),
  );
  geometry.setAttribute(POLYGON_EDGE_MASK_ATTRIBUTE, new Float32BufferAttribute(mask, 3));
  return true;
}
