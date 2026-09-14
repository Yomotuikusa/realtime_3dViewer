import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from "three";
import { zlibSync } from "three/examples/jsm/libs/fflate.module.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPolygonEdges, hasPolygonEdges } from "../src/features/polygon-edges/polygon-edges";
import * as fbxPolygons from "../src/features/polygon-edges/fbx-polygons";
import { isFbxBinary, readFbxBinaryPolygons } from "../src/features/polygon-edges/fbx-binary";
import { readFbxAsciiPolygons } from "../src/features/polygon-edges/fbx-ascii";
import { PolygonEdgeFBXLoader } from "../src/features/polygon-edges/polygon-edge-loaders";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const MAGIC = "Kaydara FBX Binary  \0";
type Property = { type: string; value: string | number | number[]; encoding?: number };

function bytes(values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function property(value: Property): Uint8Array {
  const text = new TextEncoder();
  if (value.type === "L") {
    const result = new Uint8Array(9);
    result[0] = "L".charCodeAt(0);
    new DataView(result.buffer).setBigInt64(1, BigInt(value.value as number), true);
    return result;
  }
  if (value.type === "S") {
    const body = text.encode(value.value as string);
    const result = new Uint8Array(5 + body.length);
    result[0] = "S".charCodeAt(0);
    new DataView(result.buffer).setUint32(1, body.length, true);
    result.set(body, 5);
    return result;
  }
  const values = value.value as number[];
  const raw = new Uint8Array(values.length * 4);
  const rawView = new DataView(raw.buffer);
  values.forEach((item, index) => rawView.setInt32(index * 4, item, true));
  const body = value.encoding === 1 ? zlibSync(raw) : raw;
  if (value.encoding !== 1) {
    const view = new DataView(body.buffer);
    values.forEach((item, index) => view.setInt32(index * 4, item, true));
  }
  const result = new Uint8Array(13 + body.length);
  result[0] = value.type.charCodeAt(0);
  const view = new DataView(result.buffer);
  view.setUint32(1, values.length, true);
  view.setUint32(5, value.encoding ?? 0, true);
  view.setUint32(9, body.length, true);
  result.set(body, 13);
  return result;
}

function join(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function node(name: string, properties: Property[], children: Uint8Array[], start: number, wide: boolean): Uint8Array {
  const propertyBytes = properties.map(property);
  const headerLength = wide ? 25 : 13;
  const nameBytes = new TextEncoder().encode(name);
  const nullRecord = new Uint8Array(headerLength);
  const contentLength = headerLength + nameBytes.length + propertyBytes.reduce((n, p) => n + p.length, 0)
    + children.reduce((n, child) => n + child.length, 0) + nullRecord.length;
  const result = new Uint8Array(contentLength);
  const view = new DataView(result.buffer);
  const end = start + contentLength;
  if (wide) {
    view.setBigUint64(0, BigInt(end), true);
    view.setBigUint64(8, BigInt(properties.length), true);
    view.setBigUint64(16, BigInt(propertyBytes.reduce((n, p) => n + p.length, 0)), true);
  } else {
    view.setUint32(0, end, true);
    view.setUint32(4, properties.length, true);
    view.setUint32(8, propertyBytes.reduce((n, p) => n + p.length, 0), true);
  }
  result[wide ? 24 : 12] = nameBytes.length;
  let offset = headerLength;
  result.set(nameBytes, offset); offset += nameBytes.length;
  for (const part of propertyBytes) { result.set(part, offset); offset += part.length; }
  for (const child of children) { result.set(child, offset); offset += child.length; }
  return result;
}

function binaryFbx(version: number, compressed = false): ArrayBuffer {
  const wide = version >= 7500;
  const objectsStart = 27;
  const geometryStart = objectsStart + (wide ? 25 : 13) + new TextEncoder().encode("Objects").length;
  const geometryProperties = [
    { type: "L", value: 11 }, { type: "S", value: "Geometry::quad" }, { type: "S", value: "Mesh" },
  ];
  const polygonStart = geometryStart + (wide ? 25 : 13) + new TextEncoder().encode("Geometry").length
    + property(geometryProperties[0]!).length + property(geometryProperties[1]!).length
    + property(geometryProperties[2]!).length;
  const geometry = node("Geometry", [
    { type: "L", value: 11 }, { type: "S", value: "Geometry::quad" }, { type: "S", value: "Mesh" },
  ], [node("PolygonVertexIndex", [{ type: "i", value: [0, 1, 3, -3, 2, 3, 5, -5], encoding: compressed ? 1 : 0 }], [], polygonStart, wide)], geometryStart, wide);
  const objects = node("Objects", [], [geometry], objectsStart, wide);
  const connectionsStart = objectsStart + objects.length;
  const connection = node("C", [
    { type: "S", value: "OO" }, { type: "L", value: 11 }, { type: "L", value: 22 },
  ], [], connectionsStart + (wide ? 25 : 13) + 11, wide);
  const connections = node("Connections", [], [connection], connectionsStart, wide);
  const body = join([new TextEncoder().encode(MAGIC), bytes([0, 0]), bytes([0, 0, 0, 0]), objects, connections, new Uint8Array(176)]);
  new DataView(body.buffer).setUint32(23, version, true);
  return body.buffer as ArrayBuffer;
}

function binaryFbxWithExtras(version: number, secondAttrType = "NurbsCurve"): ArrayBuffer {
  const wide = version >= 7500;
  const headerLength = wide ? 25 : 13;
  const objectsStart = 27;
  const objectsPrefix = objectsStart + headerLength + "Objects".length;
  const geometryProperties = [
    { type: "L", value: 11 }, { type: "S", value: "Geometry::quad" }, { type: "S", value: "Mesh" },
  ] as Property[];
  const propertyLength = geometryProperties.reduce((sum, item) => sum + property(item).length, 0);
  const verticesStart = objectsPrefix + headerLength + "Geometry".length + propertyLength;
  const vertices = node("Vertices", [{ type: "i", value: [0, 1, 2] }], [], verticesStart, wide);
  const polygonStart = verticesStart + vertices.length;
  const polygon = node("PolygonVertexIndex", [{ type: "i", value: [0, 1, 3, -3, 2, 3, 5, -5] }], [], polygonStart, wide);
  const geometry = node("Geometry", geometryProperties, [vertices, polygon], objectsPrefix, wide);
  const nonMeshStart = objectsPrefix + geometry.length;
  const nonMesh = node("Geometry", [
    { type: "L", value: 12 }, { type: "S", value: "Geometry::curve" }, { type: "S", value: secondAttrType },
  ], [], nonMeshStart, wide);
  const modelStart = nonMeshStart + nonMesh.length;
  const model = node("Model", [
    { type: "L", value: 22 }, { type: "S", value: "Model::quad" }, { type: "S", value: "Mesh" },
  ], [], modelStart, wide);
  const materialStart = modelStart + model.length;
  const material = node("Material", [{ type: "L", value: 33 }, { type: "S", value: "Material::red" }], [], materialStart, wide);
  const objects = node("Objects", [], [geometry, nonMesh, model, material], objectsStart, wide);
  const connectionsStart = objectsStart + objects.length;
  const connectionPrefix = connectionsStart + headerLength + "Connections".length;
  const firstConnection = node("C", [
    { type: "S", value: "OO" }, { type: "L", value: 11 }, { type: "L", value: 22 },
  ], [], connectionPrefix, wide);
  const secondConnection = node("C", [
    { type: "S", value: "OO" }, { type: "L", value: 12 }, { type: "L", value: 22 },
  ], [], connectionPrefix + firstConnection.length, wide);
  const connections = node("Connections", [], [firstConnection, secondConnection], connectionsStart, wide);
  const body = join([new TextEncoder().encode(MAGIC), bytes([0, 0]), bytes([0, 0, 0, 0]), objects, connections, new Uint8Array(176)]);
  new DataView(body.buffer).setUint32(23, version, true);
  return body.buffer as ArrayBuffer;
}

function asciiFbx(attrType = "Mesh"): string {
  return `FBXHeaderExtension:  {
  FBXVersion: 7400
}
Objects:  {
  Geometry: 11, "Geometry::quad", "${attrType}" {
    PolygonVertexIndex: *8 {
      a: 0, 1, 3, -3,
      2, 3, 5, -5,
    }
  }
  Model: 22, "Model::quad", "Mesh" {
  }
}
Connections:  {
  C: "OO",11,22
}`;
}

describe("FBX polygon readers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts only terminated PolygonVertexIndex faces", () => {
    expect(fbxPolygons.polygonSizesFromVertexIndex([0, 1, 3, -3, 2, 3, 5, -5])).toEqual([4, 4]);
    expect(fbxPolygons.polygonSizesFromVertexIndex([0, 1, -3, 0, 1, 2, -4])).toEqual([3, 4]);
    expect(fbxPolygons.polygonSizesFromVertexIndex([0, 1, 2])).toEqual([]);
    expect(fbxPolygons.polygonSizesFromVertexIndex([])).toEqual([]);
  });

  it.each([7400, 7500])("reads %s binary nodes", (version) => {
    const result = readFbxBinaryPolygons(binaryFbx(version));
    expect(result.geometries).toEqual(new Map([[11, [4, 4]]]));
    expect(result.modelToGeometry).toEqual(new Map([[22, 11]]));
  });

  it("reads compressed binary arrays and rejects non-binary signatures", () => {
    expect(readFbxBinaryPolygons(binaryFbx(7400, true)).geometries.get(11)).toEqual([4, 4]);
    expect(isFbxBinary(new TextEncoder().encode("ASCII").buffer)).toBe(false);
  });

  it("keeps non-Mesh Geometry IDs in binary Model connections", () => {
    const result = readFbxBinaryPolygons(binaryFbxWithExtras(7400));
    expect(result.geometries).toEqual(new Map([[11, [4, 4]]]));
    expect(result.modelToGeometry).toEqual(new Map([[22, 12]]));
  });

  it("uses the later binary Geometry connection", () => {
    expect(readFbxBinaryPolygons(binaryFbxWithExtras(7400, "Mesh")).modelToGeometry)
      .toEqual(new Map([[22, 12]]));
  });

  it("skips mixed binary Objects nodes and Geometry children", () => {
    expect(readFbxBinaryPolygons(binaryFbxWithExtras(7400)).geometries.get(11)).toEqual([4, 4]);
  });

  it("reads ASCII arrays across lines, ignores comments, and filters non-Mesh geometry", () => {
    expect(readFbxAsciiPolygons(`; comment\n\n${asciiFbx()}`)).toEqual({
      geometries: new Map([[11, [4, 4]]]), modelToGeometry: new Map([[22, 11]]),
    });
    expect(readFbxAsciiPolygons(asciiFbx("NurbsCurve")).geometries).toEqual(new Map());
    expect(readFbxAsciiPolygons(asciiFbx().replaceAll("    ", "\t")).geometries)
      .toEqual(new Map([[11, [4, 4]]]));
  });

  it("dispatches strings and UTF-8 ArrayBuffers", () => {
    expect(fbxPolygons.readFbxPolygons(asciiFbx()).geometries).toEqual(new Map([[11, [4, 4]]]));
    expect(fbxPolygons.readFbxPolygons(new TextEncoder().encode(asciiFbx()).buffer as ArrayBuffer).modelToGeometry)
      .toEqual(new Map([[22, 11]]));
    expect(fbxPolygons.readFbxPolygons(binaryFbx(7400)).geometries).toEqual(new Map([[11, [4, 4]]]));
  });
});

