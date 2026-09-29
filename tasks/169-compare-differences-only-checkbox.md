---
id: 169
title: 比較ブロックに「差分だけを表示」チェックボックスを足し、differencesOnly をルーム共有する
feature: objects
depends_on: [167]
owns: [web/src/features/objects/CompareControls.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects_Summary.md, web/tests/compare-visibility.test.ts, web/tests/objects-styles.test.ts, web/tests/objects-labels.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/store/display.ts, web/src/features/objects/objects.css, web/tests/compare-threshold-slider.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
167 で `MeshCompare` に載った `differencesOnly` を、比較ブロックのチェックボックスから切り替えられるようにする。
3D ビュー側の振る舞い(対象の本体を描かない)は 168 が担当する。ここでは UI とルーム共有だけを行う。

## 前提
- 167 で `MeshCompare` に任意フィールド `differencesOnly?: boolean` が入っている(`shared/src/types.ts`)。
  未指定は false。`meshCompareEquals` は未指定と false を同値として比較する
- `CompareControls.tsx`(98 行)は `update(patch: Partial<MeshCompare>)`(`:29-34`)で
  `{ ...meshCompare, ...patch }` を作り、`meshCompareEquals` で同値なら何もせず、変わっていれば
  `setMeshCompare(next)` と `send({ type: "mesh:compare", compare: next })` を行う。この関数はそのまま使う
- 既存の「比較中も基準を表示」チェックボックスは `:86-94` にあり、`<label className="compare__check">` の中に
  `<input type="checkbox" className="compare__checkbox" checked={meshCompare.baseVisible === true} onChange={(event) => update({ baseVisible: event.target.checked })} />`
  と `<span className="compare__label">{COMPARE_BASE_VISIBLE_LABEL}</span>` を置いている。その直後が `<p className="compare__legend">`
- ラベル定数は `web/src/features/objects/objects-labels.ts:12-18`。`COMPARE_BASE_VISIBLE_LABEL = "比較中も基準を表示"`(`:17`)、
  `COMPARE_LEGEND`(`:18`)
- CSS は `objects.css:144-150` の `.compare__check` を流用する。**CSS は変えない**
- 次のソース検査テストが「チェックボックスは 1 つ」を検査しており、本タスクで 2 つに更新する:
  - `web/tests/compare-visibility.test.ts:42-52`: `controls.match(/type="checkbox"/g)).toHaveLength(1)` と
    `compare__threshold` < `compare__check` < `compare__legend` の順序検査
  - `web/tests/objects-styles.test.ts:42-56`: `compareControls.match(/type="checkbox"/g)).toHaveLength(1)`、
    `checked={meshCompare.baseVisible === true}`、`baseVisible: event.target.checked` の包含検査
- `web/tests/objects-labels.test.ts:31-37` は各ラベル定数の文字列を検査する
- `web/tests/compare-threshold-slider.test.ts` は `CompareControls` を実際にマウントするが、
  `#compare-threshold` と `output.compare__value` を id / セレクタで取るので、チェックボックスが増えても影響しない。触らない
- `web/tests/summary-coverage.test.ts` は src 配下の各ファイルと tests 配下の各テストファイル名が Summary に載っていることを検査する。
  ファイルは増えないので `objects_Summary.md` の記述更新だけでよい

## インターフェイス契約

### `web/src/features/objects/objects-labels.ts`

```ts
export const COMPARE_BASE_VISIBLE_LABEL = "比較中も基準を表示";   // 既存
export const COMPARE_DIFFERENCES_ONLY_LABEL = "差分だけを表示";   // 追加
```

### `web/src/features/objects/CompareControls.tsx`

既存の「比較中も基準を表示」の `<label className="compare__check">` の**直後**、`<p className="compare__legend">` の**直前**に
次を足す(ソース検査テストが文字列で見るので `checked` / `onChange` はこの通りに書く)。

```tsx
<label className="compare__check">
  <input
    type="checkbox"
    className="compare__checkbox"
    checked={meshCompare.differencesOnly === true}
    onChange={(event) => update({ differencesOnly: event.target.checked })}
  />
  <span className="compare__label">{COMPARE_DIFFERENCES_ONLY_LABEL}</span>
</label>
```

`CompareControls` の props、`update` の実装、`objects.length < 2` で null を返す条件は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `COMPARE_DIFFERENCES_ONLY_LABEL` | `"差分だけを表示"` |
| `CompareControls.tsx` のソース | `type="checkbox"` が **2** 回、`<select` が 2 回、`type="range"` が 1 回 |
| `CompareControls.tsx` のソース | `checked={meshCompare.baseVisible === true}`、`baseVisible: event.target.checked`、`checked={meshCompare.differencesOnly === true}`、`differencesOnly: event.target.checked` をすべて含む |
| `CompareControls.tsx` のソースの出現順 | `compare__threshold` < `COMPARE_BASE_VISIBLE_LABEL` < `COMPARE_DIFFERENCES_ONLY_LABEL` < `compare__legend`(`indexOf` で検査) |
| `CompareControls.tsx` のソース | `COMPARE_DIFFERENCES_ONLY_LABEL` を `./objects-labels` から import している。16 進の色リテラルを含まない(既存検査) |
| 実行時: 2 つ目のチェックボックスを ON | `update({ differencesOnly: true })` → ストアの `meshCompare.differencesOnly === true`、`send` に `{ type: "mesh:compare", compare: { ...前の値, differencesOnly: true } }` が 1 回渡る |
| 実行時: ON のまま再度 ON 相当の値(`true`)で `update` | `meshCompareEquals` が true なので `send` は呼ばれない(既存の `update` の振る舞い) |
| 実行時: OFF に戻す | `differencesOnly: false` で送られる。`baseVisible` の値は変わらない |
| 実行時: `objects.length < 2` | 従来どおり何も描かない(null) |

## やらないこと
- 3D ビュー側の本体非表示・depthWrite の切り替え(`MeshCompareRig.tsx`、`overlay.ts`)。168 の担当
- `objects.css` の変更。`.compare__check` を流用する
- `update` 関数や `send` の呼び方の変更
- `COMPARE_LEGEND` の文言変更
- `web/tests/compare-threshold-slider.test.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る(ソース検査は `compare-visibility.test.ts` と `objects-styles.test.ts` の
      既存 `toHaveLength(1)` を 2 に更新したうえで differencesOnly の包含と順序を足す。ラベルは `objects-labels.test.ts`)
- [ ] `objects_Summary.md` の `CompareControls.tsx` の行(現在「比較中も基準を表示するチェックボックスを備え」)に
      「差分だけを表示するチェックボックス(`differencesOnly`)」を追記している
- [ ] すべてのファイルが300行以内(`CompareControls.tsx` は現在 98 行)
- [ ] verify: に書いたコマンドが成功する
