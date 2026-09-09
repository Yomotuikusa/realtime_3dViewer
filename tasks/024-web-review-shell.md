---
id: 024
title: web レビュー画面の骨格(ヘッダ・接続状態・URL コピー・入室モーダル・パネル容器)
feature: web
depends_on: [023]
owns: [web/src/app/ReviewPage.tsx, web/src/app/ReviewHeader.tsx, web/src/app/JoinDialog.tsx, web/src/app/review-labels.ts, web/src/app/review.css, web/tests/review-labels.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, ../docs/DESIGN_SKILL.md, web/web_Summary.md, web/src/styles/tokens.css, web/src/styles/base.css, web/src/styles/controls.css, web/src/store/session.ts, web/src/store/presence.ts, web/src/app/display-name.ts, web/src/app/useRealtime.ts, web/src/app/routes.ts, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/viewer/ViewerCanvas.tsx]
verify: npm run typecheck && npm run test:web && npm run build
status: todo
---

## 目的
レビュー画面(`/p/<id>`)の骨格を D35 のプレーン CSS で組み直し、**入室前のダイアログとツールバーの
重なり**(`ReviewPage.tsx:125,129`)を解消する。ヘッダに接続状態・自分の表示名と色・
「URL をコピー」を置き、設計書 §5 の「レビューURL発行 → URL共有」に UI 上の入口を作る。
HUD(025)とサイドパネルの中身(026)はこのタスクでは触らず、**それらを置く容器だけ**を用意する。

## 前提
- 023 で `styles/tokens.css` `base.css` `controls.css` が `main.tsx` から読まれている。
  `html, body, #root { height: 100% }` 済み。`.btn` `.btn--primary` `.btn--quiet` `.field` `.input` `.alert`
  `.badge[data-tone]` `.visually-hidden` が使える(定義は `web/src/styles/controls.css`)
- 023 の `web/tests/styles-rules.test.ts` は `src/**/*.css` を走査する。**このタスクが追加する
  `review.css` も対象**(16 進色を書かない、`var()` は定義済みかフォールバック付き)
- 現在の `ReviewPage`(171 行)は次を持つ: 状態 `loading | error | ready`、`JoinDialog` の絶対配置、
  Reset / 全体表示ボタンと `AnnotationToolbar` の絶対配置、`ErrorBoundary` + `ViewerCanvas`、
  `aside`(接続ラベル・`lastError`・`PresenceList`・`CommentComposer`・`CommentList`)。
  フック(`useCommentReplay` `useRealtime` `useCameraBroadcast`)の呼び出し順と `key={src}` は維持する
- session ストア: `selfId` `color` `name` `connection: "connecting" | "open" | "closed"` `lastError`
  (`web/src/store/session.ts`)。入室前は `connection === "closed"` のまま(接続していないだけ)なので、
  **未入室と切断は `joinName` の有無で区別する**
- `JoinDialog({ onJoin })` は `loadStoredName` を初期値にしたフォーム(`web/src/app/JoinDialog.tsx`)。
  空欄なら `resolveDisplayName` が `Guest-<4桁>` を付ける(D9)
- `AnnotationToolbar({ send })` は現状「モード 3 ボタン + 色 + Undo/Clear」。025 で分割する。
  このタスクでは**現状のまま HUD 容器に置く**(見た目の整えは 025)
- `ViewerCanvas` は `style={{ width: "100%", height: "100%", minHeight: "36rem" }}` の Canvas を返す
- クリップボード: `navigator.clipboard.writeText` は https / localhost 以外や権限拒否で reject する。
  失敗時は URL を読み取り専用 `<input>` で見せて手動コピーさせる(SKILL §4.8: 回復手段を示す)
- 用語は D36、対象環境は D37(1024px 以上、ライトのみ)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/app/review-labels.ts — 文言と判定の純粋関数。JSX に文言を直書きしない(D36)
import type { ConnectionStatus } from "../store/session";

export type ConnectionTone = "neutral" | "success" | "warning" | "danger";

/** 未入室(joined=false)は接続状態に関係なく「未入室」。入室後は D36 の接続文言 */
export function connectionLabel(status: ConnectionStatus, joined: boolean): string;
/** badge の data-tone。未入室 neutral / open success / connecting warning / closed danger */
export function connectionTone(status: ConnectionStatus, joined: boolean): ConnectionTone;

export type CopyState = "idle" | "copied" | "failed";
/** idle→「URL をコピー」/ copied→「コピーしました」/ failed→「コピーできません。下の URL を選択してください」 */
export function copyLabel(state: CopyState): string;
/** クリップボードに書けたら "copied"、reject / API 不在なら "failed"。例外を握りつぶさず結果に変換する */
export function copyText(text: string, clipboard: Pick<Clipboard, "writeText"> | undefined): Promise<CopyState>;

