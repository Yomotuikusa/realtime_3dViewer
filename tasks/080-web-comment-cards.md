---
id: 080
title: web コメント一覧の各コメントを枠線とドロップシャドウを持つカードにする
feature: web
depends_on: []
owns: [web/src/styles/tokens.css, web/src/app/review.css, web/src/features/comments/comments.css, web/src/features/comments/comments_Summary.md, web/tests/comments-styles.test.ts, web/tests/styles-rules.test.ts]
reads: [web/src/features/comments/CommentList.tsx, web/src/features/comments/CommentComposer.tsx, web/src/styles/controls.css, web/src/styles/base.css, web/tests/objects-styles.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右パネルのコメント一覧は現在、枠も背景も影もない行の羅列で、1件ずつの区切りが左端3pxの
アクセントバー(選択時のみ)しかない。各コメントを枠線(アウトライン)とドロップシャドウを持つ
カードにし、投稿フォームにも同じ影を与えて見た目を揃える。カードが浮いて見えるよう、
右パネルの地を薄グレーにする。**CSS だけで完結させ、TSX は変更しない。**

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- コメント1件の DOM は `<li class="comments-row" data-selected data-status>` の下に
  選択用 `<button class="comments-row__select">`(meta 行 + 本文)と、解決/再開用
  `<button class="btn btn--quiet comments-row__toggle">` が **兄弟として並ぶ 2 列グリッド**である。
  web/src/features/comments/CommentList.tsx:114-145。この構造は本タスクでは変えない
- `web/tests/styles-rules.test.ts` が CSS 規約を機械検査している。特に
  **生の色(`#rgb` / `rgb()` / `rgba()` / `hsl()`)は `src/styles/tokens.css` にしか書けない**。
  よって新しい影は必ずトークンとして tokens.css に置く。同テストの `tokenNames` 配列に
  挙げた名前は `:root` ブロックに存在することを検査される(配列に無い名前があってもエラーにはならないが、
  本タスクでは規約の一貫性のため配列にも追加する)
- `src/styles/base.css` に `:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; }`
  がある。カードの枠と選択リングに `outline` を使うとキーボードフォーカスの表示と競合するため、
  **枠は `border`、選択リングは `box-shadow` で実装する**(`outline` は使わない)
- `.review-panel` は app/review.css:145 と comments.css:1 の **2 箇所に定義がある**。
  comments.css 側は `overflow: hidden` だけを上書きしている。背景は app/review.css 側のブロックに足す
- `.review-panel` の中身(participants / objects)は背景を指定していない透過要素で、
  `.presence-tag` や `.btn` `.input` は `--color-surface`(白)。パネルの地を
  `--color-surface-subtle` にしてもこれらは白のまま映えるので、他機能の CSS は変更しない
- `.comments__list` は `overflow: auto` のスクロールコンテナである。padding が 0 のままだと
  カードの左右に出る影がスクロール枠で切れる
- `web/tests/summary-coverage.test.ts` が、src 配下の全ソースファイルが最寄りの `_Summary.md` に
  相対パスで載っていること、および tests/ の全テストファイル名がいずれかの Summary に載っていることを検査する。
  `tokens.css` は既に web/web_Summary.md:36 に載っているため追記不要。
  **新規の `tests/comments-styles.test.ts` は comments_Summary.md の「## テスト」に追記が必要**

## インターフェイス契約
CSS の宣言そのものが契約である。以下を **そのままの値で** 実装する。

### 1. web/src/styles/tokens.css — `:root` の既存の影トークンの直後に1行追加

```css
  --shadow-card: 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10);
```

既存の `--shadow-overlay` / `--shadow-control` は変更しない。

### 2. web/tests/styles-rules.test.ts — `tokenNames` 配列に追加

```ts
  "--shadow-control",
  "--shadow-card",
```

配列への1行追加だけで、テスト本体のロジックは変更しない。

### 3. web/src/app/review.css — `.review-panel` に地の色を追加

```css
.review-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 0;
  overflow: auto;
  padding: var(--space-4);
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}
```

`background` の1行を足すだけで、他のプロパティ・他のセレクタは変更しない。

### 4. web/src/features/comments/comments.css — カード化

既存ブロックを次の内容に **置き換える**(記載の無いプロパティは既存のまま残す)。

```css
.comments__list {
  grid-row: 4;
  display: grid;
  gap: var(--space-2);
  min-height: 0;
  overflow: auto;
  padding: var(--space-1);
  list-style: none;
}

.comments-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}

.comments-row:hover {
  border-color: var(--color-border-strong);
}

.comments-row[data-selected="true"] {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  box-shadow: 0 0 0 3px var(--color-accent-subtle), var(--shadow-card);
}

.comments-row[data-status="resolved"] .comments-row__body {
  color: var(--color-text-muted);
}

.comments-row__select {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.comments-row__toggle {
  margin: 0;
  padding-inline: var(--space-1);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.comments-composer {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
```

**削除するもの**: `.comments-row` の `border-left: 3px solid transparent;` と
`border-radius: var(--radius-sm);`、`.comments-row[data-selected="true"]` の
`border-left-color: var(--color-accent);`。

**変更しないもの**: `.review-panel` / `.review-panel__comments` / `.comments` /
`.comments__head` / `.comments__heading` / `.comments__filter` / `.comments__empty`(破線枠のまま) /
`.comments-row__meta` / `.comments-row__body` / `.comments-composer__title` /
`.comments-composer__actions` / `.comments-pin`(`outline` の指定を含め現状維持)。

## 振る舞い

### web/tests/comments-styles.test.ts(新規)
`web/tests/objects-styles.test.ts` と同じ要領で `src` を解決し、CSS をテキストとして読んで検査する。
セレクタのブロックを取り出すヘルパーを1つ置き、そのブロック内に宣言があることを確かめる
(例: `const index = css.indexOf(".comments-row {")` から次の `}` までを切り出す。
`.comments-row {` は `.comments-row__select {` や `.comments-row[data-selected="true"] {` とは
別の文字列なので、この単純な検索で目的のブロックだけが取れる)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| tokens.css の `:root` ブロック | `--shadow-card:` を含む |
| `--shadow-card` の値 | `0 1px 2px` と `0 1px 3px` の2段を含む |
| comments.css の `.comments-row` ブロック | `border: 1px solid var(--color-border)`、`border-radius: var(--radius-md)`、`background: var(--color-surface)`、`box-shadow: var(--shadow-card)`、`padding: var(--space-2)` を含む |
| 同ブロック | `border-left` を **含まない**、`var(--radius-sm)` を **含まない** |
| comments.css 全体 | `border-left-color` を含まない |
| `.comments-row:hover` ブロック | `border-color: var(--color-border-strong)` を含む |
| `.comments-row[data-selected="true"]` ブロック | `border-color: var(--color-accent)`、`background: var(--color-accent-subtle)`、`box-shadow: 0 0 0 3px var(--color-accent-subtle), var(--shadow-card)` を含む |
| `.comments-row[data-status="resolved"] .comments-row__body` ブロック | `var(--color-text-muted)` を含む(解決済みでも枠と影は変わらないことの担保として、comments.css に `[data-status="resolved"]` から始まり `.comments-row__body` を伴わないセレクタが無いことも検査する) |
| `.comments__list` ブロック | `gap: var(--space-2)` と `padding: var(--space-1)` を含む(`padding: 0` を含まない) |
| `.comments-row__select` ブロック | `padding: 0` を含む |
| `.comments-row__toggle` ブロック | `margin: 0` を含む |
| `.comments-composer` ブロック | `box-shadow: var(--shadow-card)` と `border: 1px solid var(--color-accent)` を含む |
| `.comments-pin` ブロック | `outline` を含まない(ピンの選択強調 `[aria-pressed="true"]` 側は現状どおり `outline` を持つ) |
| comments.css 全体 | `outline:` の出現が `.comments-pin[aria-pressed="true"]` の1箇所だけ |
| review.css の `.review-panel` ブロック | `background: var(--color-surface-subtle)` を含む |
| comments.css と review.css | 生の色(`/#[0-9a-f]{3,8}/i`、`rgb(`、`rgba(`)を含まない |
| CommentList.tsx | `comments-row` / `comments-row__select` / `comments-row__toggle` のクラス名が残っている(CSS だけの変更であることの担保) |

### 既存テストへの影響(落ちてはならない)

| 状況 | 期待する結果 |
| --- | --- |
| `tests/styles-rules.test.ts` | `--shadow-card` が `:root` にあり、生色が tokens.css だけに閉じている状態で全件通る |
| `tests/summary-coverage.test.ts` | `comments-styles.test.ts` がいずれかの Summary に載っている状態で全件通る |
| `tests/objects-styles.test.ts` | 変更なしで通る(review.css の `grid-template-rows: auto auto minmax(0, 1fr)` を保つこと) |
| `tests/layout-styles.test.ts` | 変更なしで通る(review.css の `position: relative` と `grid-template-columns` を保つこと) |

### 画面上の見た目(直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| 右パネルを開く | 地が薄グレーになり、コメント1件ごとに白いカードが枠線と薄い影付きで並ぶ |
| コメントカードにマウスを乗せる | 枠線だけが濃くなる。位置・大きさは動かない |
| コメントを選択する | 枠が青、地が薄青になり、カードの外側に薄青のリングが重なる |
| 解決済みコメント | 本文だけグレー。枠・影・地は未解決と同じ |
| 一覧をスクロールする | カード左右の影が切れない |
| 投稿フォームを開く | 青枠のフォームにカードと同じ影が付く |
| キーボードで選択ボタンにフォーカス | フォーカスリング(青2px)がカードの枠とは別に見える |

## やらないこと
- `CommentList.tsx` / `CommentComposer.tsx` / `CommentPins.tsx` など TSX の変更(クラス名の追加・変更を含む)
- 参加者一覧・オブジェクト一覧・タイムラインのカード化(今回の対象はコメント欄だけ)
- `.comments__empty`(空状態の破線枠)のカード化
- 3D ピン(`.comments-pin`)の見た目変更
- ダークテーマ対応、カードのアニメーション、hover での浮き上がり(影の差し替え)
- `--shadow-overlay` / `--shadow-control` を `--shadow-card` で置き換える他機能の一括整理

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの宣言・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] comments_Summary.md の comments.css の説明にカード化を反映し、「## テスト」に
      `tests/comments-styles.test.ts` を追記している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
