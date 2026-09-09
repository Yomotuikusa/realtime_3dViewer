---
id: 009
title: server RoomHub(WS 非依存のルーム状態と配信先決定)
feature: server
depends_on: [008]
owns: [server/src/realtime/hub.ts, server/tests/realtime-hub.test.ts, server/server_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/protocol.ts]
verify: npm run typecheck && npm run test:server
status: todo
---

## 目的
Presence / Annotation のサーバ側ロジック(§13.3, §15 のサーバ規則, §16.2, §16.3)を
`ws` に依存しない純粋クラスとして実装し、「誰に何を送るか」までをユニットテストで固める。
010 の `ws.ts` はソケットとの結線だけを持つ。

## 前提
- `ClientMessage` `ServerMessage` `PresenceUser` `Stroke` `CameraState` は `@shared/protocol` /
  `@shared/types`(002 / 001 で定義済み。shared_Summary.md 参照)
- **このクラスは `ws` も `node:http` も import しない**。入力は既に検証済みの `ClientMessage`
  (JSON parse とスキーマ検証は 010 の ws.ts が `parseClientMessage` で行う)
- ルーム状態はメモリのみ。プロセス再起動で消えてよい(§13.3)
- 決定事項 D9 / D13 / **D18 / D19 / D20 / D21 / D22**(下記の契約と振る舞い表が正)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// server/src/realtime/hub.ts
import type { ClientMessage, ServerMessage } from "@shared/protocol";
import type { PresenceUser, Stroke } from "@shared/types";

/** 8 色。join 順に「そのルームで未使用の先頭色」を割り当てる(D22) */
export const PRESENCE_PALETTE: readonly string[];

/** ルーム 1 つが保持できる線の上限(D20) */
export const MAX_ROOM_STROKES = 2000;

/** 配信先。ws.ts が connId の集合へ解決する(D19) */
export type OutboundTarget = "self" | "others" | "all";
export interface Outbound { target: OutboundTarget; msg: ServerMessage }

export interface RoomHubOptions {
  now?: () => number;            // 既定 Date.now
  newId?: () => string;          // 既定 () => nanoid(12)。connId(= userId)の発行に使う
  guestDigits?: () => string;    // 既定 4 桁のランダム数字文字列。D9 の Guest-<4桁> に使う
}

export class RoomHub {
  constructor(options?: RoomHubOptions);

  /** connId(= userId)を発行して登録する。この時点ではまだ join しておらず配信対象外(D18) */
  connect(projectId: string): string;

  /** join 済みなら others へ user:left。ルームの join 済み人数が 0 になったらルーム(線を含む)を破棄。
   *  未 join / 未知の connId なら []。二重呼び出しでも throw しない */
  disconnect(connId: string): Outbound[];

  /** 未知の connId なら []。join 前に join 以外が来たら [](無視、§15) */
  handle(connId: string, msg: ClientMessage): Outbound[];

  /** そのプロジェクトの join 済み connId 一覧。REST からの publish(D5)で ws.ts が使う */
  connectionsIn(projectId: string): string[];

  /** 未知の connId なら null */
  projectOf(connId: string): string | null;