export const LOADING_MESSAGE: string;          // 「プロジェクトを読み込んでいます…」
export const PROJECT_LOAD_FAILED: string;      // 「プロジェクトの取得に失敗しました。」
export const MODEL_LOAD_FAILED: string;        // 「モデルの読み込みに失敗しました。」
export const RELOAD_LABEL: string;             // 「再読み込み」
```

```tsx
// web/src/app/ReviewHeader.tsx
/** <header class="review-header">
 *    左: <h1 class="review-header__title">{projectName}</h1> + <span class="review-header__kind">レビュー</span>
 *    右: <span class="badge" data-tone={connectionTone(...)} role="status">{connectionLabel(...)}</span>
 *        入室後のみ: <span class="review-header__self"><i class="review-header__dot" style={{"--user-color": color}}/> {name}</span>
 *        <button class="btn btn--quiet" onClick=copy>{copyLabel(state)}</button>
 *        failed のとき: <input class="input review-header__url" readOnly value={shareUrl} aria-label="レビュー URL" onFocus={select}/>
 *  copied は 2 秒後に idle へ戻す(setTimeout。アンマウント時に clearTimeout)
 *  shareUrl は window.location.href */
export function ReviewHeader(props: { projectName: string; joined: boolean }): React.ReactElement;
```

```tsx
// web/src/app/JoinDialog.tsx(変更)
/** <div class="review-backdrop">
 *    <form class="review-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
 *      <h2 id={titleId}>レビュー空間に入室</h2>
 *      <p class="review-dialog__help">空欄のまま入室すると Guest 名が付きます。</p>
 *      <label class="field"><span class="field__label">表示名</span><input class="input" autoFocus …/></label>
 *      <button class="btn btn--primary" type="submit">入室する</button>
 *  useId() で titleId を作る。ロジック(loadStoredName / resolveDisplayName / saveName / onJoin)は変えない */
export function JoinDialog(props: { onJoin: (name: string) => void }): React.ReactElement;
```

```tsx
// web/src/app/ReviewPage.tsx(変更)— 構造だけ固定する。状態管理・フックは現状維持
/** ready のとき:
 *  <main class="review-page">
 *    <ReviewHeader projectName joined={joinName !== null} />
 *    {lastError && <p class="alert review-page__alert" role="alert">{lastError}</p>}
 *    <div class="review-body">
 *      <section class="review-viewer" aria-label="3D ビューア">
 *        <div class="review-hud">                    ← 025 が中身を ViewerHud に置き換える容器
 *          <button class="btn" onClick={requestReset}>視点を戻す</button>
 *          <button class="btn" onClick={requestFit}>全体を表示</button>
 *          <AnnotationToolbar send={realtime.send} />
 *        </div>
 *        <ErrorBoundary key={src} fallback={<ErrorCard …/>}><ViewerCanvas …>{既存の子}</ViewerCanvas></ErrorBoundary>
 *        {joinName === null && <JoinDialog onJoin={handleJoin} />}   ← HUD の後に置く(DOM 順で上に重なる)
 *      </section>
 *      <aside class="review-panel" aria-label="サイドパネル">
 *        <PresenceList />
 *        <section class="review-panel__comments" aria-label="コメント">   ← 026 が中身を整える
 *          <CommentComposer …/>
 *          <CommentList …/>
 *        </section>
 *      </aside>
 *    </div>
 *  </main>
 *  loading: <main class="review-page review-page--message"><p role="status">{LOADING_MESSAGE}</p></main>
 *  error:   <main class="review-page review-page--message"><ErrorCard …/></main>
 *  ErrorCard は class="alert review-error"(中央寄せ・本文 + .btn の再読み込み)。inline style を残さない */
