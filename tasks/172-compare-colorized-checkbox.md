---
id: 172
title: 比較ブロックに「差分を着色」チェックボックスを足し、OFF のあいだ「差分だけを表示」を無効化する
feature: objects
depends_on: [170]
owns: [web/src/features/objects/CompareControls.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects.css, web/src/features/objects/objects_Summary.md, web/tests/compare-visibility.test.ts, web/tests/objects-styles.test.ts, web/tests/objects-labels.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/store/display.ts, web/tests/compare-threshold-slider.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
170 で `MeshCompare` に載った `colorized`(未指定 true)を、比較ブロックのチェックボックスから
切り替えられるようにする。着色 OFF のあいだは「差分だけを表示」が効かない(171 が無視する)ので、
そのチェックボックスを `disabled` にして操作できないことを示す。
3D ビュー側の振る舞いは 171 が担当し、ここでは UI とルーム共有だけを行う。

## 前提
- 170 で `MeshCompare` に任意フィールド `colorized?: boolean` が入っている(`shared/src/types.ts`)。
  **未指定は true(着色する)**。`meshCompareEquals` は未指定と true を同値として比較する
- `CompareControls.tsx`(108 行)は `update(patch: Partial<MeshCompare>)`(`:29-34`)で
  `{ ...meshCompare, ...patch }` を作り、`meshCompareEquals` で同値なら何もせず、変わっていれば
  `setMeshCompare(next)` と `send({ type: "mesh:compare", compare: next })` を行う。この関数はそのまま使う
- 既存のチェックボックスは 2 つで、`:87-95` が「比較中も基準を表示」、`:96-104` が「差分だけを表示」。
  どちらも `<label className="compare__check">` の中に
  `<input type="checkbox" className="compare__checkbox" checked={...} onChange={...} />` と
  `<span className="compare__label">{...}</span>` を置く。その直後が `<p className="compare__legend">`
- ラベル定数は `web/src/features/objects/objects-labels.ts:12-19`。
  `COMPARE_BASE_VISIBLE_LABEL = "比較中も基準を表示"`(`:17`)、
  `COMPARE_DIFFERENCES_ONLY_LABEL = "差分だけを表示"`(`:18`)、`COMPARE_LEGEND`(`:19`)
- CSS は `objects.css:144-149` に `.compare__check`(flex 行)があり、`.compare__checkbox` の規則は無い。
  `:151-154` が `.compare__legend`。このタスクでは `.compare__check` は変えず、無効時の見た目だけを足す
- 次のソース検査テストが「チェックボックスは 2 つ」を検査しており、本タスクで 3 つに更新する:
  - `web/tests/compare-visibility.test.ts:81-94`(`type="checkbox"` が `toHaveLength(2)`、
    `compare__threshold` < `compare__check` の順序、`COMPARE_BASE_VISIBLE_LABEL` <
    `COMPARE_DIFFERENCES_ONLY_LABEL` < `compare__legend` の順序)
  - `web/tests/objects-styles.test.ts:42-58`(`type="checkbox"` が `toHaveLength(2)`、
    `checked={meshCompare.baseVisible === true}` などの包含、`not.toMatch(/#[0-9a-f]{3,8}/i)`)
- `web/tests/compare-visibility.test.ts:96-125` は `CompareControls` を実際にマウントし、
  `host.querySelectorAll('input[type="checkbox"]')[1]` で「差分だけを表示」を取っている。
  チェックボックスを間に挟むと添字がずれるので、本タスクで `[2]` に直す
- `web/tests/objects-labels.test.ts:25-40` は各ラベル定数の文字列を検査する
- `web/tests/compare-threshold-slider.test.ts` は `CompareControls` をマウントするが
  `#compare-threshold` と `output.compare__value` をセレクタで取るので、チェックボックスが増えても影響しない。触らない
- `web/tests/summary-coverage.test.ts` は src 配下の各ファイルと tests 配下の各テストファイル名が
  Summary に載っていることを検査する。ファイルは増えないので `objects_Summary.md` の記述更新だけでよい
- jsdom では `disabled` な `<input>` の `click()` は `change` イベントを発火しない

## インターフェイス契約

### `web/src/features/objects/objects-labels.ts`

```ts
export const COMPARE_BASE_VISIBLE_LABEL = "比較中も基準を表示";   // 既存
export const COMPARE_COLORIZED_LABEL = "差分を着色";              // 追加
export const COMPARE_DIFFERENCES_ONLY_LABEL = "差分だけを表示";   // 既存
```

### `web/src/features/objects/CompareControls.tsx`

「比較中も基準を表示」の `<label className="compare__check">` の**直後**、
「差分だけを表示」の `<label className="compare__check">` の**直前**に次を足す
(ソース検査テストが文字列で見るので `checked` / `onChange` はこの通りに書く)。

```tsx
<label className="compare__check">
  <input
    type="checkbox"
    className="compare__checkbox"
    checked={meshCompare.colorized !== false}
    onChange={(event) => update({ colorized: event.target.checked })}
  />
  <span className="compare__label">{COMPARE_COLORIZED_LABEL}</span>
</label>
```

既存の「差分だけを表示」の `<input>` に `disabled` を足す(他の属性は変えない)。

```tsx
<input
  type="checkbox"
  className="compare__checkbox"
  checked={meshCompare.differencesOnly === true}
  disabled={meshCompare.colorized === false}
  onChange={(event) => update({ differencesOnly: event.target.checked })}
/>
```

`CompareControls` の props、`update` の実装、`objects.length < 2` で null を返す条件は変えない。

### `web/src/features/objects/objects.css`

`.compare__check` の規則の直後に次を足す。既存の規則は変えない。

```css
.compare__checkbox:disabled + .compare__label {
  opacity: 0.5;
}
```

## 振る舞い

`active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 }` とする。
マウント時の入力欄の並びは `input[type="checkbox"]` の `[0]` が「比較中も基準を表示」、
`[1]` が「差分を着色」、`[2]` が「差分だけを表示」。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `COMPARE_COLORIZED_LABEL` | `"差分を着色"` |
| `COMPARE_BASE_VISIBLE_LABEL` / `COMPARE_DIFFERENCES_ONLY_LABEL` / `COMPARE_LEGEND` | 従来どおりの文字列(変更なし) |
| `CompareControls.tsx` のソース | `type="checkbox"` が **3** 回、`<select` が 2 回、`type="range"` が 1 回 |
| `CompareControls.tsx` のソース | `checked={meshCompare.colorized !== false}`、`colorized: event.target.checked`、`disabled={meshCompare.colorized === false}` をすべて含む |
| `CompareControls.tsx` のソース | 既存の `checked={meshCompare.baseVisible === true}`、`baseVisible: event.target.checked`、`checked={meshCompare.differencesOnly === true}`、`differencesOnly: event.target.checked` をそのまま含む |
| `CompareControls.tsx` のソースの出現順(`indexOf` / `lastIndexOf`) | `compare__threshold` < `compare__check`、`COMPARE_BASE_VISIBLE_LABEL` < `COMPARE_COLORIZED_LABEL` < `COMPARE_DIFFERENCES_ONLY_LABEL` < `compare__legend` |
| `CompareControls.tsx` のソース | `COMPARE_COLORIZED_LABEL` を `./objects-labels` から import している。16 進の色リテラルを含まない(既存検査) |
| `objects.css` | `.compare__checkbox:disabled + .compare__label` の規則を含む |
| 実行時: `setup(active)`(colorized 未指定)でマウント | `[1]` の `checked === true`、`[2]` の `disabled === false` |
| 実行時: `[1]` を click(ON → OFF) | `update({ colorized: false })` → ストアが `toEqual({ ...active, colorized: false })`、`send` が 1 回、引数は `{ type: "mesh:compare", compare: { ...active, colorized: false } }` |
| 実行時: 続けて `[1]` を click(OFF → ON) | ストアが `toEqual({ ...active, colorized: true })`、`send` が 1 回、引数は `{ type: "mesh:compare", compare: { ...active, colorized: true } }` |
| 実行時: `setup({ ...active, colorized: true })` でマウントし `[1]` に `change` イベントを直接投げる(値は true のまま) | `meshCompareEquals` が true なので `send` は呼ばれない(既存の `update` の振る舞い) |
| 実行時: `setup({ ...active, colorized: false })` でマウント | `[1]` の `checked === false`、`[2]` の `disabled === true` |
| 実行時: 上の状態で `[2]` を click | `change` が起きないので `send` は呼ばれず、ストアの `meshCompare` も変わらない |
| 実行時: `setup({ ...active, baseVisible: true, differencesOnly: true })` で `[1]` を click | `toEqual({ ...active, baseVisible: true, differencesOnly: true, colorized: false })`(他のフィールドは保たれる) |
| 実行時: `objects.length < 2` | 従来どおり何も描かない(null) |
| 実行時: 既存の「差分だけを表示」の切り替え(`[2]`) | 従来どおり `differencesOnly` が送られ、`baseVisible` は保たれる(既存テストの添字だけを `[2]` に直す) |

## やらないこと
- 3D ビュー側の重ね描き非表示・`differencesOnly` の無視(`MeshCompareRig.tsx`、`overlay.ts`)。171 の担当
- `COMPARE_LEGEND` の文言変更や、着色 OFF のときに凡例を隠すこと。凡例は常に出したままでよい
- `update` 関数や `send` の呼び方の変更、チェックボックスの並び替え(基準を表示 → 差分を着色 → 差分だけを表示 の順にする)
- `.compare__check` / `.compare__label` / `.compare__legend` の既存 CSS の変更。追加するのは無効時の規則だけ
- 「差分を着色」への `disabled` の付与(比較が未設定でも操作できてよい。既存 2 つと同じ扱い)
- `web/tests/compare-threshold-slider.test.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (ソース検査と実行時の切り替えは `compare-visibility.test.ts` と `objects-styles.test.ts` の
      既存 `toHaveLength(2)` を 3 に更新したうえで colorized の包含・順序・無効化を足す。
      ラベルは `objects-labels.test.ts`)
- [ ] `objects_Summary.md` の `CompareControls.tsx` の行に「差分を着色するチェックボックス(`colorized`、未指定は着色する)と、
      着色 OFF のあいだ差分だけを表示を無効化する」を、`objects-labels.ts` の行に着色ラベルを、
      `objects.css` の行に「無効なチェックのラベルは薄く表示する」を追記している
- [ ] すべてのファイルが300行以内(`CompareControls.tsx` は現在 108 行、`objects.css` は 154 行、
      `compare-visibility.test.ts` は 126 行、`objects-styles.test.ts` は 71 行、`objects-labels.test.ts` は 57 行)
- [ ] verify: に書いたコマンドが成功する
