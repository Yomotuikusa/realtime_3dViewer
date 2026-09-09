---
id: 013
title: web 入室ダイアログ・セッションストア・WebSocket クライアント
feature: web
depends_on: [012]
owns: [web/src/store/session.ts, web/src/app/display-name.ts, web/src/app/JoinDialog.tsx, web/src/api/ws.ts, web/src/app/useRealtime.ts, web/src/app/realtime-dispatch.ts, web/src/app/ReviewPage.tsx, web/tests/ws-client.test.ts, web/tests/realtime-dispatch.test.ts, web/tests/display-name.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/protocol.ts, server/server_Summary.md, web/src/store/camera.ts, web/src/api/client.ts, web/src/features/viewer/ViewerCanvas.tsx]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
レビュー空間へ入室する経路(§16.1)を通す。表示名の決定(§7)、WS の接続・再接続(§17)、
受信メッセージをストアへ振り分ける口(D6 / D23)を作る。以降の web タスクは
`realtime-dispatch.ts` に自分の `case` を足すだけで受信に対応できる。

## 前提
- 010 のサーバは `GET /ws?projectId=<id>` を受け、`join` を受けるまで他メッセージを無視し、
  `welcome` を返す(server_Summary.md 参照)。projectId が無い接続は close 1008
- 002 の `@shared/protocol`(`ClientMessage` `ServerMessage` `parseServerMessage`
  `MAX_NAME_LENGTH`)を使う。JSON の検証を web 側で再実装しない
- 012 の `ReviewPage`(`props: { projectId: string }`)が本実装済み。**このタスクで
  入室フローと接続状態表示を足す**。Canvas 部分・カメラストアには触らない
- テストは jsdom + vitest 5。`vi.useFakeTimers()` と自前のモック WebSocket で再接続を検証する
  (実ネットワークには接続しない)。@testing-library が無いため
  `JoinDialog` / `ReviewPage` / `useRealtime` の描画テストは書かない
- zustand 5。React 外から `useSessionStore.getState()` で触る
- 決定事項 **D23 / D24**、および D9(Guest 名の規則はサーバと同じ)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/store/session.ts
export type ConnectionStatus = "connecting" | "open" | "closed";

export interface SessionStoreState {
  selfId: string | null;      // welcome で確定
  color: string | null;       // welcome の users から自分の色
  name: string;               // 入室時に決めた表示名。初期値 ""
  connection: ConnectionStatus;   // 初期値 "closed"
  lastError: string | null;       // 直近のエラー表示用(§17)
  setName(name: string): void;
  setSelf(selfId: string, color: string | null): void;
  setConnection(status: ConnectionStatus): void;
  setLastError(message: string | null): void;
  reset(): void;
}
export const useSessionStore: /* zustand の UseBoundStore<StoreApi<SessionStoreState>> */;
```

```ts
// web/src/app/display-name.ts
export const NAME_STORAGE_KEY = "3dreviewer:name";
/** localStorage から読む。無い / 例外(プライベートモード等)なら "" */
export function loadStoredName(): string;
/** trim して保存。空文字なら保存しない。例外は握りつぶす */
export function saveName(name: string): void;
/** `Guest-<4桁>`。digits はテスト用の差し替え口(既定はランダム 4 桁) */
export function guestName(digits?: () => string): string;
/** trim して MAX_NAME_LENGTH に切り詰める。結果が空なら guestName(digits) */
export function resolveDisplayName(input: string, digits?: () => string): string;
```

```ts
// web/src/api/ws.ts
import type { ClientMessage, ServerMessage } from "@shared/protocol";
import type { ConnectionStatus } from "../store/session";

export const RECONNECT_MIN_MS = 1000;
export const RECONNECT_MAX_MS = 10000;

/** WebSocket のうち WsClient が使う部分だけ。テストはこれを実装したモックを渡す */
export interface SocketLike {
  readyState: number;                     // 0 CONNECTING / 1 OPEN / 2 CLOSING / 3 CLOSED
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface WsClientOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** 既定 (u) => new WebSocket(u) as unknown as SocketLike */
  createSocket?: (url: string) => SocketLike;
}

export class WsClient {
  constructor(options: WsClientOptions);
  /** 接続を開始する。多重呼び出しは無視 */
  connect(): void;
  /** OPEN でなければ送らず false。送ったら true */
  send(msg: ClientMessage): boolean;
  /** 明示的に閉じる。以降は再接続しない */
  close(): void;
  readonly status: ConnectionStatus;
}

/** `${wss|ws}://${location.host}/ws?projectId=<encodeURIComponent>` */
export function wsUrl(projectId: string): string;
```

`WsClient` の規則(D24):

- `connect()` 直後に `onStatus("connecting")`、`onopen` で `onStatus("open")`
- `onmessage` は `parseServerMessage(String(ev.data))`。`ok:false` は **握りつぶして**
  `console.warn` 相当のログのみ(接続は維持し、`onMessage` は呼ばない)
- `onclose` / `onerror`(明示 `close()` 以外)で `onStatus("closed")` の後、
  待ち時間 `min(RECONNECT_MIN_MS * 2^n, RECONNECT_MAX_MS)`(n は連続失敗回数、0 始まり)後に再接続。
  再接続の開始時にも `onStatus("connecting")` を出す
- `onopen` で連続失敗回数を 0 に戻す
- `close()` 後は `onStatus` を呼ばず、保留中のタイマも張らない
- **`join` の再送は WsClient の責務ではない**。`onStatus("open")` を受けた `useRealtime` が送る

```ts
// web/src/app/realtime-dispatch.ts
import type { ServerMessage } from "@shared/protocol";
/** ServerMessage を各ストアへ反映する。React 外から呼べる純粋な入口(D23)。
 *  014(camera / user:*) 016(stroke:*) 018(comment:*) が case を足していく */
