import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Float32BufferAttribute as Float32BufferAttributeType,
} from "three";
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

    const polygons = geometryForPolygons(
      [[0, 0, 0], [1, 0, 0], [2, 1, 0], [1, 2, 0], [0, 1, 0]],
      [[5, 0, 0], [6, 0, 0], [6, 1, 0]],
    );
    expect(applyPolygonEdges(polygons, [5, 3])).toBe(true);
    expect(values(polygons, POLYGON_EDGE_MASK_ATTRIBUTE).filter((value) => value === 0)).toHaveLength(12);
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
});

describe("OBJ polygon sizes", () => {
  it("returns Mesh faces in object order and ignores primitive objects", () => {
    const text = `
      v 0 0 0
      v 1 0 0
      v 1 1 0
      v 0 1 0
      v 0 0 1
      o a
      f 1/1/1 2/2/2 3/3/3 4/4/4
      f 1 2 3 4
      o line
      l 1 2
      f 1 2 3
      o empty
      f 1 2
      o points
      p 1 2 3
      f 1 2 3
      o final
      f 1 2 3
    `;
    expect(objPolygons.readObjPolygonSizes(text)).toEqual([[4, 4], [3]]);
  });

  it("does not create an empty object for the first declaration", () => {
    expect(objPolygons.readObjPolygonSizes("o a\nf 1 2 3\no b\nf 1 2 3 4")).toEqual([[3], [4]]);
    expect(objPolygons.readObjPolygonSizes("f 1 2\nf 1 2 3")).toEqual([[3]]);
    expect(objPolygons.readObjPolygonSizes("g\nf 1 2 3")).toEqual([[3]]);
  });
});

describe("PolygonEdgeOBJLoader", () => {
  it("adds attributes to the Mesh output while preserving ordinary OBJ output", () => {
    const text = `
      v 0 0 0
      v 1 0 0
      v 1 1 0
      v 0 1 0
      o quad
      f 1 2 3 4
    `;
    const result = new PolygonEdgeOBJLoader().parse(text);
    const mesh = result.children[0] as Mesh;
    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh.name).toBe("quad");
    expect(mesh.geometry.getAttribute("position").count).toBe(6);
    expect(hasPolygonEdges(mesh.geometry)).toBe(true);
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
});
