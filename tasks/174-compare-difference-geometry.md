---
id: 174
title: 符号付き距離としきい値から差分パッチ(飛び出し・へこみ)の geometry を切り出す純粋関数を作る
feature: compare
depends_on: []
owns: [web/src/features/compare/triangle-clip.ts, web/src/features/compare/difference-geometry.ts, web/tests/compare-triangle-clip.test.ts, web/tests/compare-difference-geometry.test.ts, web/src/features/compare/compare_Summary.md]
reads: [web/src/features/compare/deviation.ts, web/src/features/compare/overlay-geometry.ts, web/tests/compare-overlay.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
比較の差分(基準面からしきい値以上離れた対象表面)を、シェーダの画素判定ではなく
実データの三角形として持てるようにする。対象 geometry と頂点ごとの符号付き距離から、
しきい値の等値線で三角形を切り、飛び出し側・へこみ側のパッチだけを含む新しい geometry を作る。
これを描く Mesh と Rig への結線は 175 が行う。本タスクは純粋関数とそのテストだけを作る。

## 前提
- 対象 Mesh の頂点ごとの符号付き距離は `computeDeviation`(`web/src/features/compare/deviation.ts:110-147`)が
  `MeshDeviation.signedDistance: Float32Array`(`mesh.geometry` の position の count と同じ長さ、ワールド単位)で返す。
  正が飛び出し、負がへこみ。基準面に最近点が無い頂点は `Infinity`、距離 0 は `0` が入る
- 現在の重ね描きは `writeCompareDistance`(`overlay-geometry.ts:30-43`)で非有限値と配列長を超えた添字を 0 として扱っている。
  本タスクも同じ規則にする
- 対象 geometry は glTF / FBX / OBJ 由来で、index 付きも index 無しもある。SkinnedMesh の geometry は
  `skinIndex`・`skinWeight`(itemSize 4)を持ち、モーフ付きは `morphAttributes.position` と `morphTargetsRelative` を持つ
  (`web/tests/compare-overlay.test.ts:32-45` の `skinnedMesh()` がテスト用の作り方の例)
- three は 0.186。`BufferGeometry.addGroup(start, count, materialIndex)`、`computeVertexNormals()`、
  `Float32BufferAttribute(array | count, itemSize)` を使う
- `web/tests/summary-coverage.test.ts` は src 配下の各ファイルの相対パスと tests 配下の各テストファイル名が
  `compare_Summary.md` に載っていることを検査する。**本タスクで src 2 本・tests 2 本が増える**ので Summary に必ず載せる
- vitest の環境は jsdom(`web/vitest.config.ts`)。three の geometry は WebGL なしで作れる

## インターフェイス契約

### `web/src/features/compare/triangle-clip.ts`(新規)

```ts
/** 三角形内のローカル頂点番号 */
export type Corner = 0 | 1 | 2;

/**
 * 切り出した三角形の頂点。辺 from→to 上の位置 t(0 ≤ t < 1)。
 * 元の頂点そのものは from === to かつ t === 0 で表す。
 * 切断点は from が「threshold 以上」側、to が「threshold 未満」側の頂点になる。
 */
export interface ClipVertex {
  from: Corner;
  to: Corner;
  t: number;
}

/** ClipVertex 3 つ。元の三角形と同じ巻き順(向き)を保つ */
export type ClipTriangle = readonly [ClipVertex, ClipVertex, ClipVertex];

/**
 * 三角形の 3 頂点の値 values について、値が threshold 以上(等しい場合を含む)の領域を
 * 三角形 0〜2 個に分割して返す。切断点の t は (threshold - values[from]) / (values[to] - values[from])。
 * values は有限値であることを呼び出し側が保証する(この関数では検査しない)。
 *
 * 場合分け(k = 該当する頂点番号、next = (k + 1) % 3、prev = (k + 2) % 3、
 * E(a, b) = { from: a, to: b, t } の切断点、V(a) = { from: a, to: a, t: 0 } の元頂点):
 * - 3 頂点とも以上   → [[V(0), V(1), V(2)]]
 * - 0 頂点が以上     → []
 * - 1 頂点 k だけ以上 → [[V(k), E(k, next), E(k, prev)]]
 * - 2 頂点が以上(k と next が以上、prev が未満)
 *                     → [[V(k), V(next), E(next, prev)], [V(k), E(next, prev), E(k, prev)]]
 */
export function clipTriangleAtOrAbove(
  values: readonly [number, number, number],
  threshold: number,
): ClipTriangle[];
```

### `web/src/features/compare/difference-geometry.ts`(新規)

```ts
import type { BufferGeometry } from "three";

/** 飛び出し(距離 ≥ threshold)三角形の group の materialIndex */
export const DIFFERENCE_OUTSIDE_MATERIAL = 0;
/** へこみ(距離 ≤ -threshold)三角形の group の materialIndex */
export const DIFFERENCE_INSIDE_MATERIAL = 1;

/**
 * source から、頂点の符号付き距離が threshold 以上(飛び出し)または -threshold 以下(へこみ)の
 * 領域だけを切り出した、index 無しの新しい geometry を作る。source は変更しない。
 *
 * - source の全三角形を index の順(index 無しなら position の 3 頂点ずつ)に走査する。drawRange と groups は無視する
 * - 各三角形について、まず clipTriangleAtOrAbove(距離, threshold) で飛び出し側、
 *   次に clipTriangleAtOrAbove(距離の符号反転, threshold) でへこみ側を切り出す
 * - 出力の三角形は「飛び出し側を source の三角形順に全部」→「へこみ側を source の三角形順に全部」の順に並べる。
 *   各三角形内の頂点順は clipTriangleAtOrAbove の返り値の順のまま
 * - groups は必ず 2 つ、この順で追加する(count が 0 でも追加する):
 *   addGroup(0, 飛び出し頂点数, DIFFERENCE_OUTSIDE_MATERIAL)、
 *   addGroup(飛び出し頂点数, へこみ頂点数, DIFFERENCE_INSIDE_MATERIAL)
 * - 出力属性(すべて Float32BufferAttribute、source と配列を共有しない):
 *   - position(3): 切断点は辺上を線形補間 p = from + (to - from) * t
 *   - normal(3): source に normal があれば線形補間して正規化。無ければ全頂点を書き終えてから computeVertexNormals() で作る
 *   - skinIndex(4)・skinWeight(4): source に両方あるときだけ出力。切断点は t < 0.5 なら from、それ以外は to の値をそのまま写す
 *   - morphAttributes.position: source にあれば同じ本数を出力(各 itemSize 3、線形補間)。morphTargetsRelative を写す。
 *     source の morphAttributes.normal やその他の属性(uv、color、tangent 等)は出力しない
 * - signedDistance の非有限値、および position.count 以上の添字で参照できない頂点の距離は 0 とみなす
 * - source に position が無いか三角形が 0 個なら、頂点 0 個・group 2 つ(count 0)の geometry を返す
 */
export function buildDifferenceGeometry(
  source: BufferGeometry,
  signedDistance: ArrayLike<number>,
  threshold: number,
): BufferGeometry;
```

## 振る舞い

### triangle-clip.ts(`web/tests/compare-triangle-clip.test.ts`)

`V(a)` = `{ from: a, to: a, t: 0 }`、`E(a, b, t)` = `{ from: a, to: b, t }`。`toEqual` で比較する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `clipTriangleAtOrAbove([1, 1, 1], 0.5)` | `[[V(0), V(1), V(2)]]` |
| `clipTriangleAtOrAbove([1, 1, 1], 1)`(全部ちょうど等しい) | `[[V(0), V(1), V(2)]]`(等しい場合は「以上」) |
| `clipTriangleAtOrAbove([0, 0, 0], 0.5)` | `[]` |
| `clipTriangleAtOrAbove([1, 0, 0], 0.5)` | `[[V(0), E(0, 1, 0.5), E(0, 2, 0.5)]]` |
| `clipTriangleAtOrAbove([0, 1, 0], 0.5)` | `[[V(1), E(1, 2, 0.5), E(1, 0, 0.5)]]` |
| `clipTriangleAtOrAbove([0, 0, 1], 0.25)` | `[[V(2), E(2, 0, 0.75), E(2, 1, 0.75)]]`(t = (0.25 − 1) / (0 − 1) = 0.75) |
| `clipTriangleAtOrAbove([1, 1, 0], 0.5)` | `[[V(0), V(1), E(1, 2, 0.5)], [V(0), E(1, 2, 0.5), E(0, 2, 0.5)]]` |
| `clipTriangleAtOrAbove([0, 1, 1], 0.25)` | `[[V(1), V(2), E(2, 0, 0.75)], [V(1), E(2, 0, 0.75), E(1, 0, 0.75)]]` |
| `clipTriangleAtOrAbove([1, 0, 1], 0.5)` | `[[V(2), V(0), E(0, 1, 0.5)], [V(2), E(0, 1, 0.5), E(2, 1, 0.5)]]`(k = 2、next = 0、prev = 1) |
| `clipTriangleAtOrAbove([2, 0, 0], 2)`(1 頂点がちょうど等しい) | `[[V(0), E(0, 1, 0), E(0, 2, 0)]]`(退化三角形だが除外しない) |
| `clipTriangleAtOrAbove([3, -1, -1], 1)` | `[[V(0), E(0, 1, 0.5), E(0, 2, 0.5)]]`(t = (1 − 3) / (−1 − 3) = 0.5) |
| 返り値の各 t | すべて `0 <= t && t < 1` |

### difference-geometry.ts(`web/tests/compare-difference-geometry.test.ts`)

`tri()` = position `(0,0,0), (1,0,0), (0,1,0)` の index 無し geometry(normal なし)。
`box()` = `new BoxGeometry()`(index 付き、頂点 24、三角形 12、normal あり)。
`groups(g)` = `g.groups.map(({ start, count, materialIndex }) => [start, count, materialIndex])`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `buildDifferenceGeometry(box(), new Float32Array(24).fill(1), 0.5)` | `index === null`、position の count 36、`groups` は `[[0, 36, 0], [36, 0, 1]]`。position の 36 頂点は元の index 順に展開した頂点と一致し、normal も元の normal を展開したものと一致する |
| `buildDifferenceGeometry(box(), new Float32Array(24).fill(-1), 0.5)` | position の count 36、`groups` は `[[0, 0, 0], [0, 36, 1]]` |
| `buildDifferenceGeometry(box(), new Float32Array(24), 0.5)`(全部 0) | position の count 0、`groups` は `[[0, 0, 0], [0, 0, 1]]` |
| `buildDifferenceGeometry(box(), new Float32Array(24).fill(1), 1)`(ちょうど等しい) | position の count 36、`groups[0]` は `[0, 36, 0]` |
| `buildDifferenceGeometry(tri(), [1, 0, 0], 0.5)` | position の count 3、頂点が順に `(0,0,0), (0.5,0,0), (0,0.5,0)`、normal が 3 頂点とも `(0,0,1)`(computeVertexNormals による)、`groups` は `[[0, 3, 0], [3, 0, 1]]` |
| `buildDifferenceGeometry(tri(), [1, 1, 0], 0.5)` | position の count 6、頂点が順に `(0,0,0), (1,0,0), (0.5,0.5,0), (0,0,0), (0.5,0.5,0), (0,0.5,0)` |
| `buildDifferenceGeometry(tri(), [1, -1, 0], 0.5)` | position の count 6。飛び出し側 `(0,0,0), (0.25,0,0), (0,0.5,0)`、へこみ側 `(1,0,0), (0.5,0.5,0), (0.75,0,0)`。`groups` は `[[0, 3, 0], [3, 3, 1]]` |
| `buildDifferenceGeometry(tri(), [Infinity, 1, 1], 0.5)` | Infinity を 0 とみなし、頂点 1・2 だけが以上 → position の count 6、`groups[0]` は `[0, 6, 0]` |
| `buildDifferenceGeometry(tri(), [NaN, NaN, NaN], 0.5)` | position の count 0 |
| `buildDifferenceGeometry(tri(), [1], 0.5)`(配列が短い) | 添字 1・2 は 0 とみなし `[1, 0, 0]` と同じ結果(count 3) |
| `tri()` に normal `(1,0,0), (0,1,0), (0,0,1)` を付けて `[1, 0, 0]`、しきい値 0.5 | 出力 normal が順に `(1,0,0)`、`normalize(0.5,0.5,0)` ≒ `(0.7071,0.7071,0)`、`normalize(0.5,0,0.5)` ≒ `(0.7071,0,0.7071)`(`toBeCloseTo` 4 桁) |
| `tri()` に skinIndex `[0,0,0,0],[1,0,0,0],[2,0,0,0]` と skinWeight `[1,0,0,0]` ×3 を付けて `[1, 0, 0]`、しきい値 0.25 | 切断点の t は (0.25 − 1) / (0 − 1) = 0.75 ≥ 0.5 なので to 側を写す → 出力 skinIndex の x が順に `0, 1, 2`。skinIndex・skinWeight の itemSize は 4 |
| 同じ skinned な `tri()` で `[1, 0, 0]`、しきい値 0.75 | t = 0.25 < 0.5 なので from 側 → 出力 skinIndex の x が順に `0, 0, 0` |
| skinIndex だけあって skinWeight が無い `tri()` | 出力に skinIndex も skinWeight も無い |
| `tri()` に `morphAttributes.position = [(0,0,1),(0,0,1),(0,0,1) の属性]`、`morphTargetsRelative = true` を付けて `[1, 0, 0]`、しきい値 0.5 | 出力の `morphAttributes.position` の長さ 1、count 3、値は全頂点 `(0,0,1)`、`morphTargetsRelative === true`。`morphAttributes.normal` は無い |
| `box()` に `morphAttributes.position = [position.clone()]` を付けて全部 1、しきい値 0.5 | 出力 morph 属性の count 36 で、出力 position と同じ値 |
| 出力 geometry の `position.array` | source の `position.array` と同一参照ではない。`buildDifferenceGeometry` 後も source の position の count・値は変わらない |
| `tri()` に uv を付けても | 出力に uv は無い |
| position の無い `new BufferGeometry()` | position の count 0(属性は存在する)、`groups` は `[[0, 0, 0], [0, 0, 1]]` |
| `buildDifferenceGeometry(box(), new Float32Array(24).fill(1), 0.5)` の全属性 | `position`・`normal` は `Float32BufferAttribute`、itemSize 3・3 |

## やらないこと
- 差分 Mesh の作成、材質、`MeshCompareRig.tsx` の結線、既存 `overlay*.ts` の削除。すべて 175 の担当
- `deviation.ts`、`overlay-geometry.ts`、`overlay-material.ts`、`overlay.ts` の変更
- 退化三角形(面積 0)や重複頂点の除去、index 化(頂点共有)。出力は常に index 無しでよい
- 切断点のスキンウェイトの補間(端点の値を写すだけでよい)
- Worker 化や非同期化

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `compare_Summary.md` の「ファイル一覧と役割」に `triangle-clip.ts` と `difference-geometry.ts`、
      「公開インターフェイス」に `Corner`、`ClipVertex`、`ClipTriangle`、`clipTriangleAtOrAbove`、
      `DIFFERENCE_OUTSIDE_MATERIAL`、`DIFFERENCE_INSIDE_MATERIAL`、`buildDifferenceGeometry`、
      「テスト」に `tests/compare-triangle-clip.test.ts` と `tests/compare-difference-geometry.test.ts` を追記している
- [ ] すべてのファイルが300行以内(`difference-geometry.ts` は属性ごとの補間を小さな関数に分けて収める)
- [ ] verify: に書いたコマンドが成功する
