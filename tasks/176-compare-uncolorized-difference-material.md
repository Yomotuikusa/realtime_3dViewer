---
id: 176
title: 「差分を着色」が OFF のときも差分メッシュを対象本体の材質で描く
feature: compare
depends_on: []
owns: [web/src/features/compare/difference-mesh.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/compare-difference-mesh.test.ts, web/tests/compare-rig.test.ts]
reads: [web/src/features/compare/difference-material.ts, web/src/features/compare/difference-geometry.ts, web/src/features/compare/target-surface.ts, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/store/display.ts, web/src/features/objects/CompareControls.tsx, web/tests/compare-difference-material.test.ts, web/tests/compare-target-surface.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
現在は `colorized`(差分を着色)が false のあいだ差分 Mesh が `visible = false` になり、
`differencesOnly` も true だと画面に何も出ない。`colorized` を「差分を比較色で塗るか」だけの
スイッチにし、false のときは差分 Mesh を**対象本体の材質**で描いて、形は常に見えるようにする。

## 前提
- 差分 Mesh は対象 Mesh の子で、`createCompareDifference` が `createDifferenceMaterials()` の
  `[飛び出し用, へこみ用]` を材質に持つ(`web/src/features/compare/difference-mesh.ts:27-44`)。
  差分 geometry の group は `materialIndex` 0(飛び出し)と 1(へこみ)の 2 つ固定で、
  元 geometry の group は引き継がない(`difference-geometry.ts:176-179`)
- `applyCompareDifference(mesh, signedDistance, threshold, colors, options)` は現在
  `options.visible` を `difference.visible` に書くだけ(`difference-mesh.ts:63-85`)。
  呼び出し元は `MeshCompareRig.tsx:47` の `{ visible: colorized }` ただ 1 箇所
- `clearCompareDifferences` は `difference.material` を辿って dispose する
  (`difference-mesh.ts:87-92` の `disposeDifference`)
- `differencesOnly` は `setCompareSurfacesHidden` で対象本体の layer 0 を切り替えるだけで、
  `colorized` とは独立している(`MeshCompareRig.tsx:51-57`、`target-surface.ts`)。**この結線は変更しない**
- `applyMeshDisplay` は本体材質の `wireframe` / `polygonOffset` を**同じインスタンスのまま**書き換えるが、
  `mode === "wireframe"` かつ `hasPolygonEdges(geometry)` のときだけ `mesh.material` を
  別インスタンスへ差し替える(`web/src/features/viewer/mesh-display.ts:100-110, 152-154`)。
  差分 Mesh は `VIEWER_OVERLAY_KEY` を持つので `applyMeshDisplay` の走査からは除外される
- `ViewerCanvas.tsx` では `ModelMesh`(`useModelScene` が `applyMeshDisplay` を呼ぶ)が
  `MeshCompareRig` より前に置かれているので、同じ commit では本体材質の差し替えが先に走る
- `useDisplayStore` は `meshDisplay: MeshDisplayMode` を持つ(`web/src/store/display.ts:9`)
- `web/tests/compare-rig.test.ts:50` が `{ visible: colorized }` を、`:51` が色更新 effect の
  依存配列を文字列で検査している。`web/tests/compare-difference-mesh.test.ts:85-95` が
  `visible` の切り替えを検査している。どちらも本タスクで書き換える
- `web/tests/compare-difference-material.test.ts:55-61` も `MeshCompareRig.tsx` をソース検査するが、
  検査対象は `selectViewerColor` と `hexToNumber` の行だけで、本タスクが触る行には掛からない。
  **このファイルは変更しない**

## インターフェイス契約

`web/src/features/compare/difference-mesh.ts`

```ts
/** 差分 Mesh の見え方。 */
export interface CompareDifferenceOptions {
  /** 差分を比較色で着色するか。false なら対象本体の材質で描く。未指定は true */
  colorized?: boolean;
}

/** 比較色の材質 [飛び出し用, へこみ用] を覚える userData キー。 */
export const MESH_COMPARE_DIFFERENCE_MATERIALS_KEY = "meshCompareDifferenceMaterials";

/**
 * 着色しないときに差分 Mesh へ使う、対象本体の材質を 2 スロット分返す。
 * mesh.material が配列なら先頭を、単体ならそれ自身を複製せず同じインスタンスのまま 2 つ並べる。
 * 使える材質がないとき(空配列)は null。
 */
export function sourceDifferenceMaterials(mesh: Mesh): [Material, Material] | null;

/** 差分 Mesh を作成または再利用し、必要な geometry と材質を更新する。 */
export function applyCompareDifference(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
  options?: CompareDifferenceOptions,
): Mesh;
```

- `createCompareDifference` は従来どおり `createDifferenceMaterials()` の結果を
  `difference.material` に設定し、**同じ配列を `userData[MESH_COMPARE_DIFFERENCE_MATERIALS_KEY]` にも入れる**
- `applyCompareDifference` は geometry 更新のあと、毎回この順で行う:
  1. `setDifferenceColors(userData の比較色材質, colors)`(`colorized` の値に関わらず必ず)
  2. `difference.material` を下の表のとおり差し替える
  3. `difference.visible = true`
- `disposeDifference` は `difference.material` ではなく
  `userData[MESH_COMPARE_DIFFERENCE_MATERIALS_KEY]` の材質だけを dispose する
  (対象本体の材質を破棄しないため)。geometry の dispose は従来どおり
- 既存の private ヘルパ `differenceMaterials(mesh)` は userData 経由に置き換わるので削除してよい

`web/src/features/compare/MeshCompareRig.tsx`

```ts
const meshDisplay = useDisplayStore((state) => state.meshDisplay);
// ...
applyCompareDifference(mesh, signedDistance, threshold, colors, { colorized });
// 色更新 effect の依存配列:
// [result, compare.thresholdPermille, outsideColor, insideColor, colorized, meshDisplay]
```

`meshDisplay` は effect 内では使わない。本体材質のインスタンスが差し替わったときに
差分 Mesh の材質参照を張り直すためだけの依存である。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyCompareDifference(mesh, d, t, colors)`(options 未指定) | `difference.material` は userData の比較色材質 `[outside, inside]`、`visible === true` |
| `{ colorized: true }` | 同上 |
| `{ colorized: false }`、`mesh.material` が単体 `m` | `difference.material` が `[m, m]`(どちらも `m` と同一インスタンス、複製しない)、`visible === true` |
| `{ colorized: false }`、`mesh.material` が `[m0, m1]` | `difference.material` が `[m0, m0]` |
| `{ colorized: false }`、`mesh.material` が `[]` | 比較色材質のまま(`sourceDifferenceMaterials` は null) |
| `{ colorized: false }` のあと `{ colorized: true }` | 比較色材質に戻る。材質インスタンスは 1 回目と同一(作り直さない) |
| `{ colorized: false }` で `colors` を変えて呼ぶ | `difference.material` は本体材質のままだが、userData の比較色材質の色は新しい `colors` になっている。その後 `{ colorized: true }` にすると新しい色で描かれる |
| `{ colorized: false }` のあと `clearCompareDifferences(root)` | 差分 Mesh が外れて geometry と userData の比較色材質 2 つが dispose される。**本体材質 `m` は dispose されない** |
| `{ colorized: true }` のあと `clearCompareDifferences(root)` | 従来どおり geometry と比較色材質 2 つが dispose される |
| `colorized` を切り替えても geometry は | 作り直さない(`signedDistance` と `threshold` が同じなら再利用) |
| 対象が `SkinnedMesh` で `{ colorized: false }` | 差分も `SkinnedMesh` のまま、skeleton/bindMode 共有は従来どおり。材質だけ本体のものになる |
| `MeshCompareRig` が `colorized === false` で描画中 | 差分 Mesh は描かれる。`differencesOnly` が true なら本体は layer 0 から外れたままで、差分だけがモデル色で見える |

## やらないこと
- `shared/src/types.ts` の `MeshCompare` と Zod スキーマ、`meshCompareEquals`、サーバ、
  `realtime-dispatch.ts` は変更しない(任意フィールドの追加も削除もない)
- `CompareControls.tsx` とチェックボックスのラベル・凡例(`objects-labels.ts`)は変更しない。
  `objects` フォルダには一切触れない
- `differencesOnly` の結線(`setCompareSurfacesHidden` を使う effect)は変更しない
- 本体材質の複製・`polygonOffset` の付与はしない。着色 OFF では本体と差分が同一面・同色になるので、
  深度の前後関係は見た目に影響しない
- `difference-material.ts` の比較色材質そのもの(色・polygonOffset・DoubleSide)は変更しない
- `web/tests/compare-difference-material.test.ts` と `web/tests/compare-target-surface.test.ts` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] compare_Summary.md の公開インターフェイス・他フォルダとの関係・テストの記述を更新している
      (`colorized` が false のとき差分 Mesh を非表示にする、という現在の記述を書き換える)
- [ ] compare-rig.test.ts のソース検査文字列を新しい呼び出し・依存配列に合わせている
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test` が成功する
