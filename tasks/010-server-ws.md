---
id: 010
title: server WebSocket 結線とサーバ起動
feature: server
depends_on: [009]
owns: [server/src/realtime/ws.ts, server/src/index.ts, server/tests/helpers/ws.ts, server/tests/realtime-ws.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/protocol.ts, server/src/config.ts, server/src/app.ts, server/src/db/connection.ts, server/src/storage/files.ts, server/src/realtime/hub.ts, server/tests/helpers/tmp.ts]
verify: npm run typecheck && npm run test:server
status: todo
---

## 目的
`RoomHub`(009)を実ソケットに繋ぎ、`GET /ws?projectId=<id>` を動かす。あわせて
`server/src/index.ts` を実装して、HTTP(006〜008)と WS を 1 プロセスで起動し、
REST の `deps.publish`(D5)を hub 経由の実配信に結線する。

## 前提
- 009 の `RoomHub` は `connect(projectId): connId` / `disconnect(connId)` /
  `handle(connId, msg)` / `connectionsIn(projectId)` を持つ純粋クラス。
  `Outbound.target` は `"self" | "others" | "all"`(server_Summary.md 参照)
- `parseClientMessage(raw): ParseResult<ClientMessage>` は `@shared/protocol`(002)。
  例外を投げず `{ok:false, error}` を返す
- ws 8.21.3: `import { WebSocketServer, WebSocket } from "ws"`。
  `new WebSocketServer({ server, path: "/ws" })` で既存の `http.Server` に相乗りできる。
  クライアント側もテストでは同じ `ws` パッケージの `WebSocket` を使う
- @hono/node-server 2.1.1 の `serve({ fetch, port })` は Node の `http.Server` 互換オブジェクトを返す。
  これを `attachRealtime` に渡す
- `server/src/index.ts` は現在プレースホルダで `SHARED_SCAFFOLD` を import している。
  **このタスクで書き換え、その import を外す**(D25。`shared/src/index.ts` 側の export は 022 まで残す)
- 決定事項 D5 / D18 / D19 / D24。ルーム状態は projectId 単位で、DB の project 存在確認はしない
  (存在しない projectId でも WS ルームは張れる。REST 側が 404 を返す)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/realtime/ws.ts
import type { Server } from "node:http";
import type { ServerMessage } from "@shared/protocol";
import type { RoomHub } from "./hub";

/** 同一接続で連続してこの回数スキーマ違反が来たら close(1008) */
export const MAX_CONSECUTIVE_ERRORS = 20;

export interface Realtime {
  /** そのプロジェクトの join 済み全員へ送る。REST の deps.publish から呼ぶ */
  publish(projectId: string, msg: ServerMessage): void;
  /** WebSocketServer を閉じる(テストの後片付け・graceful shutdown 用) */
  close(): Promise<void>;
}

