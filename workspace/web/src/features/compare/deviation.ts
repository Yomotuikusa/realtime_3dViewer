import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
  Triangle,
  Uint32BufferAttribute,
  Vector3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { isViewerOverlay } from "../viewer/mesh-display";

/** 比較の対象・基準として三角形を採用する Mesh か。 */
export function isComparableMesh(object: Object3D): object is Mesh {
  return object instanceof Mesh && !(object instanceof InstancedMesh) && !isViewerOverlay(object);
}

/** root 配下の比較対象 Mesh を traverse 順で集める。 */
export function collectComparableMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (isComparableMesh(object)) meshes.push(object);
  });
  return meshes;
}

/** 複数 Mesh の位置と index をワールド座標の単一 geometry に焼き込む。 */
export function bakeWorldTriangles(root: Object3D): BufferGeometry | null {
  root.updateMatrixWorld(true);
  const meshes = collectComparableMeshes(root);
  if (meshes.length === 0) return null;

  const positions: number[] = [];
  const indices: number[] = [];
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) continue;

    const vertexOffset = positions.length / 3;
    const worldPosition = new Vector3();
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      worldPosition.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
      worldPosition.applyMatrix4(mesh.matrixWorld);
      positions.push(worldPosition.x, worldPosition.y, worldPosition.z);
    }

    const sourceIndex = mesh.geometry.getIndex();
    if (sourceIndex) {
      for (let index = 0; index < sourceIndex.count; index += 1) {
        indices.push(sourceIndex.getX(index) + vertexOffset);
      }
    } else {
      for (let index = 0; index < position.count; index += 1) indices.push(index + vertexOffset);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  return geometry;
}

export interface MeshDeviation {
  /** 比較対象 Mesh の元オブジェクト */
  mesh: Mesh;
  /** mesh.geometry の各頂点に対応するワールド単位の符号付き距離 */
  signedDistance: Float32Array;
}

export interface DeviationResult {
  /** 基準三角形集合のバウンディングボックスの最大辺長 */
  baseSize: number;
  /** 対象 Mesh の traverse 順の距離結果 */
  meshes: MeshDeviation[];
}

function geometrySize(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  if (!position || position.count === 0) return 0;
  const bounds = new Box3().makeEmpty();
  const point = new Vector3();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    point.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
    bounds.expandByPoint(point);
  }
  const size = bounds.getSize(new Vector3());
  return Math.max(size.x, size.y, size.z);
}

function triangleNormal(
  geometry: BufferGeometry,
  faceIndex: number,
  target: Vector3,
): Vector3 {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex()!;
  const a = index.getX(faceIndex * 3);
  const b = index.getX(faceIndex * 3 + 1);
  const c = index.getX(faceIndex * 3 + 2);
  const first = new Vector3(position.getX(a), position.getY(a), position.getZ(a));
  const second = new Vector3(position.getX(b), position.getY(b), position.getZ(b));
  const third = new Vector3(position.getX(c), position.getY(c), position.getZ(c));
  return Triangle.getNormal(first, second, third, target);
}

/** 対象 Mesh の各頂点から基準表面までの符号付き最近距離を計算する。 */
export function computeDeviation(target: Object3D, base: Object3D): DeviationResult | null {
  const bakedBase = bakeWorldTriangles(base);
  if (!bakedBase) return null;

  const bvh = new MeshBVH(bakedBase);
  const baseSize = geometrySize(bakedBase);
  target.updateMatrixWorld(true);
  const meshes = collectComparableMeshes(target);
  const normal = new Vector3();
  const worldVertex = new Vector3();
  const difference = new Vector3();

  const results = meshes.map((mesh): MeshDeviation => {
    const position = mesh.geometry.getAttribute("position");
    const signedDistance = new Float32Array(position?.count ?? 0);
    if (!position) return { mesh, signedDistance };

    for (let vertex = 0; vertex < position.count; vertex += 1) {
      worldVertex.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
      worldVertex.applyMatrix4(mesh.matrixWorld);
      const hit = bvh.closestPointToPoint(worldVertex);
      if (!hit) {
        signedDistance[vertex] = Infinity;
        continue;
      }
      if (hit.distance === 0) {
        signedDistance[vertex] = 0;
        continue;
      }

      triangleNormal(bakedBase, hit.faceIndex, normal);
      difference.copy(worldVertex).sub(hit.point);
      signedDistance[vertex] = (difference.dot(normal) >= 0 ? 1 : -1) * hit.distance;
    }
    return { mesh, signedDistance };
  });

  return { baseSize, meshes: results };
}
