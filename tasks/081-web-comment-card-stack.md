---
id: 081
title: web コメントカードを上から積み上げ、選択中のカードだけ本文を全文展開する
feature: web
depends_on: []
owns: [web/src/features/comments/comments.css, web/src/features/comments/comments_Summary.md, web/tests/comments-styles.test.ts]
reads: [web/src/features/comments/CommentList.tsx, web/src/styles/base.css, web/tests/styles-rules.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
コメント一覧のカードが、投稿数に応じて一覧の高さを均等に分け合って伸び縮みしてしまう。
カードは一定の大きさ(本文2行まで)に収めて上から順に積み上げ、溢れた分だけスクロールさせる。
あわせて、選択中のカードだけ本文を全文展開し、非選択のカードは冒頭2行だけを見せる。
**CSS だけで完結させ、TSX は変更しない。**

## 前提
- `.comments__list` は `display: grid` のスクロールコンテナで、親 `.comments` の
  `grid-template-rows: auto auto auto 1fr` の 4 行目(`1fr`)に置かれている。
  web/src/features/comments/comments.css:52-60。grid コンテナの `align-content` の初期値は
  `normal`(= `stretch`)で、これが auto 高さの各行(カード)に余った高さを均等に配る原因である
- カード本文 `.comments-row__body` は `display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; overflow: hidden;` で常に 2 行に切り詰めている。comments.css:123-129
- カードの選択状態は `<li class="comments-row" data-selected="true|false">` の属性で表現され、
  選択領域 `.comments-row__select`(native button)のクリックで選択がトグルする。
  web/src/features/comments/CommentList.tsx:114-132。**「展開」はこの選択状態と同一視する**
  (展開専用の状態は持たない)
- `web/tests/comments-styles.test.ts` の `selectorBlock(css, selector)` は
  `"<selector> {"` の最初の出現から次の `}` までを切り出す。同テストの
  "only mutes resolved comment bodies" は `[data-status="resolved"]` を含むセレクタが
  `.comments-row[data-status="resolved"] .comments-row__body` の 1 つだけであることを検査する。
  本タスクで足すセレクタは `data-selected` を使うので抵触しない
- `web/tests/styles-rules.test.ts` が、生の色は tokens.css だけ、`var(--x)` は `:root` に
  宣言済みの名前だけ、を機械検査する。本タスクは新しいトークンを追加しない

## インターフェイス契約
CSS の宣言そのものが契約である。以下を **そのままの値で** 実装する。

### web/src/features/comments/comments.css

1. `.comments__list` ブロックに 1 行追加(他のプロパティは変更しない):

```css
  align-content: start;
```

2. `.comments-row__body` ブロックに 1 行追加(長い英数字の連続でカードが横に溢れないようにする):

```css
  overflow-wrap: anywhere;
```

3. `.comments-row__body` ブロックの **直後** に新しいブロックを追加:

```css
.comments-row[data-selected="true"] .comments-row__body {
  display: block;
  overflow: visible;
  -webkit-line-clamp: unset;
}
```

**変更しないもの**: 上記以外の全セレクタ・全プロパティ(task 080 で定めたカードの枠・影・
選択リング・hover を含む)。

## 振る舞い

### web/tests/comments-styles.test.ts(既存に追記)
既存の `selectorBlock` ヘルパをそのまま使い、`describe("comments styles")` に `it` を追加する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `.comments__list` ブロック | `align-content: start` を含む |
| `.comments__list` ブロック | `align-content: stretch` / `align-content: space` を含まない |
| `.comments-row__body` ブロック | `-webkit-line-clamp: 2`、`overflow: hidden`、`overflow-wrap: anywhere` を含む |
| `.comments-row[data-selected="true"] .comments-row__body` ブロック | `display: block`、`overflow: visible`、`-webkit-line-clamp: unset` を含む |
| comments.css 全体 | `-webkit-line-clamp: 2` の出現がちょうど 1 回(非選択の切り詰めが 1 箇所に閉じている) |
| comments.css 全体 | `[data-status="resolved"]` を含むセレクタは従来どおり 1 つだけ(既存テストが落ちない) |
| CommentList.tsx | `data-selected` と `comments-row__body` の文字列が残っている(CSS だけの変更であることの担保) |

### 既存テストへの影響(落ちてはならない)

| 状況 | 期待する結果 |
| --- | --- |
| `tests/comments-styles.test.ts` の既存 `it` | すべて変更なしで通る |
| `tests/styles-rules.test.ts` | 新しい色・変数を足していないので変更なしで通る |
| `tests/summary-coverage.test.ts` | 新規ファイルを足さないので変更なしで通る |

### 画面上の見た目(直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| コメントが 1〜2 件しかない | カードは本来の高さのまま一覧の上端に寄り、下は空く |
| コメントが一覧の高さを超える | カードの高さは変わらず、一覧がスクロールする |
| 3 行以上の本文を持つ非選択カード | 本文は 2 行で切れ、末尾に `…` が出る |
| そのカードをクリックして選択 | 枠が青くなり、本文が全文に広がる。他のカードは 2 行のまま |
| 選択中のカードをもう一度クリック | 選択が外れ、本文が 2 行に戻る |
| 3D ビューのピンをクリック | 一覧側の対応するカードが選択され、全文に広がる |

## やらないこと
- `CommentList.tsx` など TSX の変更(展開専用の state や「もっと見る」ボタンの追加を含む)
- 選択とは独立した展開状態の導入
- カードの高さの固定値指定(本文 2 行の切り詰めで一定に保つ)
- Composer / 空状態 / ピンの見た目変更
- 3D ビュー上への本文表示(task 085)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの宣言・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] comments_Summary.md の comments.css の説明に「上から積み上げ」と「選択中のみ全文展開」を反映している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
