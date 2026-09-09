---
id: 019
title: web コメント投稿(アンカークリック・Composer・3D ピン)
feature: web
depends_on: [018]
owns: [web/src/features/comments/compose.ts, web/src/features/comments/CommentPickLayer.tsx, web/src/features/comments/CommentComposer.tsx, web/src/features/comments/CommentPins.tsx, web/src/app/ReviewPage.tsx, web/tests/compose.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, web/src/api/client.ts, web/src/store/session.ts, web/src/store/camera.ts, web/src/store/annotation.ts, web/src/store/comments.ts, web/src/features/viewer/pick.ts, web/src/features/viewer/model-target.ts, web/src/features/annotation/stroke-build.ts, web/src/features/annotation/AnnotationLayer.tsx]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
MVP #5(Viewpoint Comment)の書く側。Comment モードでモデルをクリックして位置(anchor)を決め、
本文を入力して「現在の視点 + 自分の線 + anchor + 本文」を投稿する(§16.4)。
投稿済みコメントは 3D 上にピンとして表示し、クリックで選択できるようにする。

## 前提
- 018 の comments ストア(`composerAnchor` / `setComposerAnchor` / `upsert` / `select` / `setLastError`)
  と 011 の `createComment(projectId, input)` が実装済み
- 017 の `pickModel` `toNdc` `getModelTarget`(`features/viewer/`)と `offsetAlongNormal`
  (`features/annotation/stroke-build.ts`)を使う。レイキャストを再実装しない
- 017 の `AnnotationLayer` は `mode === "pen"` のときだけリスナを付ける。**このタスクの
  `CommentPickLayer` は `mode === "comment"` のときだけ付ける**ので、両者が同時に反応することはない。
  `AnnotationLayer.tsx` は変更しない(reads のみ。イベントの付け方を揃える参考にする)
- Comment モード中も OrbitControls は有効(D31: 無効化は pen のみ)。したがって
  「ドラッグ(視点操作)」と「クリック(配置)」を **移動量で区別**する
- `CreateCommentInput` は `@shared/api`(`strokes` は最大 200 本、`body` は trim 後 1〜2000 文字)。
  `authorName` は session ストアの `name`、`versionId` は `project.latestVersion.id`
- サーバは POST 後に `comment:created` を自分を含む全員へ配信する(008)。自分は REST 応答で
  `upsert` し、WS でも同じものが来る(冪等)
- drei の `Html` はラベル用(014 の `RemoteCameras` と同じ使い方)
- 決定事項 **D28 / D32**
- テスト対象は `compose.ts` のみ。コンポーネントは typecheck のみ
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/comments/compose.ts
import type { CameraState, Comment, Stroke, Vec3 } from "@shared/types";
import type { CreateCommentInput } from "@shared/api";

/** クリック判定に使う移動量の上限(px) */
export const CLICK_MOVE_THRESHOLD_PX = 5;
/** down と up の距離が閾値以下ならクリック */
export function isClick(down: { x: number; y: number }, up: { x: number; y: number }): boolean;

/** 自分の線を createdAt 昇順(同値は id 昇順)で。userId が null なら []。
 *  200 本を超えるなら **新しい方** 200 本を残す */
export function ownStrokesForComment(strokes: Record<string, Stroke>, userId: string | null): Stroke[];

/** 投稿本文を組む。body は trim。空なら null。camera / anchor は複製して入れる */
export function buildCommentInput(args: {
  versionId: string; authorName: string; body: string;
  anchor: Vec3; camera: CameraState;
  strokes: Record<string, Stroke>; userId: string | null;
}): CreateCommentInput | null;
```

```tsx
// web/src/features/comments/CommentPickLayer.tsx
/** 何も描画しない(null)。Canvas 内に置き、mode === "comment" の間だけ gl.domElement に
 *  pointerdown / pointerup を付ける。isClick なら pickModel → offsetAlongNormal → setComposerAnchor */
export function CommentPickLayer(): null;

// web/src/features/comments/CommentComposer.tsx
/** composerAnchor が null なら何も描画しない。textarea と「投稿」「キャンセル」。
 *  投稿: buildCommentInput → createComment → upsert + setComposerAnchor(null) + select(comment.id)。
 *  失敗は comments.setLastError(ApiClientError.message)。送信中は disabled */
export function CommentComposer(props: { projectId: string; versionId: string }): React.ReactElement | null;

// web/src/features/comments/CommentPins.tsx
/** selectVisible(items, showOnlyOpen) の各コメントを anchor 位置に drei Html でピン表示。
 *  ピンのクリックで select(id)。選択中は強調、resolved は薄く。Canvas 内に置く */
export function CommentPins(): React.ReactElement;
```

`CommentPickLayer` の動作:

| イベント | 動作 |
| --- | --- |
| `pointerdown`(主ボタン) | down 位置を記録 |
| `pointerup` | `isClick(down, up)` かつ `pickModel` ヒット → `setComposerAnchor(offsetAlongNormal(point, normal, modelSize))`。ドラッグ / 外れなら何もしない |
| mode が "comment" 以外 | リスナを外す |

`CommentComposer` の投稿内容: `anchor = composerAnchor`、`camera = cameraStore.selfCamera`、
`strokes = annotationStore.strokes`(`buildCommentInput` が自分の分だけ抜く)、
`authorName = sessionStore.name`、`userId = sessionStore.selfId`。
`connection !== "open"` でも投稿は REST なので**許可する**(線は空になりうる)。
投稿後、`setMode("orbit")` は **しない**(連続投稿できるように)。

`ReviewPage` への追加分: `<ViewerCanvas>` の children に `<CommentPickLayer />` と `<CommentPins />`。
サイドパネルの `<CommentList>` の上に `<CommentComposer projectId versionId={project.latestVersion.id} />`。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `isClick({x:0,y:0}, {x:3,y:4})` | `true`(距離 5 は閾値以下) |
| `isClick({x:0,y:0}, {x:3,y:5})` | `false` |
| `ownStrokesForComment({a:u1@2, b:u2@1, c:u1@1}, "u1")` | `[c, a]` |
| `ownStrokesForComment(…, null)` | `[]` |
| 自分の線 250 本 | 200 本で、createdAt が大きい方(新しい方)が残り、昇順 |
| `buildCommentInput({… body:"  hi  " …})` | `body === "hi"`、`versionId` / `authorName` がそのまま |
| `buildCommentInput({… body:"   " …})` | `null` |
| `buildCommentInput` の `camera` / `anchor` | 入力と `cameraEquals` / 各成分一致、かつ別参照(`position` 配列も) |
| `buildCommentInput` の `strokes` | `ownStrokesForComment` と同じ結果 |
| `buildCommentInput` の結果 | `CreateCommentInput.safeParse` が成功する(`strokes` が空でも) |
| `CLICK_MOVE_THRESHOLD_PX` | 5 |

## やらないこと
- コメント再現(選択時のカメラ移動・線の一時表示)は 020
- comments ストア / `CommentList` の変更(018 の成果物)。`AnnotationLayer` / `pick.ts` の変更
- 投稿時に自分の線を消すこと(線はルームに残す。§15 の思想どおり)
- 画像添付・メンション(MVP 外)
- 描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(投稿フロー、クリック判定規則)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
