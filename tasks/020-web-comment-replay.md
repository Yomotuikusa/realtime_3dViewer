---
id: 020
title: web コメント再現(視点の補間移動と線の一時表示)
feature: web
depends_on: [019]
owns: [web/src/features/comments/replay.ts, web/src/features/comments/useCommentReplay.ts, web/src/features/comments/ReplayStrokes.tsx, web/src/app/ReviewPage.tsx, web/tests/comment-replay.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, web/src/store/camera.ts, web/src/store/presence.ts, web/src/store/annotation.ts, web/src/store/comments.ts, web/src/features/annotation/StrokeLines.tsx, web/src/features/viewer/CameraRig.tsx]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
中核体験 §3-5。コメントを選択すると、投稿時の視点へ 300ms 程度で補間移動し、
投稿時の線を「再現中の線」として一時表示する。別コメントの選択・選択解除で消す(§16.4)。

## 前提
- 018 の comments ストア(`items` / `selectedId`)、012 の camera ストア(`requestCamera`)、
  016 の annotation ストア(`replayStrokes` / `setReplayStrokes`)、016 の `StrokeLines(props)`
  が実装済み
- 015 の `CameraRig` は `pendingCamera` を consume した時点で `presence.unfollow()` する(D27)。
  したがって**ここで `unfollow` を呼ぶ必要はない**が、consume は次フレームなので
  `applyCommentReplay` でも `unfollow()` を呼んで即時性を保証する(冪等)
- 再現中の線は WS に流さない(D7)。ルームのライブな線(`strokes`)とは別レイヤ
- 決定事項 **D7 / D27 / D33**
- テスト対象は `applyCommentReplay`(各ストアの `getState()` で検証)。フック / R3F は typecheck のみ
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/comments/replay.ts
import type { Comment } from "@shared/types";

/** 選択の変化を各ストアへ反映する。React 外の純粋な入口(D33)。
 *  comment 非 null: camera.requestCamera(comment.camera)、presence.unfollow()、
 *                    annotation.setReplayStrokes(comment.strokes)
 *  comment null:    annotation.setReplayStrokes([]) のみ(カメラは動かさない) */
export function applyCommentReplay(comment: Comment | null): void;

/** 再現中の線の表示透明度 */
export const REPLAY_OPACITY = 0.6;
```

```ts
// web/src/features/comments/useCommentReplay.ts
/** comments ストアの selectedId を購読し、変化のたびに items から該当 Comment を引いて
 *  applyCommentReplay を呼ぶ。同じ id が続く間は再実行しない。アンマウント時は applyCommentReplay(null) */
export function useCommentReplay(): void;
```

```tsx
// web/src/features/comments/ReplayStrokes.tsx
/** annotation ストアの replayStrokes を <StrokeLines strokes opacity={REPLAY_OPACITY} /> で描く。Canvas 内に置く */
export function ReplayStrokes(): React.ReactElement;
```

`ReviewPage` への追加分: `useCommentReplay()` を呼ぶ。`<ViewerCanvas>` の children に `<ReplayStrokes />`。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyCommentReplay(c)`(strokes 2 本) | `camera.consumePendingCamera()` が `c.camera` と `cameraEquals` な別参照。`annotation.replayStrokes` が 2 本 |
| Follow 中(`presence.followingUserId === "a"`)に `applyCommentReplay(c)` | `followingUserId === null` |
| `applyCommentReplay(c)` → `applyCommentReplay(null)` | `replayStrokes` が `[]`。`pendingCamera` は **新たに積まれない**(c で積んだ分を consume 済みなら null のまま) |
| `applyCommentReplay(null)`(何も選択していない状態から) | どのストアも変わらない。throw しない |
| `applyCommentReplay(c1)` → `applyCommentReplay(c2)` | `replayStrokes` が c2 のもの、`pendingCamera` が c2 の camera(後勝ち) |
| `applyCommentReplay(c)` の後、`annotation.strokes`(ライブ線) | 変わらない(別レイヤ) |
| `REPLAY_OPACITY` | 0.6 |

## やらないこと
- `CameraRig` の変更(補間は 012 / 015 の実装に任せる)
- comments / annotation / camera ストアの変更
- 再現中の線をルームへ送ること(D7)
- 描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(再現フロー、ライブ線と再現線の分離)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
