---
id: 100
title: server 版内オブジェクト(部位)の表示・非表示をルームで保持し中継する
feature: server
depends_on: [097, 098]
owns: [server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/tests/room-display.test.ts, server/tests/realtime-hub-parts.test.ts, server/server_Summary.md]
reads: [shared/src/protocol.ts, shared/src/types.ts, shared/src/object-part.ts, shared/shared_Summary.md, server/tests/realtime-hub-objects.test.ts, server/tests/realtime-hub.test.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
098 で定義した `object:part-visibility` をサーバで受け、非表示の部位集合をルーム単位で保持して
送信元以外へ中継し、後から入った人へ `welcome.hiddenObjectParts` で復元する(設計書 §13.5)。
版単位の `object:visibility` と同じ流儀で、097 が分離した `room-display.ts` に足す。

## 前提
- 097 により、ルーム共有の表示状態は `room-display.ts` の `RoomDisplayState` にあり、`applyDisplayMessage(state, userId, msg)` が
  更新と中継メッセージ生成、`displayWelcomeFields(state)` が welcome 復元フィールド(空・null はキーを省く)を担う。
  `hub.ts` の `Room` は `{ users, strokes, display }`。server/src/realtime/room-display.ts、hub.ts
- 098 により shared に `ObjectPartRef { versionId, objectPath }`、`objectPartKey(part)`(`"v1:0/1"`)、
  Client / Server の `object:part-visibility`、`welcome.hiddenObjectParts?: ObjectPartRef[]` がある。
  shared/src/types.ts、shared/src/object-part.ts、shared/src/protocol.ts
- 版単位の `hiddenObjects` は `Set<string>` で挿入順を保ち、`hiddenObjectsIn(projectId)` が複製配列を返す。
  部位も同じ性質(挿入順・複製)にする
- `server/tests/realtime-hub.test.ts:38-58` は welcome を `toEqual` で全体比較しているので、部位が無いときに
  `hiddenObjectParts` キーが存在してはならない
- hub のテストの書き方は `server/tests/realtime-hub-objects.test.ts`(`join` / `welcome` ヘルパ、`newId` 注入)を真似る

## インターフェイス契約

### 変更 server/src/realtime/room-display.ts

```ts
import type { ObjectPartRef } from "@shared/types";

export interface RoomDisplayState {
  light: LightAngles | null;
  hiddenObjects: Set<string>;
  /** 非表示にされた部位。キーは objectPartKey(part)。挿入順を保つ */
  hiddenParts: Map<string, ObjectPartRef>;
  meshDisplay: MeshDisplayMode | null;
  meshCompare: MeshCompare | null;
}

export type DisplayClientMessage = Extract<ClientMessage, {
  type: "light" | "object:visibility" | "object:part-visibility" | "mesh:display" | "mesh:compare";
}>;

export type DisplayWelcomeFields = Pick<WelcomeMessage, "light" | "hiddenObjectIds" | "hiddenObjectParts" | "meshDisplay" | "meshCompare">;

/** createRoomDisplayState は hiddenParts: new Map() も初期化する */

/**
 * applyDisplayMessage に object:part-visibility を追加:
 * - visible なら hiddenParts.delete(key)、そうでなければ hiddenParts.set(key, { versionId, objectPath })(既にあれば上書きせず順序を保つ)
 * - 返り値 { type: "object:part-visibility", userId, versionId, objectPath, visible }
 */

/**
 * displayWelcomeFields に hiddenObjectParts を追加: hiddenParts が空ならキーを含めない。
 * 含めるときは挿入順の配列で、各要素は state と別オブジェクト({ ...part })
 */

/** hiddenParts の挿入順の複製配列(要素も複製)。hub.hiddenObjectPartsIn が使う */
export function hiddenPartsOf(state: RoomDisplayState): ObjectPartRef[];
```

### 変更 server/src/realtime/hub.ts

- `handle` の表示系 case に `"object:part-visibility"` を追加する(097 でまとめた 1 つの return に型を足すだけ)。
  098 が `case "stroke:clear":` の直前に置いた仮分岐 `case "object:part-visibility": return [];` は削除する(仮分岐を残すと表示系 case に到達しない)
- 読み取り口を追加する:

```ts
  /** ルームで非表示の部位(挿入順・複製)。ルームが無ければ [] */
  hiddenObjectPartsIn(projectId: string): ObjectPartRef[];
```

## 振る舞い

### server/tests/room-display.test.ts(追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createRoomDisplayState().hiddenParts` | 空の `Map` |
| `object:part-visibility` を `{ versionId: "v1", objectPath: "0/1", visible: false }` で | 返り値 `{ type: "object:part-visibility", userId: "u1", versionId: "v1", objectPath: "0/1", visible: false }`。`hiddenPartsOf(state)` が `[{ versionId: "v1", objectPath: "0/1" }]` |
| 同じ部位を再度 visible=false、続けて別の部位 `"2"`、続けて最初の部位を visible=true | `hiddenPartsOf` が `[{v1,"0/1"}]` → `[{v1,"0/1"},{v1,"2"}]` → `[{v1,"2"}]`。返り値は毎回 1 つ |
| 別の版 `v2` の `"0/1"` を非表示 | `v1:0/1` とは別のエントリとして残る |
| `displayWelcomeFields` で部位が無い | `"hiddenObjectParts" in` が false |
| 部位がある | `hiddenObjectParts` が挿入順の配列。配列を push / 要素を書き換えても state は変わらない |
| `hiddenPartsOf` の返り値を書き換える | state は変わらない |

### server/tests/realtime-hub-parts.test.ts(新規。realtime-hub-objects.test.ts と同じ構成)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| join 済み "a" が `{ type: "object:part-visibility", versionId: "v1", objectPath: "0/2", visible: false }` を送る | `[{ target: "others", msg: { type: "object:part-visibility", userId: "a", versionId: "v1", objectPath: "0/2", visible: false } }]`。`hub.hiddenObjectPartsIn("p1")` が `[{ versionId: "v1", objectPath: "0/2" }]` |
| その後 "b" が同じルームに join | welcome の `hiddenObjectParts` が `[{ versionId: "v1", objectPath: "0/2" }]`、`hiddenObjectIds` キーは無い |
| "a" が visible=true を送る | 中継 1 つ、`hiddenObjectPartsIn("p1")` が `[]` |
| 版単位の `object:visibility` と部位の非表示を混在 | welcome に `hiddenObjectIds` と `hiddenObjectParts` の両方が載り、互いに影響しない |
| 別ルーム "p2" に join | `"hiddenObjectParts" in welcome` が false |
| ルームの全員が disconnect した後に再 join | `"hiddenObjectParts" in welcome` が false(ルーム削除で忘れる) |
| join 前の接続・未知の接続から送る | `[]`。`hiddenObjectPartsIn` は `[]` |
| `hiddenObjectPartsIn` / welcome の配列を書き換える | hub の内部状態は変わらない |
| light / strokes / users | 部位の切り替えで変わらない(objects テストの "does not change ..." と同じ確認) |

## やらないこと
- web の変更
- 部位の非表示の DB 永続化(ルーム状態と同じくメモリのみ)
- 存在しない objectPath の検証(サーバはモデルの構造を知らない。形式は zod で検証済み)
- `ws.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存の hub テストも通る
- [ ] server_Summary.md を更新している。room-display.ts の説明に部位の非表示集合と `hiddenPartsOf`、hub.ts に
      `hiddenObjectPartsIn` を追加し、テスト節に `tests/realtime-hub-parts.test.ts` を載せる
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
