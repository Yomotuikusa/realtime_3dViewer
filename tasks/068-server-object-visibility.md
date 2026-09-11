---
id: 068
title: server RoomHub がオブジェクトの表示・非表示をルーム単位で保持し、中継と welcome への反映を行う
feature: server
depends_on: [067]
owns: [server/src/realtime/hub.ts, server/tests/realtime-hub-objects.test.ts, server/server_Summary.md]
reads: [shared/src/protocol.ts, shared/src/types.ts, server/tests/realtime-hub-light.test.ts, server/src/realtime/ws.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
オブジェクトの表示・非表示を参加者全員で共有する。RoomHub がルームごとに
「非表示の versionId 集合」を持ち、切り替えを送信元以外へ中継し、後から入室した人にも
welcome で現在の状態を渡す。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 066 で次が定義済み。shared/src/protocol.ts
  - `ClientMessage` に `{ type: "object:visibility"; versionId: string; visible: boolean }`
  - `ServerMessage` に `{ type: "object:visibility"; userId: string; versionId: string; visible: boolean }`
  - `welcome` に任意の `hiddenObjectIds?: string[]`
- 066 で `RoomHub.handle()` に `case "object:visibility"` が**中継だけ**(状態を持たない)の形で
  既に入っており、`server/tests/realtime-hub-objects.test.ts` に「others へ中継する」「welcome に
  `hiddenObjectIds` が無い(状態を持たない)」「join 前は `[]`」のテストがある。
  本タスクはこの case に状態更新を足し、「状態を持たない」テストを本タスクの振る舞いへ**書き換える**
- ライトの共有は同じ形で実装済みで、そのまま真似る。
  `Room.light` の保持: server/src/realtime/hub.ts:38-43、`case "light"` の中継: :127-131、
  welcome への任意反映: :199-204、テスト: server/tests/realtime-hub-light.test.ts
- `handle` は join 前の接続・未知の接続・ルーム不在なら `[]` を返す。hub.ts:105-113
- 空ルームは最後の退室で削除される(状態も消える)。hub.ts:96-99
- `ws.ts` は `hub.handle` の戻り値 `Outbound[]` をそのまま配る。`ws.ts` の変更は不要
- RoomHub は DB を知らないため、`versionId` が project に属するかは検証しない
- `hub.ts` は 066 の中継 case 込みで 250 行弱。追加は 30 行程度に収める(振る舞いは既存の
  `light` と同型なので、分割は不要な見込み。超えるなら責務境界で分割し、分割先を Summary に載せる)
- 067 が `server_Summary.md` を変更するため、本タスクは 067 の後に流す(depends_on)

## インターフェイス契約

```ts
// server/src/realtime/hub.ts
interface Room {
  users: Map<string, PresenceUser>;
  strokes: Map<string, Stroke>;
  light: LightAngles | null;
  /** 非表示にされたオブジェクトの versionId。挿入順を保つ */
  hiddenObjects: Set<string>;
}

export class RoomHub {
  // 既存の connect / disconnect / handle / connectionsIn / projectOf / usersIn / strokesIn は変更しない
  /** ルームで非表示のオブジェクト id。挿入順。ルーム不在なら [] */
  hiddenObjectsIn(projectId: string): string[];
}
```

`handle(connId, { type: "object:visibility", versionId, visible })`:
- `visible === false` → `room.hiddenObjects.add(versionId)`
- `visible === true` → `room.hiddenObjects.delete(versionId)`
- 戻り値は常に `[{ target: "others", msg: { type: "object:visibility", userId: connId, versionId, visible } }]`
  (状態が変わらなくても中継する。ライトと同じ後勝ち・無条件中継)

join 時の welcome:
- `room.hiddenObjects.size === 0` → `hiddenObjectIds` キーを付けない
- それ以外 → `hiddenObjectIds: [...room.hiddenObjects]`(新しい配列)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| join 済み a が `visible: false` を送る | `[{ target: "others", msg: { type: "object:visibility", userId: "a", versionId, visible: false } }]`。`hiddenObjectsIn("p1")` が `[versionId]` |
| その後 b が同じルームへ join | b の welcome に `hiddenObjectIds: [versionId]` |
| welcome の配列を呼び出し側で書き換える | `hiddenObjectsIn` の結果に影響しない(複製されている) |
| a が同じ id に `visible: true` を送る | 中継される。`hiddenObjectsIn` が `[]` |
| その後 c が join | welcome に `hiddenObjectIds` キーが無い |
| 誰も切り替えていないルームへ join | welcome に `hiddenObjectIds` キーが無い |
| `v1`, `v2` の順に非表示 → `v1` を表示 → `v1` を再び非表示 | `hiddenObjectsIn` が `["v2", "v1"]`(Set の挿入順) |
| 同じ id を2回 `visible: false` | 2回とも中継。集合は1件のまま |
| join 前の接続 / 未知の接続からの `object:visibility` | `[]`。状態変化なし |
| p1 で非表示にしても p2 の welcome | `hiddenObjectIds` を持たない(ルーム分離) |
| 全員退室後に再 join | `hiddenObjectIds` を持たない(空ルーム削除で忘れる) |
| `object:visibility` を受けても | `usersIn` / `strokesIn` / `light` は変わらない |

## やらないこと
- versionId が project に存在するかの検証(DB を知らない)
- 可視性の永続化
- `ws.ts` や REST ルートの変更
- `object:added` の配信(067 の REST publish で済んでいる。RoomHub は関与しない)
- web の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md の RoomHub の記述とテスト一覧を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
