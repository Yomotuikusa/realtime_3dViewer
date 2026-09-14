---
id: 097
title: server RoomHub のルーム共有表示状態を room-display.ts へ分離する
feature: server
depends_on: []
owns: [server/src/realtime/hub.ts, server/src/realtime/room-display.ts, server/tests/room-display.test.ts, server/server_Summary.md]
reads: [shared/src/protocol.ts, shared/src/types.ts, server/src/realtime/ws.ts, server/tests/realtime-hub.test.ts, server/tests/realtime-hub-light.test.ts, server/tests/realtime-hub-objects.test.ts, server/tests/realtime-hub-display.test.ts, server/tests/realtime-hub-compare.test.ts, server/tests/realtime-hub-focal.test.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
`hub.ts` は 285 行で上限(300 行)の直前にある。次のタスク(100)で「版内オブジェクト(部位)の
表示・非表示」をルーム共有状態に足すため、先に「ルームで共有する 3D ビューの見え方」
(ライト / 非表示の版 / メッシュ表示方法 / メッシュ比較設定)を `room-display.ts` へ分離する。
**振る舞いは一切変えない**。既存の hub テスト 6 本がそのまま通ることが分離の正しさの証明である。

## 前提
- `Room` は `users / strokes / light / hiddenObjects / meshDisplay / meshCompare` を持つ。server/src/realtime/hub.ts:38-49
- `handle` の `light` / `object:visibility` / `mesh:display` / `mesh:compare` の 4 case はいずれも
  「ルーム状態を更新し、`target: "others"` で userId 付きの同名メッセージを 1 つ返す」。hub.ts:133-150
- `join` は welcome に `light` / `hiddenObjectIds` / `meshDisplay` / `meshCompare` を
  「未設定(null)または空なら**キー自体を省いて**」載せる。hub.ts:234-247。
  `server/tests/realtime-hub.test.ts:38-58` は welcome を `toEqual` で全体比較しているので、空のときにキーが
  存在すると落ちる
- 読み取り口 `hiddenObjectsIn` / `meshDisplayIn` / `meshCompareIn` は複製を返す。hub.ts:182-194
- `ws.ts` は `Room` の内部フィールドを参照しない(`hub.handle` / `connect` / `disconnect` / `connectionsIn` /
  `projectOf` だけを使う)
- 設計書 §13.5「表示状態の共有原則」(docs/3dreviewer-plan-and-architecture.md)が、この分離先を
  「表示に関わる共有状態の置き場」と定めている。ファイル冒頭のコメントでその節を指すこと

## インターフェイス契約

### 新規 server/src/realtime/room-display.ts

```ts
import type { ClientMessage, ServerMessage } from "@shared/protocol";
import type { LightAngles, MeshCompare, MeshDisplayMode } from "@shared/types";

/**
 * ルームで共有する「3D ビューの見え方」の状態(設計書 §13.5)。
 * 表示に関わる共有状態はここに置き、applyDisplayMessage で更新し、displayWelcomeFields で復元する。
 */
export interface RoomDisplayState {
  /** ルームで共有するライトの向き。誰も変えていなければ null */
  light: LightAngles | null;
  /** 非表示にされた版の versionId。挿入順を保つ */
  hiddenObjects: Set<string>;
  /** ルームで共有するメッシュの表示方法。誰も切り替えていなければ null */
  meshDisplay: MeshDisplayMode | null;
  /** ルームで共有するメッシュ比較の設定。誰も変えていなければ null */
  meshCompare: MeshCompare | null;
}

/** 表示状態を変える ClientMessage */
export type DisplayClientMessage = Extract<ClientMessage, { type: "light" | "object:visibility" | "mesh:display" | "mesh:compare" }>;

export type WelcomeMessage = Extract<ServerMessage, { type: "welcome" }>;

/** 表示状態の welcome 復元フィールド(未設定・空のキーは含まれない) */
export type DisplayWelcomeFields = Pick<WelcomeMessage, "light" | "hiddenObjectIds" | "meshDisplay" | "meshCompare">;

/** すべて未設定の初期状態を作る(Set は呼び出しごとに新しいインスタンス) */
export function createRoomDisplayState(): RoomDisplayState;

/**
 * state を更新し、送信元以外へ中継する ServerMessage を返す(値は複製して state と共有しない)。
 * - light: state.light = { yaw, pitch }、返り値 { type: "light", userId, angles }
 * - object:visibility: visible なら hiddenObjects から削除、そうでなければ追加、返り値 { type: "object:visibility", userId, versionId, visible }
 * - mesh:display: state.meshDisplay = mode、返り値 { type: "mesh:display", userId, mode }
 * - mesh:compare: state.meshCompare = { ...compare }、返り値 { type: "mesh:compare", userId, compare: { ...compare } }
 */
export function applyDisplayMessage(state: RoomDisplayState, userId: string, msg: DisplayClientMessage): ServerMessage;

/**
 * welcome に載せる復元フィールド。light / meshDisplay / meshCompare は null なら、hiddenObjectIds は空なら
 * キー自体を含めない。含める値は複製(light と meshCompare は浅い複製、hiddenObjectIds は新しい配列)
 */
export function displayWelcomeFields(state: RoomDisplayState): DisplayWelcomeFields;
```

### 変更 server/src/realtime/hub.ts

- `Room` を `{ users: Map<string, PresenceUser>; strokes: Map<string, Stroke>; display: RoomDisplayState }` にする
- `join` のルーム新規作成で `display: createRoomDisplayState()` を使い、welcome の組み立てを
  `...displayWelcomeFields(room.display)` に置き換える
- `handle` の `light` / `object:visibility` / `mesh:display` / `mesh:compare` の 4 case を
  `return [{ target: "others", msg: applyDisplayMessage(room.display, connId, msg) }];` の 1 つにまとめる
- `hiddenObjectsIn` / `meshDisplayIn` / `meshCompareIn` は `room.display` を読むだけで、シグネチャと返り値(複製)は変えない
- `LightAngles` / `MeshCompare` / `MeshDisplayMode` の import が不要になれば外す。それ以外の公開面
  (`PRESENCE_PALETTE`、`MAX_*`、`Outbound*`、`RoomHubOptions`、`RoomHub` の全メソッド)は変えない

## 振る舞い

### 既存テスト(変更しない)
`server/tests/realtime-hub*.test.ts` の 6 ファイルがそのまま通ること。これが本タスクの主たる検証である。

### 新規 server/tests/room-display.test.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createRoomDisplayState()` を 2 回 | それぞれ `{ light: null, hiddenObjects: 空 Set, meshDisplay: null, meshCompare: null }`。2 つの `hiddenObjects` は別インスタンス |
| `applyDisplayMessage(state, "u1", { type: "light", angles: { yaw: 1, pitch: 0.5 } })` | 返り値 `{ type: "light", userId: "u1", angles: { yaw: 1, pitch: 0.5 } }`。`state.light` が同値で、返り値の `angles` とは別オブジェクト |
| `object:visibility` を visible=false → false → true の順に | hiddenObjects が `["v1"]` → `["v1"]` → `[]`。返り値は毎回 `{ type: "object:visibility", userId, versionId, visible }` |
| `mesh:display` に `"wireframe"` | `state.meshDisplay === "wireframe"`、返り値 `{ type: "mesh:display", userId: "u1", mode: "wireframe" }` |
| `mesh:compare` に `{ baseId: "v1", targetId: "v2", thresholdPermille: 5 }` | `state.meshCompare` が同値で入力と別オブジェクト。返り値の `compare` も state と別オブジェクト |
| 初期状態で `displayWelcomeFields(state)` | `{}`(`"light" in` / `"hiddenObjectIds" in` / `"meshDisplay" in` / `"meshCompare" in` がすべて false) |
| 4 種すべて設定後に `displayWelcomeFields(state)` | 4 キーとも存在し、`hiddenObjectIds` は挿入順の配列。返り値の配列を push しても state の Set は変わらない。`light` / `meshCompare` は state と別オブジェクト |

## やらないこと
- 部位(版内オブジェクト)の表示状態の追加(100)
- `ws.ts` の変更
- 既存 hub テストの変更(落ちるなら分離が間違っている)
- protocol / shared の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存の hub テスト 6 本も変更なしで通る
- [ ] `hub.ts` が 260 行以下になっている(100 が足す余地を残す)
- [ ] server_Summary.md を更新している。`src/realtime/room-display.ts` をファイル一覧に追加し、
      「ルーム共有の表示状態はすべてここに置く(設計書 §13.5)」と書く。hub.ts の説明から
      表示状態の保持の記述を room-display.ts へ移す。テスト節に `tests/room-display.test.ts` を載せる
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
