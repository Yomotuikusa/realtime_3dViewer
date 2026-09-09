---
id: 002
title: shared REST 入出力スキーマと WS プロトコル
feature: shared
depends_on: [001]
owns: [shared/src/api.ts, shared/src/protocol.ts, shared/src/index.ts, shared/tests/api.test.ts, shared/tests/protocol.test.ts, shared/shared_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/src/types.ts]
verify: npm run test:shared
status: todo
---

## 目的
REST(§14)と WebSocket(§15)の入出力を zod で 1 度だけ定義し、サーバ受信・クライアント受信の
両側で同じスキーマを使えるようにする。

## 前提
- 001 で `shared/src/types.ts` に `Vec3Schema` `CameraStateSchema` `StrokeSchema`
  `CommentStatusSchema` `CommentSchema` `PresenceUserSchema` が定義済み。ここから import する
- `shared/src/index.ts` は `SHARED_SCAFFOLD` と `export * from "./types"` を持つ。
  `SHARED_SCAFFOLD` は残したまま `api` `protocol` の re-export を追加する
- zod 4.5.4。discriminated union は `z.discriminatedUnion("type", [...])`
- 決定事項 D9 / D16(docs/task-breakdown.md §3)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// shared/src/api.ts
import { z } from "zod";

export const ErrorCode = {
  VALIDATION: "VALIDATION", NOT_FOUND: "NOT_FOUND", UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE", BAD_REQUEST: "BAD_REQUEST", INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError { error: { code: ErrorCode; message: string } }
export const ApiErrorSchema = /* ... */ satisfies z.ZodType<ApiError>;

export const MAX_UPLOAD_BYTES_DEFAULT = 100 * 1024 * 1024;
export const ALLOWED_MODEL_EXTENSIONS = [".glb", ".gltf"] as const;
export const ProjectNameSchema = z.string().trim().min(1).max(100);

export const CreateCommentInput = z.object({
  versionId: z.string().min(1),
  authorName: z.string().trim().min(1).max(50),
  body: z.string().trim().min(1).max(2000),
  anchor: Vec3Schema,
  camera: CameraStateSchema,
  strokes: z.array(StrokeSchema).max(200),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

export const UpdateCommentStatusInput = z.object({ status: CommentStatusSchema });
export type UpdateCommentStatusInput = z.infer<typeof UpdateCommentStatusInput>;

export const ListCommentsQuery = z.object({ status: CommentStatusSchema.optional() });
export type ListCommentsQuery = z.infer<typeof ListCommentsQuery>;
```

```ts
// shared/src/protocol.ts
export const MAX_NAME_LENGTH = 50;
export const CAMERA_SEND_INTERVAL_MS = 50;   // 最大 20Hz

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "camera"; camera: CameraState }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear" };

export type ServerMessage =
  | { type: "welcome"; selfId: string; users: PresenceUser[]; strokes: Stroke[] }
  | { type: "user:joined"; user: PresenceUser }
  | { type: "user:left"; userId: string }
  | { type: "camera"; userId: string; camera: CameraState }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear"; userId: string }
  | { type: "comment:created"; comment: Comment }
  | { type: "comment:updated"; comment: Comment }
  | { type: "error"; code: string; message: string };

export const ClientMessageSchema = /* z.discriminatedUnion("type", [...]) */ satisfies z.ZodType<ClientMessage>;
export const ServerMessageSchema = /* ... */ satisfies z.ZodType<ServerMessage>;

export type ParseResult<T> = { ok: true; msg: T } | { ok: false; error: string };
/** 1 フレーム(テキスト)を JSON parse → スキーマ検証。例外を投げない */
export function parseClientMessage(raw: string): ParseResult<ClientMessage>;
export function parseServerMessage(raw: string): ParseResult<ServerMessage>;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `CreateCommentInput` に妥当な入力(strokes 空配列) | 受理 |
| `authorName` が `"  "`(空白のみ)/ 51 文字 | 拒否(trim 後 min 1、max 50) |
| `body` が 2001 文字 | 拒否 |
| `strokes` が 201 本 | 拒否 |
| `anchor` が `[0,0]` | 拒否 |
| `UpdateCommentStatusInput` に `{status:"resolved"}` | 受理。`{status:"done"}` は拒否 |
| `ListCommentsQuery` に `{}` / `{status:"open"}` | 受理。`{status:"x"}` は拒否 |
| `ApiErrorSchema` に `{error:{code:"NOT_FOUND",message:"x"}}` | 受理。code が `ErrorCode` に無い値なら拒否 |
| `ProjectNameSchema` に `"  abc  "` | 受理し、出力は `"abc"` |
| `ClientMessageSchema` に `{type:"join",name:""}` | 受理(空名は RoomHub が Guest 名を割り当てる。D9) |
| `ClientMessageSchema` に `{type:"join",name:<51 文字>}` | 拒否 |
| `ClientMessageSchema` に `{type:"camera",camera:{position:[1,2,3],target:[0,0,0]}}` | 受理 |
| `ClientMessageSchema` に `{type:"stroke:add",stroke:<1 点の stroke>}` | 拒否(StrokeSchema の min 2) |
| `ClientMessageSchema` に `{type:"stroke:remove",strokeId:""}` | 拒否 |
| `ClientMessageSchema` に `{type:"stroke:clear"}` | 受理 |
| `ClientMessageSchema` に `{type:"welcome",...}`(サーバ→クライアントのメッセージ) | 拒否 |
| `ServerMessageSchema` の全 10 種それぞれ妥当な例 | 受理(テストは 10 種すべてを列挙) |
| `ServerMessageSchema` に `{type:"error",code:"X"}`(message 欠落) | 拒否 |
| `parseClientMessage("{not json")` | `{ok:false, error:<非空文字列>}`。例外を投げない |
| `parseClientMessage('{"type":"nope"}')` | `{ok:false, ...}` |
| `parseClientMessage('{"type":"stroke:clear"}')` | `{ok:true, msg:{type:"stroke:clear"}}` |
| `parseServerMessage` | 上と同じ規則で `ServerMessageSchema` を使う |
| `CAMERA_SEND_INTERVAL_MS` | 50。`MAX_NAME_LENGTH` は 50 |

## やらないこと
- camera / stroke の純粋関数(003)
- サーバ側の RoomHub / ルート実装、クライアント側の WsClient(別 feature)
- `SHARED_SCAFFOLD` の削除
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md が更新されている(api / protocol の公開インターフェイスを追記)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run test:shared` が成功する