  /** テスト用の覗き窓。join 済みユーザーを join 順で返す */
  usersIn(projectId: string): PresenceUser[];
  /** テスト用。ルームの線を追加順で返す */
  strokesIn(projectId: string): Stroke[];
}
```

`handle` のメッセージ別の規則:

| 受信 `ClientMessage` | ルーム状態の変化 | 返す `Outbound[]`(この順) |
| --- | --- | --- |
| `join`(未 join) | `PresenceUser{id: connId, name, color, camera: null}` を追加 | `[{self, welcome}, {others, user:joined}]` |
| `join`(join 済み) | なし | `[{self, error(BAD_REQUEST, "already joined")}]` |
| `camera` | 自分の `PresenceUser.camera` を更新 | `[{others, {type:"camera", userId: connId, camera}}]` |
| `stroke:add` | `userId` を connId、`createdAt` を `now()` で上書きして保存(D20) | `[{all, {type:"stroke:add", stroke:<上書き後>}}]` |
| `stroke:add`(ルームが `MAX_ROOM_STROKES` 本) | なし | `[{self, error(BAD_REQUEST, ...)}]` |
| `stroke:remove`(自分の線) | 削除 | `[{all, {type:"stroke:remove", strokeId}}]` |
| `stroke:remove`(他人の線 / 存在しない) | なし | `[]` |
| `stroke:clear` | 自分の線を全削除 | `[{all, {type:"stroke:clear", userId: connId}}]` |

`welcome` は `{ type:"welcome", selfId: connId, users: <自分を含む join 順の全員>(D21),
strokes: <ルームの線を追加順で> }`。

名前の正規化(D9): `name.trim()` が空なら `Guest-${guestDigits()}`。空でなければ trim した値を使う。

色の割当(D22): `PRESENCE_PALETTE` のうち、そのルームで**使われていない先頭の色**。
すべて使用中なら `PRESENCE_PALETTE[room.users.size % PRESENCE_PALETTE.length]`。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `connect("p1")` を 2 回(`newId` を `["a","b"]` に注入) | "a", "b" が返る。`projectOf("a") === "p1"`。`usersIn("p1")` は空(未 join) |
| `connectionsIn("p1")`(誰も join していない) | `[]` |
| `handle("a", {type:"join", name:"Rin"})` | `[{target:"self", msg:{type:"welcome", selfId:"a", users:[{id:"a",name:"Rin",color:PRESENCE_PALETTE[0],camera:null}], strokes:[]}}, {target:"others", msg:{type:"user:joined", user:<同じ>}}]` |
| 上の後 `connectionsIn("p1")` | `["a"]` |
| a が join 済みのルームに b が join | b の welcome の `users` は a と b の 2 人(join 順)。b の色は `PRESENCE_PALETTE[1]` |
| a が退室した後に c が join | c の色は `PRESENCE_PALETTE[0]`(未使用の先頭色に戻る) |
| 9 人目が join(パレット 8 色) | 例外なく色が割り当たる(`size % 8` の色) |
| `join` で `name:"   "`(`guestDigits` を `() => "0042"` に注入) | 名前が `"Guest-0042"` |
| `join` で `name:"  Rin  "` | 名前は `"Rin"` |
| join 済みの a が再度 `join` | `[{self, {type:"error", code:"BAD_REQUEST", ...}}]`。`usersIn` は 1 人のまま |
| 未 join の a が `camera` / `stroke:add` / `stroke:clear` | `[]`。ルーム状態は変わらない |
| 未知の connId `"zz"` に `handle` / `disconnect` | `[]`。throw しない |
| join 済み a の `camera` | `[{others, {type:"camera", userId:"a", camera:<受信値>}}]`。`usersIn` の a の camera が更新される |
| a の `stroke:add`(stroke.userId が `"b"`、createdAt が 1) | 配信される stroke は `userId:"a"`、`createdAt: now()`。`target` は `"all"` |
| 同じ stroke id で `stroke:add` を 2 回 | 上書きされ、`strokesIn` は 1 本。2 回目も `all` へ配信 |
| ルームに `MAX_ROOM_STROKES` 本ある状態で `stroke:add` | `[{self, error BAD_REQUEST}]`。線は増えない |
| a が `stroke:remove` で自分の線 | `[{all, {type:"stroke:remove", strokeId}}]`。`strokesIn` から消える |
| a が `stroke:remove` で b の線 / 存在しない id | `[]`。線は残る |
| a が `stroke:clear`(a の線 2 本 / b の線 1 本) | `[{all, {type:"stroke:clear", userId:"a"}}]`。`strokesIn` は b の 1 本だけ |
| a が線 0 本で `stroke:clear` | それでも `[{all, stroke:clear}]` を返す(冪等) |
| join 済み a を `disconnect` | `[{others, {type:"user:left", userId:"a"}}]`。`usersIn` から消えるが **a の線は残る** |
| 未 join の connId を `disconnect` | `[]` |
| `disconnect` を同じ connId で 2 回 | 2 回目は `[]`。throw しない |
| ルームの最後の 1 人が `disconnect` した後、新たに join | `welcome.strokes` は `[]`(ルームが破棄されている) |
| 別プロジェクト p2 に join した d がいるとき、p1 の a の `camera` | p2 は無関係(`connectionsIn("p2")` は `["d"]` のまま、`usersIn("p1")` に d は現れない) |

## やらないこと
- `ws` / `node:http` の import、実ソケットとの結線、JSON parse とスキーマ検証(すべて 010)
- REST からの `publish` の実装(010。ここでは `connectionsIn` を提供するだけ)
- コメントの永続化・配信内容の生成(008 が `ServerMessage` を作って渡す)
- `server/src/app.ts` / `server/src/index.ts` の変更
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md が更新されている(RoomHub の公開 API / Outbound の意味 / パレット)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:server` が成功する
