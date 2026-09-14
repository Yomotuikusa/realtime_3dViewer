---
id: 079
title: web オブジェクト一覧に「比較」ブロック(基準/対象の選択・しきい値スライダー・凡例)を置き、mesh:compare をルームへ送信する
feature: web
depends_on: [075]
owns: [web/src/features/objects/CompareControls.tsx, web/src/features/objects/ObjectList.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects.css, web/src/features/objects/objects_Summary.md, web/tests/objects-labels.test.ts, web/tests/objects-styles.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, shared/src/protocol.ts, web/src/store/display.ts, web/src/store/objects.ts, web/src/features/viewer/FocalLengthSlider.tsx, web/src/features/viewer/viewer.css, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
ユーザーが基準の版・対象の版・しきい値を選べるようにする。右ドックのオブジェクト一覧の末尾に
「比較」ブロックを置き、変更のたびにローカルの display ストアを更新してから `mesh:compare` をルームへ送信する。
これで 075〜079 が揃い、比較がルーム全員の画面に反映される。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 075 で `ClientMessage` に `{ type: "mesh:compare"; compare: MeshCompare }` があり、サーバは送信元以外へ中継する。
  したがって自分のストアは自分で更新する(`ObjectList` の表示切替と同じ流儀。web/src/features/objects/ObjectList.tsx:40-44)
- 075 の `useDisplayStore` に `meshCompare` / `setMeshCompare(compare)` がある。`@shared/types` に
  `MeshCompare`、`MIN_COMPARE_THRESHOLD_PERMILLE`(1)、`MAX_COMPARE_THRESHOLD_PERMILLE`(50)、
  `@shared/compare` に `meshCompareEquals` がある
- 3D への適用は 078 が display ストアを読んで行う。UI 側は 3D に触らない
- `ObjectList({ projectId, send })` は `useObjectsStore` の `objects`(number 昇順の `ModelVersion[]`)を一覧し、
  末尾に `.objects__add` の label と `role="alert"` の p を描く。web/src/features/objects/ObjectList.tsx:76-114。116 行
- 見出し・文言は `objects-labels.ts`(21 行)に定数と純粋関数で置き、`web/tests/objects-labels.test.ts` で固定する
- スライダーの前例は `FocalLengthSlider`(label と output を上段、`type="range"` を下段)。
  web/src/features/viewer/FocalLengthSlider.tsx、CSS は viewer.css の `.hud-focal*`(:110-132)
- `select` に当てる共通クラスは `.input`(web/src/styles/controls.css:56-61)。`.field` / `.field__label` も使える
- CSS の規約: 生の色は `tokens.css` 以外で禁止、状態は `aria-*` / `data-*` で表現、`!important` / `@import` 禁止。
  `tests/styles-rules.test.ts` が機械検証する。**凡例に色見本は置かず文言だけにする**(トークン追加を避ける)
- web のテストは jsdom で `@testing-library` がない。React コンポーネントのレンダリングテストは書けない
- `web/tests/objects-styles.test.ts` は objects.css / review.css / ReviewPage.tsx のテキストを検査している(34 行)

## インターフェイス契約

### 変更 web/src/features/objects/objects-labels.ts

末尾に足す。

```ts
export const COMPARE_HEADING = "比較";
export const COMPARE_BASE_LABEL = "基準";
export const COMPARE_TARGET_LABEL = "対象";
export const COMPARE_NONE_LABEL = "なし";
export const COMPARE_THRESHOLD_LABEL = "しきい値";
export const COMPARE_LEGEND = "赤: 対象が基準から飛び出し / 青: へこみ";

/** "v<number> · <fileName>" */
export function compareOptionLabel(version: { number: number; fileName: string }): string;

/** 千分率を "0.5%" のように小数1桁の百分率で表す。5 → "0.5%"、12 → "1.2%"、50 → "5.0%" */
export function thresholdPermilleText(permille: number): string;
```

### 新規 web/src/features/objects/CompareControls.tsx

```tsx
export function CompareControls({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement | null;
```

- `useObjectsStore` の `objects` が 2 件未満なら `null` を返す(比べる相手がない)
- `useDisplayStore` の `meshCompare` / `setMeshCompare` を読む

描画:
```html
<div class="compare" role="group" aria-label="比較">
  <h3 class="compare__heading">比較</h3>
  <label class="compare__field">
    <span class="compare__label">基準</span>
    <select class="input compare__select"> <option value="">なし</option> <option value="v1の id">v1 · one.glb</option> ... </select>
  </label>
  <label class="compare__field">
    <span class="compare__label">対象</span>
    <select class="input compare__select"> 同上 </select>
  </label>
  <div class="compare__threshold">
    <div class="compare__threshold-head">
      <label class="compare__label" for="compare-threshold">しきい値</label>
      <output class="compare__value" for="compare-threshold">0.5%</output>
    </div>
    <input id="compare-threshold" class="compare__range" type="range" min="1" max="50" step="1" value="5">
  </div>
  <p class="compare__legend">赤: 対象が基準から飛び出し / 青: へこみ</p>
</div>
```

- option は `objects` の順(number 昇順)。表示は `compareOptionLabel(version)`、value は `version.id`
- select の `value` は、ストアの id が `objects` に存在すればその id、存在しないか null なら `""`
- 変更は次の1関数に集約する。`select` の `""` は `null` に、range は `Number(...)` に変換して渡す

```ts
function update(patch: Partial<MeshCompare>): void {
  const next = { ...meshCompare, ...patch };
  if (meshCompareEquals(next, meshCompare)) return;
  setMeshCompare(next);
  send({ type: "mesh:compare", compare: next });
}
```

- `send` の戻り値は無視する(未接続でもローカルは変わる。再接続時の welcome で同期される)
- 基準と対象に同じ版を選ぶことは**禁止しない**(その場合は 078 が「無効」として何も描かない)。UI は値をそのまま送る
- range は `onChange` ごとに送る。throttle は入れない

### 変更 web/src/features/objects/ObjectList.tsx

`CompareControls` を import し、`.objects__add` の label の直後、`role="alert"` の p の前に
`<CompareControls send={send} />` を足す。他は変えない。

### 変更 web/src/features/objects/objects.css

末尾に足す。

```css
.compare {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.compare__heading {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

.compare__field {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
}

.compare__label {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.compare__select {
  min-width: 0;
  width: 100%;
  font-size: var(--text-sm);
}

.compare__threshold {
  display: grid;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.compare__threshold-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.compare__range {
  width: 100%;
}

.compare__value {
  color: var(--color-text-muted);
}

.compare__legend {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}
```

## 振る舞い

### objects-labels(web/tests/objects-labels.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 定数 | `COMPARE_HEADING` "比較"、`COMPARE_BASE_LABEL` "基準"、`COMPARE_TARGET_LABEL` "対象"、`COMPARE_NONE_LABEL` "なし"、`COMPARE_THRESHOLD_LABEL` "しきい値"、`COMPARE_LEGEND` "赤: 対象が基準から飛び出し / 青: へこみ" |
| `compareOptionLabel({ number: 2, fileName: "two.glb" })` | `"v2 · two.glb"` |
| `thresholdPermilleText(5)` / `(12)` / `(50)` / `(1)` | `"0.5%"` / `"1.2%"` / `"5.0%"` / `"0.1%"` |

### スタイルとソース検査(web/tests/objects-styles.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `objects.css` | `.compare`、`.compare__field`、`.compare__range`、`.compare__legend` のセレクタを含み、`.compare__field` に `grid-template-columns` がある |
| `ObjectList.tsx` | `<CompareControls send={send} />` を含み、その位置が `objects__add` より後で `role="alert"` より前 |
| `CompareControls.tsx` | `aria-label={COMPARE_HEADING}`、`type: "mesh:compare"`、`meshCompareEquals(` を含む。`<select` がちょうど2つ、`type="range"` がちょうど1つ。`min={MIN_COMPARE_THRESHOLD_PERMILLE}` と `max={MAX_COMPARE_THRESHOLD_PERMILLE}` を含む。`objects.length < 2` を含む |
| `CompareControls.tsx` | 生の色(`#` + 16進)を含まない(凡例は文言のみ) |

### コンポーネントの振る舞い(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| 版が1つだけのプロジェクト | 「比較」ブロックが出ない |
| 版が2つ以上 | 一覧と「ファイルを追加」の下に「比較」ブロック。基準・対象は「なし」、しきい値 0.5% |
| 基準に v1、対象に v2 を選ぶ | 選んだ時点でそれぞれ送信され、両方選び終わると(078 により)v2 に赤青が出る。同室の他の参加者の画面も同じ |
| しきい値を動かす | 値表示が追従し、赤青の範囲が変わる。他の参加者にも反映される |
| 基準を「なし」に戻す | 赤青が消える |
| 他の参加者が設定を変える | 自分の select と スライダーが追従する |
| 途中入室 | ルームの設定が select とスライダーに入っている |

## やらないこと
- 3D への適用(078)、ストア・dispatch・protocol の変更(075)
- 送信の throttle、localStorage 保存
- 色見本・色トークンの追加、色や不透明度の設定 UI
- 基準と対象の入れ替えボタン、同一版選択の禁止
- 計算中インジケータ
- `ReviewPage.tsx` / `review.css` / `viewer.css` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る
- [ ] objects_Summary.md に CompareControls.tsx、objects-labels / objects.css の追加、ObjectList の変更を載せている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
