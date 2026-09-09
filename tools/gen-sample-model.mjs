// 手動テスト用の glTF / GLB サンプルを生成する。
// 使い方: node tools/gen-sample-model.mjs [出力先ディレクトリ]
//   既定の出力先は workspace/data/samples/
// 生成物: sample-scene.gltf (buffer を base64 埋め込み) / sample-scene.glb
// 中身は色と位置の異なる 6 つの直方体。Follow・アノテーション・コメントピンの
// 位置ずれが目視で分かるよう、あえてパーツを分けている。

import { mkdirSync, writeFileSync } from "node:fs";

// --- 立方体ジオメトリ (24頂点/法線 + 36インデックス) ---
const faces = [
  { n: [0, 0, 1], v: [[-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1]] },
  { n: [0, 0,-1], v: [[ 1,-1,-1],[-1,-1,-1],[-1, 1,-1],[ 1, 1,-1]] },
  { n: [1, 0, 0], v: [[ 1,-1, 1],[ 1,-1,-1],[ 1, 1,-1],[ 1, 1, 1]] },
  { n: [-1,0, 0], v: [[-1,-1,-1],[-1,-1, 1],[-1, 1, 1],[-1, 1,-1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1],[ 1, 1, 1],[ 1, 1,-1],[-1, 1,-1]] },
  { n: [0,-1, 0], v: [[-1,-1,-1],[ 1,-1,-1],[ 1,-1, 1],[-1,-1, 1]] },
];
const pos = [], nrm = [], idx = [];
faces.forEach((f, i) => {
  f.v.forEach((v) => { pos.push(...v); nrm.push(...f.n); });
  const b = i * 4;
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
});

const posBuf = Buffer.from(new Float32Array(pos).buffer);
const nrmBuf = Buffer.from(new Float32Array(nrm).buffer);
const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
const pad4 = (b) => (b.length % 4 === 0 ? b : Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]));
const bin = Buffer.concat([posBuf, nrmBuf, pad4(idxBuf)]);

const parts = [
  { name: "Body",      t: [0, 0.6, 0],     s: [1.2, 0.8, 0.8], c: [0.55, 0.60, 0.70, 1] },
  { name: "Head",      t: [1.4, 1.6, 0],   s: [0.5, 0.5, 0.5], c: [0.90, 0.55, 0.30, 1] },
  { name: "LegFront",  t: [0.8, -0.5, 0.5],s: [0.2, 0.7, 0.2], c: [0.35, 0.45, 0.55, 1] },
  { name: "LegBack",   t: [-0.8, -0.5, 0.5],s:[0.2, 0.7, 0.2], c: [0.35, 0.45, 0.55, 1] },
  { name: "Fin",       t: [-1.3, 1.1, 0],  s: [0.4, 0.5, 0.1], c: [0.30, 0.70, 0.60, 1] },
  { name: "Ground",    t: [0, -1.3, 0],    s: [3.5, 0.08, 2.5],c: [0.22, 0.24, 0.28, 1] },
];

const gltf = {
  asset: { version: "2.0", generator: "3dreviewer manual-test sample" },
  scene: 0,
  scenes: [{ name: "SampleScene", nodes: parts.map((_, i) => i) }],
  nodes: parts.map((p, i) => ({ name: p.name, mesh: i, translation: p.t, scale: p.s })),
  meshes: parts.map((p, i) => ({
    name: p.name,
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i }],
  })),
  materials: parts.map((p) => ({
    name: `${p.name}Mat`,
    pbrMetallicRoughness: { baseColorFactor: p.c, metallicFactor: 0.1, roughnessFactor: 0.7 },
  })),
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-1,-1,-1], max: [1,1,1] },
    { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
    { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
    { buffer: 0, byteOffset: posBuf.length, byteLength: nrmBuf.length, target: 34962 },
    { buffer: 0, byteOffset: posBuf.length + nrmBuf.length, byteLength: idxBuf.length, target: 34963 },
  ],
  buffers: [{ byteLength: bin.length }],
};

const dir = process.argv[2] ?? new URL("../workspace/data/samples/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

// --- .gltf (base64 埋め込み) ---
const embedded = structuredClone(gltf);
embedded.buffers = [{ byteLength: bin.length, uri: `data:application/octet-stream;base64,${bin.toString("base64")}` }];
writeFileSync(`${dir}/sample-scene.gltf`, JSON.stringify(embedded, null, 2));

// --- .glb ---
const jsonChunk = pad4(Buffer.from(JSON.stringify(gltf), "utf8"));
const jsonPadded = Buffer.from(jsonChunk); // pad4 は 0 埋め、JSON は空白埋めが正式
for (let i = Buffer.byteLength(JSON.stringify(gltf)); i < jsonPadded.length; i++) jsonPadded[i] = 0x20;
const header = Buffer.alloc(12);
header.write("glTF", 0, "ascii");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + bin.length, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(jsonPadded.length, 0);
jsonHead.write("JSON", 4, "ascii");
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4); // "BIN\0"
writeFileSync(`${dir}/sample-scene.glb`, Buffer.concat([header, jsonHead, jsonPadded, binHead, bin]));

console.log("written to", dir);
