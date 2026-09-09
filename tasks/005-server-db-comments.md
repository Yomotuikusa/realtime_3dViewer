---
id: 005
title: server comments テーブル層
feature: server
depends_on: [004]
owns: [server/src/db/comments.ts, server/tests/db-comments.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, server/src/db/connection.ts, server/src/db/projects.ts, server/src/db/schema.sql, server/tests/helpers/tmp.ts]
verify: npm run typecheck && npm run test:server
status: todo
---

## 目的
Viewpoint Comment(§6 #5, #6)の永続化。anchor / camera / strokes は JSON 列に保存し、
ドメイン型 `Comment` として読み書きする。

## 前提
- 004 で `comments` テーブル(schema.sql)、`openDb` `withTransaction`、`insertProject`
  `insertModelVersion` が実装済み。テストのシードにはこれらを使う
- `comments.status` は CHECK 制約 `IN ('open','resolved')`。`project_id` `version_id` は FK
- JSON 列は `JSON.stringify` / `JSON.parse` で扱い、読み出し時に `Vec3Schema` 等での再検証はしない
  (書き込み時に routes が検証する)
- 決定事項 D12: 一時 DB が要る場合は `server/tests/helpers/tmp.ts` を使う。`:memory:` でもよい
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/db/comments.ts
import type { Comment, CommentStatus, CameraState, Stroke, Vec3 } from "@shared/types";
import type { Db } from "./connection";

export interface NewComment {
  id: string; projectId: string; versionId: string; authorName: string; body: string;
  anchor: Vec3; camera: CameraState; strokes: Stroke[]; createdAt: number;
}
/** status は "open"、updatedAt = createdAt。挿入した行を Comment として返す */
export function insertComment(db: Db, input: NewComment): Comment;
/** created_at 昇順(同値なら id 昇順)。status 指定時はその status のみ */
export function listComments(db: Db, projectId: string, status?: CommentStatus): Comment[];
/** projectId に属さない commentId なら null */
export function findComment(db: Db, projectId: string, commentId: string): Comment | null;
/** 更新後の Comment を返す。無ければ null(更新しない) */
export function updateCommentStatus(
  db: Db, projectId: string, commentId: string, status: CommentStatus, updatedAt: number,
): Comment | null;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `insertComment` → 返り値 | 入力の全フィールド + `status:"open"` + `updatedAt === createdAt` |
| `insertComment` で strokes が 2 本(各 3 点) | `findComment` で同じ内容が `Stroke[]` として戻る(深い等価) |
| `insertComment` で存在しない projectId / versionId | throw(FK) |
| `listComments` 3 件(createdAt 30, 10, 20 の順で挿入) | createdAt 10, 20, 30 の順 |
| `listComments` で createdAt が同じ 2 件 | id 昇順 |
| `listComments(db, p, "open")` | resolved のものは含まない |
| `listComments` で別 project のコメント | 含まない |
| `listComments` で 0 件 | `[]` |
| `findComment(p, "nope")` | null |
| `findComment(projectB, commentOfProjectA)` | null |
| `updateCommentStatus(..., "resolved", 999)` | 返り値 `status:"resolved"`, `updatedAt:999`。`createdAt` は不変。`findComment` でも反映 |
| `updateCommentStatus` を "resolved" → "open" | 戻せる(Open/Resolved トグル) |
| `updateCommentStatus` で存在しない id / 別 project の id | null。何も変わらない |

## やらないこと
- HTTP ルート(008)、WS 配信(010)
- 入力の zod 検証(routes の責務)
- コメントの削除・本文編集(MVP 外)
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
