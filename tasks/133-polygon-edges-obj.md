---
id: 133
title: 多角形の輪郭辺の属性付与と OBJ の多角形読み取り
feature: polygon-edges
depends_on: []
owns: [web/src/features/polygon-edges/polygon-edges.ts, web/src/features/polygon-edges/obj-polygons.ts, web/src/features/polygon-edges/polygon-edge-loaders.ts, web/src/features/polygon-edges/polygon-edges_Summary.md, web/web_Summary.md, web/tests/polygon-edges.test.ts, web/tests/obj-polygons.test.ts]
reads: [node_modules/three/examples/jsm/loaders/OBJLoader.js, web/src/features/viewer/viewer_Summary.md, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
three のローダーは多角形をすべて三角形に分割するため、ワイヤー表示で対角線が描かれ、四角形主体のトポロジーを見比べられない。
分割前の多角形の「輪郭の辺」を三角形ごとの頂点属性として geometry に持たせる基盤と、OBJ からの多角形読み取りを作る。

## 前提
- OBJLoader は `f` 行を先頭頂点からの扇状分割で三角形にし、その三角形を **file 順に連続して** 非インデックスの position 属性へ積む。node_modules/three/examples/jsm/loaders/OBJLoader.js:640-653(頂点数 n の面 → n-2 個の三角形。n < 3 なら三角形 0 個で何も積まない)
- OBJLoader は各行の先頭空白を除いてから先頭1文字で分岐する。`#` はコメント。OBJLoader.js:560-575 付近(`lines[i].trimStart()`)
- オブジェクトの区切りは、先頭文字が `v` `f` `l` `p` のいずれでもない行が `/^[og]\s*(.+)?/` に一致したとき(OBJLoader.js:20, 687-697)。ただし最初の `o`/`g` は暗黙の先頭オブジェクトの名前を変えるだけで新しいオブジェクトは作らない。OBJLoader.js:52-60
- `l` 行はそのオブジェクトの geometry.type を `'Line'`(OBJLoader.js:408)、`p` 行は `'Points'`(OBJLoader.js:391)にし、以後 `f` 行が来ても戻らない
- 出力時、頂点を1つも持たないオブジェクトは飛ばされる(OBJLoader.js:785 `if ( geometry.vertices.length === 0 ) continue;`)。type が `'Line'` なら LineSegments、`'Points'` なら Points、それ以外は Mesh になり、file 順に `container.add(mesh)` される。OBJLoader.js:780-919
- `OBJLoader.parse(data: string): Group`(node_modules/@types/three/examples/jsm/loaders/OBJLoader.d.ts:8)
- web の Summary の置き場と機械検証の規則: web/web_Summary.md:8-12、web/tests/summary-coverage.test.ts。新しい機能フォルダを作るので `web/src/features/polygon-edges/polygon-edges_Summary.md` を作り、`web/web_Summary.md` の一覧へ `src/features/polygon-edges/polygon-edges_Summary.md` を追記する
- ビューアの表示切替(mesh-display.ts)は本タスクでは触らない。属性の利用は別タスク(135)

## インターフェイス契約

```ts
// web/src/features/polygon-edges/polygon-edges.ts
import type { BufferGeometry } from "three";

/** 三角形の各頂点の重心座標。頂点 j に単位ベクトル e_j。itemSize 3、Float32BufferAttribute */
export const POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE = "polygonEdgeBarycentric";
/** 三角形ごとの輪郭フラグ。成分 j は「頂点 j の対辺(頂点 j+1 と j+2 を結ぶ辺)が多角形の輪郭なら 1、内側の対角線なら 0」。
 *  同じ三角形の 3 頂点に同じ値を入れる。itemSize 3、Float32BufferAttribute */
export const POLYGON_EDGE_MASK_ATTRIBUTE = "polygonEdgeMask";

/** 両属性が揃っていれば true */
export function hasPolygonEdges(geometry: BufferGeometry): boolean;

/**
 * geometry の三角形を file 順の多角形へ対応づけ、両属性を付ける。
 * polygonSizes[p] は p 番目の多角形の頂点数で、その多角形は連続する polygonSizes[p]-2 個の三角形を占める。
 * 付けられない場合は geometry を変更せず false を返す(振る舞い表を参照)。
 */
export function applyPolygonEdges(geometry: BufferGeometry, polygonSizes: readonly number[]): boolean;
```

輪郭の判定: 同じ多角形に属する三角形どうしで共有している辺は内側(対角線)、それ以外は輪郭。
辺の同一性は、position 属性の値(x, y, z の3つの Float32 値)が両端で一致するかで判定する
(非インデックス geometry では同じ点が頂点ごとに複製されており、同じ多角形内なら同じ元頂点は同じ値を持つ)。

```ts
// web/src/features/polygon-edges/obj-polygons.ts
/**
 * OBJ テキストから、OBJLoader が Mesh として出力するオブジェクトごとに、面(f 行)の頂点数を file 順で返す。
 * 返り値の並びは OBJLoader.parse(text).children のうち Mesh であるものの並びと一致する。
 */
export function readObjPolygonSizes(text: string): number[][];
```

```ts
// web/src/features/polygon-edges/polygon-edge-loaders.ts
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { Group } from "three";

/** OBJLoader の出力 Mesh へ多角形の輪郭辺の属性を付けるローダー */
export class PolygonEdgeOBJLoader extends OBJLoader {
  parse(data: string): Group;
}
```
`parse` は `super.parse(data)` の結果の `children` から `Mesh` インスタンスだけを順に取り出し、`readObjPolygonSizes(data)` の結果と同じ長さなら
i 番目どうしを `applyPolygonEdges(mesh.geometry, sizes[i])` で結びつける。長さが違えば何も付けない。
`readObjPolygonSizes` が例外を投げた場合は捕捉して何も付けず、`super.parse` の結果をそのまま返す。

## 振る舞い

### applyPolygonEdges
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 四角形1枚(頂点数 [4])を三角形2枚(6頂点)に分割した非インデックス geometry | true。mask は各三角形で共有辺の成分だけ 0、他は 1。barycentric は頂点 0,1,2 に (1,0,0),(0,1,0),(0,0,1) |
| 三角形1枚(頂点数 [3]) | true。mask は (1,1,1) |
| 五角形1枚(頂点数 [5])を扇状分割した 3 三角形 | true。扇の内側 2 辺だけ 0 |
| 四角形と三角形が続く([4, 3]、合計 9 頂点) | true。前 6 頂点は四角形、後 3 頂点は三角形として判定される |
| 頂点数の合計 Σ 3·(n-2) が position.count と一致しない | false。属性は付かない |
| polygonSizes に 3 未満の値がある | false |
| polygonSizes が空 | false |
| インデックス付き geometry(`geometry.index !== null`) | false |
| position 属性がない | false |
| 既に両属性が付いている geometry に再度呼ぶ | true。属性は作り直さない(同じ属性オブジェクトのまま) |
| hasPolygonEdges | 両属性があるときだけ true。片方だけなら false |

### readObjPolygonSizes
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `o` 宣言なしで `f` 行が 2 本(四角形と三角形) | `[[4, 3]]` |
| `o a` の後に四角形 2 面、`o b` の後に三角形 1 面 | `[[4, 4], [3]]` |
| 先頭に `o a`(暗黙オブジェクトの改名)の後、面が続く | 1 要素だけ返る(空の先頭要素を作らない) |
| `f` を持たない `o`(または `g`)がある | その要素は返さない |
| `l` 行(または `p` 行)を含むオブジェクト。`f` 行が混在していても | その要素は返さない(OBJLoader は LineSegments / Points にする) |
| `f 1/1/1 2/2/2 3/3/3 4/4/4` のような複合インデックス | 頂点数 4 と数える |
| 頂点が 2 個以下の `f` 行 | 数えない(OBJLoader も三角形を作らない) |
| 行頭の空白、`#` コメント、`usemtl` / `mtllib` / `s` 行 | 区切りに影響しない |
| `g` 行(名前なしを含む) | `o` と同じ区切り |
| 面行の頂点数を 4 と数える判定は空白区切りのトークン数 | `f  1 2 3 4 `(空白多め)でも 4 |

### PolygonEdgeOBJLoader
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 四角形 1 面のキューブ状 OBJ(6 面すべて四角形) | 出力 Mesh の geometry に両属性が付き、`hasPolygonEdges` が true。各三角形の mask は成分 1 つだけ 0 |
| `l` 行を含むオブジェクトと Mesh が混在 | Mesh の数と読み取り結果の長さが一致するので Mesh には属性が付く |
| Mesh の数と読み取り結果の長さが一致しない状況(readObjPolygonSizes をモックして長さを変える) | どの Mesh にも属性が付かず、`super.parse` の結果は返る |
| 通常の OBJLoader と同じ入力 | Mesh の数・名前・position は OBJLoader と同じ(属性が増えるだけ) |

## やらないこと
- FBX の読み取り(`PolygonEdgeFBXLoader`)は 134 で同じ `polygon-edge-loaders.ts` に足す。ここでは作らない
- ビューアの結線(ModelMesh.tsx、mesh-display.ts)と描画用マテリアルは 135。ここでは触らない
- 頂点位置の一致以外の方法(トポロジー推定・法線判定)での輪郭判定はしない
- glTF は扱わない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] polygon-edges_Summary.md が作成され、web/web_Summary.md から索引されている(summary-coverage.test.ts が通る)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
