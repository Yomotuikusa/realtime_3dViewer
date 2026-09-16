---
id: 148
title: ルーム共有のライトの明るさ(倍率)を protocol と RoomHub に追加する
feature: shared
depends_on: [136, 141]
owns: [shared/src/types.ts, shared/src/protocol.ts, shared/tests/protocol-light-brightness.test.ts, shared/shared_Summary.md, server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/tests/room-display.test.ts, server/tests/realtime-hub-brightness.test.ts, server/server_Summary.md, web/src/app/realtime-dispatch.ts]
reads: [shared/tests/protocol.test.ts, server/src/realtime/room-state.ts, server/tests/realtime-hub-light.test.ts, web/tests/realtime-dispatch.test.ts, docs/3dreviewer-plan-and-architecture.md, docs/task-breakdown.md]
verify: npm run typecheck && npm run test:shared && npm run test:server
status: todo
---

## 目的
ライトの明るさは「何が見えているか」を変えるのでルームで共有する(設計書 §13.5 / D39。2026-09-16 確定)。
向き(`light`)と同じ 4 点セットのうち、1. protocol、2. RoomHub の保持・中継・welcome を本タスクで行い、
3. web の受信反映と 4. 送信側 UI は 149 で行う。明るさは既定の光の強さに掛ける倍率で表す。

## 前提
- 向きの実装(写すべき形): `shared/src/types.ts:66-72` `LightAngles`、`:164-168` `LightAnglesSchema`。
  `shared/src/protocol.ts:37` `| { type: "light"; angles: LightAngles }`(ClientMessage、union は `:34-54`)、
  `:81` `| { type: "light"; userId: string; angles: LightAngles }`(ServerMessage、union は `:56-105`)、
  welcome(`:57-77`)の `light?: LightAngles`(`:62`)と `jointDisplay?: JointDisplay` 等の省略可能フィールド、
  `ClientMessageSchema`(`:109-123`、`:112` が light)、`ServerMessageSchema`(`:125-164`、`:131` が welcome の light、`:148` が light)
- 数値の共有設定の形: `shared/src/types.ts:88-90` `MIN_COMPARE_THRESHOLD_PERMILLE` / `MAX_…` / `DEFAULT_…` と
  `:175` の `z.number().int().min(MIN_…).max(MAX_…)`
- server: `server/src/realtime/room-display.ts` の `RoomDisplayState.light: LightAngles | null`(`:11-14`)、
  `createRoomDisplayState`(`:45-56`、`light: null` は `:47`)、`DisplayClientMessage`(`:30-34`)、`DisplayWelcomeFields`(`:38-42`)、
  `applyDisplayMessage(state, userId, msg)` の `case "light"`(`:64-67`)、`displayWelcomeFields(state)`(`:99-101`)。
  `server/src/realtime/hub.ts:98-106` の `case "light": … case "playback:source": return [{ target: "others", msg: applyDisplayMessage(room.display, connId, msg) }]`、
  welcome の組み立ては `:208-218`(`...displayWelcomeFields(room.display)`)
- テストの形: `shared/tests/protocol.test.ts:252-277`(`describe("light protocol")`)、`server/tests/realtime-hub-light.test.ts:18-31`
  (`hub.handle("a", { type: "light", angles })` → `[{ target: "others", msg: … }]`、welcome への復元)、`server/tests/room-display.test.ts:38`(light の複製)、`:166, :179`(welcome の省略・復元)
- **`ClientMessage` / `ServerMessage` に variant を足すと `server/src/realtime/hub.ts` と `web/src/app/realtime-dispatch.ts` の switch が網羅性検査で落ちる**
  (planner-prompt の規則)。web 側は `realtime-dispatch.ts:48-50` の `case "light"` の隣に仮の最小分岐を置き、149 が結線する。
  welcome の `lightBrightness` は 149 まで読まない
- `web/tests/realtime-dispatch.test.ts` は no-op の分岐では変わらないので触らない
- `shared_Summary.md:12`(protocol.ts)、`:10`(types.ts)。`server_Summary.md:37-38`(room-display.ts)、`:45-48`(hub.ts)。`## テスト` 節はどちらにも無い
- 136 で `shared/src/types.ts` に `MIN_STROKE_POINTS` 等が入っている(本タスクはその後に走る)。
  141 への依存は `server/server_Summary.md` の owns 衝突を避けるためで、140 / 141 が足した `config.ts` / `ws.ts` の変更は本タスクに関係しない

## インターフェイス契約

```ts
// shared/src/types.ts(追加)
/** ルームで共有するライトの明るさ。web 側の既定の光の強さに掛ける倍率 */
export const MIN_LIGHT_BRIGHTNESS = 0.25;
export const MAX_LIGHT_BRIGHTNESS = 4;
/** 誰も変えていないルームの明るさ */
export const DEFAULT_LIGHT_BRIGHTNESS = 1;
/** 有限数で MIN〜MAX。整数には限らない */
export const LightBrightnessSchema = z.number().min(MIN_LIGHT_BRIGHTNESS).max(MAX_LIGHT_BRIGHTNESS);
```

