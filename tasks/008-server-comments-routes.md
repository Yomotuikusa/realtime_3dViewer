---
id: 008
title: server コメント API(一覧・投稿・Resolve)
feature: server
depends_on: [007]
owns: [server/src/routes/comments.ts, server/src/app.ts, server/tests/helpers/app.ts, server/tests/routes-comments.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, shared/src/protocol.ts, server/src/errors.ts, server/src/db/connection.ts, server/src/db/projects.ts, server/src/db/comments.ts, server/src/routes/projects.ts, server/tests/helpers/tmp.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
Viewpoint Comment(§6 #5, #6)の REST 面を通す。保存後に `deps.publish` を呼び、
他の参加者へ `comment:created` / `comment:updated` を配信できる状態にする(実配信の結線は 010)。

## 前提
- 006 で `createApp(deps)` / `AppDeps`(`db` `storage` `config` `publish` `now` `newId`)/
  `tests/helpers/app.ts` の `makeTestApp` `seedProject` が実装済み。007 で
  `routes/projects.ts` に POST が入っている(server_Summary.md 参照)
- `createApp` は現在 `projectRoutes` だけをマウントしている。**このタスクで `app.ts` に
  `commentRoutes` のマウントを追加する**(`app.ts` は 006 の owns だが、006→007→008 は
  直列なので競合しない)
- `makeTestApp().published` は `publish` の呼び出し記録
  (`Array<{ projectId: string; msg: ServerMessage }>`)。ここに配信を検証する
- 005 の `insertComment` `listComments` `findComment` `updateCommentStatus`、
  004 の `findProject` `findModelVersion` をそのまま使う。SQL はこのタスクで書かない
- `CreateCommentInput` `UpdateCommentStatusInput` `ListCommentsQuery` `ErrorCode` は `@shared/api`。
  `authorName` `body` は zod 側で trim 済みの値が出てくる
- 決定事項 D5 / D13 / **D17**(docs/task-breakdown.md §3 と本タスクの表を参照)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/routes/comments.ts
import type { Hono } from "hono";
import type { AppDeps } from "../app";

/** createApp が "/api/projects/:projectId/comments" にマウントする */
export function commentRoutes(deps: Required<AppDeps>): Hono;
```

```ts
// server/src/app.ts(追加分のみ。既存の projectRoutes マウントは変えない)
//   app.route("/api/projects/:projectId/comments", commentRoutes(resolved));
// ※ Hono のマウント方法は実装者が決めてよい。パスが下表どおりに解決されればよい
```

```ts
// server/tests/helpers/app.ts(追加分のみ。既存 export のシグネチャは変えない)
import type { Comment } from "@shared/types";
/** seedProject 済みの project にコメントを 1 件シードする。省略値は下記 */
export function seedComment(
  t: TestApp,
  opts: { projectId: string; versionId: string;
          id?: string; authorName?: string; body?: string;
          status?: CommentStatus; createdAt?: number; strokes?: Stroke[] },
): Comment;
```

ルート(すべて `:projectId` が存在しなければ 404 NOT_FOUND):

| メソッド / パス | 入力 | 出力 |
| --- | --- | --- |
| `GET /api/projects/:projectId/comments` | query `?status=open|resolved`(任意) | 200 `Comment[]`(created_at 昇順) |
| `POST /api/projects/:projectId/comments` | JSON `CreateCommentInput` | 201 `Comment` |
| `PATCH /api/projects/:projectId/comments/:commentId` | JSON `UpdateCommentStatusInput` | 200 `Comment` |

POST の処理順:

1. `findProject(db, projectId)` が null → 404 NOT_FOUND
2. body を `CreateCommentInput` で parse(失敗 → 400 VALIDATION)
3. `findModelVersion(db, projectId, input.versionId)` が null → **404 NOT_FOUND**(D17)
4. `insertComment(db, { id: newId(), projectId, ...input, createdAt: now() })`
5. `publish(projectId, { type: "comment:created", comment })`
6. 201 で `comment` を返す

PATCH の処理順:

1. `findProject` が null → 404 NOT_FOUND
2. body を `UpdateCommentStatusInput` で parse(失敗 → 400 VALIDATION)
3. `updateCommentStatus(db, projectId, commentId, status, now())` が null → 404 NOT_FOUND
4. `publish(projectId, { type: "comment:updated", comment })`
5. 200 で `comment` を返す

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `GET .../comments`(0 件) | 200 `[]` |
| `GET .../comments`(createdAt 30, 10, 20 の順でシード) | 200。createdAt 10, 20, 30 の順の配列 |
| `GET .../comments?status=open`(open 2 件 / resolved 1 件) | 200。2 件、すべて `status:"open"` |
| `GET .../comments?status=done` | 400 VALIDATION |
| `GET .../comments` で別 project のコメント | 含まれない |
| `GET /api/projects/nope/comments` | 404 NOT_FOUND |
| POST 正常(`ids=["c1"]`) | 201。`id:"c1"`、`status:"open"`、`createdAt === updatedAt === 1700000000000`、入力の anchor / camera / strokes が深い等価で戻る |
| 上と同じ POST の後 `published` | 長さ 1。`{projectId:<該当>, msg:{type:"comment:created", comment:<レスポンスと同じ>}}` |
| POST 後に `GET .../comments` | 投稿したコメントが含まれる |
| POST で `body:""` / 2001 文字 / `authorName:"   "` | 400 VALIDATION。`published` は空、DB にも増えない |
| POST で `anchor:[0,0]` / `camera` 欠落 / `strokes` が 201 本 | 400 VALIDATION |
| POST で JSON ではない本文 | 400 VALIDATION(500 にしない) |
| POST で `versionId` が別 project の版 / 存在しない版 | 404 NOT_FOUND。`published` は空、DB にも増えない |
| POST で `authorName:"  Rin  "`, `body:"  ok  "` | 保存値は `"Rin"` / `"ok"`(zod の trim) |
| POST で `strokes: []` | 201(空配列は許可) |
| `PATCH .../comments/<id>` に `{status:"resolved"}` | 200。`status:"resolved"`、`updatedAt` は now()、`createdAt` は不変 |
| 上の直後の `published` | `{type:"comment:updated", comment:<レスポンスと同じ>}` |
| PATCH で resolved → open | 200 で戻せる |
| PATCH に `{status:"done"}` / `{}` | 400 VALIDATION。`published` は空 |
| `PATCH .../comments/nope` | 404 NOT_FOUND。`published` は空 |
| 別 project のコメント id を PATCH | 404 NOT_FOUND |
| `PATCH /api/projects/nope/comments/<id>` | 404 NOT_FOUND |
| `seedComment` の既定値 | `authorName:"Tester"`, `body:"seed"`, `status:"open"`, `strokes:[]`, `createdAt:1700000000000`, `id` は `ids` キューから |

## やらないこと
- WebSocket 実配信・RoomHub(009 / 010)。`publish` はあくまで `AppDeps` 経由で呼ぶだけ
- コメントの削除・本文編集(MVP 外)
- `server/src/db/comments.ts` の変更(005 の成果物。SQL を書き足さない)
- `server/src/routes/projects.ts` / `server/src/index.ts` の変更
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(コメント 3 ルートの入出力・エラーコード・publish の呼び出し)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
