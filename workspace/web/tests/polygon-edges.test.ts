import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Float32BufferAttribute as Float32BufferAttributeType,
} from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { describe, expect, it, vi } from "vitest";
import {
  applyPolygonEdges,
  hasPolygonEdges,
  POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE,
  POLYGON_EDGE_MASK_ATTRIBUTE,
} from "../src/features/polygon-edges/polygon-edges";
import * as objPolygons from "../src/features/polygon-edges/obj-polygons";
import { PolygonEdgeOBJLoader } from "../src/features/polygon-edges/polygon-edge-loaders";

function geometryForPolygons(...polygons: number[][][]): BufferGeometry {
  const position: number[] = [];
  for (const polygon of polygons) {
    for (let triangle = 1; triangle < polygon.length - 1; triangle += 1) {
      for (const vertex of [polygon[0]!, polygon[triangle]!, polygon[triangle + 1]!]) position.push(...vertex);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  return geometry;
}

function values(geometry: BufferGeometry, name: string): number[] {
  return Array.from((geometry.getAttribute(name) as Float32BufferAttributeType).array);
}

describe("polygon edge attributes", () => {
  it("marks a quadrilateral diagonal as internal and writes barycentric coordinates", () => {
    const geometry = geometryForPolygons(
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
    );

    expect(applyPolygonEdges(geometry, [4])).toBe(true);
    expect(values(geometry, POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE)).toEqual([
      1, 0, 0, 0, 1, 0, 0, 0, 1,
      1, 0, 0, 0, 1, 0, 0, 0, 1,
    ]);
    expect(values(geometry, POLYGON_EDGE_MASK_ATTRIBUTE)).toEqual([
      1, 0, 1, 1, 0, 1, 1, 0, 1,
      1, 1, 0, 1, 1, 0, 1, 1, 0,
    ]);
  });

  it("handles triangles, pentagons, and consecutive polygons", () => {
    const triangle = geometryForPolygons([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(applyPolygonEdges(triangle, [3])).toBe(true);
    expect(values(triangle, POLYGON_EDGE_MASK_ATTRIBUTE)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);

    const pentagon = geometryForPolygons([
      [0, 0, 0], [1, 0, 0], [2, 1, 0], [1, 2, 0], [0, 1, 0],
    ]);
    expect(applyPolygonEdges(pentagon, [5])).toBe(true);
    expect(values(pentagon, POLYGON_EDGE_MASK_ATTRIBUTE).filter((value) => value === 0))
      .toHaveLength(12);

    const polygons = geometryForPolygons(
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      [[5, 0, 0], [6, 0, 0], [5, 1, 0]],
    );
    expect(applyPolygonEdges(polygons, [4, 3])).toBe(true);
    expect(values(polygons, POLYGON_EDGE_MASK_ATTRIBUTE)).toEqual([
      1, 0, 1, 1, 0, 1, 1, 0, 1,
      1, 1, 0, 1, 1, 0, 1, 1, 0,
      1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it("rejects invalid geometry and leaves attributes untouched", () => {
    const geometry = geometryForPolygons([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(applyPolygonEdges(geometry, [])).toBe(false);
    expect(applyPolygonEdges(geometry, [2])).toBe(false);
    expect(applyPolygonEdges(geometry, [4])).toBe(false);
    expect(geometry.getAttribute(POLYGON_EDGE_MASK_ATTRIBUTE)).toBeUndefined();

    geometry.setIndex([0, 1, 2]);
    expect(applyPolygonEdges(geometry, [3])).toBe(false);
    const withoutPosition = new BufferGeometry();
    expect(applyPolygonEdges(withoutPosition, [3])).toBe(false);
  });

  it("reports and preserves already-created attributes", () => {
    const geometry = geometryForPolygons([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(hasPolygonEdges(geometry)).toBe(false);
    expect(applyPolygonEdges(geometry, [3])).toBe(true);
    const barycentric = geometry.getAttribute(POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE);
    const mask = geometry.getAttribute(POLYGON_EDGE_MASK_ATTRIBUTE);
    expect(hasPolygonEdges(geometry)).toBe(true);
    expect(applyPolygonEdges(geometry, [3])).toBe(true);
    expect(geometry.getAttribute(POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE)).toBe(barycentric);
    expect(geometry.getAttribute(POLYGON_EDGE_MASK_ATTRIBUTE)).toBe(mask);
  });

  it("accepts an already-attributed geometry without revalidating its source", () => {
    const geometry = geometryForPolygons([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(applyPolygonEdges(geometry, [3])).toBe(true);
    geometry.setIndex([0, 1, 2]);
    const barycentric = geometry.getAttribute(POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE);
    const mask = geometry.getAttribute(POLYGON_EDGE_MASK_ATTRIBUTE);

    expect(applyPolygonEdges(geometry, [])).toBe(true);
    expect(geometry.getAttribute(POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE)).toBe(barycentric);
    expect(geometry.getAttribute(POLYGON_EDGE_MASK_ATTRIBUTE)).toBe(mask);
  });

  it("requires both attributes for hasPolygonEdges", () => {
    const geometry = geometryForPolygons([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    geometry.setAttribute(
      POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE,
      new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3),
    );
    expect(hasPolygonEdges(geometry)).toBe(false);

    geometry.deleteAttribute(POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE);
    geometry.setAttribute(
      POLYGON_EDGE_MASK_ATTRIBUTE,
      new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3),
    );
    expect(hasPolygonEdges(geometry)).toBe(false);
  });
});

describe("PolygonEdgeOBJLoader", () => {
  it("adds attributes to the Mesh output while preserving ordinary OBJ output", () => {
    const text = `
      v 0 0 0
      v 1 0 0
      v 1 1 0
      v 0 1 0
      v 0 0 1
      v 1 0 1
      v 1 1 1
      v 0 1 1
      o cube
      f 1 2 3 4
      f 5 8 7 6
      f 1 5 6 2
      f 2 6 7 3
      f 3 7 8 4
      f 5 1 4 8
    `;
    const result = new PolygonEdgeOBJLoader().parse(text);
    const ordinaryResult = new OBJLoader().parse(text);
    const mesh = result.children[0] as Mesh;
    const ordinaryMesh = ordinaryResult.children[0] as Mesh;
    expect(mesh).toBeInstanceOf(Mesh);
    expect(result.children).toHaveLength(1);
    expect(ordinaryResult.children).toHaveLength(1);
    expect(mesh.name).toBe(ordinaryMesh.name);
    expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(
      Array.from(ordinaryMesh.geometry.getAttribute("position").array),
    );
    expect(hasPolygonEdges(mesh.geometry)).toBe(true);

    const mask = values(mesh.geometry, POLYGON_EDGE_MASK_ATTRIBUTE);
    for (let triangle = 0; triangle < mask.length; triangle += 9) {
      const triangleMask = mask.slice(triangle, triangle + 3);
      expect(triangleMask.filter((value) => value === 0)).toHaveLength(1);
      expect(mask.slice(triangle, triangle + 3)).toEqual(mask.slice(triangle + 3, triangle + 6));
      expect(mask.slice(triangle, triangle + 3)).toEqual(mask.slice(triangle + 6, triangle + 9));
    }
  });

  it("does not add attributes when the Mesh count does not match", () => {
    const readSizes = vi.spyOn(objPolygons, "readObjPolygonSizes").mockReturnValue([]);
    try {
      const result = new PolygonEdgeOBJLoader().parse("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3");
      expect(hasPolygonEdges((result.children[0] as Mesh).geometry)).toBe(false);
    } finally {
      readSizes.mockRestore();
    }
  });

  it("keeps the parsed result unchanged when size reading throws", () => {
    const readSizes = vi.spyOn(objPolygons, "readObjPolygonSizes").mockImplementation(() => {
      throw new Error("invalid OBJ metadata");
    });
    try {
      const result = new PolygonEdgeOBJLoader().parse("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3");
      expect(hasPolygonEdges((result.children[0] as Mesh).geometry)).toBe(false);
    } finally {
      readSizes.mockRestore();
    }
  });

  it("adds attributes to Mesh objects when Line objects are interleaved", () => {
    const loader = new PolygonEdgeOBJLoader();
    const text = "v 0 0 0\nv 1 0 0\nv 0 1 0\no line\nl 1 2\no mesh\nf 1 2 3";
    const result = loader.parse(text);
    expect(result.children).toHaveLength(2);
    expect(hasPolygonEdges((result.children[1] as Mesh).geometry)).toBe(true);
  });

  it("skips Points objects while attaching attributes to later Mesh objects", () => {
    const text = [
      "v 0 0 0",
      "v 1 0 0",
      "v 0 1 0",
      "o points",
      "p 1 2 3",
      "f 1 2 3",
      "o mesh",
      "f 1 2 3",
    ].join("\n");
    const result = new PolygonEdgeOBJLoader().parse(text);
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).not.toBeInstanceOf(Mesh);
    expect(result.children[1]).toBeInstanceOf(Mesh);
    expect(hasPolygonEdges((result.children[1] as Mesh).geometry)).toBe(true);
  });
});