export function dispatchServerMessage(msg: ServerMessage): void;
```

このタスクで実装する `case`:

| msg.type | 反映先 |
| --- | --- |
| `welcome` | `session.setSelf(msg.selfId, msg.users.find(u => u.id === msg.selfId)?.color ?? null)`。`users` / `strokes` は 014 / 016 が扱う |
| `error` | `session.setLastError(`${msg.code}: ${msg.message}`)` |
| その他すべて | 何もしない(default で握りつぶし、throw しない) |

```tsx
// web/src/app/useRealtime.ts
export interface Realtime { send(msg: ClientMessage): boolean }
/** name が null の間は接続しない。非 null になったら接続し、"open" のたびに join を送る */
export function useRealtime(projectId: string, name: string | null): Realtime;

// web/src/app/JoinDialog.tsx
/** 初期値は loadStoredName()。送信時に resolveDisplayName → saveName → onJoin */
export function JoinDialog(props: { onJoin: (name: string) => void }): React.ReactElement;
```

`ReviewPage` への追加分:

- `const [joinName, setJoinName] = useState<string | null>(null)`。null の間は
  Canvas の手前に `JoinDialog` を出す(モデルの取得・表示は入室前から行ってよい)
- `useRealtime(projectId, joinName)` を呼ぶ。`joinName` 決定時に `session.setName` も行う
- サイドパネル上部に接続状態を出す: `connecting` → 「再接続中」、`closed` → 「切断」、
  `open` → 表示なし。`session.lastError` があればその文言も出す(§17)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `resolveDisplayName("  Rin  ")` | `"Rin"` |
| `resolveDisplayName("", () => "0042")` | `"Guest-0042"` |
| `resolveDisplayName("   ", () => "0042")` | `"Guest-0042"` |
| `resolveDisplayName(<60 文字>)` | 50 文字(`MAX_NAME_LENGTH`)に切り詰められる |
| `saveName("  Rin  ")` → `loadStoredName()` | `"Rin"` |
| `saveName("   ")` → `loadStoredName()` | 保存されない(直前の値のまま / 未保存なら `""`) |
| `localStorage.getItem` が throw する状況 | `loadStoredName()` は `""` を返し、`saveName` も throw しない |
| `guestName(() => "1234")` | `"Guest-1234"` |
| `wsUrl("p1")`(jsdom の location) | `"ws://localhost:3000/ws?projectId=p1"` 形式(host は `location.host`、http なら `ws:`) |
| `new WsClient({...}).connect()` | `createSocket` が url で 1 回呼ばれ、`onStatus("connecting")` |
| モック socket の `onopen()` | `onStatus("open")`。`status === "open"` |
| open 後に `send({type:"stroke:clear"})` | `socket.send` に `'{"type":"stroke:clear"}'` が渡り、true |
| `connecting` のまま `send` | `socket.send` は呼ばれず false |
| `onmessage` に妥当な `welcome` の JSON | `onMessage` がその `ServerMessage` で 1 回呼ばれる |
| `onmessage` に `"{not json"` / `'{"type":"nope"}'` | `onMessage` は呼ばれない。例外も投げない |
| `onclose()` 後 999ms / 1000ms 経過(fake timers) | 999ms では再接続せず、1000ms で `createSocket` が 2 回目 |
| 連続失敗 4 回の待ち時間 | 1000 → 2000 → 4000 → 8000 ms |
| 連続失敗 5 回目以降 | 10000ms で頭打ち |
| `onopen` を挟んでから再度 `onclose` | 待ち時間が 1000ms に戻る |
| `close()` 呼び出し後に `onclose` が発火 | `onStatus` が呼ばれず、タイマ全消化後も `createSocket` は増えない |
| `connect()` を 2 回連続 | `createSocket` は 1 回だけ |
| `dispatchServerMessage({type:"welcome", selfId:"u1", users:[{id:"u1",name:"Rin",color:"#f00",camera:null}], strokes:[]})` | `session.selfId === "u1"`、`color === "#f00"` |
| 上で `users` に自分が含まれない welcome | `selfId` は入り、`color` は `null` |
| `dispatchServerMessage({type:"error", code:"BAD_REQUEST", message:"x"})` | `session.lastError` が `"BAD_REQUEST: x"` |
| `dispatchServerMessage({type:"camera", ...})` など未対応の type | 何も起きず throw しない |
| session ストアの初期値 | `selfId:null, color:null, name:"", connection:"closed", lastError:null` |
| `setConnection("open")` → `reset()` | 初期値に戻る |

## やらないこと
- presence ストア・参加者一覧・カメラ送信(014)。`welcome.users` の反映もまだ行わない
- Annotation / Comment の受信反映(016 / 018)
- WsClient に join 再送や名前を持たせること(D24)
- `web/src/store/camera.ts` / `features/viewer/*` の変更
- 描画テスト・E2E、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(session ストア / WsClient の再接続規則 / dispatch の拡張方法)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