export function ReviewPage(props: { projectId: string }): React.ReactElement;
```

```css
/* web/src/app/review.css — 接頭辞 review-。主なルール */
/* .review-page      display:grid; grid-template-rows: auto auto 1fr; height:100%(100vh ではなく #root の 100%)
   .review-header    height: var(--header-height); border-bottom 1px border; padding 0 var(--space-4); flex; gap var(--space-3); align-items center
   .review-header__title  font-size var(--text-lg); font-weight 600(h1 だが大きくしない。SKILL §3.3)
   .review-header__kind   text-sm; text-muted
   .review-header__dot    0.625rem の円; background: var(--user-color, var(--color-border))
   .review-body      display:grid; grid-template-columns: minmax(0,1fr) var(--panel-width); min-height:0
   .review-viewer    position:relative; min-width:0; background: var(--color-surface-subtle)
   .review-hud       position:absolute; inset:0; z-index:1; padding var(--space-3); display:flex; align-items:flex-start; gap var(--space-2); pointer-events:none
                     (ビューア全面を覆う。025 の Follow バッジ(上中央)とヒント(左下)が absolute でこの箱を基準に置けるようにするため。
                      このタスクの中身(ボタン 2 つ + AnnotationToolbar)は flex-start で左上に並ぶ)
   .review-hud :is(.btn, [role="toolbar"], [role="group"], [role="status"], [role="alert"])  pointer-events:auto
                     (HUD の空き領域は Canvas に触れる。操作・表示の実体は role を持つ要素か .btn。
                      025 が中身を差し替えても、この規則に従えば追加の pointer-events 指定は要らない)
   .review-backdrop  position:absolute; inset:0; z-index:2; display:grid; place-items:center; background: var(--color-surface-muted) の半透明は使わず、
                     `color-mix(in srgb, var(--color-text) 40%, transparent)` で暗くする(16 進・rgba を書かない規約のため)
   .review-dialog    surface; border; radius-lg; box-shadow var(--shadow-overlay); width: min(24rem, 90%); padding var(--space-5); display:grid; gap var(--space-3)
   .review-panel     border-left 1px border; overflow:auto; min-height:0; display:grid; grid-template-rows: auto 1fr; gap: var(--space-4); padding var(--space-4)
   .review-panel__comments  min-height:0
   .review-page--message    place-items:center
   .review-error     max-width 28rem; text-align center; display:grid; gap var(--space-3) */
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `connectionLabel("closed", false)` / `("open", false)` / `("connecting", false)` | すべて `"未入室"` |
| `connectionLabel("open", true)` / `("connecting", true)` / `("closed", true)` | `"接続中"` / `"再接続中…"` / `"切断"` |
| `connectionTone(…)` | 未入室 `"neutral"`、open `"success"`、connecting `"warning"`、closed(入室後) `"danger"` |
| `copyLabel("idle")` / `("copied")` / `("failed")` | `"URL をコピー"` / `"コピーしました"` / `"コピーできません。下の URL を選択してください"` |
| `copyText("u", { writeText: async () => {} })` | `"copied"`、`writeText` が `"u"` で 1 回呼ばれる |
| `copyText("u", { writeText: async () => { throw new Error("denied") } })` | `"failed"`(例外は伝播しない) |
| `copyText("u", undefined)` | `"failed"` |
| `LOADING_MESSAGE` 等の定数 | 契約のコメントどおりの文字列 |
| 入室前にレビュー画面を開く(目視) | ビューアの上に暗い backdrop と中央のダイアログ。表示名 input にフォーカスが当たっている。HUD はダイアログの下に隠れ、操作できない |
| 入室する(目視) | backdrop が消え、ヘッダの状態が「未入室」→「接続中」に変わり、自分の色の丸と名前が出る |
| サーバを止める(目視) | 状態が「再接続中…」(warning)になる。復帰で「接続中」 |
| 「URL をコピー」を押す(目視) | 2 秒間「コピーしました」。https/localhost 以外では失敗文言と読み取り専用 URL が出る |
| 1280×800 / 1920×1080(目視) | ヘッダ 1 行、ビューアが残り全部、パネル 22rem。ページ全体に縦スクロールが出ない(パネル内だけスクロール) |
| 既存の全テスト + 023 の `styles-rules.test.ts` | 引き続き通る(`review.css` が規約を満たす) |
| `ReviewPage.tsx` | 300 行以内。inline `style={{` が **0 箇所** |

## やらないこと
- `AnnotationToolbar` の変更(モード文言の日本語化・分割・スタイル)。025 で行う
- `PresenceList` `CommentList` `CommentComposer` `CommentPins` の変更。026 で行う
- `ViewerCanvas` `CameraRig` など Canvas 内の変更
- session / presence / comments ストアの変更
- レスポンシブ(1024px 未満)、ダークテーマ、アニメーション(D37)
- 依存の追加・package.json の変更

## 目視確認(マージ後に人間が行う)
`npm run dev:server` + `npm run dev:web`、1280×800 と 1920×1080 で:
- [ ] 入室ダイアログがツールバーと重ならず、backdrop で背後が操作できない
- [ ] ヘッダの接続バッジが 未入室 → 接続中 → (サーバ停止で)再接続中… → 接続中 と変わる
- [ ] 自分の名前の横の丸が、参加者一覧(026 前でも現状の一覧)の自分の色と一致する
- [ ] URL コピーが動く(localhost)。`copied` 後 2 秒で元に戻る
- [ ] ページ全体に縦スクロールが出ない。パネルだけがスクロールする
- [ ] Tab 順: ヘッダ → HUD → パネル。フォーカス輪が全ボタンで見える
- [ ] `docs/DESIGN_SKILL.md` §12 の視覚スロップ(グラデーション・大きな角丸・全面の影)が無い

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM 構造・クラス名で実装されている
- [ ] 振る舞い表の純粋関数の行すべてに対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(`ReviewHeader` `review-labels` `review.css` の役割、`.review-hud` `.review-panel__comments` が 025 / 026 の差し込み口であること)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web && npm run build` が成功する
- [ ] 最終メッセージに `docs/DESIGN_SKILL.md` §16 の Visual audit 1〜12 と Interaction audit 1〜6 への回答を書く
