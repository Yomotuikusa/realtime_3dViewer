import { unzlibSync } from "three/examples/jsm/libs/fflate.module.js";
import type { FbxPolygonInfo } from "./fbx-polygons";
import { polygonSizesFromVertexIndex } from "./fbx-polygons";

const MAGIC = "Kaydara FBX Binary  \0";

class Reader {
  readonly view: DataView;
  offset = 0;

  constructor(readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  private ensure(length: number): void {
    if (this.offset + length > this.buffer.byteLength) throw new Error("Invalid FBX binary data");
  }

  bytes(length: number): Uint8Array {
    this.ensure(length);
    const result = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return result;
  }

  string(length: number): string {
    return new TextDecoder().decode(this.bytes(length));
  }

  uint8(): number { this.ensure(1); return this.view.getUint8(this.offset++); }
  int16(): number { this.ensure(2); const value = this.view.getInt16(this.offset, true); this.offset += 2; return value; }
  uint32(): number { this.ensure(4); const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  uint64(): number { this.ensure(8); const value = Number(this.view.getBigUint64(this.offset, true)); this.offset += 8; return value; }
  int32(): number { this.ensure(4); const value = this.view.getInt32(this.offset, true); this.offset += 4; return value; }
  int64(): number { this.ensure(8); const value = Number(this.view.getBigInt64(this.offset, true)); this.offset += 8; return value; }
  float32(): number { this.ensure(4); const value = this.view.getFloat32(this.offset, true); this.offset += 4; return value; }
  float64(): number { this.ensure(8); const value = this.view.getFloat64(this.offset, true); this.offset += 8; return value; }
}

interface Header { end: number; properties: number; name: string; }

function arrayValues(reader: Reader, type: string, count: number, encoding: number, length: number): number[] {
  const source = encoding === 0 ? reader : new Reader(reader.bytes(length).slice().buffer);
  if (encoding === 1) {
    const compressed = source.buffer;
    const decoded = unzlibSync(new Uint8Array(compressed));
    source.offset = 0;
    return arrayValues(new Reader(decoded.slice().buffer), type, count, 0, 0);
  }
  if (encoding !== 0) throw new Error("Unsupported FBX array encoding");
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (type === "b" || type === "c") values.push(source.uint8());
    else if (type === "i" || type === "f") values.push(type === "i" ? source.int32() : source.float32());
    else if (type === "d") values.push(source.float64());
    else if (type === "l") values.push(source.int64());
    else throw new Error(`Unsupported FBX array type: ${type}`);
  }
  return values;
}

function property(reader: Reader): unknown {
  const type = reader.string(1);
  if (type === "C") return reader.uint8() !== 0;
  if (type === "Y") return reader.int16();
  if (type === "I") return reader.int32();
  if (type === "F") return reader.float32();
  if (type === "D") return reader.float64();
  if (type === "L") return reader.int64();
  if (type === "S") return reader.string(reader.uint32());
  if (type === "R") return reader.bytes(reader.uint32());
  if ("bcdfil".includes(type)) {
    const count = reader.uint32();
    const encoding = reader.uint32();
    const length = reader.uint32();
    return arrayValues(reader, type, count, encoding, length);
  }
  throw new Error(`Unsupported FBX property type: ${type}`);
}

function header(reader: Reader, wide: boolean): Header | null {
  const end = wide ? reader.uint64() : reader.uint32();
  const properties = wide ? reader.uint64() : reader.uint32();
  if (wide) reader.uint64(); else reader.uint32();
  const name = reader.string(reader.uint8());
  if (end === 0) return null;
  if (end < reader.offset || end > reader.buffer.byteLength) throw new Error("Invalid FBX node offset");
  return { end, properties, name };
}

function skip(reader: Reader, node: Header): void { reader.offset = node.end; }

function endOfContent(reader: Reader): boolean {
  const remaining = reader.buffer.byteLength - reader.offset;
  if (remaining < 176) return false;
  if (reader.buffer.byteLength % 16 === 0) {
    return ((reader.offset + 176) & ~0xf) >= reader.buffer.byteLength;
  }
  return reader.offset + 176 >= reader.buffer.byteLength;
}

function readGeometry(
  reader: Reader,
  node: Header,
  wide: boolean,
  geometries: Map<number, number[]>,
  geometryIds: Set<number>,
): void {
  const values = Array.from({ length: node.properties }, () => property(reader));
  const id = typeof values[0] === "number" ? values[0] : undefined;
  const attrType = typeof values[2] === "string" ? values[2] : undefined;
  if (id !== undefined) geometryIds.add(id);
  let sizes: number[] | undefined;
  while (reader.offset < node.end) {
    const child = header(reader, wide);
    if (child === null) continue;
    if (child.name === "PolygonVertexIndex" && child.properties === 1) {
      const values = property(reader);
      if (Array.isArray(values)) sizes = polygonSizesFromVertexIndex(values);
      reader.offset = child.end;
    } else skip(reader, child);
  }
  if (id !== undefined && attrType === "Mesh" && sizes !== undefined) geometries.set(id, sizes);
}

function readObjects(
  reader: Reader,
  node: Header,
  wide: boolean,
  geometries: Map<number, number[]>,
  geometryIds: Set<number>,
): void {
  while (reader.offset < node.end) {
    const child = header(reader, wide);
    if (child === null) continue;
    if (child.name === "Geometry") readGeometry(reader, child, wide, geometries, geometryIds);
    else skip(reader, child);
  }
}

function readConnections(reader: Reader, node: Header, wide: boolean, connections: Array<[number, number]>): void {
  while (reader.offset < node.end) {
    const child = header(reader, wide);
    if (child === null) continue;
    if (child.name === "C") {
      const values = Array.from({ length: child.properties }, () => property(reader));
      if (typeof values[1] === "number" && typeof values[2] === "number") {
        connections.push([values[1], values[2]]);
      }
      reader.offset = child.end;
    } else skip(reader, child);
  }
}

/** FBX バイナリの必要なノードだけを読み取る。 */
export function readFbxBinaryPolygons(buffer: ArrayBuffer): FbxPolygonInfo {
  if (!isFbxBinary(buffer)) throw new Error("Not an FBX binary file");
  const reader = new Reader(buffer);
  reader.offset = 23;
  const version = reader.uint32();
  if (version < 6400) throw new Error(`Unsupported FBX version: ${version}`);
  const wide = version >= 7500;
  const geometries = new Map<number, number[]>();
  const geometryIds = new Set<number>();
  const connections: Array<[number, number]> = [];
  while (reader.offset < buffer.byteLength && !endOfContent(reader)) {
    const node = header(reader, wide);
    if (node === null) continue;
    if (node.name === "Objects") readObjects(reader, node, wide, geometries, geometryIds);
    else if (node.name === "Connections") readConnections(reader, node, wide, connections);
    else skip(reader, node);
  }
  const modelToGeometry = new Map<number, number>();
  for (const [geometryId, modelId] of connections) {
    if (geometryIds.has(geometryId)) modelToGeometry.set(modelId, geometryId);
  }
  return { geometries, modelToGeometry };
}

/** バッファ先頭が FBX Binary の署名で始まるかを判定する。 */
export function isFbxBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < MAGIC.length) return false;
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (bytes[index] !== MAGIC.charCodeAt(index)) return false;
  }
  return true;
}
