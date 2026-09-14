---
id: 134
title: FBX(バイナリ / ASCII)からの多角形読み取りと PolygonEdgeFBXLoader
feature: polygon-edges
depends_on: [133]
owns: [web/src/features/polygon-edges/fbx-binary.ts, web/src/features/polygon-edges/fbx-ascii.ts, web/src/features/polygon-edges/fbx-polygons.ts, web/src/features/polygon-edges/polygon-edge-loaders.ts, web/src/features/polygon-edges/polygon-edges_Summary.md, web/tests/fbx-polygons.test.ts]
reads: [web/src/features/polygon-edges/polygon-edges.ts, node_modules/three/examples/jsm/loaders/FBXLoader.js, node_modules/@types/three/examples/jsm/loaders/FBXLoader.d.ts, node_modules/@types/three/examples/jsm/libs/fflate.module.d.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
FBX にはファイル内に多角形の区切り(`PolygonVertexIndex`)が残っているが、three の FBXLoader は三角形化して捨てる。
FBXLoader とは別に、同じデータから多角形ごとの頂点数だけを読み取り、133 の `applyPolygonEdges` で出力 Mesh へ輪郭辺の属性を付ける。

## 前提
- 133 で `applyPolygonEdges(geometry, polygonSizes): boolean` と `PolygonEdgeOBJLoader` が `polygon-edge-loaders.ts` にある。web/src/features/polygon-edges/polygon-edges.ts
- FBXLoader は Geometry ノードの `PolygonVertexIndex` を file 順に走査し、負の値 `v` を `v ^ -1` に戻して面の終端とみなす。面の頂点数 n が 3 より大きければ earcut で n-2 個(退化した面ではそれ未満のこともある)の三角形に分け、三角形を **file 順に連続して** 非インデックスの position へ積む。FBXLoader.js:1996-2013, 2211-2271
- Mesh の出力: Model ノードごとに `new Mesh(geometry, material)` / `new SkinnedMesh(...)` を作り、`model.ID = id`(Model ノードの id、数値)を付ける。FBXLoader.js:1091, 1453-1458。`ID` は @types にないので `(mesh as Mesh & { ID?: unknown }).ID` として読む
- Model と Geometry の対応は Connections から取る。接続 `[from, to]` は from が子、to が親で、Model(親)の children に Geometry(子)がある。Model に複数の Geometry が接続されていれば **接続の並び順で後のものが勝つ**。FBXLoader.js:220-262, 1375-1384
- 形式判定: バイナリはバッファ先頭が `'Kaydara FBX Binary  \0'`(空白2つ + NUL、FBXLoader.js:4364-4370)。それ以外は ASCII として扱う。FBXLoader は ASCII の `FBXVersion: (\d+)` が 7000 未満なら例外にする(FBXLoader.js:94-96)
- バイナリの構造(FBXLoader.js:3786-3990):
  - 先頭 23 バイトのマジックの後に uint32 version(little endian)。version >= 7500 なら endOffset / numProperties / propertyListLen は uint64、それ未満は uint32。続けて uint8 nameLen、name
  - endOffset が 0 のノードは NULL レコード。ノードのサブノードは property list の直後から endOffset まで
  - プロパティ型は先頭 1 文字。`C` bool(1) `Y` int16 `I` int32 `F` float32 `D` float64 `L` int64 `S`/`R` uint32 長さ + 本体。配列型 `b c d f i l` は uint32 arrayLength、uint32 encoding、uint32 compressedLength の後、encoding 0 なら生の要素列、1 なら zlib 圧縮(`unzlibSync` で展開)。要素幅は b/c 1、i/f 4、d/l 8
  - ファイル終端の判定は FBXLoader.js:3815 `endOfContent` と同じ(size % 16 の分岐)
  - `Objects` 配下の `Geometry` ノードは propertyList = [id(L), attrName(S), attrType(S)]。その子 `PolygonVertexIndex` は単一プロパティで int32 配列(`i`)
  - `Connections` 配下の `C` ノードは propertyList = [type(S) "OO" など, from(L), to(L), ...]
- int64 は `Number(new DataView(...).getBigInt64(offset, true))` で読む。FBXLoader の手組み実装と同じ値になる(id は 2^53 未満)
- `unzlibSync` は `three/examples/jsm/libs/fflate.module.js` から import できる(型は `@types/three/examples/jsm/libs/fflate.module.d.ts` が fflate を再エクスポート)。追加の依存は入れない
- ASCII の構造(FBXLoader.js:3452-3560): ノード開始行は `名前: 属性, 属性, ... {`、終了行は `}`。`Geometry: 123456, "Geometry::name", "Mesh" {` の第1属性が id で `parseInt`。`PolygonVertexIndex: *24 {` の中に `a: 0,1,3,-3,...` があり、長い配列は `,` で終わる行の次の行へ続く。接続行は `C: "OO",from,to`(from, to は `parseInt`)。コメント行は `;` で始まる
- `FBXLoader.parse(FBXBuffer: ArrayBuffer | string, path: string): Group`(FBXLoader.d.ts:6)。ビューアの useLoader は ArrayBuffer を渡す

## インターフェイス契約

```ts
// web/src/features/polygon-edges/fbx-polygons.ts
export interface FbxPolygonInfo {
  /** Geometry ノード id → 多角形ごとの頂点数(file 順) */
  geometries: Map<number, number[]>;
  /** Model ノード id → その Model に接続された Geometry ノード id(接続の並び順で後勝ち) */
  modelToGeometry: Map<number, number>;
}

/** PolygonVertexIndex の生の値列から多角形ごとの頂点数を返す。負の値が面の終端 */
export function polygonSizesFromVertexIndex(indices: ArrayLike<number>): number[];

/** 形式を判定して binary / ascii の読み取りへ振り分ける。string は ASCII とみなす */
export function readFbxPolygons(data: ArrayBuffer | string): FbxPolygonInfo;
```

```ts
// web/src/features/polygon-edges/fbx-binary.ts
export function isFbxBinary(buffer: ArrayBuffer): boolean;
export function readFbxBinaryPolygons(buffer: ArrayBuffer): FbxPolygonInfo;
```
必要なノード(`Objects` → `Geometry` → `PolygonVertexIndex`、`Connections` → `C`)以外は endOffset へ飛ばして読み飛ばす。
`Geometry` の attrType が `"Mesh"` でないものは geometries に入れない。

```ts
// web/src/features/polygon-edges/fbx-ascii.ts
export function readFbxAsciiPolygons(text: string): FbxPolygonInfo;
```
`PolygonVertexIndex` ノードの内側では、`}` までの行を集めて `a:` 接頭辞を除き、`,` で分割して数値にする(行またぎの継続に依存しない)。

```ts
// web/src/features/polygon-edges/polygon-edge-loaders.ts(133 の内容に追記)
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

/** FBXLoader の出力 Mesh へ多角形の輪郭辺の属性を付けるローダー */
export class PolygonEdgeFBXLoader extends FBXLoader {
  parse(buffer: ArrayBuffer | string, path: string): Group;
}
```
`parse` は `super.parse(buffer, path)` の後、`readFbxPolygons(buffer)` を呼び、結果の group を `traverse` して
`Mesh` かつ `typeof ID === "number"` のものについて `modelToGeometry.get(ID)` → `geometries.get(geometryId)` を引き、
見つかれば `applyPolygonEdges(mesh.geometry, sizes)` を呼ぶ。`readFbxPolygons` が例外を投げたら捕捉して何も付けず、
`super.parse` の結果をそのまま返す。

## 振る舞い

### polygonSizesFromVertexIndex
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `[0, 1, 3, -3, 2, 3, 5, -5]` | `[4, 4]` |
| `[0, 1, -3, 0, 1, 2, -4]` | `[3, 4]` |
| 末尾が負で終わらない(`[0, 1, 2]`) | 未終端の面は数えず `[]` |
| 空配列 | `[]` |

### readFbxBinaryPolygons(テストは仕様に沿ったバイナリをテスト内で組み立てる)
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| version 7400(32bit オフセット)、Geometry 1 つ(四角形 2 面、非圧縮 `i` 配列)、Model 1 つ、`C` で接続 | geometries = {geoId: [4, 4]}、modelToGeometry = {modelId: geoId} |
| version 7500(64bit オフセット)、同じ内容 | 同じ結果 |
| `PolygonVertexIndex` が encoding 1(zlib 圧縮。テストでは fflate の `zlibSync` で作る) | 非圧縮と同じ結果 |
| Geometry の attrType が `"NurbsCurve"` | geometries に入らない |
| 1 つの Model に Geometry が 2 つ接続 | 接続順で後の Geometry id になる |
| Objects の他ノード(Model / Material)や Geometry 配下の Vertices などが混在 | 読み飛ばされて結果に影響しない |
| 先頭マジックが一致しないバッファ | `isFbxBinary` が false |

### readFbxAsciiPolygons
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 四角形 2 面の Geometry と Model、`C: "OO",geoId,modelId` を含む最小の ASCII | geometries = {geoId: [4, 4]}、modelToGeometry = {modelId: geoId} |
| `a:` の配列が複数行に分かれている(行末 `,` で継続) | 連結して読める |
| `;` コメント行と空行 | 無視される |
| `Geometry` の attrType が `"Mesh"` 以外 | geometries に入らない |
| インデントがタブでなく空白 | 同じ結果(行頭空白の種類に依存しない) |

### readFbxPolygons
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| バイナリの ArrayBuffer | `readFbxBinaryPolygons` の結果 |
| ASCII 文字列を UTF-8 で詰めた ArrayBuffer | `readFbxAsciiPolygons` の結果 |
| string | `readFbxAsciiPolygons` の結果 |

### PolygonEdgeFBXLoader
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `super.parse` をモックして Mesh(`ID` 付き)を返し、`readFbxPolygons` の結果に対応する Geometry がある | その Mesh の geometry に `applyPolygonEdges` が呼ばれ、`hasPolygonEdges` が true |
| Mesh の `ID` が modelToGeometry にない | 属性は付かない |
| `readFbxPolygons` が例外を投げる | 例外は外へ出ず、`super.parse` の結果が返る |
| 三角形数が頂点数の合計と合わない(earcut が退化面で三角形を減らした状況を模す) | `applyPolygonEdges` が false を返し、属性は付かない。他の Mesh には影響しない |

## やらないこと
- FBXLoader 本体の複製や差し替えはしない。位置・法線・UV・スキン・アニメーションは読まない
- Model 配下に頂点を持つ FBX 6.x 形式(`Objects.Geometry` がない)への対応はしない。読めなければ三角形表示のまま
- ビューアの結線(ModelMesh.tsx、mesh-display.ts)は 135。ここでは触らない
- 新しい npm 依存は追加しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] polygon-edges_Summary.md が更新されている(fbx-binary.ts / fbx-ascii.ts / fbx-polygons.ts と fbx-polygons.test.ts を載せる)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
