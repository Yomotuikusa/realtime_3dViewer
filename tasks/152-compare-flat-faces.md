---
id: 152
title: メッシュ比較の重ね描きを三角形単位の平坦な色にし、しきい値 0 の誤差下限を設ける
feature: compare
depends_on: []
owns: [web/src/features/compare/overlay-geometry.ts, web/src/features/compare/overlay.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/compare-overlay.test.ts, web/tests/compare-overlay-color.test.ts, web/tests/compare-overlay-faces.test.ts, web/tests/compare-rig.test.ts]
reads: [web/src/features/compare/deviation.ts, web/src/features/compare/model-scenes.ts, web/src/features/viewer/mesh-display.ts, web/src/features/theme/viewer-colors.ts, web/tests/compare-deviation.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
比較の重ね描きは頂点ごとの RGBA を GPU が三角形内部で線形補間するため、赤(α0.85)と
透明黒(0,0,0,0)の間が暗い赤〜茶に、赤と青が隣接する三角形が紫に見える。
重ね描き geometry を index なし(三角形ごとに独立した 3 頂点)へ展開し、
三角形単位で 1 色だけを塗ることで混色をなくす。
あわせて、しきい値 0(151 で許可される)のときに浮動小数の誤差(実測で基準サイズの
3e-8 倍程度)が赤青のノイズにならないよう、ワールド単位への換算に下限を設ける。

## 前提
- 距離の計算は `web/src/features/compare/deviation.ts` の `computeDeviation(target, base)` で、
  結果 `MeshDeviation.signedDistance` は**元 geometry の頂点番号**ごとの `Float32Array`。
  **このタスクでは deviation.ts を変更しない**
- 現在の `createCompareOverlayGeometry`(`overlay.ts:36-52`)は元 geometry の
  `position` / `skinIndex` / `skinWeight` / `index` / `morphAttributes.position` を**同じ参照で共有**し、
  `color`(itemSize 4)だけを所有する。このタスクでこれを「index 展開したコピー」へ変える
- `createCompareOverlay`(`overlay.ts:65`)は `createCompareOverlayGeometry` を呼んで
  Mesh / SkinnedMesh を作る。SkinnedMesh の `bind` と morph の共有はそのまま使えるので変えない
- `colorizeDeviation`(`overlay.ts:89-111`)は今は頂点単位で
  `distance >= threshold` → outside、`distance <= -threshold` → inside、
  非有限・0 はスキップ、先頭で全頂点を 0 クリア、末尾で `needsUpdate = true`
- `disposeCompareOverlay`(`overlay.ts:132`)は `color` 以外の属性を `deleteAttribute` してから
  `dispose` する。展開したコピーでも共有した参照でも、この処理はそのままで安全
- three 0.186 の `BufferAttribute` / `InterleavedBufferAttribute` はどちらも
  `getComponent(index, component)` を持つ。`index.array` は `Uint16Array | Uint32Array`
- three の `BoxGeometry(1, 1, 1)` は頂点 24、index 36(12 面)。index の先頭 2 面は
  `(0, 2, 1)` と `(2, 3, 1)`。振る舞い表の期待値はこれで検算してある
- `thresholdWorld`(`MeshCompareRig.tsx:12-14`)は `baseSize * permille / 1000`。
  `web/tests/compare-rig.test.ts:18-20` が `(2,5) → 0.01`、`(10,50) → 0.5`、`(0,5) → 0` を検査しており、
  **下限を足しても 3 つとも同じ値になる**(下限 `baseSize * 1e-6` はどれより小さいか 0)
- OBJ / FBX 由来の geometry は index を持たないことがある。index が無ければ元から三角形ごとに
  独立した頂点なので、展開せず元の属性を共有してよい
- 既存テストのうち、頂点番号で色を検査している箇所は面単位へ書き換える必要がある。
  `web/tests/compare-overlay.test.ts` は現在 226 行で上限に近いので、**既存の検査の書き換えだけ**を行い、
  展開と面色の新しい検査は owns に用意した `web/tests/compare-overlay-faces.test.ts` へ書く
  - `compare-overlay.test.ts:66-67`: `position` / `index` の同一参照検査 → 展開後の検査へ
  - `compare-overlay.test.ts:88-90`: `skinIndex` / `skinWeight` / `morphAttributes.position` の同一参照検査 → 展開後の検査へ
  - `compare-overlay.test.ts:130-154`: `colorizes finite distances and clears stale colors` → 面単位へ
  - `compare-overlay.test.ts:156-162`: `limits coloring to the shorter of the two arrays` → 面単位へ
  - `compare-overlay.test.ts:179`: `rgba(first.geometry, 0)` は展開後も頂点 0 が透明なのでそのまま通る
  - `compare-overlay-color.test.ts:44-54, 56-62, 64-76`: 頂点番号を展開後の頂点番号へ
  - `compare-overlay-color.test.ts:78-86` と `compare-rig.test.ts:23-43` のソース文字列検査は**そのまま残して通す**
- `web/tests/summary-coverage.test.ts` は `web/tests/*.test.ts` が最寄りの Summary の `## テスト` に
  載っていることを機械検証する。新しいテストファイルは `compare_Summary.md` に追記する

## インターフェイス契約

### `web/src/features/compare/overlay-geometry.ts`(新規)

```ts
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, InterleavedBufferAttribute, Mesh } from "three";

/** 展開元 index の配列を持つ geometry.userData のキー。値は index.array。元 geometry に index が無ければ未設定 */
export const COMPARE_SOURCE_INDEX_KEY = "meshCompareSourceIndex";

/** attribute を index の順に並べ直した新しい属性を返す。count === index.count、itemSize は同じ */
export function expandByIndex(
  attribute: BufferAttribute | InterleavedBufferAttribute,
  index: BufferAttribute,
): Float32BufferAttribute;

/** 重ね描きの頂点番号 → 元 geometry の頂点番号の対応表。展開していなければ null(恒等) */
export function compareSourceIndex(geometry: BufferGeometry): ArrayLike<number> | null;

/** 比較重ね描き専用の、index を持たない geometry を作る。 */
export function createCompareOverlayGeometry(mesh: Mesh): BufferGeometry;
```

`createCompareOverlayGeometry` の手順:
1. `source = mesh.geometry`、`index = source.getIndex()`
2. `"position"` / `"skinIndex"` / `"skinWeight"` のそれぞれについて、元にあれば
   `index` があるとき `expandByIndex(attribute, index)`、無いとき元の属性をそのまま `setAttribute`
3. `source.morphAttributes.position` があれば、`index` があるとき各要素を `expandByIndex` した新しい配列、
   無いとき同じ配列参照を `geometry.morphAttributes.position` に入れる
4. `geometry.morphTargetsRelative = source.morphTargetsRelative`
5. `color` は `new Float32BufferAttribute(count * 4, 4)`。`count` は手順 2 で入れた `position` の `count`
   (position が無ければ 0)
6. `index` があるとき `geometry.userData[COMPARE_SOURCE_INDEX_KEY] = index.array`
7. `setIndex` は呼ばない。`boundingBox` / `boundingSphere` は今までどおり元の参照を入れる

### `web/src/features/compare/overlay.ts`

```ts
export { COMPARE_SOURCE_INDEX_KEY, compareSourceIndex, createCompareOverlayGeometry, expandByIndex } from "./overlay-geometry";

/** 符号付き距離に応じて color 属性を三角形単位で書き直す。 */
export function colorizeDeviation(
  geometry: BufferGeometry,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
): void;
```

`colorizeDeviation` の手順(`color` 属性なし / `itemSize !== 4` の早期 return、
`outsideColor.setHex` / `insideColor.setHex`、全頂点の 0 クリア、末尾の `needsUpdate = true` は変えない):
1. `sourceIndex = compareSourceIndex(geometry)`、`faceCount = Math.floor(color.count / 3)`
2. 各面 `face` について、頂点 `v = face * 3 + corner`(corner 0..2)の元頂点番号
   `s = sourceIndex ? sourceIndex[v] : v` を求める。`s >= signedDistance.length` の頂点は無視する
3. `d = signedDistance[s]` が非有限なら無視する。有限な `d` のうち `Math.abs(d)` が
   **それまでの最大より真に大きい**ものを代表 `best` とする(初期値 0。同点は先の頂点が勝つ)
4. `best === 0` なら透明のまま。`best >= threshold` なら 3 頂点とも outside 色、
   `best <= -threshold` なら 3 頂点とも inside 色。alpha は `COMPARE_OVERLAY_OPACITY`

`applyCompareOverlay` / `createCompareOverlay` / `createCompareOverlayMaterial` /
`clearCompareOverlays` / `isMeshCompareOverlay` / 各定数のシグネチャと振る舞いは変えない。

### `web/src/features/compare/MeshCompareRig.tsx`

```ts
/** しきい値 0 のときにも計算誤差を着色しないための下限。基準サイズに対する比 */
export const ZERO_THRESHOLD_RATIO = 1e-6;

/** 千分率のしきい値をワールド単位へ換算する。max(baseSize * permille / 1000, baseSize * ZERO_THRESHOLD_RATIO) */
export function thresholdWorld(baseSize: number, thresholdPermille: number): number;
```

`MeshCompareRig` 本体(2 つの `useEffect` とその依存配列、ストア購読)は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `expandByIndex(position(count 4, itemSize 3), index [0,2,1, 2,3,1])` | `count === 6`、`itemSize === 3`、頂点 1 の xyz が元の頂点 2 と等しい、元の属性と別インスタンス |
| `expandByIndex(itemSize 4 の属性, index)` | `itemSize === 4` のまま展開される |
| `createCompareOverlayGeometry(BoxGeometry の Mesh)` | `getIndex() === null`、`position.count === 36`、`position` が元と別インスタンス、`color.count === 36`、`color.itemSize === 4`、全成分 0、`normal` / `uv` なし、`compareSourceIndex(geometry) === source.getIndex().array` |
| 同上 | 元 geometry の `position` / `index` は変わらず、元に `color` は付かない(既存検査) |
| index を持たない Mesh(`BoxGeometry().toNonIndexed()`) | `position` が元の属性と**同じ参照**、`compareSourceIndex(geometry) === null`、`color.count === 36` |
| SkinnedMesh(index あり、skinIndex / skinWeight / morphAttributes.position あり) | `skinIndex.count` / `skinWeight.count` / `morphAttributes.position[0].count` が 36 で元と別インスタンス、`morphTargetsRelative` は元と同じ、`createCompareOverlay` の結果が SkinnedMesh で `skeleton` / `bindMatrix` / `morphTargetInfluences` を共有(既存検査) |
| position が無い geometry の Mesh | `color.count === 0`、例外なし |
| `colorizeDeviation(box, [1, -1, 0, 0.1], 0.5, { outside: 0xff0000, inside: 0x00ff00 })` | 面 0 `(0,2,1)` の代表は 1 → 頂点 0,1,2 が `[1,0,0,0.85]`。面 1 `(2,3,1)` の代表は -1 → 頂点 3,4,5 が `[0,1,0,0.85]`。頂点 6 以降は `[0,0,0,0]` |
| `colorizeDeviation(box, [0.05, -0.05, 0, 0], 0.1, colors)` | 全頂点 `[0,0,0,0]`(範囲内) |
| `colorizeDeviation(box, [0.3, -0.3, 0, 0], 0.1, colors)` | 面 0 の代表は 0.3(同点は先の頂点)→ outside。面 1 は -0.3 → inside |
| `colorizeDeviation(box, [NaN, 0.2, Infinity, -Infinity], 0.1, colors)` | 面 0 `(0,2,1)` は 0.2 だけ有限 → outside。面 1 `(2,3,1)` は 0.2 だけ有限 → outside |
| `colorizeDeviation(box, [NaN, NaN, NaN, NaN], 0.1, colors)` | 全頂点 `[0,0,0,0]` |
| `colorizeDeviation(box, [0.2, -0.2, 0, 0], 0, colors)` | 面 0 → outside、面 1 → inside(しきい値 0 は 0 以外を着色) |
| `colorizeDeviation(box, [0, 0, 0, 0], 0, colors)` | 全頂点 `[0,0,0,0]` |
| `colorizeDeviation(box, new Float32Array([1]), 0, colors)` | 例外なし。元頂点 0 を含む面 0, 1 が outside、他は透明(範囲外の元頂点は無視) |
| `colorizeDeviation(box, new Float32Array(100).fill(-1), 0, colors)` | 例外なし。全面 inside |
| index なし geometry へ `colorizeDeviation(g, d, t, colors)` | 頂点 `v` の元頂点番号は `v` 自身として面が塗られる |
| 色を変えて 2 回 `colorizeDeviation` | 2 回目の色になる(既存検査) |
| `color` 属性なし / `itemSize !== 4` | 何もしない(既存どおり) |
| 塗り直し後の `color.version` | 増える(既存どおり) |
| `applyCompareOverlay` を同じ mesh へ 2 回 | 同じ overlay を再利用し、重ね描きは 1 つ(既存検査) |
| `clearCompareOverlays` | 材質と geometry の dispose、`position` / `skinIndex` の deleteAttribute、元 geometry は無傷(既存検査) |
| `thresholdWorld(2, 5)` / `(10, 50)` / `(0, 5)` | `0.01` / `0.5` / `0`(既存検査そのまま) |
| `thresholdWorld(2, 0)` | `2e-6`(`toBeCloseTo(2e-6, 12)`) |
| `thresholdWorld(1000, 0)` | `1e-3`(`toBeCloseTo(0.001, 12)`) |
| `thresholdWorld(1000, 1)` | `1`(下限 `1e-3` より大きい側が勝つ) |
| `ZERO_THRESHOLD_RATIO` | `1e-6` |
| `MeshCompareRig.tsx` のソース | `}, [base, target]);` と `}, [result, compare.thresholdPermille, outsideColor, insideColor]);` を含む(既存検査) |

## やらないこと
- `deviation.ts` / `model-scenes.ts` の変更。距離は元頂点ごとのまま
- `createCompareOverlayMaterial` の設定変更(`vertexColors` / `transparent` / `depthWrite` / `toneMapped` / `renderOrder = -1`)。
  シェーダの `flat` 補間や `onBeforeCompile` は使わない
- `COMPARE_OVERLAY_OPACITY` の変更
- しきい値の下限定数(151 の `MIN_COMPARE_THRESHOLD_PERMILLE`)や `shared/` / `server/` の変更
- 既存テストの `expect` の削除・緩和。頂点番号の検査は展開後の番号へ**更新**し、ソース文字列検査は残す
- 面の色を「頂点の多数決」や「平均距離」で決めること。代表は |距離| 最大の 1 頂点

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `compare_Summary.md` の「ファイル一覧と役割」に `overlay-geometry.ts` を足し、
      「公開インターフェイス」に `COMPARE_SOURCE_INDEX_KEY` / `expandByIndex` / `compareSourceIndex` /
      `ZERO_THRESHOLD_RATIO` を足し、「他フォルダとの関係」の「色属性だけを所有して」を
      「index 展開したコピーを所有し三角形単位で塗る」に改め、`## テスト` に
      `tests/compare-overlay-faces.test.ts` を追記している
- [ ] すべてのファイルが300行以内(`overlay.ts` は現在 155 行で geometry 生成を移すので減る、
      `compare-overlay.test.ts` は 226 行なので新しい検査を足さない)
- [ ] verify: に書いたコマンドが成功する
