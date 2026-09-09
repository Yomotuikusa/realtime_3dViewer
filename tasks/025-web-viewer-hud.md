---
id: 025
title: web ビューア HUD(モード切替の可視化・ペン道具・Follow 中バッジ・視点操作・ヒント)
feature: web
depends_on: [024]
owns: [web/src/app/ReviewPage.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/annotation/annotation.css, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, ../docs/DESIGN_SKILL.md, web/web_Summary.md, web/src/styles/tokens.css, web/src/styles/controls.css, web/src/app/review.css, web/src/store/annotation.ts, web/src/store/presence.ts, web/src/store/session.ts, web/src/store/comments.ts, web/src/store/camera.ts, web/src/features/annotation/stroke-build.ts, web/src/features/viewer/CameraRig.tsx]
verify: npm run typecheck && npm run test:web && npm run build
status: todo
---

## 目的
設計書 §8 の仮説 C(Follow)と D(3D 非経験者)を測れる状態にする。**今どのモードか、
今誰の視点を追従しているか、今何をすればよいか**を、ビューアの上に常時表示する。
用語を D36 の日本語に統一し、ペンモードで Orbit が止まる(D31)ことを画面で説明する。

## 前提
- 024 で `ReviewPage` に `<div class="review-hud">` の容器があり、中に「視点を戻す」「全体を表示」と
  `<AnnotationToolbar send>` が現状のまま置かれている。**このタスクで中身を `<ViewerHud>` 1 つに置き換える**
  (`review-hud` の位置・`pointer-events` の規則は 024 の `review.css` が持つ。変えない)
- annotation ストア(`web/src/store/annotation.ts`): `mode: "orbit" | "pen" | "comment"`、`color`、`strokes`、
  `drafting`、`setMode` `setColor`。`STROKE_COLORS`(6 色)と `DEFAULT_STROKE_COLOR`
- `latestOwnStrokeId(strokes, selfId)`(`features/annotation/stroke-build.ts`)で Undo 対象を求める(017 と同じ)
- presence ストア: `users: Record<id, PresenceUser>`、`followingUserId`、`unfollow()`。
  Follow 中は `CameraRig` が毎フレーム追従し、ユーザー操作(OrbitControls `start`)で解除される(D27)
- comments ストア: `composerAnchor: Vec3 | null`(コメント位置が決まっているか)
- camera ストア: `requestReset()` `requestFit()`
- session ストア: `selfId`、`connection`。線の送信は `connection === "open"` のときだけ(017)
- 現在の `AnnotationToolbar` は「モード 3 ボタン(英語) + 色 6 個 + Undo/Clear」を 1 つの `role="toolbar"` に持つ。
  **このタスクでモード切替を `ViewerHud` 側へ移し、`AnnotationToolbar` はペン道具(色・1本戻す・自分の線を消す)だけにする**
- `.btn[aria-pressed="true"]` の選択スタイルは 023 の `controls.css` にある。モード・色ボタンはこれを使う
- 用語は D36、対象環境は D37。SKILL §4.4: 少数の排他モードは segmented control
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/viewer/hud-labels.ts — 文言と判定の純粋関数(D36)
import type { AnnotationMode } from "../../store/annotation";

export const MODE_LABELS: Readonly<Record<AnnotationMode, string>>; // orbit 視点 / pen ペン / comment コメント
export const MODE_ORDER: readonly AnnotationMode[];                    // ["orbit", "pen", "comment"]
export const RESET_LABEL: string;   // 視点を戻す
export const FIT_LABEL: string;     // 全体を表示
export const UNDO_LABEL: string;    // 1本戻す
export const CLEAR_LABEL: string;   // 自分の線を消す
export const UNFOLLOW_LABEL: string; // 追従を解除

/** STROKE_COLORS の 6 色に対する日本語名。未知の色は 16 進をそのまま返す */
export function colorName(hex: string): string;

/** 「{name} の視点を追従中」。name が空なら「他の参加者の視点を追従中」 */
export function followingLabel(name: string): string;

export interface HintInput {
  mode: AnnotationMode;
  canEdit: boolean;      // connection === "open"
  hasAnchor: boolean;    // composerAnchor !== null
  following: boolean;    // followingUserId !== null
}
/** ビューア左下の 1 行ヒント。優先順: following > mode 別
 *  following: 「操作すると追従が解除されます」
 *  orbit:     「ドラッグで回転、ホイールで拡大縮小、右ドラッグで移動」
 *  pen & canEdit:   「モデルの上をドラッグして線を描きます(この間は視点を動かせません)」
 *  pen & !canEdit:  「接続が切れているため線を描けません」
 *  comment & !hasAnchor: 「モデルをクリックしてコメントの位置を決めます」
 *  comment & hasAnchor:  「右のパネルで本文を入力してください」 */