/** server の "/ws" に WebSocketServer を張る。1 プロセス 1 回だけ呼ぶ */
export function attachRealtime(server: Server, hub: RoomHub): Realtime;
```

接続 1 本の扱い:

1. `connection` 時に `req.url` の query から `projectId` を取る。
   無い / 空文字なら `{type:"error", code:"BAD_REQUEST", message:...}` を 1 通送って `close(1008)`
2. `connId = hub.connect(projectId)` を発行し、`connId → WebSocket` の Map に登録する
3. `message` 受信(テキスト): `parseClientMessage(String(data))`
   - `{ok:false}` → `{type:"error", code:"VALIDATION", message:<parse の error>}` を self へ送り、
     連続エラー数 +1。`MAX_CONSECUTIVE_ERRORS` に達したら `close(1008)`
   - `{ok:true}` → 連続エラー数を 0 に戻し、`hub.handle(connId, msg)` の `Outbound[]` を送出
4. `close` / `error` 時: Map から外し、`hub.disconnect(connId)` の `Outbound[]` を送出
5. 送出の解決(D19): `self` = その接続のみ / `others` = `hub.connectionsIn(projectId)` から自分を除く /
   `all` = `hub.connectionsIn(projectId)` 全員。`readyState === OPEN` の接続にだけ
   `JSON.stringify(msg)` を送る。送信失敗は握りつぶしてログ(JSON 1 行)にとどめる

```ts
// server/src/index.ts(公開 export は持たない起動スクリプト)
// 1. loadConfig(process.env)
// 2. openDb(path.join(config.dataDir, "app.db"))  ※ dataDir は mkdir -p 済みにする
// 3. createFileStorage(config.dataDir)
// 4. const hub = new RoomHub()
// 5. let realtime: Realtime | null = null;
//    const app = createApp({ db, storage, config, publish: (p, m) => realtime?.publish(p, m) });
// 6. const server = serve({ fetch: app.fetch, port: config.port });
// 7. realtime = attachRealtime(server as unknown as Server, hub);
// 8. 起動ログを console に JSON 1 行(§17)
```

```ts
// server/tests/helpers/ws.ts
export interface RealtimeFixture {
  url: string;                 // "ws://127.0.0.1:<ephemeral>/ws"
  hub: RoomHub;
  realtime: Realtime;
  /** WS を張って open を待つ。projectId 省略時はクエリ自体を付けない */
  open(projectId?: string): Promise<WebSocket>;
  /** 次に届く 1 フレームを ServerMessage として解決する。既定 1000ms で reject */
  next(ws: WebSocket, timeoutMs?: number): Promise<ServerMessage>;
  /** close イベントの code を解決する */
  closed(ws: WebSocket, timeoutMs?: number): Promise<number>;
  cleanup(): Promise<void>;    // 全クライアントと server を閉じる
}
/** http.createServer()(Hono は使わない)を port 0 で listen し attachRealtime する */
export function startRealtime(): Promise<RealtimeFixture>;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `open("p1")` して `{type:"join",name:"Rin"}` を送る | 1 通目が `welcome`。`selfId` は非空、`users` は自分 1 人 |
| a が join 済みのところへ b が接続して join | a に `user:joined`(b の id / 色)が届く。b には `welcome`(2 人) |
| b が `camera` を送る | a に `{type:"camera", userId:<b>, camera:<送った値>}` が届く。**b 自身には届かない** |
| b が `stroke:add` を送る | a と b の**両方**に `stroke:add` が届く。stroke.userId は b の id |
| b の接続を close | a に `{type:"user:left", userId:<b>}` が届く |
| `open()`(projectId 無し)/ `?projectId=` (空) | `error`(BAD_REQUEST)を 1 通受け取り、close code が 1008 |
| join 前に `{type:"camera",...}` を送る | 何も返らない(1000ms 待って `next` が timeout する、を明示的に検証) |
| `"{not json"` を送る | `{type:"error", code:"VALIDATION", message:<非空>}` が返り、接続は開いたまま |
| `'{"type":"nope"}'` を送る | 同上 |
| 不正フレームを 19 回 → 正常な `join` → さらに不正 1 回 | close されない(カウンタがリセットされる) |
| 不正フレームを連続 20 回 | 20 通目の `error` の後に close code 1008 |
| `realtime.publish("p1", {type:"comment:created", comment})` | p1 に join 済みの a / b の両方に届く |
| `publish` の projectId が別ルーム / 誰も join していない | 例外なく何も起きない |
| join していない接続(connect 済み・join 前)がいる状態で `publish` | その接続には届かない |
| `realtime.close()` 後に `publish` | throw しない |
| 2 本の接続が同じ `projectId` で、片方が `stroke:clear` | 両方に `{type:"stroke:clear", userId:<送信者>}` |

## やらないこと
- `RoomHub` のロジック変更(009 の成果物。`hub.ts` は reads のみ)
- 静的配信・`web/dist` の参照(021)
- 認証・レート制限・ping/pong によるゾンビ接続掃除(MVP 外)
- `server/src/index.ts` に対するテスト(実プロセス起動の副作用のみのため typecheck で担保する。
  ロジックは `attachRealtime` 側に置き、index.ts は結線だけにすること)
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行(index.ts の行を除く)に対応するテストがあり、通る
- [ ] `server/src/index.ts` から `SHARED_SCAFFOLD` の import が消えている
- [ ] server_Summary.md が更新されている(WS エンドポイント / close コード / 起動手順)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
