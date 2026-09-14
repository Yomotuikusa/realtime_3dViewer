---
id: 086
title: web コメントカードの高さを揃え、吹き出しの閉じるボタンを円形アウトライン付きにする
feature: web
depends_on: []
owns: [web/src/features/comments/comments.css, web/src/features/comments/comments_Summary.md, web/tests/comments-styles.test.ts]
reads: [web/src/features/comments/CommentList.tsx, web/src/features/comments/CommentCallout.tsx, web/src/styles/controls.css, web/src/styles/tokens.css, web/src/styles/base.css, web/src/main.tsx]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右パネルのコメントカードは、本文が 1 行のコメントと 2 行のコメントで高さが異なり、並べると
ガタつく。非選択カードの本文領域を常に 2 行分の高さにして全カードを同じ大きさに揃える。
あわせて、3D ビュー上のピン横に出る吹き出しの右上にある閉じるボタン(×)を、円形の
アウトライン(枠線)を持つ丸ボタンにする。**CSS だけで完結させ、TSX は変更しない。**

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- コメントカードの本文は `<p class="comments-row__body">` で、`.comments-row__body` は
  `display: -webkit-box; -webkit-line-clamp: 2; overflow: hidden;` により最大 2 行に切り詰めている。
  web/src/features/comments/comments.css:127-134。本文が 1 行しか無いときは 1 行分の高さにしか
  ならず、これがカードの高さのばらつきの原因である
- 選択中カードは `.comments-row[data-selected="true"] .comments-row__body` で
  `display: block; overflow: visible; -webkit-line-clamp: unset;` として全文展開する
  (comments.css:136-140)。**この全文展開は本タスクでも残す**(人間の決定)。
  揃えるのは非選択カードの高さだけである
- 行の高さは `body { font: var(--text-md) / var(--leading) var(--font-ui); }`(base.css:13-15)で
  決まり、`--leading: 1.5`(tokens.css:8)。`button { font: inherit; }`(base.css:19-23)なので
  カード内の選択ボタン配下でも同じ行高が効く。したがって本文 2 行分の高さは
  `calc(var(--leading) * 2em)` で表せる
- メタ行 `.comments-row__meta` は `display: flex`(折り返しなし)で、`strong` / `time` は
  ellipsis、バッジは短い文言なので常に 1 行に収まる。本タスクでメタ行は変更しない
- 吹き出しの閉じるボタンは
  `<button class="btn btn--quiet comments-callout__close" aria-label="コメントを閉じる">×</button>`
  である。web/src/features/comments/CommentCallout.tsx:43-51。`.btn` は `min-height: 2rem`、
  `padding: var(--space-1) var(--space-3)`、`border: 1px solid var(--color-border)`、
  `border-radius: var(--radius-md)` を持ち、`.btn--quiet` が `border-color: transparent` にしている
  (web/src/styles/controls.css:1-33)。`.btn:hover` / `.btn--quiet:hover` の背景色は変更しない
- CSS の読み込み順は main.tsx:1-3 で tokens → base → controls、その後に各機能の
  comments.css が import される。`.comments-callout__close`(単一クラス、特異度は `.btn--quiet` と同じ)
  は **後から読まれるので同じ特異度でも勝つ**。既存の `.comments-row__toggle { margin: 0; ... }` も
  同じ仕組みで `.btn` を上書きしている。セレクタは単一クラスのまま書く
- `web/tests/comments-styles.test.ts` は次を機械検査している。本タスクで壊してはならない
  - `outline:` の出現が comments.css 内で **1 回だけ**(`.comments-pin[aria-pressed="true"]`)。
    よって閉じるボタンの円形アウトラインは **`border` で実装し、`outline` は使わない**
  - 生の色(`#rgb` / `rgb()` / `hsl()`)が無いこと。色はすべてトークン `var(--...)` を使う
  - `selectorBlock(css, selector)` は `"<selector> {"` の最初の出現から次の `}` までを切り出す。
    `.comments-row__body` は `"\n.comments-row__body"` で引いている(test:80)ので、
    `.comments-row__body {` ブロックを先頭に置く現状の並びを崩さない
  - "stacks comment cards and expands only the selected body"(test:76-99)が選択中の
    全文展開ブロックを検査している。これは変更しない
- `web/tests/styles-rules.test.ts` は `var(--x)` の名前が tokens.css の `:root` に宣言済みかを
  検査する。`--leading`(tokens.css:8)、`--color-border-strong`(tokens.css:28)は宣言済み。
  本タスクは新しいトークンを追加しない
- `web/tests/summary-coverage.test.ts` により、ソースとテストの一覧は Summary に載っている必要が
  あるが、本タスクは新規ファイルを作らないので追記は不要。comments.css の説明文だけ更新する

