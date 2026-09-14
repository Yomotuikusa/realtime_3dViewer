---
id: 109
title: server の RoomHub をルーム状態とストローク操作へ分割する
feature: server
depends_on: []
owns: [server/src/realtime/hub.ts, server/src/realtime/room-state.ts, server/src/realtime/room-strokes.ts, server/server_Summary.md, server/tests/room-state.test.ts, server/tests/room-strokes.test.ts, server/tests/realtime-hub.test.ts, server/tests/realtime-guards.test.ts]
reads: [server/src/realtime/room-display.ts, server/src/realtime/ws.ts, server/src/index.ts, server/tests/helpers/ws.ts, server/tests/realtime-hub-display.test.ts, server/tests/realtime-hub-joint.test.ts, server/tests/realtime-hub-light.test.ts, server/tests/realtime-hub-objects.test.ts, server/tests/realtime-hub-parts.test.ts, server/tests/realtime-hub-compare.test.ts, server/tests/realtime-hub-focal.test.ts, shared/src/protocol.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
`server/src/realtime/hub.ts` が 279 行あり、1ファイル 300 行の上限に迫っている。
共有メッセージを 1 種類足すたびに `handle` の `switch` とアクセサが伸びるため、
次の機能(110 の `trail:display`)を入れる前に責務の境界で分割する。
振る舞いは一切変えない、純粋な整理タスクである。

## 前提
- `hub.ts` は現在 4 つの責務を 1 ファイルに持つ。
  1. ルーム内の定数と複製ヘルパ(`PRESENCE_PALETTE`、`MAX_*`、`copyCamera` / `copyUser` / `copyStroke`)
  2. ルームのデータ構造(`Connection`、`Room`、色の割り当て `colorFor`)
  3. ストロークのルーム内操作(`addStroke` / `removeStroke` と `stroke:clear` の本体)
  4. `RoomHub` クラス(接続管理・`join`・`handle` の分岐・読み出しアクセサ)
- 表示状態(ライト、表示/非表示、メッシュ表示、比較、ジョイント)は既に
  `server/src/realtime/room-display.ts` へ分かれており、`handle` からは
  `applyDisplayMessage(room.display, connId, msg)` の 1 行で呼ばれている。
  本タスクはこの分担に手を触れない
- **hub.ts の識別子はテストと ws.ts から名指しで import されている**(grep 済み)。
  - `server/src/realtime/ws.ts:4` … `import type { Outbound, RoomHub } from "./hub"`
  - `server/tests/realtime-hub.test.ts:4-7` … `MAX_ROOM_STROKES`、`PRESENCE_PALETTE`、`RoomHub`
  - `server/tests/realtime-guards.test.ts:5-9` … `MAX_CONNECTIONS`、`MAX_ROOMS`、`MAX_ROOM_STROKES`、`RoomHub`
  - `server/src/index.ts:10`、`server/tests/helpers/ws.ts:3`、その他 `realtime-hub-*.test.ts` … `RoomHub` のみ
  これらの import 元は `"./hub"` / `"../src/realtime/hub"` のまま変えない。
  移動した識別子は `hub.ts` から re-export して解決する
- `Room.display` の型 `RoomDisplayState` と `createRoomDisplayState()` は `room-display.ts` にある

## インターフェイス契約

### 新規 `server/src/realtime/room-state.ts`

```ts
import type { ServerMessage } from "@shared/protocol";
import type { CameraState, PresenceUser, Stroke } from "@shared/types";
import { createRoomDisplayState, type RoomDisplayState } from "./room-display";

/** Colors are selected in room-local join order. */
export const PRESENCE_PALETTE: readonly string[];
export const MAX_ROOM_STROKES = 2000;
export const MAX_ROOMS = 200;
export const MAX_CONNECTIONS = 1000;

export type OutboundTarget = "self" | "others" | "all";
export interface Outbound {
  target: OutboundTarget;
  msg: ServerMessage;
}

export interface Connection {
  projectId: string;
  user?: PresenceUser;
}

export interface Room {
  users: Map<string, PresenceUser>;
  strokes: Map<string, Stroke>;
  display: RoomDisplayState;
}

/** 空のルームを作る。users / strokes / display は呼び出しごとに新しいインスタンス */
export function createRoom(): Room;

/** PRESENCE_PALETTE の先頭から最初の未使用色。全色使用済みなら人数で巡回する */
export function colorFor(room: Room): string;

export function copyCamera(camera: CameraState): CameraState;
export function copyUser(user: PresenceUser): PresenceUser;
export function copyStroke(stroke: Stroke): Stroke;
```

`PRESENCE_PALETTE` の要素と順序は現在の `hub.ts:13-22` からそのまま移す
(`#ef4444`, `#f97316`, `#eab308`, `#22c55e`, `#06b6d4`, `#3b82f6`, `#8b5cf6`, `#ec4899`)。

### 新規 `server/src/realtime/room-strokes.ts`

```ts
import type { Stroke } from "@shared/types";
import type { Outbound, Room } from "./room-state";

/**
 * 既存の同 id が他者のものなら self へ error("stroke owned by another user")、
 * 新規かつ room.strokes.size >= MAX_ROOM_STROKES なら self へ error("room stroke limit reached")。
 * いずれも room は変更しない。成功時は userId=connId・createdAt=now へ差し替えて保存し、
 * all へ stroke:add を返す(保存する値と返す値は別インスタンス)。
 */
export function addStroke(room: Room, connId: string, incoming: Stroke, now: number): Outbound[];

/** 存在しない、または connId のものでなければ [] を返して room を変更しない。 */
export function removeStroke(room: Room, connId: string, strokeId: string): Outbound[];

/** connId のストロークだけを消し、常に all へ stroke:clear を返す。 */
export function clearStrokes(room: Room, connId: string): Outbound[];
```

`error` の `code` はいずれも現在と同じ `"BAD_REQUEST"`。

### `server/src/realtime/hub.ts`(残るもの)

```ts
export { MAX_CONNECTIONS, MAX_ROOMS, MAX_ROOM_STROKES, PRESENCE_PALETTE } from "./room-state";
export type { Outbound, OutboundTarget } from "./room-state";

export interface RoomHubOptions {
  now?: () => number;
  newId?: () => string;
  guestDigits?: () => string;
}

export class RoomHub {
  constructor(options?: RoomHubOptions);
  connect(projectId: string): string | null;
  disconnect(connId: string): Outbound[];
  handle(connId: string, msg: ClientMessage): Outbound[];
  connectionsIn(projectId: string): string[];
  projectOf(connId: string): string | null;
  usersIn(projectId: string): PresenceUser[];
  strokesIn(projectId: string): Stroke[];
  hiddenObjectsIn(projectId: string): string[];
  hiddenObjectPartsIn(projectId: string): ObjectPartRef[];
  meshDisplayIn(projectId: string): MeshDisplayMode | null;
  meshCompareIn(projectId: string): MeshCompare | null;
  jointDisplayIn(projectId: string): JointDisplay | null;
}
```

公開メソッドの名前・引数・戻り値は現在と完全に同じにする。
`handle` の `switch` の各 case が返す値も現在と同じで、ストローク 3 種の本体だけが
`room-strokes.ts` の関数呼び出しに置き換わる(`stroke:add` は `this.now()` を渡す)。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `import { PRESENCE_PALETTE, MAX_ROOM_STROKES } from "../src/realtime/hub"` | 分割前と同じ値が得られる(re-export 済み) |
| `import type { Outbound } from "./hub"`(ws.ts) | 型が解決でき `npm run typecheck` が通る |
| `createRoom()` を 2 回呼ぶ | users / strokes / display がそれぞれ別インスタンス |
| `colorFor`: 未使用色がある | PRESENCE_PALETTE の先頭から最初の未使用色 |
| `colorFor`: 8 人全色使用済み | `PRESENCE_PALETTE[room.users.size % 8]` |
| `copyUser`: camera が null | camera が null のまま複製される |
| `copyUser`: camera あり | camera.position / target まで新しい配列 |
| `copyStroke` | points の各要素まで新しい配列 |
| `addStroke`: 既存 id が他者のもの | self へ error "stroke owned by another user"、`room.strokes` は不変 |
| `addStroke`: 既存 id が自分のもの | 上書き保存し all へ stroke:add |
| `addStroke`: 新規かつ上限到達 | self へ error "room stroke limit reached"、`room.strokes` は不変 |
| `addStroke`: 正常 | userId=connId・createdAt=now で保存し、all へ stroke:add。返す stroke は保存した実体と別インスタンス |
| `removeStroke`: 存在しない id | `[]`、`room.strokes` は不変 |
| `removeStroke`: 他者のストローク | `[]`、`room.strokes` は不変 |
| `removeStroke`: 自分のストローク | 削除して all へ stroke:remove |
| `clearStrokes`: 他者のものが混在 | connId のものだけ消え、all へ stroke:clear |
| `clearStrokes`: 自分のものが 0 件 | room は不変だが all へ stroke:clear を返す(現状と同じ) |
| 既存の `server/tests/realtime-*.test.ts` 全件 | 変更なしで通る |
| `hub.ts` / `room-state.ts` / `room-strokes.ts` の行数 | いずれも 300 行以内。hub.ts は 200 行以内に収まる |

## やらないこと
- `room-display.ts` と `applyDisplayMessage` の変更。表示状態は既に分離済みで、ここでは触らない
- `RoomHub` の公開メソッドの名前・シグネチャ・戻り値の変更、メソッドの追加・削除
- `ws.ts`、`server/src/index.ts`、`server/tests/helpers/ws.ts` の変更
- `shared/` と `web/` の変更。`trail:display` の追加は 110 の仕事であり、ここでは行わない
- 既存テストの import 元の書き換え。`hub.ts` からの re-export で解決する。
  `server/tests/realtime-hub.test.ts` と `server/tests/realtime-guards.test.ts` を owns に
  挙げてあるのは、やむを得ず修正が要る場合の逃げ道である。
  **既存の `expect` を削除・緩和してはならない**
- 新しいテストで既存テストの内容を置き換えること。`room-state.test.ts` と
  `room-strokes.test.ts` は上の振る舞い表のうち新関数の行を直接検証するために足す

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(新ファイル 2 つの役割・公開インターフェイス・テスト)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
