---
id: 026
title: web サイドパネル(参加者・コメント一覧の階層と状態表示・投稿カード・3D ピン/カメララベル)
feature: web
depends_on: [025]
owns: [web/src/features/presence/PresenceList.tsx, web/src/features/presence/RemoteCameras.tsx, web/src/features/presence/presence-labels.ts, web/src/features/presence/presence.css, web/src/features/comments/CommentList.tsx, web/src/features/comments/CommentRow.tsx, web/src/features/comments/CommentComposer.tsx, web/src/features/comments/CommentPins.tsx, web/src/features/comments/comment-labels.ts, web/src/features/comments/comments.css, web/tests/presence-labels.test.ts, web/tests/comment-labels.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, ../docs/DESIGN_SKILL.md, web/web_Summary.md, web/src/styles/tokens.css, web/src/styles/controls.css, web/src/app/review.css, web/src/app/ReviewPage.tsx, web/src/store/presence.ts, web/src/store/session.ts, web/src/store/comments.ts, web/src/features/comments/compose.ts, web/src/features/viewer/hud-labels.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test:web && npm run build
status: done
---

## 目的
この製品の主対象である**コメント**をサイドパネルの主役にし、参加者はその上に小さく置く
(SKILL §1.2: 視覚的な強さは仕事の重要度に従う)。コメントの状態(未解決 / 解決済み)を
色だけでなく文字で示し、時刻・空状態・投稿中の文脈を足す。用語を D36 に揃える。
3D 側の HTML オーバーレイ(ピン・他者カメラの名札)も同じトークンに載せる。

## 前提
- 024 の `ReviewPage` は `<aside class="review-panel">` に `<PresenceList />` と
  `<section class="review-panel__comments" aria-label="コメント">` (中に `<CommentComposer />` `<CommentList />`) を置いている。
  **`aside` は `grid-template-rows: auto 1fr` なので、`PresenceList` は高さ auto、コメント節が残りを取る**。
  `ReviewPage` はこのタスクの owns ではない。構造が合わなければ申し送りに書く
- presence ストア: `users: Record<id, PresenceUser>`(`id` `name` `color` `camera`)、`followingUserId`、`follow(id)` `unfollow()`。
  session ストア: `selfId` `name`
- comments ストア: `items`(createdAt 昇順)、`showOnlyOpen`、`selectedId`、`composerAnchor`、`lastError`、
  `select` `setFilter` `setComposerAnchor` `setLastError`、`selectVisible(items, showOnlyOpen)`。
  `Comment` は `authorName` `body` `status: "open" | "resolved"` `createdAt: number`(ms)を持つ(`shared/src/types.ts:21`)
- 018 の規則: `CommentList` の**選択領域と状態変更ボタンは兄弟要素として分離**する(ボタンのクリックで選択が変わらない)。
  `updatingIds` の集合管理、`listComments` / `updateCommentStatus` の呼び方は 018 のまま
- 019 の規則: `CommentComposer` は `composerAnchor === null` で `null` を返す。投稿ロジック(`buildCommentInput` 〜 `select`)は変えない
- `CommentPins` は drei `Html` の中に `<button>` を置く。`onPointerDown/Up` の `stopPropagation` は
  `CommentPickLayer` との干渉を避けるためのもので、**外さない**
- `RemoteCameras` の名札も drei `Html`。`Html` の子は通常の DOM なので CSS クラスが効く
- D36 の用語、D35 の規約(16 進色を書かない。参加者色は `--user-color` で渡す)、D37 の対象環境
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/presence/presence-labels.ts
export const PRESENCE_HEADING: string;   // 参加者
export const SELF_SUFFIX: string;        // あなた
export const FOLLOW_LABEL: string;       // 視点に入る
export const UNFOLLOW_LABEL: string;     // 追従を解除
/** 「参加者 (3)」のような見出し文言 */
export function presenceHeading(count: number): string;
```

```ts
// web/src/features/comments/comment-labels.ts
import type { CommentStatus } from "@shared/types";
export const COMMENTS_HEADING: string;        // コメント
export const FILTER_OPEN_ONLY: string;        // 未解決のみ
export const COMPOSER_TITLE: string;          // この位置にコメント
export const COMPOSER_BODY_LABEL: string;     // 本文
export const SUBMIT_LABEL: string;            // 投稿する
export const CANCEL_LABEL: string;            // キャンセル
export const EMPTY_MESSAGE: string;           // コメントはまだありません。「コメント」モードでモデルをクリックすると投稿できます。
export const EMPTY_FILTERED_MESSAGE: string;  // 未解決のコメントはありません。
/** 「コメント (5)」。visible 件数を渡す */
export function commentsHeading(count: number): string;
/** open→未解決 / resolved→解決済み */
export function statusLabel(status: CommentStatus): string;
/** badge の data-tone。open→"warning"、resolved→"success" */
export function statusTone(status: CommentStatus): "warning" | "success";
/** open のとき「解決にする」、resolved のとき「再開する」 */
export function toggleStatusLabel(status: CommentStatus): string;
/** 「{authorName} のコメント」(ピンの aria-label) */
export function pinLabel(authorName: string): string;
/** createdAt(ms) を now(ms) と比べて整形する。timeZone 省略時は実行環境のローカル。
 *  同じ日: "HH:MM"(24h、0 埋め)/ 同じ年: "M/D HH:MM" / それ以外: "YYYY/M/D"。Intl.DateTimeFormat を使う */
export function formatCommentTime(createdAt: number, now: number, timeZone?: string): string;
```

```tsx
// web/src/features/presence/PresenceList.tsx(変更)
/** <section class="presence" aria-label={PRESENCE_HEADING}>
 *    <h2 class="presence__heading">{presenceHeading(count)}</h2>
 *    <ul class="presence__list">
 *      <li class="presence__row" data-self={isSelf} data-following={isFollowing} style={{"--user-color": user.color}}>
 *        <i class="presence__dot" aria-hidden="true"/> <span class="presence__name">{name}</span>
 *        {isSelf && <span class="badge" data-tone="neutral">{SELF_SUFFIX}</span>}
 *        {!isSelf && <button class="btn btn--quiet presence__follow" aria-pressed={isFollowing} onClick={toggle}>{isFollowing ? UNFOLLOW_LABEL : FOLLOW_LABEL}</button>}
 *  自分は常に先頭、他は名前順(localeCompare "ja")。follow/unfollow の呼び方は 014 のまま */
export function PresenceList(): React.ReactElement;

// web/src/features/presence/RemoteCameras.tsx(変更)— 名札だけ
/** <Html …><span class="presence-tag" style={{"--user-color": user.color}}>{user.name}</span></Html>
 *  cone の geometry / material / Quaternion 計算は変えない */
```

```tsx
// web/src/features/comments/CommentList.tsx(変更)— 外側の <section> は ReviewPage が持つので作らない
/** <div class="comments">
 *    <div class="comments__head">
 *      <h2 class="comments__heading">{commentsHeading(visibleItems.length)}</h2>
 *      <label class="comments__filter"><input type="checkbox" …/> {FILTER_OPEN_ONLY}</label>
 *    </div>
 *    {lastError && <p class="alert" role="alert">{lastError}</p>}
 *    {visibleItems.length === 0 && <p class="comments__empty">{items.length === 0 ? EMPTY_MESSAGE : EMPTY_FILTERED_MESSAGE}</p>}
 *    <ul class="comments__list">
 *      <li class="comments-row" data-selected={selectedId===id} data-status={status}>
 *        <button type="button" class="comments-row__select" aria-pressed={selected} onClick={toggleSelect}>   ← div role=button を native button に(SKILL §5.8)
 *          <span class="comments-row__meta"><strong>{authorName}</strong> <time dateTime={iso}>{formatCommentTime(createdAt, Date.now())}</time>
 *                <span class="badge" data-tone={statusTone(status)}>{statusLabel(status)}</span></span>
 *          <p class="comments-row__body">{body}</p>   ← 2 行で省略(現行の -webkit-line-clamp を CSS へ)
 *        </button>
 *        <button type="button" class="btn btn--quiet comments-row__toggle" disabled={isUpdating} onClick={changeStatus}>{toggleStatusLabel(status)}</button>
 *  Date.now() は描画ごとに呼んでよい(秒単位の再描画は不要。分の桁は次の再描画で更新される) */
export function CommentList(props: { projectId: string }): React.ReactElement;

// web/src/features/comments/CommentComposer.tsx(変更)
/** <form class="comments-composer">
 *    <h3 class="comments-composer__title">{COMPOSER_TITLE}</h3>
 *    <label class="field"><span class="field__label">{COMPOSER_BODY_LABEL}</span><textarea class="input" autoFocus …/></label>
 *    <div class="comments-composer__actions"><button class="btn btn--primary" type="submit">{sending ? "投稿中…" : SUBMIT_LABEL}</button><button class="btn btn--quiet" type="button">{CANCEL_LABEL}</button></div>
 *  autoFocus でクリック直後に本文へ入力できる(HUD のヒント「右のパネルで本文を…」と対になる) */
export function CommentComposer(props: { projectId: string; versionId: string }): React.ReactElement | null;

// web/src/features/comments/CommentPins.tsx(変更)
/** <button type="button" class="comments-pin" aria-label={pinLabel(authorName)} aria-pressed={selected} data-status={status} …stopPropagation は維持/>
 *  CommentPin の props に authorName と status を渡す。サイズ・色は CSS([aria-pressed="true"] / [data-status="resolved"])で決める */
```

```css
/* web/src/features/presence/presence.css — 接頭辞 presence- */
/* .presence__heading  text-sm; font-weight 600; text-muted; margin-bottom var(--space-2)
   .presence__list     list-style none; padding 0; display:grid; gap var(--space-1)
   .presence__row      flex; align-items center; gap var(--space-2); min-height 2rem; padding 0 var(--space-2); radius-sm
   .presence__row[data-following="true"]  background accent-subtle
   .presence__dot      0.625rem 円; background var(--user-color, var(--color-border))
   .presence__name     flex 1; overflow hidden; text-overflow ellipsis; white-space nowrap
   .presence-tag       名札: surface; border 1px; border-left 3px solid var(--user-color, var(--color-border)); radius-sm; padding 0 var(--space-2); text-xs; white-space nowrap; shadow overlay */
/* web/src/features/comments/comments.css — 接頭辞 comments- */
/* .comments           display:grid; grid-template-rows: auto auto auto 1fr; min-height 0; gap var(--space-2)
   .comments__head     flex; justify-content space-between; align-items baseline
   .comments__heading  text-lg; font-weight 600
   .comments__filter   text-sm; flex; gap var(--space-1); align-items center
   .comments__empty    text-sm; text-muted; padding var(--space-3); border 1px dashed border; radius-md
   .comments__list     list-style none; padding 0; display:grid; gap var(--space-1); overflow auto; min-height 0
   .comments-row       display:grid; grid-template-columns: 1fr auto; align-items start; border-left 3px solid transparent; radius-sm
   .comments-row[data-selected="true"]  border-left-color accent; background accent-subtle
   .comments-row[data-status="resolved"] .comments-row__body  text-muted
   .comments-row__select  text-align left; background none; border 0; padding var(--space-2); width 100%; cursor pointer; display:grid; gap var(--space-1)
   .comments-row__meta    text-sm; flex; gap var(--space-2); align-items center; time は text-muted
   .comments-row__body    2 行 clamp
   .comments-composer     border 1px accent; radius-md; padding var(--space-3); display:grid; gap var(--space-2); background surface
   .comments-composer__title  text-md; font-weight 600
   .comments-composer__actions flex; gap var(--space-2)
   .comments-pin        1.1rem 円; border 2px solid var(--color-surface); background accent; shadow overlay; cursor pointer
   .comments-pin[data-status="resolved"]  background var(--color-border-strong); opacity .6
   .comments-pin[aria-pressed="true"]     1.5rem; outline 3px solid accent; outline-offset 1px */
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `presenceHeading(0)` / `(3)` | `"参加者 (0)"` / `"参加者 (3)"` |
| `commentsHeading(5)` | `"コメント (5)"` |
| `statusLabel("open")` / `("resolved")` | `"未解決"` / `"解決済み"` |
| `statusTone("open")` / `("resolved")` | `"warning"` / `"success"` |
| `toggleStatusLabel("open")` / `("resolved")` | `"解決にする"` / `"再開する"` |
| `pinLabel("A")` | `"A のコメント"` |
| `formatCommentTime(t, now, "UTC")`、t と now が同じ UTC 日 | `"HH:MM"`(例 `09:05`) |
| 同じ年・別の日 | `"M/D HH:MM"`(例 `3/7 09:05`。月日は 0 埋めしない) |
| 別の年 | `"YYYY/M/D"` |
| `timeZone` 省略 | 例外を投げず文字列を返す(値はローカル依存なので形式のみ検証: `/^\d{2}:\d{2}$|^\d{1,2}\/\d{1,2} \d{2}:\d{2}$|^\d{4}\/\d{1,2}\/\d{1,2}$/`) |
| 参加者 3 人(目視) | 見出し「参加者 (3)」、自分が先頭で「あなた」バッジ、他は名前順。追従中の行だけ薄い accent 背景 |
| コメント 0 件(目視) | 破線枠の空状態文言。「未解決のみ」で全部消えたときは別文言 |
| コメント行(目視) | 投稿者・時刻・状態バッジ・本文 2 行。選択行は左に accent 線。解決済みは本文が薄い |
| 「解決にする」を押す(目視) | 選択状態は変わらず、バッジが「解決済み」になり、「再開する」に変わる |
| コメントモードでモデルをクリック(目視) | パネル上部に accent 枠の投稿カードが出て本文に即入力できる。投稿後カードが消え、新しい行が選択される |
| 3D ピン(目視) | 未解決は accent、解決済みは灰色で薄い。選択中は大きく輪が付く。ホバーで「{名前} のコメント」(ブラウザ既定の title は不要。aria-label のみ) |
| 他者カメラの名札(目視) | その人の色の左線、白地、小さい文字 |
| 既存の全テスト + `styles-rules.test.ts` | 通る(`presence.css` `comments.css` が規約を満たす) |
| 変更した `.tsx` | inline `style={{` は `--user-color` を渡す箇所のみ。`CommentPins` `RemoteCameras` の `Html position` は props であり対象外 |

## やらないこと
- `ReviewPage.tsx` の変更(構造が合わなければ申し送り)
- comments / presence ストア、`compose.ts`、`replay.ts` の変更
- コメントのスレッド・返信・編集・削除・@Mention(設計書 §9 の将来候補)
- コメント行からの「この視点へ移動」ボタン(選択 = 再現 のまま。020 の仕様)
- 相対時刻(「3 分前」)。再描画のタイマーが要るので採らない
- ダークテーマ・レスポンシブ・アニメーション(D37)
- 依存の追加・package.json の変更

## 目視確認(マージ後に人間が行う)
`npm run dev:server` + `npm run dev:web`、ブラウザ 2 つ、1280×800 と 1920×1080 で:
- [ ] パネルを一目見て「コメントの一覧が主」と分かる。参加者は補助に見える
- [ ] 未解決 / 解決済み が色を消しても(グレースケールで)区別できる(バッジ文字)
- [ ] 10 件以上コメントを入れてもパネル内だけがスクロールし、見出しと参加者は残る
- [ ] コメントモードでクリック → 投稿カードにフォーカス → Enter ではなくボタンで投稿(textarea の改行を壊していない)
- [ ] もう一方のブラウザに行とピンが即時に現れる
- [ ] `docs/DESIGN_SKILL.md` §3.8: 行をカードにしていない(区切りは左線と背景のみ)。§12 の「カードの中のカード」が無い

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM 構造・クラス名で実装されている
- [ ] 振る舞い表の純粋関数の行すべてに対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(`*-labels.ts`、`presence.css` `comments.css`、`CommentList` の native button 化、`CommentPin` の props 追加)
- [ ] すべてのファイルが300行以内(`CommentList.tsx` は現在 133 行。超える見込みなら 1 行分の描画を `CommentRow.tsx`(owns 済み)に分けてよい。分けない場合は作らない)
- [ ] verify: `npm run typecheck && npm run test:web && npm run build` が成功する
- [ ] 最終メッセージに `docs/DESIGN_SKILL.md` §16 の Visual audit 1〜12 と Interaction audit 1〜6 への回答を書く
