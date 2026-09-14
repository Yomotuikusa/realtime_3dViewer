---
id: 110
title: shared/server/web にモーション軌跡(trail:display)のルーム共有を通す
feature: shared
depends_on: [109]
owns: [shared/src/trail.ts, shared/src/index.ts, shared/src/protocol.ts, shared/shared_Summary.md, shared/tests/trail.test.ts, shared/tests/protocol-trail.test.ts, server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/server_Summary.md, server/tests/room-display.test.ts, server/tests/realtime-hub-trail.test.ts, web/src/store/display.ts, web/src/store/store_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/app_Summary.md, web/tests/store-display.test.ts, web/tests/realtime-dispatch.test.ts]
reads: [shared/src/types.ts, shared/src/joint.ts, shared/src/object-part.ts, shared/tests/protocol-joint.test.ts, shared/tests/joint.test.ts, server/src/realtime/room-state.ts, server/src/realtime/ws.ts, server/tests/realtime-hub-joint.test.ts, web/src/app/review-stores.ts, web/tests/review-stores.test.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test
status: done
---

## 目的
選択したボーンのアニメーション軌跡(Maya の Motion Trail 相当)の表示設定を、
ルーム全員で共有できるようにする。本タスクは型・スキーマ・中継・ストアまでの結線だけを行う。
軌跡の計算は 112、3D の描画は 113、切り替える UI は 114。

## 前提
- ルーム共有の表示状態は `joint:display` と同じ経路を通る(設計書 §13.5)。
  `shared/src/protocol.ts` の union → `server/src/realtime/room-display.ts` の `applyDisplayMessage` →
  `server/src/realtime/hub.ts` の `case` 群 → `web/src/app/realtime-dispatch.ts` → `web/src/store/display.ts`
- `ClientMessage` / `ServerMessage` の union に variant を足すと、`hub.ts` の `handle` の `switch` と
  `realtime-dispatch.ts` の `switch`(末尾に `msg satisfies never`)が網羅性検査になるため、
  この 3 ファイルは必ず同時に変更する。片方だけ変えると `npm run typecheck` が落ちる
- 109 の後の `hub.ts` では、表示状態のメッセージは `case "light": … case "joint:display":` の
  fall-through 群でまとめて `applyDisplayMessage` へ渡している。`trail:display` もこの群へ足す
- `welcome` は `hub.ts` の `join` が `...displayWelcomeFields(room.display)` を展開して組み立てる。
  `room-display.ts` に復元フィールドを足せば `hub.ts` 側の welcome 本体は変更不要
- **`shared/src/types.ts` は 247 行あり、1 ファイル 300 行の上限に近い。**
  そのため `MotionTrail` の型・スキーマ・比較・複製はすべて新規の `shared/src/trail.ts` に置き、
  `types.ts` は変更しない(`JointDisplay` が types.ts にあるのとは意図的に扱いを変える)
- `ObjectPartRef` / `ObjectPartRefSchema` は `shared/src/types.ts`、
  `isSameObjectPart` は `shared/src/object-part.ts` にある
- `server/tests/room-display.test.ts:14-21` は `createRoomDisplayState()` の戻り値を
  `toEqual({ light: null, hiddenObjects: …, hiddenParts: …, meshDisplay: null, meshCompare: null, jointDisplay: null })`
  で完全一致検査している。フィールドを足すとここが落ちるので、同じ検査に `motionTrail: null` を加える
- `web/tests/realtime-dispatch.test.ts` は現在 233 行ある。追加分を入れても 300 行を超えないよう、
  `trail:display` のテストは welcome 復元と中継受信の 2 ケースに絞って書く

## インターフェイス契約

### 新規 `shared/src/trail.ts`

```ts
import { z } from "zod";
import { isSameObjectPart } from "./object-part";
import { ObjectPartRefSchema, type ObjectPartRef } from "./types";

/** ルームで共有するモーション軌跡の表示設定 */
export interface MotionTrail {
  /** 軌跡を描くなら true */
  visible: boolean;
  /** 軌跡を描く対象の部位。未選択なら null */
  target: ObjectPartRef | null;
}

/** 誰も切り替えていないルームの値 */
export const DEFAULT_MOTION_TRAIL: MotionTrail = { visible: false, target: null };

export const MotionTrailSchema = z.object({
  visible: z.boolean(),
  target: ObjectPartRefSchema.nullable(),
}) satisfies z.ZodType<MotionTrail>;

/** visible が === で等しく、target が両方 null か isSameObjectPart で等しいとき true */
export function motionTrailEquals(a: MotionTrail, b: MotionTrail): boolean;

/** target の参照まで複製する(target が null なら null のまま) */
export function cloneMotionTrail(trail: MotionTrail): MotionTrail;
```

`shared/src/index.ts` の末尾へ `export * from "./trail";` を足す。

### `shared/src/protocol.ts`

```ts
// ClientMessage の union の末尾へ
/** 自分が軌跡の表示設定を変えた(値全体を送る) */
| { type: "trail:display"; trail: MotionTrail }

// ServerMessage の union の joint:display の直後へ
/** userId が軌跡の表示設定を変えた(送信元以外へ中継) */
| { type: "trail:display"; userId: string; trail: MotionTrail }

// welcome の jointDisplay の直後へ
/** ルームの軌跡表示設定。誰も変えていなければ省略される */
motionTrail?: MotionTrail;
```

`ClientMessageSchema` / `ServerMessageSchema` / welcome スキーマにも同じ順で追加する。

### `server/src/realtime/room-display.ts`

```ts
export interface RoomDisplayState {
  // … 既存フィールドの後ろへ
  /** ルームで共有する軌跡の表示設定。誰も変えていなければ null */
  motionTrail: MotionTrail | null;
}

export type DisplayClientMessage = Extract<
  ClientMessage,
  { type: "light" | "object:visibility" | "object:part-visibility" | "mesh:display" | "mesh:compare" | "joint:display" | "trail:display" }
>;

export type DisplayWelcomeFields = Pick<
  WelcomeMessage,
  "light" | "hiddenObjectIds" | "hiddenObjectParts" | "meshDisplay" | "meshCompare" | "jointDisplay" | "motionTrail"
>;
```

- `createRoomDisplayState()` は `motionTrail: null` を返す
- `applyDisplayMessage` に
  `case "trail:display": state.motionTrail = cloneMotionTrail(msg.trail); return { type: "trail:display", userId, trail: cloneMotionTrail(state.motionTrail) };`
- `displayWelcomeFields` に
  `if (state.motionTrail !== null) fields.motionTrail = cloneMotionTrail(state.motionTrail);`

### `server/src/realtime/hub.ts`

- `handle` の fall-through 群へ `case "trail:display":` を足す(本体は変えない)
- アクセサを 1 つ足す(`jointDisplayIn` と同型)

```ts
/** ルームの軌跡表示設定(複製)。ルームが無い・未設定なら null */
motionTrailIn(projectId: string): MotionTrail | null;
```

### `web/src/store/display.ts`

```ts
export interface DisplayStoreState {
  // … 既存の後ろへ
  /** 軌跡の表示設定。初期値は DEFAULT_MOTION_TRAIL の複製 */
  motionTrail: MotionTrail;
  /** motionTrailEquals で同値なら state を更新しない。複製して保持する */
  setMotionTrail(trail: MotionTrail): void;
}
```

`reset()` は `motionTrail: cloneMotionTrail(DEFAULT_MOTION_TRAIL)` も戻す。

### `web/src/app/realtime-dispatch.ts`

- `welcome` の末尾へ `display.setMotionTrail(msg.motionTrail ?? DEFAULT_MOTION_TRAIL);`
- `case "trail:display": display.setMotionTrail(msg.trail); break;`

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `motionTrailEquals({visible:true,target:null},{visible:true,target:null})` | true |
| `motionTrailEquals` 片方だけ target が null | false |
| `motionTrailEquals` target の versionId だけ違う | false |
| `motionTrailEquals` target の objectPath だけ違う | false |
| `motionTrailEquals` 同じ内容の別インスタンスの target | true |
| `cloneMotionTrail({visible:false,target:{versionId:"v1",objectPath:"0/2"}})` | 値は等しく、戻り値と `target` が入力と別インスタンス |
| `cloneMotionTrail` target が null | `target` は null のまま |
| `MotionTrailSchema.safeParse({visible:true,target:null})` | success |
| `MotionTrailSchema.safeParse({visible:true,target:{versionId:"v1",objectPath:"0/2"}})` | success |
| `MotionTrailSchema` objectPath が `"/0"` / `""` / `"a"` | failure(ObjectPathSchema の規則) |
| `MotionTrailSchema` visible 欠落 | failure |
| `parseClientMessage('{"type":"trail:display","trail":{"visible":true,"target":null}}')` | ok、msg が同値 |
| `parseServerMessage` の `trail:display` に userId 欠落 | `ok:false` |
| `parseServerMessage` の welcome に `motionTrail` 省略 | ok、`motionTrail` は undefined |
| `createRoomDisplayState()` | `motionTrail` が null(既存フィールドの検査も従来どおり) |
| `applyDisplayMessage(state,"u1",{type:"trail:display",trail:T})` | 戻り値 `{type:"trail:display",userId:"u1",trail:T と同値}`。`state.motionTrail`・戻り値の `trail`・入力 `T` が互いに別インスタンス |
| `displayWelcomeFields`: motionTrail 未設定 | `motionTrail` キーを含まない |
| `displayWelcomeFields`: 設定済み | `motionTrail` が複製で載る |
| hub: 入室済みの u1 が `trail:display` を送る | `[{target:"others", msg:{type:"trail:display",userId:"u1",trail:…}}]` |
| hub: 上記の後に u2 が join | u2 の welcome に同じ `motionTrail` が載る |
| hub: 誰も送っていないルームへ join | welcome に `motionTrail` キーが無い |
| `hub.motionTrailIn("なしのid")` | null |
| `hub.motionTrailIn` 設定済み | 複製が返り、`room` 内の実体とは別インスタンス |
| display ストア初期値 | `motionTrail` が `DEFAULT_MOTION_TRAIL` と同値で別インスタンス |
| `setMotionTrail` に同値を渡す | `set` が呼ばれず購読者へ通知されない |
| `setMotionTrail` に別値を渡す | state が更新され、渡した値とは別インスタンスで保持される |
| `reset()` | `motionTrail` が `DEFAULT_MOTION_TRAIL` と同値へ戻る |
| dispatch: welcome に `motionTrail` あり | その値がストアへ入る |
| dispatch: welcome に `motionTrail` 無し | `DEFAULT_MOTION_TRAIL` がストアへ入る(全置換) |
| dispatch: `trail:display` 受信 | `setMotionTrail(msg.trail)` が呼ばれる |

## やらないこと
- `shared/src/types.ts` の変更。`MotionTrail` は `shared/src/trail.ts` に置く
- 軌跡の計算・描画・UI。112 / 113 / 114 の仕事であり、ここでは行わない
- `web/src/app/review-stores.ts` の変更。display ストアは既に reset 対象に入っている
- `server/src/realtime/ws.ts` の変更。表示メッセージ専用の分岐を持たない
- `server/src/realtime/room-state.ts` / `room-strokes.ts` の変更(109 の成果物)
- 既存テストの `expect` の削除・緩和。`room-display.test.ts` は `motionTrail: null` を
  足すだけにとどめ、他の検査は残す

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md / server_Summary.md / store_Summary.md / app_Summary.md が更新されている
- [ ] すべてのファイルが300行以内(hub.ts と realtime-dispatch.test.ts に特に注意)
- [ ] verify: に書いたコマンドが成功する