export function hint(input: HintInput): string;
```

```tsx
// web/src/features/viewer/ViewerHud.tsx — review-hud 容器の中身。ストアは自分で購読する
/** <div class="hud">
 *    <div class="hud__row">
 *      <div class="hud-modes" role="group" aria-label="操作モード">          ← segmented control
 *        MODE_ORDER.map(m => <button type="button" class="btn hud-mode" aria-pressed={mode===m} onClick={setMode(m)}>{MODE_LABELS[m]}</button>)
 *      </div>
 *      {mode === "pen" && <AnnotationToolbar send={send} />}                ← ペン道具はペン中だけ
 *      <div class="hud-view" role="group" aria-label="視点">
 *        <button class="btn btn--quiet" onClick={requestReset}>{RESET_LABEL}</button>
 *        <button class="btn btn--quiet" onClick={requestFit}>{FIT_LABEL}</button>
 *      </div>
 *    </div>
 *    {followingUserId && (
 *      <div class="hud-follow" role="status" style={{"--user-color": users[followingUserId]?.color}}>
 *        <i class="hud-follow__dot"/> {followingLabel(users[followingUserId]?.name ?? "")}
 *        <button class="btn btn--quiet" onClick={unfollow}>{UNFOLLOW_LABEL}</button>
 *      </div>)}
 *    <p class="hud-hint" role="status" aria-live="polite">{hint(...)}</p>
 *  </div>
 *  followingUserId が users に無い(退室直後)場合もクラッシュせず followingLabel("") を出す */
export function ViewerHud(props: { send: (msg: ClientMessage) => boolean }): React.ReactElement;
```

```tsx
// web/src/features/annotation/AnnotationToolbar.tsx(変更)— ペン道具だけ。モード切替は持たない
/** <div class="annotation-tools" role="toolbar" aria-label="ペン">
 *    <div class="annotation-colors" role="group" aria-label="線の色">
 *      STROKE_COLORS.map(c => <button type="button" class="annotation-color" aria-label={colorName(c)} aria-pressed={color===c}
 *                                style={{"--stroke-color": c}} onClick={setColor(c)} />)
 *    </div>
 *    <button class="btn btn--quiet" disabled={!canEdit || latestStrokeId===null} onClick=stroke:remove>{UNDO_LABEL}</button>
 *    <button class="btn btn--quiet" disabled={!canEdit || ownStrokeCount===0} onClick=stroke:clear>{CLEAR_LABEL}</button>
 *  送信条件(canEdit = connection==="open"、selfId 必須)は 017 のまま */
export function AnnotationToolbar(props: { send: (msg: ClientMessage) => boolean }): React.ReactElement;
```

```css
/* web/src/features/viewer/viewer.css — 接頭辞 hud- */
/* .hud            display:contents(位置は親 .review-hud のフレックスに任せ、.hud-follow / .hud-hint の absolute は .review-hud(inset:0)基準になる)。pointer-events は書かない(024 の `.review-hud :is(.btn, [role=…])` の規則で、role を持つ要素と .btn だけが auto になる)
   .hud__row       flex; gap var(--space-3); align-items:center; flex-wrap:wrap(左上に並ぶ)
   .hud-modes      surface 背景; border 1px; radius-md; padding 2px; display:inline-flex; box-shadow var(--shadow-overlay)
   .hud-mode       .btn を上書き: border:0; radius-sm; 選択時([aria-pressed="true"])は accent 背景 + on-accent 文字(controls.css の subtle より強く。1 画面で最も重要な状態のため)
   .hud-view       surface 背景; border; radius-md; box-shadow overlay; inline-flex
   .hud-follow     position:absolute; top var(--space-3); left 50%; translate -50% 0; surface; border-left 4px solid var(--user-color, var(--color-accent)); radius-md; shadow; padding var(--space-1) var(--space-3); inline-flex; gap var(--space-2); align-items:center
   .hud-follow__dot 0.625rem の円; background var(--user-color, var(--color-accent))
   .hud-hint       position:absolute; bottom var(--space-3); left var(--space-3); text-sm; text-muted; surface 背景; radius-sm; padding var(--space-1) var(--space-2); max-width 40rem */
