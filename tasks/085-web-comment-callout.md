---
id: 085
title: web 選択中コメントの本文を 3D ビュー上のピン横に吹き出しで表示する
feature: web
depends_on: [084]
owns: [web/src/features/comments/CommentCallout.tsx, web/src/features/comments/CommentPins.tsx, web/src/features/comments/comment-labels.ts, web/src/features/comments/comments.css, web/src/features/comments/comment-callout.css, web/src/features/comments/comments_Summary.md, web/tests/comment-callout.test.ts, web/tests/comment-labels.test.ts, web/tests/comments-styles.test.ts]
reads: [shared/src/types.ts, web/src/store/comments.ts, web/src/features/comments/CommentList.tsx, web/src/features/comments/CommentPickLayer.tsx, web/src/styles/controls.css, web/src/styles/tokens.css]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
3D ビュー上のピンをクリックしても、コメントの中身は右パネルの一覧まで目を移さないと読めない。
選択中のコメント(ピンからでも一覧からでも)について、そのピンの横に投稿者・時刻・状態・フレーム・
本文(全文)を持つ吹き出しを出し、閉じるボタンで選択を解除できるようにする。

## 前提
- ピンは `CommentPins()` が表示対象コメントごとに drei の `<Html position={anchor} center>` で
  native button を描画している(web/src/features/comments/CommentPins.tsx)。`selectedId` は
  `useCommentsStore` の `selectedId` で、選択は `select(id)`、解除は `select(null)`。
  `select` は `items` に無い id を null に正規化する(web/src/store/comments.ts:75-77)
- ピンは `onPointerDown` / `onPointerUp` で `event.stopPropagation()` している。
  Canvas 上の pointerdown/up を購読する `CommentPickLayer` に、オーバーレイ上の操作が
  「モデルへのクリック」として届かないようにするためで、吹き出しも同じ扱いにする
- drei `Html` は `center` を付けないと、投影点を左上にして子要素を置く。`zIndexRange` の
  既定は `[16777271, 0]` で、カメラ距離に応じてこの範囲内の z-index が各 Html に付く。
  上限・下限を同じ値にすると常にその値になる
- メタ行の書式は一覧カードと同じにする: `formatCommentTime(createdAt, Date.now())`、
  `statusLabel` / `statusTone` の `.badge`、`playbackBadge` / `playbackTitle` のフレームバッジ
  (`.badge` `data-tone="accent"`)。いずれも web/src/features/comments/comment-labels.ts(task 084 まで)に
  あり、`pinLabel(authorName)` は `"<name> のコメント"` を返す
- `web/tests/comments-styles.test.ts` は `outline:` の出現が comments.css 内で 1 回だけであること、
  生の色が無いこと、`[data-status="resolved"]` を含むセレクタが
  `.comments-row[data-status="resolved"] .comments-row__body` の 1 つだけであることを検査する。
  最後の検査の正規表現は `.comments-row[data-status="resolved"]` に限定されているので、
  `.comments-callout[data-status="resolved"]` は抵触しない
- 状態は既存の `selectedId` だけを使う。吹き出し専用の状態は持たない(一覧から選んでも出る)
- `web/tests/summary-coverage.test.ts` により、新規ソース `CommentCallout.tsx` と新規テスト
  `comment-callout.test.ts` は comments_Summary.md に載せる必要がある

## インターフェイス契約

### web/src/features/comments/comment-labels.ts

```ts
export const CLOSE_CALLOUT_LABEL = "コメントを閉じる";
```

### web/src/features/comments/CommentCallout.tsx(新規)

```tsx
import type { Comment } from "@shared/types";

/** 選択中コメントをアンカー位置の横に吹き出しで描画する。閉じるボタンで select(null)。 */
export function CommentCallout({ comment }: { comment: Comment }): ReactElement;
```

描画する DOM(クラス名・属性は **そのまま**):

```tsx
<Html position={comment.anchor} zIndexRange={[16777272, 16777272]}>
  <div
    className="comments-callout"
    role="dialog"
    aria-label={pinLabel(comment.authorName)}
    data-status={comment.status}
    onPointerDown={(event) => event.stopPropagation()}
    onPointerUp={(event) => event.stopPropagation()}
  >
    <div className="comments-callout__head">
      <span className="comments-callout__meta">
        <strong>{comment.authorName}</strong>
        <time dateTime={new Date(comment.createdAt).toISOString()}>
          {formatCommentTime(comment.createdAt, Date.now())}
        </time>
        <span className="badge" data-tone={statusTone(comment.status)}>{statusLabel(comment.status)}</span>
        {playback !== null && (
          <span className="badge comments-row__frame" data-tone="accent" title={playbackTitle(playback)}>
            {playbackBadge(playback)}
          </span>
        )}
      </span>
      <button
        type="button"
        className="btn btn--quiet comments-callout__close"
        aria-label={CLOSE_CALLOUT_LABEL}
        title={CLOSE_CALLOUT_LABEL}
        onClick={() => useCommentsStore.getState().select(null)}
      >
        ×
      </button>
    </div>
    <p className="comments-callout__body">{comment.body}</p>
  </div>
</Html>
```

`playback` は `comment.playback ?? null`。

### web/src/features/comments/CommentPins.tsx
`CommentPins()` で `visibleItems.find((comment) => comment.id === selectedId)` を求め、
ピンの `map` の **後ろ** に、見つかったときだけ `<CommentCallout comment={selected} />` を描画する。
`CommentPin` の描画と挙動(`select(id)`、伝播停止、`aria-pressed`)は変更しない。

