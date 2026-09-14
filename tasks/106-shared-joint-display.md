---
id: 106
title: shared/server/web にジョイント表示(可視・x-ray)のルーム共有を通す
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/joint.ts, shared/src/index.ts, shared/src/protocol.ts, shared/shared_Summary.md, shared/tests/joint.test.ts, shared/tests/protocol-joint.test.ts, server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/server_Summary.md, server/tests/room-display.test.ts, server/tests/realtime-hub-joint.test.ts, web/src/store/display.ts, web/src/store/store_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/app_Summary.md, web/tests/store-display.test.ts, web/tests/realtime-dispatch.test.ts]
reads: [shared/src/compare.ts, shared/tests/mesh-compare.test.ts, shared/tests/protocol.test.ts, server/tests/realtime-hub-display.test.ts, server/tests/realtime-hub-compare.test.ts, server/src/realtime/ws.ts, web/src/features/viewer/DisplayModeBar.tsx, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test
status: done
---

## 目的
ジョイント(ボーン)の可視化を「表示する / しない」と「x-ray(メッシュに隠さず手前に描く)」の
2つの真偽値でルーム共有できるようにする。本タスクは型・スキーマ・中継・ストアまでの結線だけを行う。
3D の描画は 107、切り替える UI は 108。

## 前提
- ルーム共有の表示状態は `mesh:display` / `mesh:compare` と同じ経路を通る。
  `shared/src/protocol.ts` の union → `server/src/realtime/room-display.ts` の `applyDisplayMessage` →
  `server/src/realtime/hub.ts` の `case` 群 → `web/src/app/realtime-dispatch.ts` → `web/src/store/display.ts`
- `ClientMessage` / `ServerMessage` の union に variant を足すと、`hub.ts:118-146` の `switch` と
  `realtime-dispatch.ts:20-79` の `switch`(末尾に `msg satisfies never`)が網羅性検査になるため、
  この3ファイルは必ず同時に変更する。片方だけ変えると `npm run typecheck` が落ちる
- `welcome` は `hub.ts:225-238` が `...displayWelcomeFields(room.display)` を展開して組み立てる。
  `room-display.ts` に復元フィールドを足せば `hub.ts` 側の welcome 本体は変更不要
- 複製と同値抑止の前例は `MeshCompare`。`shared/src/compare.ts` に `meshCompareEquals` / `cloneMeshCompare` があり、
  `web/src/store/display.ts:26-29` の `setMeshCompare` が同値なら `set` を呼ばない
- `server/tests/room-display.test.ts:14,21` は `createRoomDisplayState()` の**全キー**を `toEqual` で断言しているため、
  state にキーを足すとこのテストは必ず更新が要る
- `shared/tests/protocol.test.ts` は現在 **284行**で上限に余裕がない。本タスクでは触らず、
  ジョイント関連の断言は新規 `shared/tests/protocol-joint.test.ts` に書く
  (`mesh-compare.test.ts` が protocol の断言を別ファイルに持つ前例と同じ)
- `server/src/realtime/hub.ts` は現在 **272行**。本タスクでの追加は `case` 1行・アクセサ5行・import の型追加だけとし、
  それ以外の整理や分割は行わない(行数の余裕が小さいことは Summary の申し送りに書く)
- 既存の `server/tests/realtime-hub-display.test.ts` / `realtime-hub-compare.test.ts` は変更しない。
  RoomHub のジョイント表示の検証は新規 `server/tests/realtime-hub-joint.test.ts` に書く(1状態1ファイルの既存流儀)

## インターフェイス契約

### 変更 shared/src/types.ts

`MeshCompare` 群の直後に置く。

```ts
/** ルームで共有するジョイント(ボーン)の表示設定 */
export interface JointDisplay {
  /** ジョイントを描くなら true */
  visible: boolean;
  /** メッシュに隠さず常に手前へ描くなら true */
  xray: boolean;
}
/** 誰も切り替えていないルームの値 */
export const DEFAULT_JOINT_DISPLAY: JointDisplay = { visible: false, xray: true };
```

スキーマ節(`MeshCompareSchema` の直後)に置く。

```ts
export const JointDisplaySchema = z.object({
  visible: z.boolean(),
  xray: z.boolean(),
}) satisfies z.ZodType<JointDisplay>;
```

### 新規 shared/src/joint.ts

```ts
import type { JointDisplay } from "./types";

/** 2フィールドすべて === で等しいとき true */
export function jointDisplayEquals(a: JointDisplay, b: JointDisplay): boolean;

/** 浅い複製(フィールドはプリミティブなので浅くてよい) */
export function cloneJointDisplay(display: JointDisplay): JointDisplay;
```

### 変更 shared/src/index.ts

末尾に `export * from "./joint";` を足す。

### 変更 shared/src/protocol.ts

```ts
// ClientMessage(mesh:compare の後)
  /** 自分がジョイントの表示設定を変えた(値全体を送る) */
  | { type: "joint:display"; display: JointDisplay }

// ServerMessage の welcome(meshCompare の後)
      /** ルームのジョイント表示設定。誰も変えていなければ省略される */
      jointDisplay?: JointDisplay;

// ServerMessage(mesh:compare の後)
  /** userId がジョイントの表示設定を変えた(送信元以外へ中継) */
  | { type: "joint:display"; userId: string; display: JointDisplay }
```

- `ClientMessageSchema` の末尾に `z.object({ type: z.literal("joint:display"), display: JointDisplaySchema })`
- welcome の object スキーマに `jointDisplay: JointDisplaySchema.optional()`
- `ServerMessageSchema` の `mesh:compare` の後に
  `z.object({ type: z.literal("joint:display"), userId: IdSchema, display: JointDisplaySchema })`
- import は `JointDisplaySchema` と `type JointDisplay` を既存の import 文へ追加する

### 変更 server/src/realtime/room-display.ts

```ts
export interface RoomDisplayState {
  // …既存…
  /** ルームで共有するジョイントの表示設定。誰も変えていなければ null */
  jointDisplay: JointDisplay | null;
}

export type DisplayClientMessage = Extract<
  ClientMessage,
  { type: "light" | "object:visibility" | "object:part-visibility" | "mesh:display" | "mesh:compare" | "joint:display" }
>;

export type DisplayWelcomeFields = Pick<
  WelcomeMessage,
  "light" | "hiddenObjectIds" | "hiddenObjectParts" | "meshDisplay" | "meshCompare" | "jointDisplay"
>;
```

- `createRoomDisplayState()` は `jointDisplay: null` を足す(キーは上の interface の宣言順に合わせる)
- `applyDisplayMessage` に次の case を `mesh:compare` の後へ足す

```ts
    case "joint:display":
      state.jointDisplay = { ...msg.display };
      return { type: "joint:display", userId, display: { ...state.jointDisplay } };
```

- `displayWelcomeFields` に
  `if (state.jointDisplay !== null) fields.jointDisplay = { ...state.jointDisplay };` を足す

### 変更 server/src/realtime/hub.ts

- `handle` の fallthrough 群へ `case "joint:display":` を `case "mesh:compare":` の**直後**に足す(本体は共通のまま)
- `meshCompareIn` の直後に読み取り口を足す

```ts
  /** ルームのジョイント表示設定(複製)。ルームが無い・未設定なら null */
  jointDisplayIn(projectId: string): JointDisplay | null;
```

- import の `import type { … } from "@shared/types";` に `JointDisplay` を足す
- 上記以外は変更しない

### 変更 web/src/store/display.ts

```ts
export interface DisplayStoreState {
  // …既存…
  /** ジョイントの表示設定。初期値は DEFAULT_JOINT_DISPLAY の複製 */
  jointDisplay: JointDisplay;
  /** jointDisplayEquals で同値なら state を更新しない。複製して保持する */
  setJointDisplay(display: JointDisplay): void;
}
```

- 初期値は `cloneJointDisplay(DEFAULT_JOINT_DISPLAY)`
- `reset()` は `jointDisplay: cloneJointDisplay(DEFAULT_JOINT_DISPLAY)` も含めて1回の `set` で戻す

### 変更 web/src/app/realtime-dispatch.ts

- `welcome` の `display.setMeshCompare(...)` の直後に
  `display.setJointDisplay(msg.jointDisplay ?? DEFAULT_JOINT_DISPLAY);`
- `case "mesh:compare":` の後に

```ts
    case "joint:display":
      display.setJointDisplay(msg.display);
      break;
```

## 振る舞い

### shared/tests/joint.test.ts(新規)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `DEFAULT_JOINT_DISPLAY` | `{ visible: false, xray: true }` |
| `jointDisplayEquals({visible:true,xray:false}, {visible:true,xray:false})` | `true`(別オブジェクトでも true) |
| `visible` だけ違う / `xray` だけ違う | `false` |
| `cloneJointDisplay(d)` | `toEqual(d)` かつ `not.toBe(d)`。戻り値を書き換えても `d` は変わらない |
| `JointDisplaySchema.safeParse({visible:false,xray:true})` | 成功 |
| `JointDisplaySchema.safeParse({visible:true,xray:true,extra:1})` | 成功し、`data` に `extra` を含まない |
| `{visible:"true",xray:true}` / `{visible:true}` / `{}` / `null` | 失敗 |
| `../src/index` から `JointDisplay` 型 / `DEFAULT_JOINT_DISPLAY` / `JointDisplaySchema` / `jointDisplayEquals` / `cloneJointDisplay` を import | すべて解決し、関数は `typeof === "function"` |

### shared/tests/protocol-joint.test.ts(新規)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ClientMessageSchema.safeParse({type:"joint:display",display:{visible:true,xray:false}})` | 成功 |
| `{type:"joint:display"}` / `display:{visible:true}` / `display:{visible:1,xray:true}` | 失敗 |
| `ServerMessageSchema.safeParse({type:"joint:display",userId:"user-1",display:{visible:true,xray:true}})` | 成功 |
| `{type:"joint:display",display:{…}}`(userId なし) / `userId:""` | 失敗 |
| welcome に `jointDisplay:{visible:true,xray:false}` | 成功し、`data.jointDisplay` が一致 |
| welcome に `jointDisplay` を載せない | 成功し、`"jointDisplay" in data === false` |
| welcome の `jointDisplay:{visible:true}` | 失敗 |
| `parseClientMessage(JSON.stringify({type:"joint:display",display:{visible:true,xray:true}}))` | `{ ok:true, msg:{…} }` |
| `parseServerMessage` に同型 + `userId` | `{ ok:true, msg:{…} }` |

### server/tests/room-display.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 既存の `createRoomDisplayState()` の `toEqual`(2箇所) | `jointDisplay: null` を加えた全キーで一致 |
| `applyDisplayMessage(state,"u1",{type:"joint:display",display})` | 戻り値 `{type:"joint:display",userId:"u1",display}`。`state.jointDisplay` は `toEqual(display)` かつ引数とも戻り値とも `not.toBe` |
| 続けて別の値を適用 | 後勝ちで `state.jointDisplay` が新しい値 |
| 未設定での `displayWelcomeFields(state)` | `"jointDisplay" in fields === false` |
| 設定後の `displayWelcomeFields(state)` | `fields.jointDisplay` が `toEqual` かつ `state.jointDisplay` と `not.toBe` |
| `joint:display` を適用しても `meshDisplay` / `meshCompare` / `light` / 非表示集合 | 変化しない |

### server/tests/realtime-hub-joint.test.ts(新規)

`realtime-hub-display.test.ts` と同じ組み立て(接続 → join → handle)で書く。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| join 済み接続が `joint:display` を送る | `[{target:"others", msg:{type:"joint:display", userId:<connId>, display}}]` |
| 送信後の `hub.jointDisplayIn("p1")` | `toEqual(display)` かつ送信した値と `not.toBe` |
| 2回送る | 後勝ち |
| 送信後に別の接続が join したときの welcome | `jointDisplay` が載り、`hub.jointDisplayIn` の値と `toEqual` |
| 誰も送っていないルームの welcome | `"jointDisplay" in welcome === false`。`jointDisplayIn("p1")` は `null` |
| `jointDisplayIn("missing")` | `null` |
| p1 で送っても `jointDisplayIn("p2")` | `null` |
| 全員退出後に再 join | `jointDisplayIn` は `null`、welcome に載らない |
| join していない接続が `joint:display` を送る | `[]` を返し、`jointDisplayIn` は `null` |
| `mesh:display` を送っても `jointDisplayIn` | `null` のまま(独立) |

### web/tests/store-display.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期状態の `jointDisplay` | `toEqual(DEFAULT_JOINT_DISPLAY)` かつ `not.toBe(DEFAULT_JOINT_DISPLAY)` |
| `setJointDisplay({visible:true,xray:false})` | 反映され、引数と `not.toBe` |
| 同値を別オブジェクトで再送 | `useDisplayStore.getState()` が `toBe` で同一(再描画しない) |
| `xray` だけ違う値 | 更新される |
| `reset()` | `jointDisplay` が `DEFAULT_JOINT_DISPLAY` と `toEqual` |
| `setJointDisplay` の後の `meshDisplay` / `meshCompare` | 変化しない |

### web/tests/realtime-dispatch.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `dispatchServerMessage({type:"joint:display",userId:"u2",display:{visible:true,xray:false}})` | ストアの `jointDisplay` が `{visible:true,xray:false}` |
| `welcome` に `jointDisplay:{visible:true,xray:false}` | 反映される |
| `jointDisplay` の無い `welcome` | `DEFAULT_JOINT_DISPLAY` に戻る |
| 上記の welcome 適用後の `meshDisplay` / `meshCompare` | 既存テストどおりの値のまま |

## やらないこと
- ジョイントの 3D 描画・three.js のコード(107)
- HUD のボタン・ラベル・アイコン(108)
- `shared/tests/protocol.test.ts` / `server/tests/realtime-hub-display.test.ts` の変更(行数と責務のため触らない)
- `server/src/realtime/ws.ts` の変更(ClientMessage は既存経路でそのまま `hub.handle` へ渡る)
- `hub.ts` の分割・整理(行数に余裕が無いことは申し送りに書くだけ)
- `docs/3dreviewer-plan-and-architecture.md` の更新(workspace の外なので変更しない)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・キー順で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存テストも通る
- [ ] shared_Summary.md を更新している。`src/joint.ts` をファイル一覧・公開インターフェイスに追加し、
      `src/types.ts` と `src/protocol.ts` の説明に `JointDisplay` / `joint:display` を追記し、
      `src/index.ts` の再エクスポート一覧に joint を足し、テスト節に `tests/joint.test.ts` と
      `tests/protocol-joint.test.ts` を載せる
- [ ] server_Summary.md を更新している。`room-display.ts` の説明にジョイント表示設定を足し、
      `hub.ts` の説明に `jointDisplayIn` を足し、テスト節に `tests/realtime-hub-joint.test.ts` を載せ、
      `tests/room-display.test.ts` の説明を6種の更新・中継に直す。
      申し送りとして `hub.ts` が行数上限に近いことを記す
- [ ] store_Summary.md の `display.ts` の説明と公開インターフェイスに `jointDisplay` / `setJointDisplay` を足している
- [ ] app_Summary.md の `realtime-dispatch.ts` の説明に `joint:display` と welcome の `jointDisplay` を足し、
      テスト節の `tests/realtime-dispatch.test.ts` の説明にも足している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
