---
id: 029
title: server realtime の接続検証・上限・線の所有者チェック
feature: server
depends_on: [028]
owns: [server/src/realtime/ws.ts, server/src/realtime/hub.ts, server/src/index.ts, server/tests/helpers/ws.ts, server/tests/realtime-ws.test.ts, server/tests/realtime-hub.test.ts, server/tests/realtime-guards.test.ts, server/server_Summary.md]
reads: [server/src/db/projects.ts, server/src/db/connection.ts, server/src/app.ts, shared/shared_Summary.md, shared/src/protocol.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test:server
status: todo
---

## 目的
セキュリティレビューで確認した WebSocket の弱点を塞ぐ。現状は (1) `/ws?projectId=任意` で
DB を見ずに接続・ルーム作成でき、ルーム数・接続数の上限もない、(2) `maxPayload` 未設定で
ws 既定の 100MiB フレームを受けて `JSON.parse` する、(3) `stroke:add` が既存 id の線を所有者
チェックなしで上書きし userId を送信者に付け替える(乗っ取り)、(4) Origin を検査しないため
外部サイトから接続できる(CSWSH)。

## 前提
- `attachRealtime(server, hub)` は server/src/index.ts:25 と server/tests/helpers/ws.ts:2 から呼ばれる。
  **第 3 引数を足す**ので両方を更新する
- `RoomHub.connect(projectId)` は無条件に connId を返す。server/src/realtime/hub.ts:76-80。
  ルームは `join` 時に作られる(hub.ts:151-155)
- `addStroke` は `room.strokes.has(incoming.id)` の場合、上限判定をスキップして無条件に上書きする。
  hub.ts:190-201。`removeStroke` は `stroke.userId !== connId` で拒否する。hub.ts:203-208
- `findProject(db, projectId)` は project が無い、または version が無いと `null` を返す。server/src/db/projects.ts:63-90
- `ws` 8.21.3 の `WebSocketServer` は `maxPayload` オプションを受け付け、超過フレームは
  close code 1009 で切断される(ライブラリ側の挙動。テストで確認する)
- `Stroke.points` は最大 2000 点(shared/src/types.ts:75)。1 点 3 数値 × 約 20 文字で最大約 120KiB。
  `MAX_WS_PAYLOAD_BYTES` はこれを収める値にする
- close code の意味: 1008 = Policy Violation、1013 = Try Again Later
- Origin の方針(人間と合意済み): Origin ヘッダが**ある**接続は、その host が `Host` ヘッダと一致する
  ときだけ許可する。Origin ヘッダが**無い**接続(非ブラウザ)は許可する。許可オリジンの環境変数は設けない
- ルームの線は全員退室で消える現状を**維持する**(猶予期間は設けない)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/realtime/hub.ts(追加・変更分)
export const MAX_ROOM_STROKES = 2000;      // 既存
export const MAX_ROOMS = 200;              // 追加: 同時に存在できるルーム数
export const MAX_CONNECTIONS = 1000;       // 追加: プロセス全体の同時接続数(join 前も数える)

export class RoomHub {
  /** 接続を登録して connId を返す。接続数が MAX_CONNECTIONS 以上なら登録せず null */
  connect(projectId: string): string | null;
  // handle / disconnect / connectionsIn / projectOf / usersIn / strokesIn は変更なし
}
```

```ts
// server/src/realtime/ws.ts(追加・変更分)
export const MAX_CONSECUTIVE_ERRORS = 20;          // 既存
export const MAX_WS_PAYLOAD_BYTES = 256 * 1024;     // 追加

export interface RealtimeOptions {
  /** projectId が存在すれば true。index.ts では findProject(db, id) !== null を渡す */
  projectExists: (projectId: string) => boolean;
}

export function attachRealtime(server: Server, hub: RoomHub, options: RealtimeOptions): Realtime;
// Realtime インターフェイス(publish / close)は変更なし
```

```ts
// server/tests/helpers/ws.ts(変更分)
export function startRealtime(options?: Partial<RealtimeOptions>): Promise<RealtimeFixture>;
// options.projectExists の既定は () => true(既存テストを変更せずに通すため)
```

接続時の判定順(ws.ts の `connection` ハンドラ):
1. projectId 無し → `error BAD_REQUEST "projectId query parameter is required"` + close 1008(既存)
2. Origin ヘッダあり、かつ `new URL(origin).host !== request.headers.host`(URL パース失敗も含む) →
   `error BAD_REQUEST "origin not allowed"` + close 1008
3. `projectExists(projectId)` が false → `error NOT_FOUND "Project not found"` + close 1008
4. `hub.connect(projectId)` が null → `error BAD_REQUEST "connection limit reached"` + close 1013

join 時(hub.join):
- ルームが未作成で `rooms.size >= MAX_ROOMS` → `[{ target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "room limit reached" } }]` を返し、ルームもユーザーも作らない

stroke:add(hub.addStroke):
- `room.strokes.get(incoming.id)` が存在し、その `userId !== connId` →
  `[{ target: "self", msg: { type: "error", code: "BAD_REQUEST", message: "stroke owned by another user" } }]`。線は変更しない
- 自分の線の同 id 再送は従来どおり置換(上限到達後も許可)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `/ws?projectId=p1`、projectExists が false | `error NOT_FOUND` を受信後 close 1008。`hub.projectOf` に接続が残らない |
| `/ws?projectId=p1`、projectExists が true、Origin なし | 接続成功、join で welcome(既存テスト維持) |
| Origin が `http://<Host と同じ>` | 接続成功 |
| Origin が `http://evil.example` | `error BAD_REQUEST "origin not allowed"` 後 close 1008 |
| Origin が `null` や URL でない文字列 | close 1008 |
| 実ソケット接続前に `hub.connect` を MAX_CONNECTIONS 回呼んで枠を埋めた状態で `/ws?projectId=p1` に接続 | `error BAD_REQUEST "connection limit reached"` 後 close 1013 |
| `hub.connect` を MAX_CONNECTIONS 回呼ぶ | 全て connId を返す。MAX_CONNECTIONS + 1 回目が null |
| disconnect 後に再度 connect | 枠が戻り connId を返す |
| ルーム MAX_ROOMS 個が存在する状態で別 projectId に join(hub 単体テスト) | self に `error BAD_REQUEST "room limit reached"`、`usersIn` は空、rooms は増えない |
| 既存ルームへの join は MAX_ROOMS 到達後も | 成功する |
| 全員退室でルームが消えた後の join | 成功する(枠が戻る) |
| A が線 s1 を追加、B が同 id s1 で stroke:add | B の self に `error BAD_REQUEST "stroke owned by another user"`、`strokesIn` の s1 は A のまま、他者へ配信なし |
| A が自分の s1 を再送 | 置換され all に配信(既存挙動) |
| B がその後 stroke:remove s1 | 拒否される(既存挙動、退行確認) |
| MAX_WS_PAYLOAD_BYTES を超えるテキストフレームを送る | サーバが close 1009 で切断し、`hub.projectOf(connId)` が null になる |
| 2000 点の正当な stroke:add(約 120KiB) | 受理され all に配信される |
| 連続 20 回のスキーマ違反 | close 1008(既存挙動、退行確認) |
| index.ts | `attachRealtime(server, hub, { projectExists: (id) => findProject(db, id) !== null })` で結線される(typecheck で確認) |

## やらないこと
- ping/pong による無応答接続の切断は行わない(別タスクで判断する)
- ルームの猶予期間(全員退室後も線を保持)は設けない
- `shared/src/protocol.ts` / `types.ts` のスキーマは変更しない(id 長の制限は 030)
- 認証トークンや許可オリジンの環境変数は追加しない
- HTTP 側(`server/src/app.ts`、`routes/*`)は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(RealtimeOptions、MAX_ROOMS / MAX_CONNECTIONS / MAX_WS_PAYLOAD_BYTES、接続時の判定順、所有者チェックを反映)
- [ ] すべてのファイルが300行以内 (realtime-hub.test.ts は 228 行あるので、新規ケースは realtime-guards.test.ts に書く)
- [ ] verify: に書いたコマンドが成功する