### web/src/features/comments/comments.css
`.comments-pin` ブロックの **直前** に追加(他は変更しない。`outline` と生の色は使わない):

```css
.comments-callout {
  display: grid;
  gap: var(--space-1);
  width: 16rem;
  max-width: 16rem;
  margin-left: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-sm);
  box-shadow: var(--shadow-overlay);
  transform: translateY(-50%);
  pointer-events: auto;
}

.comments-callout__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.comments-callout__meta {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.comments-callout__meta strong,
.comments-callout__meta time {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comments-callout__meta time {
  color: var(--color-text-muted);
}

.comments-callout__close {
  flex: 0 0 auto;
  margin: 0;
  padding-inline: var(--space-1);
}

.comments-callout__body {
  max-height: 10rem;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comments-callout[data-status="resolved"] .comments-callout__body {
  color: var(--color-text-muted);
}
```

## 振る舞い

### web/tests/comment-callout.test.ts(新規)
drei `Html` は jsdom で描画できないため、web/tests/comments-styles.test.ts と同じ要領で
ソースをテキストとして読み、構造を検査する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| CommentCallout.tsx | `export function CommentCallout` を含み、`from "@react-three/drei"` で `Html` を import している |
| CommentCallout.tsx | `zIndexRange={[16777272, 16777272]}` を含む |
| CommentCallout.tsx | `className="comments-callout"`、`role="dialog"`、`data-status={comment.status}` を含む |
| CommentCallout.tsx | `onPointerDown` と `onPointerUp` の両方で `stopPropagation()` を呼んでいる(出現が 2 回以上) |
| CommentCallout.tsx | `comments-callout__close` のボタンが `CLOSE_CALLOUT_LABEL` を `aria-label` に持ち、`select(null)` を呼ぶ |
| CommentCallout.tsx | `comments-callout__body`、`formatCommentTime`、`statusLabel`、`statusTone`、`playbackBadge`、`playbackTitle`、`pinLabel` を参照している |
| CommentCallout.tsx | `comment.playback ?? null` を含む(古いコメントの欠落キー対応) |
| CommentPins.tsx | `CommentCallout` を import し、`<CommentCallout comment=` を含む |
| CommentPins.tsx | `selectedId` で `visibleItems` から 1 件を `find` している(`.find(` を含む) |
| CommentPins.tsx | 既存のピン(`comments-pin`、`aria-pressed`、`select(id)`)が残っている |
| CommentCallout.tsx / CommentPins.tsx | `outline` / `style={{` を含まない(見た目は CSS 側に閉じる) |

### web/tests/comment-labels.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `CLOSE_CALLOUT_LABEL` | `"コメントを閉じる"` |

### web/tests/comments-styles.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `.comments-callout` ブロック | `width: 16rem`、`margin-left: var(--space-3)`、`border: 1px solid var(--color-accent)`、`box-shadow: var(--shadow-overlay)`、`transform: translateY(-50%)`、`pointer-events: auto` を含む |
| `.comments-callout__body` ブロック | `max-height: 10rem`、`overflow: auto`、`white-space: pre-wrap`、`overflow-wrap: anywhere` を含む |
| `.comments-callout__close` ブロック | `margin: 0` を含む |
| `.comments-callout[data-status="resolved"] .comments-callout__body` ブロック | `var(--color-text-muted)` を含む |
| comments.css 全体 | `outline:` の出現は従来どおり 1 回、生の色は無い(既存テストが通る) |
| comments.css 全体 | `.comments-row[data-status="resolved"]` を含むセレクタは従来どおり 1 つだけ(既存テストが通る) |

### 画面上の見た目(直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| ピンをクリック | ピンの右に白い吹き出しが出て、投稿者・時刻・状態バッジ・(あれば)F バッジ・本文全文が読める。同時に右パネルの該当カードも選択・展開される |
| 一覧のカードをクリック | 同じ吹き出しがビュー上のピン横に出る |
| 吹き出しの「×」 | 選択が外れ、吹き出しとカードの展開が消え、再現線が消える |
| 吹き出しの上でドラッグ | カメラは回らず、新しいコメントアンカーも置かれない |
| 長い本文 | 吹き出しの高さは 10rem で止まり、本文だけがスクロールする。幅は 16rem を超えない |
| カメラを回す | 吹き出しはピンに追従し、近いピンより手前に描かれる |
| 解決済みコメント | 本文だけグレー |
| 「未解決のみ」でフィルタして選択中コメントが隠れる | 吹き出しも消える(`selectedId` が正規化されるため) |

## やらないこと
- 吹き出し内での返信・編集・解決操作(解決は一覧側のボタンのまま)
- 吹き出しの位置をビューポート内に収める補正(画面端で切れてもよい)
- ホバーでのプレビュー表示(選択時のみ)
- ピン自体の見た目・挙動の変更
- `CommentList.tsx` / `store/comments.ts` / `useCommentReplay.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM・CSS で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] comments_Summary.md に CommentCallout.tsx の役割・公開インターフェイス、CommentPins.tsx の
      変更、comments.css の吹き出し、テスト一覧(comment-callout.test.ts)を反映している
- [ ] すべてのファイルが300行以内(comments.css は現在 182 行。081/084/085 の追加を合わせても
      300 行以内に収まる見込みだが、超える場合は吹き出しの CSS を
      `web/src/features/comments/comment-callout.css` に分けて CommentCallout.tsx から import し、
      Summary とテストの読込先も合わせる)
- [ ] verify: に書いたコマンドが成功する