/* web/src/features/annotation/annotation.css — 接頭辞 annotation- */
/* .annotation-tools  surface; border; radius-md; shadow; padding 2px var(--space-2); inline-flex; gap var(--space-2); align-items:center
   .annotation-colors inline-flex; gap var(--space-1)
   .annotation-color  1.25rem 円; background var(--stroke-color, var(--color-border)); border 2px solid var(--color-surface); 選択時([aria-pressed="true"])は outline 2px solid var(--color-text) offset 1px */
```

`ReviewPage.tsx` の変更: `.review-hud` の中身を `<ViewerHud send={realtime.send} />` だけにする。
`requestReset` / `requestFit` の関数と `AnnotationToolbar` の import を `ReviewPage` から消す。それ以外は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MODE_LABELS` / `MODE_ORDER` | `{orbit:"視点", pen:"ペン", comment:"コメント"}` / `["orbit","pen","comment"]` |
| `colorName("#ff0000")` … 6 色 | 赤 / 橙 / 緑 / 青 / 紫 / 桃(D36 の対応) |
| `colorName("#123456")` | `"#123456"` |
| `colorName("#FF0000")` | `"赤"`(大文字も同じ色として扱う) |
| `followingLabel("A")` / `("")` | `"A の視点を追従中"` / `"他の参加者の視点を追従中"` |
| `hint({following:true, …任意})` | `"操作すると追従が解除されます"`(mode に関係なく最優先) |
| `hint({mode:"orbit", …})` | ドラッグで回転… の文言 |
| `hint({mode:"pen", canEdit:true})` / `canEdit:false` | 線を描きます… / 接続が切れている… |
| `hint({mode:"comment", hasAnchor:false})` / `hasAnchor:true` | クリックして位置… / 右のパネルで本文… |
| モードボタンを押す(目視) | 押したボタンだけ accent 塗り。ペンに切り替えると色・1本戻す・自分の線を消す が現れ、他モードでは消える |
| ペンモードでドラッグ(目視) | 線が描け、視点は動かない。ヒントに「視点を動かせません」が出ている |
| 参加者一覧で「Follow」(目視。026 前は現行文言) | 上中央にその人の色の帯と「{名前} の視点を追従中」。ドラッグすると消える。「追従を解除」でも消える |
| 追従中の相手が退室(目視) | バッジが消える(presence の `applyWelcome`/`removeUser` が解除する。クラッシュしない) |
| 切断中にペンモード(目視) | 1本戻す / 消す が disabled、ヒントが「接続が切れている…」 |
| 既存の全テスト + `styles-rules.test.ts` | 通る(`viewer.css` `annotation.css` が規約を満たす) |
| `ReviewPage.tsx` `ViewerHud.tsx` `AnnotationToolbar.tsx` | inline `style={{` は `--user-color` / `--stroke-color` を渡す箇所のみ |

## やらないこと
- `CameraRig` `AnnotationLayer` `CommentPickLayer` など Canvas 内の変更(モードの意味は変えない)
- モードのキーボードショートカット(1/2/3 等)。有用だが今回は起票しない
- `PresenceList` の Follow ボタン文言の変更(026)
- session / presence / annotation ストアの変更
- ダークテーマ・レスポンシブ・アニメーション(D37)。バッジの出現に transition を付けるなら opacity のみ
- 依存の追加・package.json の変更

## 目視確認(マージ後に人間が行う)
`npm run dev:server` + `npm run dev:web`、ブラウザ 2 つで同じ URL を開き、1280×800 と 1920×1080 で:
- [ ] 現在のモードが**見ただけで**分かる(3D を知らない人に「今どのモード?」と聞いて即答できる)
- [ ] ペンモードで「回そうとしたら動かない」と感じたとき、ヒントがその理由を言っている
- [ ] 片方で Follow → もう片方を動かすと、Follow 側の画面が動き、上中央のバッジが誰の視点かを示す
- [ ] Follow 側でドラッグ → バッジが消えて自由に動ける
- [ ] HUD の空き領域(ボタンの間)をドラッグしても視点が回る(`pointer-events` の抜け)
- [ ] 入室ダイアログの下に HUD が透けて見えるが操作できない(024 の backdrop)
- [ ] `docs/DESIGN_SKILL.md` §12: グロー・大きな影・pill 形が無い。accent はモード選択と Follow 帯だけ

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM 構造・クラス名で実装されている
- [ ] 振る舞い表の純粋関数の行すべてに対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(`ViewerHud` `hud-labels` `viewer.css` `annotation.css`、`AnnotationToolbar` の責務縮小)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web && npm run build` が成功する
- [ ] 最終メッセージに `docs/DESIGN_SKILL.md` §16 の Visual audit 1〜12 と Interaction audit 1〜6 への回答を書く