```ts
// shared/src/protocol.ts
export type ClientMessage =
  // …既存
  | { type: "light:brightness"; brightness: number };
export type ServerMessage =
  | { type: "welcome"; /* …既存 */ /** ルームのライトの明るさ。誰も変えていなければ省略される */ lightBrightness?: number }
  // …既存
  | { type: "light:brightness"; userId: string; brightness: number };
// ClientMessageSchema / ServerMessageSchema に同じ形の z.object を足す(brightness は LightBrightnessSchema、userId は IdSchema)。
// welcome は lightBrightness: LightBrightnessSchema.optional()
```

```ts
// server/src/realtime/room-display.ts
export interface RoomDisplayState {
  // …既存
  /** ルームで共有するライトの明るさ。誰も変えていなければ null */
  lightBrightness: number | null;
}
// DisplayClientMessage の union に "light:brightness"、DisplayWelcomeFields の Pick に "lightBrightness" を足す
// applyDisplayMessage: case "light:brightness": state.lightBrightness = msg.brightness; return { type: "light:brightness", userId, brightness: msg.brightness }
// displayWelcomeFields: state.lightBrightness !== null なら fields.lightBrightness = state.lightBrightness

// server/src/realtime/hub.ts:98-106 の case 列に "light:brightness" を足す(処理は同じ)

// web/src/app/realtime-dispatch.ts(仮の最小分岐。149 が結線する)
//   case "light:brightness":
//     break;
```

## 振る舞い

### shared(`shared/tests/protocol-light-brightness.test.ts`)
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MIN_LIGHT_BRIGHTNESS` / `MAX_LIGHT_BRIGHTNESS` / `DEFAULT_LIGHT_BRIGHTNESS` | 0.25 / 4 / 1 |
| `LightBrightnessSchema` に 0.25 / 1 / 4 / 1.5 | 受理 |
| `LightBrightnessSchema` に 0.2 / 4.01 / NaN / Infinity / "1" | 拒否 |
| `ClientMessageSchema` に `{ type: "light:brightness", brightness: 2 }` | 受理 |
| `{ type: "light:brightness" }` / `{ type: "light:brightness", brightness: 0 }` | 拒否 |
| `ServerMessageSchema` に `{ type: "light:brightness", userId: "user-1", brightness: 2 }` | 受理。`userId` 無しは拒否 |
| welcome に `lightBrightness` 無し | 受理し、`"lightBrightness" in data` が false |
| welcome に `lightBrightness: 2` | 受理し、`data.lightBrightness === 2`。`lightBrightness: 9` は拒否 |
| `parseClientMessage(JSON)` / `parseServerMessage(JSON)` | 上と同じ判定で ok / error |

### server
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createRoomDisplayState()` | `lightBrightness === null` |
| `applyDisplayMessage(state, "a", { type: "light:brightness", brightness: 2 })` | `state.lightBrightness === 2`、返り値 `{ type: "light:brightness", userId: "a", brightness: 2 }` |
| `displayWelcomeFields(state)` で未設定 | `lightBrightness` キーが無い(既存の「omits all unset welcome fields」に加える) |
| 設定済み | `lightBrightness` が入る(既存の「restores all configured fields」に加える) |
| `hub.handle("a", { type: "light:brightness", brightness: 2 })`(a は join 済み) | `[{ target: "others", msg: { type: "light:brightness", userId: "a", brightness: 2 } }]` |
| その後 b が同じ project に join | b の welcome に `lightBrightness: 2`。向き(`light`)は送っていなければ省略のまま |
| 未 join / 未知の接続からの `light:brightness` | 既存の `light` と同じ扱い(`realtime-hub-light.test.ts:56` と同じ期待) |
| 別 project | 共有されない。ルームが空になると忘れる(`realtime-hub-light.test.ts:63` と同じ) |
| 後勝ち | 2 → 0.5 と送ると welcome は 0.5 |

### web
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `npm run typecheck` | `realtime-dispatch.ts` の switch が網羅されて通る。`light:brightness` 受信は何もしない(149 まで) |

## やらないこと
- web のストア・UI・送信(149)はしない。`realtime-dispatch.ts` は仮分岐 1 つだけ
- `light`(向き)のメッセージ形を変えない。明るさを `LightAngles` に入れない
- 明るさの実際の光の強さへの換算(web の `AMBIENT_LIGHT_INTENSITY` 等)は shared に持ち込まない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存の light テストもすべて通る
- [ ] shared_Summary.md(types.ts / protocol.ts)と server_Summary.md(room-display.ts / hub.ts)が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
