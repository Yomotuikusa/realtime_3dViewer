import { Mesh } from "three";
import type { Group } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { applyPolygonEdges } from "./polygon-edges";
import { readObjPolygonSizes } from "./obj-polygons";
import { readFbxPolygons } from "./fbx-polygons";

/** OBJLoader の Mesh に多角形の輪郭辺属性を付けるローダー。 */
export class PolygonEdgeOBJLoader extends OBJLoader {
  override parse(data: string): Group {
    const result = super.parse(data);
    let polygonSizes: number[][];
    try {
      polygonSizes = readObjPolygonSizes(data);
    } catch {
      return result;
    }

    const meshes = result.children.filter((child): child is Mesh => child instanceof Mesh);
    if (meshes.length !== polygonSizes.length) return result;
    for (let index = 0; index < meshes.length; index += 1) {
      const sizes = polygonSizes[index];
      const mesh = meshes[index];
      if (mesh !== undefined && sizes !== undefined) applyPolygonEdges(mesh.geometry, sizes);
    }
    return result;
  }
}

/** FBXLoader の Mesh 出力へ多角形の輪郭辺属性を付けるローダー。 */
export class PolygonEdgeFBXLoader extends FBXLoader {
  override parse(buffer: ArrayBuffer | string, path: string): Group {
    const result = super.parse(buffer, path);
    let info: ReturnType<typeof readFbxPolygons>;
    try {
      info = readFbxPolygons(buffer);
    } catch {
      return result;
    }
    result.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const id = (object as Mesh & { ID?: unknown }).ID;
      if (typeof id !== "number") return;
      const geometryId = info.modelToGeometry.get(id);
      const sizes = geometryId === undefined ? undefined : info.geometries.get(geometryId);
      if (sizes !== undefined) applyPolygonEdges(object.geometry, sizes);
    });
    return result;
  }
}