describe("PolygonEdgeFBXLoader", () => {
  afterEach(() => vi.restoreAllMocks());

  function meshWithId(id: number, vertices = 6): Mesh {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(new Array(vertices * 3).fill(0), 3));
    const mesh = new Mesh(geometry);
    (mesh as Mesh & { ID?: unknown }).ID = id;
    return mesh;
  }

  it("applies edges to the matching model Mesh", () => {
    const mesh = meshWithId(22);
    const group = new Group(); group.add(mesh);
    vi.spyOn(FBXLoader.prototype, "parse").mockReturnValue(group);
    vi.spyOn(fbxPolygons, "readFbxPolygons").mockReturnValue({
      geometries: new Map([[11, [4]]]), modelToGeometry: new Map([[22, 11]]),
    });
    new PolygonEdgeFBXLoader().parse("ignored", "");
    expect(hasPolygonEdges(mesh.geometry)).toBe(true);
  });

  it("leaves meshes unchanged when metadata throws or geometry is invalid", () => {
    const unmatched = meshWithId(99);
    const invalid = meshWithId(22, 3);
    const group = new Group(); group.add(unmatched, invalid);
    vi.spyOn(FBXLoader.prototype, "parse").mockReturnValue(group);
    vi.spyOn(fbxPolygons, "readFbxPolygons").mockReturnValue({
      geometries: new Map([[11, [4]]]), modelToGeometry: new Map([[22, 11]]),
    });
    expect(new PolygonEdgeFBXLoader().parse("ignored", "")).toBe(group);
    expect(hasPolygonEdges(unmatched.geometry)).toBe(false);
    expect(hasPolygonEdges(invalid.geometry)).toBe(false);
    vi.mocked(fbxPolygons.readFbxPolygons).mockImplementation(() => { throw new Error("bad"); });
    expect(new PolygonEdgeFBXLoader().parse("ignored", "")).toBe(group);
  });
});
