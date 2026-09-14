import { describe, expect, it } from "vitest";
import { readObjPolygonSizes } from "../src/features/polygon-edges/obj-polygons";

describe("readObjPolygonSizes", () => {
  it("reads faces without an object declaration as one Mesh object", () => {
    expect(readObjPolygonSizes("f 1 2 3 4\nf 1 2 3")).toEqual([[4, 3]]);
  });

  it("keeps face sizes in file order across object declarations", () => {
    expect(readObjPolygonSizes("o a\nf 1 2 3 4\nf 1 2 3 4\no b\nf 1 2 3")).toEqual([
      [4, 4],
      [3],
    ]);
  });

  it("renames the implicit first object instead of creating an empty one", () => {
    expect(readObjPolygonSizes("o a\nf 1 2 3\no b\nf 1 2 3 4")).toEqual([[3], [4]]);
    expect(readObjPolygonSizes("g\nf 1 2 3")).toEqual([[3]]);
  });

  it("omits objects without valid faces, including both o and g declarations", () => {
    const text = [
      "o first",
      "f 1 2 3",
      "o empty-object",
      "g empty-group",
      "o second",
      "f 1 2 3 4",
    ].join("\n");

    expect(readObjPolygonSizes(text)).toEqual([[3], [4]]);
  });

  it("omits Line and Points objects even when f rows are mixed in", () => {
    const text = [
      "o line",
      "l 1 2",
      "f 1 2 3",
      "o points",
      "p 1 2 3",
      "f 1 2 3 4",
      "o mesh",
      "f 1 2 3",
    ].join("\n");

    expect(readObjPolygonSizes(text)).toEqual([[3]]);
  });

  it("counts compound face references by vertex token", () => {
    expect(readObjPolygonSizes("f 1/1/1 2/2/2 3/3/3 4/4/4")).toEqual([[4]]);
  });

  it("ignores face rows with two or fewer vertices", () => {
    expect(readObjPolygonSizes("f 1\nf 1 2\nf 1 2 3")).toEqual([[3]]);
  });

  it("ignores comments and non-declaration metadata rows", () => {
    const text = [
      "  # comment before the faces",
      "  usemtl material",
      "  mtllib materials.mtl",
      "  s 1",
      "  f  1 2 3 4 ",
      "  # another comment",
      "  f  1/1/1   2/2/2  3/3/3  ",
    ].join("\n");

    expect(readObjPolygonSizes(text)).toEqual([[4, 3]]);
  });

  it("treats a nameless g row as an object boundary", () => {
    const text = "o a\nf 1 2 3\ng\nf 1 2 3 4";

    expect(readObjPolygonSizes(text)).toEqual([[3], [4]]);
  });
});