## インターフェイス契約
CSS の宣言そのものが契約である。以下を **そのままの値で** 実装する。

### web/src/features/comments/comments.css

1. `.comments-row__body` ブロックを次に置き換える(`margin: 0` の直後に `min-height` を 1 行足すだけ):

```css
.comments-row__body {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  margin: 0;
  min-height: calc(var(--leading) * 2em);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
```

2. `.comments-callout__close` ブロックを次に置き換える:

```css
.comments-callout__close {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  line-height: 1;
}
```

**変更しないもの**: 上記 2 ブロック以外の全セレクタ・全プロパティ。特に
`.comments-row[data-selected="true"] .comments-row__body`(全文展開)、`.comments-row`、
`.comments-row__meta`、`.comments-callout`、`.comments-pin` 系は現状維持。

## 振る舞い

### web/tests/comments-styles.test.ts(既存に追記)
既存の `selectorBlock` ヘルパをそのまま使い、`describe("comments styles")` に `it` を追加する。
既存の `it` は 1 つも変更しない。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `"\n.comments-row__body"` ブロック | `min-height: calc(var(--leading) * 2em)` を含む |
| 同ブロック | `-webkit-line-clamp: 2` と `overflow: hidden` を引き続き含む |
| `.comments-row[data-selected="true"] .comments-row__body` ブロック | `min-height` を **含まない**(全文展開側は最小高さを上書きしない。基底ブロックの値がそのまま効く) |
| comments.css 全体 | `min-height: calc(var(--leading) * 2em)` の出現がちょうど 1 回 |
| `.comments-callout__close` ブロック | `border-radius: 50%`、`width: 1.5rem`、`height: 1.5rem`、`min-height: 0`、`padding: 0`、`margin: 0`、`border: 1px solid var(--color-border-strong)`、`display: inline-flex` を含む |
| 同ブロック | `outline` を **含まない** |
| comments.css 全体 | `outline:` の出現が従来どおり 1 回だけ(既存テストが落ちない) |
| comments.css 全体 | 生の色を含まない(既存テストが落ちない) |
| CommentCallout.tsx | `comments-callout__close` と `btn--quiet` の文字列が残っている(CSS だけの変更であることの担保) |
| CommentList.tsx | `comments-row__body` と `data-selected` の文字列が残っている(同上) |

### 既存テストへの影響(落ちてはならない)

| 状況 | 期待する結果 |
| --- | --- |
| `tests/comments-styles.test.ts` の既存 `it` | すべて変更なしで通る |
| `tests/comment-callout.test.ts` | TSX を変更しないので変更なしで通る |
| `tests/styles-rules.test.ts` | 新しい色・変数を足していないので変更なしで通る |
| `tests/summary-coverage.test.ts` | 新規ファイルを足さないので変更なしで通る |

### 画面上の見た目(直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| 本文 1 行のコメントと 2 行のコメントが並ぶ | 非選択カードはすべて同じ高さ。1 行のカードは本文の下に 1 行分の余白がある |
| 3 行以上の本文を持つ非選択カード | 従来どおり 2 行で切れ、他のカードと同じ高さ |
| カードを選択する | 従来どおり枠が青くなり本文が全文に広がる。本文 1 行のカードを選択しても高さは 2 行分のまま(縮まない) |
| 吹き出しを開く | 右上の × が正円のボタンになり、グレー 1px の丸い枠線が付く。× は円の中央にある |
| × にマウスを乗せる | 従来どおり背景だけ薄グレーになる。円の形・大きさは変わらない |
| × をクリック | 従来どおり選択が解除され、吹き出しが閉じる |
| × にキーボードでフォーカス | 青のフォーカスリング(base.css の `:focus-visible`)が円の外側に別途出る |

## やらないこと
- `CommentList.tsx` / `CommentCallout.tsx` / `CommentPins.tsx` など TSX の変更(クラス名の追加・変更を含む)
- 選択中カードの全文展開の廃止(人間の決定により残す)
- カード全体への固定高さ指定(揃えるのは本文領域の最小高さだけ)
- メタ行(`.comments-row__meta`)の折り返し制御や省略の変更
- 3D ピン(`.comments-pin`)の見た目変更
- 一覧側の解決/再開ボタン(`.comments-row__toggle`)や Composer のボタンの円形化
- `.btn` / `.btn--quiet` など共通スタイル(controls.css)の変更
- 新しいトークンの追加、ダークテーマ対応

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの宣言・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] comments_Summary.md の comments.css の説明に「非選択カードの本文領域を 2 行分の高さに揃える」
      「吹き出しの閉じるボタンは円形アウトライン付き」を反映している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
