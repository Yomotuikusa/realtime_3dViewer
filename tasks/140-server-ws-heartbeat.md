---
id: 140
title: server WebSocket にハートビートを入れ、応答の無い接続を切って退室を配信する
feature: server
depends_on: []
owns: [server/src/config.ts, server/src/app.ts, server/src/realtime/ws.ts, server/src/index.ts, server/tests/config.test.ts, server/tests/helpers/ws.ts, server/tests/realtime-heartbeat.test.ts, server/server_Summary.md]
reads: [server/src/realtime/hub.ts, server/src/realtime/room-state.ts, server/tests/realtime-ws.test.ts, server/tests/realtime-guards.test.ts, server/tests/helpers/app.ts, node_modules/ws/lib/websocket.js, node_modules/@types/ws/index.d.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
サーバは `close` / `error` イベントでしか接続を片付けないため、回線断などで半開きになったソケットが
`MAX_CONNECTIONS` の枠と参加者一覧(幽霊ユーザ)を永久に占有する。ping/pong のハートビートで応答の無い接続を
切り、既存の切断処理を通して `user:left` を配信する。間隔は環境変数で調整できるようにする。
あわせて `app.ts` に重複している web/dist の既定パスを `config.ts` の定数に一本化する。

## 前提
- `server/src/config.ts` の `Config` は `port` / `dataDir` / `maxUploadBytes` / `webDistDir`(`:3-9`)。
  `loadConfig(env)`(`:32-42`)は `parseNonNegativeInteger(name, value)`(`:11-21`)で数値を読み、
  `webDistDir` の既定 `"./web/dist"` を `:39` に書いている
- `server/src/app.ts:24` の `AppDeps.config` は `Omit<Config, "webDistDir"> & Partial<Pick<Config, "webDistDir">>`。
  `:101` `app.route("/", staticRoutes(config.webDistDir ?? "./web/dist"))` が既定パスの 2 つ目の出所
- `server/src/realtime/ws.ts`: `MAX_CONSECUTIVE_ERRORS` / `MAX_WS_PAYLOAD_BYTES`(`:6-8`)、
  `RealtimeOptions { projectExists }`(`:10-12`)、`Realtime { publish; close(): Promise<void> }`(`:14-19`)、
  `attachRealtime(server, hub, options)`(`:59`)、`new WebSocketServer({ server, path: "/ws", maxPayload })`(`:61`)。
  接続処理は `:80-152`。`hub.connect(projectId)` は `:117`、`sockets.set(connId, { projectId, socket })` は `:127`
  (`SocketConnection { projectId; socket: WebSocket }` は `:21-24`)。`finalize`(`:131-136`)が `sockets.delete` と
  `hub.disconnect(connId)` の Outbound 送信を行い、`socket.on("close", finalize)` / `socket.on("error", finalize)`(`:150-151`)。
  `ping` / `pong` / `isAlive` / `setInterval` / `setTimeout` はどこにも無い
- `hub.disconnect(connId)`(`server/src/realtime/hub.ts:58-72`)は join 済みなら `{ target: "others", msg: { type: "user:left", userId } }` を返し、
  接続枠(`MAX_CONNECTIONS`、`room-state.ts:19`)を解放する
- `server/src/index.ts:28-30` `realtime = attachRealtime(server as unknown as Server, hub, { projectExists: … })`
- `ws` 8.21.3。クライアント `WebSocket` のオプション `autoPong`(既定 true。`node_modules/ws/lib/websocket.js:637-670`、
  `@types/ws/index.d.ts:262`)を false にすると ping に自動応答しない。`WebSocket#terminate()`(`index.d.ts:102`)は接続を即座に破棄し `close` を発火する
- `server/tests/helpers/ws.ts`: `startRealtime(options?: Partial<RealtimeOptions>): Promise<RealtimeFixture>`(`:50`)が `node:http` の実サーバを ephemeral port で立て(`:52-54`)、
  実 `RoomHub` で `attachRealtime` する(`:62-64`)。**既に `Partial<RealtimeOptions>` を受けるので、`RealtimeOptions` に `heartbeatIntervalMs?` を足せば `startRealtime({ heartbeatIntervalMs: 50 })` がそのまま書ける**。
  `open(projectId?): Promise<WebSocket>`(`:73-91`)が `ws` の実クライアントで `ws://127.0.0.1:<port>/ws` に接続する。
  `server/tests/helpers/app.ts` の `makeTestApp(overrides: Partial<Config> = {})` は `loadConfig({})` を土台に config を作るので、`Config` に必須フィールドを足しても既存テストの呼び出しは壊れない
  server のテストに fake timers は無い(`grep useFakeTimers server/tests` に一致なし)。実時間で短い間隔(数十 ms)を使う
- `server/tests/config.test.ts` の書き方: `it("rejects invalid numeric values with the variable name")` が
  `expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/)`(`:29-32`)。既定値のテストは `:6-13`
- `server/server_Summary.md:9-10`(config.ts)、`:49-55`(ws.ts)、`:56-60`(app.ts)。`## テスト` 節は無い
- 設計書 §18 の環境変数一覧は docs 側なので、このタスクでは触らない(起票側で追記する)

## インターフェイス契約

```ts
// server/src/config.ts
/** WEB_DIST_DIR の既定。app.ts の static の既定もこれを使う */
export const DEFAULT_WEB_DIST_DIR = "./web/dist";
/** WS_HEARTBEAT_INTERVAL_MS の既定。0 でハートビート無効 */
export const DEFAULT_WS_HEARTBEAT_INTERVAL_MS = 30_000;

export interface Config {
  port: number;
  dataDir: string;
  maxUploadBytes: number;
  webDistDir: string;
  /** WS_HEARTBEAT_INTERVAL_MS。ping の間隔(ms)。0 で無効 */
  wsHeartbeatIntervalMs: number;
}
// loadConfig は env.WS_HEARTBEAT_INTERVAL_MS を parseNonNegativeInteger("WS_HEARTBEAT_INTERVAL_MS", …) で読む
```

```ts
// server/src/app.ts
// AppDeps.config の型を次にする(既存のテストは config に wsHeartbeatIntervalMs を渡していないので必須にしない)
config: Omit<Config, "webDistDir" | "wsHeartbeatIntervalMs"> & Partial<Pick<Config, "webDistDir" | "wsHeartbeatIntervalMs">>;
// static の既定は staticRoutes(config.webDistDir ?? DEFAULT_WEB_DIST_DIR)
```

```ts
// server/src/realtime/ws.ts(既存 export はすべて残す)
export interface RealtimeOptions {
  projectExists: (projectId: string) => boolean;
  /** ping の間隔(ms)。省略時 DEFAULT_WS_HEARTBEAT_INTERVAL_MS。0 以下でハートビート無効 */
  heartbeatIntervalMs?: number;
}
export function attachRealtime(server: Server, hub: RoomHub, options: RealtimeOptions): Realtime;
```
ハートビートの手順:
1. `SocketConnection` に `isAlive: boolean` を足し、接続登録時(`sockets.set`)は `true`。`socket.on("pong", …)` で `true`
2. 間隔が 1 以上なら `attachRealtime` で `setInterval` を 1 本作り `unref()` する。毎回、`sockets` の全接続について
   `isAlive === false` なら `socket.terminate()`(以後は既存の `close` → `finalize` に任せる)、そうでなければ `isAlive = false` にして `socket.ping()`
3. `Realtime.close()` は最初に `clearInterval` してから従来の処理を行う

```ts
// server/src/index.ts
realtime = attachRealtime(server as unknown as Server, hub, {
  projectExists: (projectId) => findProject(db, projectId) !== null,
  heartbeatIntervalMs: config.wsHeartbeatIntervalMs,
});
```

```ts
// server/tests/helpers/ws.ts
// startRealtime(options?: Partial<RealtimeOptions>) は変更不要(heartbeatIntervalMs が RealtimeOptions に入るため)
// open(projectId?, clientOptions?: { autoPong?: boolean }) — 省略可能な第 2 引数を足し、ws クライアントの生成オプションへ渡す
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `loadConfig({})` | `wsHeartbeatIntervalMs === 30000`、`webDistDir === "./web/dist"`(= `DEFAULT_WEB_DIST_DIR`) |
| `loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "0" })` | `wsHeartbeatIntervalMs === 0` |
| `loadConfig({ WS_HEARTBEAT_INTERVAL_MS: "abc" })` / `"-1"` | `/WS_HEARTBEAT_INTERVAL_MS/` で throw |
| `createApp` に `webDistDir` を渡さない | 従来どおり `./web/dist` を static のルートにする(既存テストが通る) |
| 間隔 50ms、A・B が join 済み、B は `autoPong: false` | 300ms 以内に B のクライアントで `close` が発火し、A は `{ type: "user:left", userId: <B の id> }` を受信する |
| 上の続き | B の枠が解放される(`hub` の接続数が 1 減る。`realtime-guards.test.ts:95` の枠テストと同じ観測方法) |
| 間隔 50ms、`autoPong` 既定のクライアント | 300ms 待っても開いたままで、`user:left` は届かない |
| 間隔 0(または省略して `startRealtime({ heartbeatIntervalMs: 0 })`) | `autoPong: false` のクライアントも 300ms 後に開いたまま |
| `realtime.close()` | タイマーが解除され、テストプロセスが終了できる(`close` 後に `vi.getTimerCount` 相当の確認は不要。`afterEach` で close するだけでテストがハングしないこと) |
| ping を受けたクライアント | `pong` を返した接続は次の周期でも切られない(既定 `autoPong` の行で担保) |
| 既存テスト(`realtime-ws.test.ts` / `realtime-guards.test.ts` 等) | すべて通る(`startRealtime()` 無引数は既定間隔 30s なのでテスト中に ping は走らない) |

## やらないこと
- `hub.ts` / `room-state.ts` は変更しない(切断は既存の `hub.disconnect` に任せる)
- クライアント(web)側の変更はしない。ブラウザの WebSocket は ping に自動で pong を返す
- 無応答の判定に ping 以外(最終受信時刻など)は使わない
- 環境変数の説明を docs に足すのは起票側が行う
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md の config.ts / ws.ts / app.ts の説明が更新されている(ハートビート、`WS_HEARTBEAT_INTERVAL_MS`、`DEFAULT_WEB_DIST_DIR`)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
