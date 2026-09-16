---
id: 154
title: 比較ブロックの切り替えで基準モデルの描画を止める / 戻す
feature: compare
depends_on: [153]
owns: [web/src/features/compare/compare-visibility.ts, web/src/features/compare/compare_Summary.md, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/viewer_Summary.md, web/src/features/objects/CompareControls.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects.css, web/src/features/objects/objects_Summary.md, web/tests/compare-visibility.test.ts, web/tests/objects-styles.test.ts, web/tests/objects-labels.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/store/objects.ts, web/src/store/display.ts, web/src/features/viewer/ModelMesh.tsx, web/tests/model-scene.test.ts, web/tests/mesh-display.test.ts, web/tests/mesh-display-color.test.ts, web/tests/pick.test.ts, web/tests/outliner-highlight.test.ts, web/tests/trail-rig.test.ts, web/tests/timeline-styles.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
比較の「へこみ」(青)は基準モデルの表面より内側にあり、基準を不透明で描いている間は基準の面に
隠れて Z ファイティングの隙間からしか見えず、赤青が斑点状に乱れて見える(実画面で確認済み。
基準を非表示にすると赤青はきれいに分かれる)。比較が有効なあいだは既定で基準の版を 3D ビューで
描かず、比較ブロックのチェックボックスで「比較中も基準を表示」へ切り替えられるようにする。
オブジェクト一覧の「表示中 / 非表示」やルーム共有の表示状態は変えず、描画だけを止める。

## 前提
- 153 で `MeshCompare` に任意フィールド `baseVisible?: boolean` が入っている(`shared/src/types.ts`)。
  未指定は false(比較中は基準を描かない)。`meshCompareEquals` は未指定と false を同値として比較する
- `isMeshCompareActive(compare)` は `shared/src/compare.ts` にあり、baseId / targetId が両方 non-null で異なるとき true
- 版の表示可否は `isObjectVisible(hiddenIds, versionId)`(`web/src/store/objects.ts:126-128`、
  `!hiddenIds.includes(versionId)`)。`ViewerCanvas.tsx:47` が `visible={isObjectVisible(hiddenIds, version.id)}` で
  `ModelMesh` に渡し、`ModelMesh` は `<primitive object={scene} visible={visible} />` で scene に反映する
- `ViewerCanvas.tsx`(61 行)は既に `useDisplayStore((state) => state.meshDisplay)` を購読している(`:23`)。
  比較設定は同じストアの `meshCompare`
- 比較の距離計算(`MeshCompareRig`)は登録済み scene の geometry を読むだけで `visible` を見ない。
  基準の描画を止めても計算・重ね描きには影響しない
- `CompareControls.tsx`(89 行)は `update(patch)` が `{ ...meshCompare, ...patch }` を作り、
  `meshCompareEquals` で同値でなければローカル反映と `mesh:compare` 送信を行う(`:33-38`)。
  チェックボックスもこの `update` を使う
- **`ViewerCanvas.tsx` のソース文字列を検査するテストが 7 本ある**。次の文字列は残すこと:
  - `model-scene.test.ts:159-161`: `fileName={version.fileName}`、`<ModelMesh` がちょうど 1 回
  - `mesh-display.test.ts:233-238`: `useDisplayStore`、`meshDisplay={meshDisplay}`
  - `mesh-display-color.test.ts:73-76`: `useThemeStore(selectViewerColor("background"))`、`<color attach="background" args={[background]} />`
  - `pick.test.ts:153-172`: `<PlaybackClock />` と `<PlaybackSourceSync />` が各 1 回でこの順、
    `export function ViewerCanvas({ children }: { children?: ReactNode })`、`modelSrc` を含まない
  - `outliner-highlight.test.ts:228`: `SelectionRig` を含まない
  - `trail-rig.test.ts:197` 付近と `timeline-styles.test.ts:16`: 既存の配置検査。変更する行は `visible=` の 1 行だけなので通る
- `objects-styles.test.ts:42-51` は `CompareControls.tsx` に `<select` が 2 回、`type="range"` が 1 回、
  `#rrggbb` 形式の色リテラルを含まないことを検査する。チェックボックスを足しても通る
- `web/tests/summary-coverage.test.ts` は `web/src` 配下の全ソースが最寄りの Summary に相対パスで載っていること、
  `web/tests/*.test.ts` がいずれかの Summary に載っていることを機械検証する
- `objects.css` の `.compare__field` は `grid-template-columns: 3rem minmax(0, 1fr)` の 2 列(ラベル+select)。
  チェックボックス用には別クラスを用意する

## インターフェイス契約

### `web/src/features/compare/compare-visibility.ts`(新規)

```ts
import type { MeshCompare } from "@shared/types";

/**
 * 比較のために versionId の版の描画を止めるべきか。
 * 比較が有効で、baseVisible が true でなく、versionId が基準で、対象が表示中のときだけ true。
 */
export function isHiddenByCompare(
  compare: MeshCompare,
  hiddenIds: readonly string[],
  versionId: string,
): boolean;
```

実装は `isMeshCompareActive(compare) && compare.baseVisible !== true && versionId === compare.baseId && !hiddenIds.includes(compare.targetId)`。

### `web/src/features/viewer/ViewerCanvas.tsx`

`const meshCompare = useDisplayStore((state) => state.meshCompare);` を足し、`ModelMesh` の `visible` を次にする。

```tsx
visible={isObjectVisible(hiddenIds, version.id) && !isHiddenByCompare(meshCompare, hiddenIds, version.id)}
```

他の行は変えない。

### `web/src/features/objects/objects-labels.ts`

```ts
export const COMPARE_BASE_VISIBLE_LABEL = "比較中も基準を表示";
```

### `web/src/features/objects/CompareControls.tsx`

しきい値(`compare__threshold`)の直後、凡例(`compare__legend`)の直前に置く。

```tsx
<label className="compare__check">
  <input
    type="checkbox"
    className="compare__checkbox"
    checked={meshCompare.baseVisible === true}
    onChange={(event) => update({ baseVisible: event.target.checked })}
  />
  <span className="compare__label">{COMPARE_BASE_VISIBLE_LABEL}</span>
</label>
```

### `web/src/features/objects/objects.css`

```css
.compare__check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
```

色は書かない(`objects-styles.test.ts:51` が `#rrggbb` を禁止)。

## 振る舞い

`active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `isHiddenByCompare(active, [], "v1")` | `true`(基準は描かない) |
| `isHiddenByCompare(active, [], "v2")` | `false`(対象は描く) |
| `isHiddenByCompare(active, [], "v3")` | `false`(無関係な版) |
| `isHiddenByCompare({ ...active, baseVisible: true }, [], "v1")` | `false`(切り替えで基準を描く) |
| `isHiddenByCompare({ ...active, baseVisible: false }, [], "v1")` | `true` |
| `isHiddenByCompare(active, ["v2"], "v1")` | `false`(対象が非表示なら基準は今までどおり描く) |
| `isHiddenByCompare(active, ["v1"], "v1")` | `true`(基準が既に非表示でも判定は変えない。`ViewerCanvas` 側の `&&` で結果は非表示のまま) |
| `isHiddenByCompare({ ...active, targetId: null }, [], "v1")` | `false`(比較が無効) |
| `isHiddenByCompare({ ...active, targetId: "v1" }, [], "v1")` | `false`(基準と対象が同じは無効) |
| `isHiddenByCompare(DEFAULT_MESH_COMPARE, [], "v1")` | `false` |
| `ViewerCanvas.tsx` のソース | `useDisplayStore((state) => state.meshCompare)` と `!isHiddenByCompare(meshCompare, hiddenIds, version.id)` を含み、`isObjectVisible(hiddenIds, version.id)` を含む。`<ModelMesh` は 1 回のまま |
| `CompareControls.tsx` のソース | `type="checkbox"` がちょうど 1 回、`checked={meshCompare.baseVisible === true}`、`baseVisible: event.target.checked` を含む。`<select` 2 回、`type="range"` 1 回は既存どおり |
| `objects.css` | `.compare__check {` を含む |
| `COMPARE_BASE_VISIBLE_LABEL` | `"比較中も基準を表示"` |
| チェックを入れる操作(手動確認) | `mesh:compare` が `baseVisible: true` で送られ、基準の版が 3D ビューに戻る。オブジェクト一覧の「表示中」は変わらない |
| 基準を選び直して比較を解除(手動確認) | 基準の版が再び描かれる |

ソース検査とラベルの行はそれぞれ `web/tests/compare-visibility.test.ts`(関数と `ViewerCanvas`)、
`web/tests/objects-styles.test.ts`(`CompareControls` と CSS)、`web/tests/objects-labels.test.ts`(ラベル)に書く。

## やらないこと
- `useObjectsStore` の `hiddenIds` や `object:visibility` の送信。共有の表示状態は変えない
- 基準を半透明・ワイヤフレームで描くゴースト表示
- `ModelMesh.tsx` / `useModelScene.ts` / `MeshCompareRig.tsx` / `overlay.ts` の変更
- 重ね描きの深度テストや `renderOrder` の変更
- `shared/` / `server/` の変更(153 で済んでいる)
- しきい値の刻みや 0.0% 時の着色方法の変更(別途相談)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る(手動確認の 2 行を除く)
- [ ] `compare_Summary.md` の「ファイル一覧と役割」に `compare-visibility.ts`、「公開インターフェイス」に `isHiddenByCompare`、
      「他フォルダとの関係」に「比較中は `ViewerCanvas` が `isHiddenByCompare` で基準の版の描画を止め、
      `baseVisible` で戻す」を、`## テスト` に `tests/compare-visibility.test.ts` を追記している
- [ ] `viewer_Summary.md` の `ViewerCanvas.tsx` の役割(`:7`)に「比較中は compare の `isHiddenByCompare` で基準の版の
      `visible` を落とす」を追記している
- [ ] `objects_Summary.md` の `CompareControls.tsx` の役割に「比較中も基準を表示するチェックボックス」を、
      `objects-labels.ts` / `objects.css` の説明にラベルとチェック行のクラスを追記している
- [ ] すべてのファイルが300行以内(`ViewerCanvas.tsx` 61 行、`CompareControls.tsx` 89 行、`objects.css` 147 行、
      `objects-styles.test.ts` 64 行、`objects-labels.test.ts` 49 行)
- [ ] verify: に書いたコマンドが成功する
