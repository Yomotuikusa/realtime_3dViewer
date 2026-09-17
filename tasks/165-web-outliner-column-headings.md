---
id: 165
title: web アウトライナ上部を「名前 / タイプ / 👁」の列見出しにし、タイプ列を行と揃える
feature: outliner
depends_on: []
owns: [web/src/features/outliner/Outliner.tsx, web/src/features/outliner/outliner.css, web/src/features/outliner/outliner-labels.ts, web/src/features/outliner/outliner_Summary.md, web/tests/outliner-styles.test.ts, web/tests/outliner-labels.test.ts]
reads: [web/src/features/outliner/OutlinerRow.tsx, web/src/features/outliner/outliner-icons.tsx, web/src/styles/tokens.css, web/src/app/ReviewDock.tsx, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, web/tests/dock-structure.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

163 でドック上部バーにタイトルが出て以降、アウトライナ本体の上部には表示列の目アイコンが
右端にぽつんと残るだけになっている。ここを `名前 / タイプ / 👁` の列見出しにして、
何の列なのかを読み取れるようにする。あわせて行側の「タイプ」列に固定幅を与え、
見出しと値の左端が縦に揃うようにする。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### 現在の DOM

- 上部は `Outliner.tsx:60-65`。`.outliner__head` の中に目アイコンの `<span class="outliner__eye">`
  が 1 つあるだけで、`outliner.css:10-16` の `justify-content: flex-end` で右端へ寄せている。
  見出し `<h2>` は 163 でドックバーへ移譲済みなので、ここには無い。
- 1 行の DOM は `OutlinerRow.tsx:36-68`。`.outliner__row`(flex, `gap: var(--space-1)`,
  `padding-left: calc(var(--outliner-depth, 0) * 16px)`)の直下に
  ①`.outliner__expand`(幅 `1.25rem`、葉のときも同幅の span を出す)
  ②`.outliner__select`(`flex: 1 1 auto`, `padding: var(--space-1) var(--space-2)`,
  内側 `gap: var(--space-2)`。中身は種別アイコン → 版バッジ → `.outliner__name` →
  `.outliner__kind`)
  ③`.outliner__visible`(`input[type=checkbox]`、幅 `0.875rem`、`margin: 0 var(--space-1) 0 0`)
  が並ぶ。
- `.outliner__kind` は種別ラベルと読み込み中表示の**両方**に使われている
  (`OutlinerRow.tsx:56-57`)。`outliner.css:136-141` で `margin-left: auto` により右へ逃げるため、
  版バッジや名前の長さで左端の位置が行ごとに変わり、列として揃っていない。
- `OutlinerRow.tsx` はこのタスクでは**変更しない**(reads)。列を揃えるのに必要な変更は
  すべて CSS 側で完結する。

### 文字幅の実測前提

- `--text-xs` は `0.75rem`(`web/src/styles/tokens.css:5`)。日本語グリフは 1 文字 1em。
- `.outliner__kind` に入りうる最長の文字列は `OUTLINER_LOADING` = `"読み込み中…"` の
  6 グリフ(三点リーダも全角 1em)。6 × 0.75rem = **4.5rem**。
- 種別ラベルの最長は `"グループ"` `"メッシュ"` `"ポイント"` の 4 グリフ = **3rem**。
- よって列幅 `5rem` なら両方とも省略記号なしで収まる(下の契約で採用する値)。
- 見出しの `"タイプ"` は 3 グリフ = 2.25rem。

### 変えてはいけない / 必ず直す既存の検査

- `web/tests/outliner-styles.test.ts:60` に
  `expect(ruleBody(cssText, ".outliner__head")).toContain("justify-content: flex-end");`
  がある。列見出し化でこの宣言は消えるため、**この 1 行は下の契約どおりに差し替える**
  (owns に入っている)。
- 同 `:89` の `expect(outlinerText).toContain("OUTLINER_VISIBILITY_HEADING");` と
  同 `:88` の `expect(outlinerText).toContain("<EyeIcon");` は**そのまま通り続けること**。
  目アイコンと `role="img"` の aria-label は残す。
- `web/tests/outliner-labels.test.ts:17-24` の既存の期待値は 1 つも変えない。新しい定数の
  期待値を足すだけにする。
- `web/tests/styles-rules.test.ts:150` は、`src` 配下の CSS が参照する CSS 変数が
  どこかで宣言されているかフォールバック付きであることを要求する。新設する
  `--outliner-kind-width` は `.outliner` ルールで宣言するので満たせる。
  同 `:143` は `tokens.css` 以外での生の色を禁じるので、色は必ずトークン経由で書く。
- `web/tests/summary-coverage.test.ts` は `src` 配下の全ファイルと `tests/` の全テスト名が
  Summary に載っていることを要求する。このタスクは**ファイルを新規追加しない**ので、
  `outliner_Summary.md` は記述の更新だけでよい。
- `web/tests/dock-structure.test.ts` はドック側の DOM を検査している。`.outliner__head` は
  ドックバー(`.review-dock-bar`)とは別物なので影響しない。変更しない。

### 現在の行数(上限 300 行)

`Outliner.tsx` 114、`outliner.css` 145、`outliner-labels.ts` 31、`outliner_Summary.md` 55、
`outliner-styles.test.ts` 114、`outliner-labels.test.ts` 36。いずれも上限に余裕がある。
見積もりは `Outliner.tsx` 約 120、`outliner.css` 約 175、`outliner-styles.test.ts` 約 122。

## インターフェイス契約

### web/src/features/outliner/outliner-labels.ts

既存の定数・関数は名前も値も変えない。次の 2 つを加える。

```ts
/** 上部列見出しの「名前」列。 */
export const OUTLINER_NAME_HEADING = "名前";
/** 上部列見出しの「タイプ」列。値は KIND_LABELS と OUTLINER_LOADING が入る列を指す。 */
export const OUTLINER_KIND_HEADING = "タイプ";
```

### web/src/features/outliner/Outliner.tsx

`.outliner__head` の中身だけを差し替える。`<section>` と `<ul role="tree">` の
`aria-label`、および目アイコンの属性は現行のまま維持する。

```tsx
<div className="outliner__head">
  <span className="outliner__head-indent" aria-hidden="true"></span>
  <div className="outliner__head-labels">
    <span className="outliner__head-name">{OUTLINER_NAME_HEADING}</span>
    <span className="outliner__head-kind">{OUTLINER_KIND_HEADING}</span>
  </div>
  <span className="outliner__eye" role="img" aria-label={OUTLINER_VISIBILITY_HEADING} title={OUTLINER_VISIBILITY_HEADING}>
    <EyeIcon />
  </span>
</div>
```

- この列見出しは `role="tree"` の**外**にある装飾行なので、`role` は付けない
  (`columnheader` は `table` / `grid` の中でしか意味を持たないため付けてはならない)。
- `.outliner__head-indent` は行の `.outliner__expand` と同じ幅を占めるだけのスペーサー。

### web/src/features/outliner/outliner.css

列幅は 1 か所で宣言し、見出しと行の両方が同じ変数を参照する。

```css
.outliner {
  /* 既存の宣言は変えない。次を足す */
  --outliner-kind-width: 5rem;
}

.outliner__head {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.outliner__head-indent {
  flex: 0 0 1.25rem;
}

.outliner__head-labels {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-1) var(--space-2);
}

.outliner__head-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outliner__head-kind {
  flex: 0 0 var(--outliner-kind-width);
}

.outliner__eye {
  display: inline-flex;
  flex: 0 0 0.875rem;
  justify-content: center;
  margin-right: var(--space-1);
  color: var(--color-text-muted);
}

.outliner__name {
  flex: 1 1 auto;   /* 追加。タイプ列の左端を行ごとに固定するため */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outliner__kind {
  flex: 0 0 var(--outliner-kind-width);   /* margin-left: auto をやめて固定列にする */
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- `.outliner__head` から `justify-content: flex-end` と `padding-right: var(--space-1)` は
  取り除く(右端の位置合わせは `.outliner__eye` の `margin-right` が担う)。
- `.outliner__eye-icon` の `1rem` は変えない。`.outliner__eye` は幅 `0.875rem` の
  チェックボックス列に対して中央揃えなので、アイコンが左右 1px ずつはみ出すが
  **中心は揃う**。これが意図した状態である。
- 上の 3 つのフレックス幅が揃うことで、見出しと行のタイプ列の左端は
  `.outliner__select` の右端から `var(--space-2) + 5rem` の位置で一致する。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| オブジェクトが 0 件 | 列見出しは常に出る。その下に `.outliner__empty` が出る(現行どおり) |
| 版ルート行(バッジあり)と深い子行(バッジなし)が並ぶ | どちらも `.outliner__kind` が `flex: 0 0 var(--outliner-kind-width)` なので、タイプ列の左端は同じ位置に来る |
| 種別が `group` の行 | タイプ列に `"グループ"`(3rem)が省略記号なしで収まる |
| `loading === true` の行(`kind === null`) | 同じ `.outliner__kind` に `"読み込み中…"`(6 グリフ = 4.5rem)が入り、列幅 5rem に省略記号なしで収まる |
| 名前が列幅より長い行 | `.outliner__name` が `flex: 1 1 auto` + `min-width: 0` で縮み、名前だけが省略記号になる。タイプ列と表示列は動かない |
| 深い階層で字下げされた行 | 字下げは `.outliner__row` の `padding-left` なので名前列の左端だけがずれ、タイプ列と表示列の位置は変わらない |
| 目アイコンとチェックボックス | `.outliner__eye` の幅 `0.875rem` + `margin-right: var(--space-1)` が `.outliner__visible` と同一なので、中心が縦に揃う |
| 支援技術 | 目の `role="img"` + `aria-label="表示"` は現行どおり。列見出しの行自体には `role` を付けない |

### 追加するテスト

`web/tests/outliner-styles.test.ts`(既存の `it("keeps the required CSS state rules")` と
`it("shares visibility and keeps selection local")` に足す。`:60` の flex-end の 1 行は削除して置き換える)

```ts
expect(ruleBody(cssText, ".outliner")).toContain("--outliner-kind-width: 5rem");
expect(ruleBody(cssText, ".outliner__head-kind")).toContain("var(--outliner-kind-width)");
expect(ruleBody(cssText, ".outliner__kind")).toContain("var(--outliner-kind-width)");
expect(ruleBody(cssText, ".outliner__kind")).not.toContain("margin-left: auto");
expect(ruleBody(cssText, ".outliner__name")).toContain("flex: 1 1 auto");
expect(ruleBody(cssText, ".outliner__eye")).toContain("margin-right: var(--space-1)");
expect(ruleBody(cssText, ".outliner__head-indent")).toContain("1.25rem");
expect(outlinerText).toContain("OUTLINER_NAME_HEADING");
expect(outlinerText).toContain("OUTLINER_KIND_HEADING");
expect(outlinerText).not.toContain('role="columnheader"');
```

`web/tests/outliner-labels.test.ts`

```ts
expect(OUTLINER_NAME_HEADING).toBe("名前");
expect(OUTLINER_KIND_HEADING).toBe("タイプ");
```

## やらないこと

- `OutlinerRow.tsx` は変更しない。行の DOM・クラス名・並び順はそのまま使う
- 目アイコンを別の図案に差し替えたり、`.outliner__eye-icon` のサイズを変えたりしない
- 列見出しをクリックしての並べ替えや、列幅のドラッグ変更は入れない
- ドック上部バー(`review-dock.css` / `ReviewDock.tsx`)には手を入れない。タイトル行は 163 のまま
- 版バッジ(`.outliner__tag`)や種別アイコンの位置は変えない。「名前」見出しがそれらの上に
  来ることは仕様として許容する(揃えるのはタイプ列と表示列の 2 つ)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの DOM・クラス名・CSS 宣言になっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md が更新されている(上部が列見出しになったこと、列幅トークン
      `--outliner-kind-width` が見出しと行の両方を揃えていることを書く)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
