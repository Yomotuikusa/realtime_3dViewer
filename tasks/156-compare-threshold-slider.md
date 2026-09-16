---
id: 156
title: 比較しきい値スライダーを目盛番号で動かし、表示を小数 2 桁の百分率にする
feature: objects
depends_on: [155]
owns: [web/src/features/objects/CompareControls.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects_Summary.md, web/tests/objects-styles.test.ts, web/tests/objects-labels.test.ts, web/tests/compare-threshold-slider.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, shared/shared_Summary.md, web/src/store/display.ts, web/src/store/objects.ts, web/tests/compare-visibility.test.ts, web/tests/trail-bar.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
155 で共有スキーマが 0.1‰(0.01%)刻みのしきい値を受け付け、目盛一覧 `COMPARE_THRESHOLD_STEPS_PERMILLE`
(0〜0.9 を 0.1 刻み、1〜50 を 1 刻み、計 60 個)が shared に入る。
スライダーを「値そのもの」ではなく「目盛の添字」で動かし、0.1% 未満を 0.01% 刻みで選べるようにする。
あわせて、しきい値の表示を「0.50%」「0.03%」のように小数 2 桁へ統一する。

## 前提
- 155 のインターフェイス(`shared/src/compare.ts`):
  `COMPARE_THRESHOLD_STEPS_PERMILLE: readonly number[]`(長さ 60、`[14] === 5`、`[59] === 50`)と
  `nearestCompareThresholdIndex(permille: number): number`(最寄りの添字。非有限は 14)
- 現在のスライダー(`web/src/features/objects/CompareControls.tsx:76-85`)は
  `min={MIN_COMPARE_THRESHOLD_PERMILLE}` `max={MAX_COMPARE_THRESHOLD_PERMILLE}` `step="1"`
  `value={meshCompare.thresholdPermille}` で、`onChange` は `update({ thresholdPermille: Number(event.target.value) })`。
  `update` は `meshCompareEquals` で同値なら何もせず、違えば `setMeshCompare` と `send({ type: "mesh:compare", compare: next })` を行う
- `thresholdPermilleText(permille)`(`web/src/features/objects/objects-labels.ts:62`)は `(permille / 10).toFixed(1) + "%"`
- `web/tests/objects-styles.test.ts:51-52` は CompareControls のソースに
  `min={MIN_COMPARE_THRESHOLD_PERMILLE}` と `max={MAX_COMPARE_THRESHOLD_PERMILLE}` を要求している。**この 2 行をこのタスクで差し替える**
- `web/tests/compare-visibility.test.ts:42-52` も CompareControls のソースを検査するが、要求は
  `type="range"` が 1 つ、`<select` が 2 つ、`type="checkbox"` が 1 つ、`compare__threshold` → `compare__check` → `compare__legend` の順だけ。
  このタスクの変更で壊れないので変更しない
- `web/tests/objects-labels.test.ts:45-49` は `thresholdPermilleText` に `"0.5%"` 等を期待している。このタスクで 2 桁へ更新する
- React の描画テストの書き方は `web/tests/trail-bar.test.ts:26,53-62` にある
  (`IS_REACT_ACT_ENVIRONMENT`、`createRoot` + `act`、`afterEach` で unmount)。
  ストアは `useObjectsStore.getState().setObjects(versions)`(`web/src/store/objects.ts:62`)と
  `useDisplayStore.getState().setMeshCompare(compare)` / `reset()`(`web/src/store/display.ts:43,63`)。
  `ModelVersion` は `{ id, projectId, number, fileName, byteSize, createdAt }`(`shared/src/types.ts:47-54`)。
  `CompareControls` は `objects.length < 2` のとき null を返すので、版を 2 つ登録する
- jsdom で React の `onChange` を range 入力に発火させるには、
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "3")` で値を入れてから
  `input.dispatchEvent(new Event("input", { bubbles: true }))` を `act` の中で行う
- `web/tests/summary-coverage.test.ts` は `web/tests/*.test.ts` が最寄りの Summary の `## テスト` に載っていることを機械検証する。
  新しいテストファイルは `objects_Summary.md` に追記する
- `CompareControls.tsx` は現在 103 行、`objects-labels.ts` は 64 行、`objects-styles.test.ts` は 68 行、`objects-labels.test.ts` は 51 行

## インターフェイス契約

### `web/src/features/objects/CompareControls.tsx`

`CompareControls({ send })` のシグネチャと、select / checkbox / legend / `update` の振る舞いは変えない。
`MIN_COMPARE_THRESHOLD_PERMILLE` / `MAX_COMPARE_THRESHOLD_PERMILLE` の import は外し、
`@shared/compare` から `COMPARE_THRESHOLD_STEPS_PERMILLE` と `nearestCompareThresholdIndex` を import する。
range 入力は次のとおり(id / className / step は現状のまま)。

```tsx
<input
  id="compare-threshold"
  className="compare__range"
  type="range"
  min={0}
  max={COMPARE_THRESHOLD_STEPS_PERMILLE.length - 1}
  step="1"
  value={nearestCompareThresholdIndex(meshCompare.thresholdPermille)}
  onChange={(event) => {
    const permille = COMPARE_THRESHOLD_STEPS_PERMILLE[Number(event.target.value)];
    if (permille !== undefined) update({ thresholdPermille: permille });
  }}
/>
```

### `web/src/features/objects/objects-labels.ts`

```ts
/** 千分率を小数 2 桁の百分率で表す。"0.50%" / "0.03%" */
export function thresholdPermilleText(permille: number): string;
```

### `web/tests/compare-threshold-slider.test.ts`(新規)

`CompareControls` を描画し、range 入力の属性と onChange の結果をストアと `send` のモックで検証する。
`web/tests/objects-styles.test.ts` にはソース文字列の検査だけを置く。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `thresholdPermilleText(5)` / `(12)` / `(50)` / `(1)` / `(0)` | `"0.50%"` / `"1.20%"` / `"5.00%"` / `"0.10%"` / `"0.00%"` |
| `thresholdPermilleText(0.1)` / `(0.3)` / `(0.9)` / `(2.5)` | `"0.01%"` / `"0.03%"` / `"0.09%"` / `"0.25%"` |
| CompareControls のソース | `min={0}`、`max={COMPARE_THRESHOLD_STEPS_PERMILLE.length - 1}`、`value={nearestCompareThresholdIndex(meshCompare.thresholdPermille)}` を含む。`type="range"` は 1 つ |
| 版 2 つ・`meshCompare.thresholdPermille: 5` で描画 | `#compare-threshold` の `min === "0"`、`max === "59"`、`value === "14"`。`output.compare__value` の文字列が `"0.50%"` |
| 同上で `thresholdPermille: 0.3` | `value === "3"`、表示 `"0.03%"` |
| 同上で `thresholdPermille: 50` | `value === "59"`、表示 `"5.00%"` |
| range に `"3"` を入れて input イベント(値は 5 から) | `useDisplayStore.getState().meshCompare.thresholdPermille === 0.3`、`send` が `{ type: "mesh:compare", compare: { baseId, targetId, thresholdPermille: 0.3 } }` で 1 回呼ばれる |
| range に `"59"` を入れて input イベント | ストアが `50`、`send` の compare が `thresholdPermille: 50` |
| range に現在と同じ添字 `"14"` を入れて input イベント(値は 5) | ストアは `5` のまま、`send` は呼ばれない(`meshCompareEquals` で同値) |
| 範囲外の添字 `"99"` を入れて input イベント | range 入力が値を `max` の `"59"` に丸めるので(jsdom で確認済み)、ストアが `50`、`send` の compare が `thresholdPermille: 50` |
| 版が 1 つだけ | 何も描画しない(既存どおり) |

## やらないこと
- `shared/` / `server/` の変更。目盛一覧と最寄り添字は 155 のものを使う
- `web/src/features/compare/MeshCompareRig.tsx` の換算 `thresholdWorld` の変更。小数の千分率でそのまま正しい
- `web/tests/compare-visibility.test.ts` の変更。壊れないことを前提に確認済み
- `objects.css` の変更。スライダーの見た目は変えない
- 表示を「1 桁と 2 桁の混在」にすること。常に 2 桁
- スライダーに目盛ラベル(datalist)や数値入力欄を足すこと

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `objects_Summary.md` を更新している: CompareControls.tsx の役割に「しきい値は shared の目盛一覧の添字で動かす」を添え、
      objects-labels.ts の役割の「表示用 helper」に「しきい値は小数 2 桁の百分率」を添え、
      `## テスト` に `tests/compare-threshold-slider.test.ts` を追記する
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
