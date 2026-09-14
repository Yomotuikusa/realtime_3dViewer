---
id: 072
title: shared/server/web メッシュの表示方法(mesh:display)をルーム全員で共有する(受信側と web ストア)
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/protocol.ts, shared/tests/types.test.ts, shared/tests/protocol.test.ts, shared/shared_Summary.md, server/src/realtime/hub.ts, server/tests/realtime-hub-display.test.ts, server/server_Summary.md, web/src/store/display.ts, web/tests/store-display.test.ts, web/src/app/review-stores.ts, web/tests/review-stores.test.ts, web/src/app/realtime-dispatch.ts, web/tests/realtime-dispatch.test.ts, web/src/store/store_Summary.md, web/src/app/app_Summary.md]
reads: [shared/src/index.ts, shared/tests/lighting.test.ts, server/src/realtime/ws.ts, server/tests/realtime-hub-light.test.ts, server/tests/realtime-hub-objects.test.ts, web/src/store/objects.ts, web/src/store/lighting.ts, web/tests/store-objects.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
3D ビューのメッシュの表示方法を「メッシュ / ワイヤフレーム / メッシュ+ワイヤ」の3種類から
選べるようにし、その選択を**ルーム単位の共有値**にする。本タスクはその土台として、
型・WS メッセージ・サーバの保持と中継・web のストアと受信反映を作る。
three.js への適用は 073、切替 UI と送信は 074 で行う。したがって本タスク完了時点では
画面上は何も変わらない(サーバから届いた値がストアに入るだけ)。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### なぜ shared / server / web を1タスクにまとめてあるのか(060 / 066 と同じ理由)

`verify` の `npm run typecheck` は `tsc shared && tsc server && tsc web` の直列実行である。
`ClientMessage` / `ServerMessage` の union に種類を足すと、次の2つの網羅性検査が落ちる。

- `RoomHub.handle()` の `switch (msg.type)` に default が無く、union が増えると
  `TS2366: Function lacks ending return statement` になる。server/src/realtime/hub.ts:115-151
- web の `dispatchServerMessage` の `default: msg satisfies never`。web/src/app/realtime-dispatch.ts:63-64

**したがって union 追加とこの2つのハンドラは同じコミットに入れるしかない。タスクを分割しようとしないこと。**

### 既存の形(そのまま真似る)

- ライトの共有が同型の実装済み例である。
  型: shared/src/types.ts:55-60、スキーマ: :107-110、
  protocol の union とスキーマ: shared/src/protocol.ts:26, :39, :46, :63, :76, :87、
  RoomHub の `Room.light` 保持: server/src/realtime/hub.ts:38-45、`case "light"`: :129-133、
  welcome への任意反映: :222-223、テスト: server/tests/realtime-hub-light.test.ts
- 列挙値のスキーマは `CommentStatusSchema = z.enum([...]) satisfies z.ZodType<CommentStatus>` の形。shared/src/types.ts:120
- protocol.ts のローカル `IdSchema` は `z.string().min(1)`(types.ts の `IdSchema` とは別物)。shared/src/protocol.ts:58
- `shared/tests/protocol.test.ts:86` の "accepts all twelve server message variants" は server メッセージの
  種類数を固定している。本タスクで 13 種になるので、テスト名と配列を更新する。
  :44 の "accepts each client message shape" の配列にも新メッセージを足す
- `shared/src/index.ts` は `export *` なので変更不要
- `hub.ts` は現在 262 行。追加は 15 行程度に収める(上限 300 行)
- web の objects ストアが「ルーム共有値を welcome で全置換する」例である。
  `dispatchServerMessage` は `objects.applyWelcome(msg.hiddenObjectIds ?? [])` と、
  welcome にキーが無ければ**初期値へ戻す**。web/src/app/realtime-dispatch.ts:25
  (light は「無ければ触らない」だが、本タスクは objects の流儀に合わせる。後述)
- `resetReviewStores()` は現在 8 ストアを初期化する。web/src/app/review-stores.ts。
  `web/src/app/app_Summary.md:14, :42, :55` に「8ストア」「8つ」と書かれている
- web のテストは jsdom で `@testing-library` がない。検証できるのは純粋関数とストアだけ
- `web/tests/summary-coverage.test.ts` が、src の全ファイルが最寄りの `_Summary.md` に載っていること、
  `web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っていることを検査する。
  **新しいファイルを足したら Summary にも書くこと**

## インターフェイス契約

### 変更 shared/src/types.ts

`LightAngles` の interface(:55-60)の直後に足す。

```ts
/** ルームで共有するメッシュの表示方法。solid=通常、wireframe=線のみ、solid-wireframe=通常描画に線を重ねる */
export type MeshDisplayMode = "solid" | "wireframe" | "solid-wireframe";
/** 誰も切り替えていないルームの表示方法 */
export const DEFAULT_MESH_DISPLAY: MeshDisplayMode = "solid";
```

`LightAnglesSchema`(:107-110)の直後に足す。

```ts
export const MeshDisplayModeSchema = z.enum(["solid", "wireframe", "solid-wireframe"]) satisfies z.ZodType<MeshDisplayMode>;
```

### 変更 shared/src/protocol.ts

`MeshDisplayModeSchema` と `type MeshDisplayMode` の import を足す。

```ts
export type ClientMessage =
  | /* 既存はそのまま */
  /** 自分がメッシュの表示方法を切り替えた */
  | { type: "mesh:display"; mode: MeshDisplayMode };   // object:visibility の直後(末尾)

export type ServerMessage =
  | {
      type: "welcome";
      /* 既存はそのまま */
      /** ルームのメッシュ表示方法。誰も切り替えていなければ省略される */
      meshDisplay?: MeshDisplayMode;                     // hiddenObjectIds の直後
    }
  | /* 既存はそのまま */
  /** userId がメッシュの表示方法を切り替えた(送信元以外へ中継) */
  | { type: "mesh:display"; userId: string; mode: MeshDisplayMode }   // object:added の直後、error の前
  | { type: "error"; code: string; message: string };
```

スキーマは union と同じ位置に足す。

```ts
// ClientMessageSchema(末尾)
z.object({ type: z.literal("mesh:display"), mode: MeshDisplayModeSchema }),

// ServerMessageSchema の welcome に1行足す(hiddenObjectIds の直後)
meshDisplay: MeshDisplayModeSchema.optional(),

// ServerMessageSchema(object:added の直後、error の前)
z.object({ type: z.literal("mesh:display"), userId: IdSchema, mode: MeshDisplayModeSchema }),
```

### 変更 server/src/realtime/hub.ts

```ts
interface Room {
  /* 既存はそのまま */
  /** ルームで共有するメッシュの表示方法。誰も切り替えていなければ null */
  meshDisplay: MeshDisplayMode | null;
}
```

- `join()` の `existingRoom ?? {...}` に `meshDisplay: null` を足す
- `handle()` の `switch` に `case "object:visibility"` の直後、`case "stroke:add"` の前に足す

```ts
case "mesh:display":
  room.meshDisplay = msg.mode;
  return [{ target: "others", msg: { type: "mesh:display", userId: connId, mode: msg.mode } }];
```

- `join()` の `welcome` は `...(room.meshDisplay === null ? {} : { meshDisplay: room.meshDisplay })` を
  `hiddenObjectIds` の spread の直後に足す
- `hiddenObjectsIn` の直後に参照用メソッドを足す

```ts
meshDisplayIn(projectId: string): MeshDisplayMode | null
```

`copyUser` / `usersIn` / `strokesIn` / `hiddenObjectsIn` / `disconnect` / `ws.ts` は**変更しない**。

### 新規 web/src/store/display.ts

```ts
import { DEFAULT_MESH_DISPLAY, type MeshDisplayMode } from "@shared/types";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface DisplayStoreState {
  /** メッシュの表示方法。初期値は DEFAULT_MESH_DISPLAY */
  meshDisplay: MeshDisplayMode;
  /** 同値なら state を更新しない(購読者を再描画させない) */
  setMeshDisplay(mode: MeshDisplayMode): void;
  reset(): void;
}

export const useDisplayStore: UseBoundStore<StoreApi<DisplayStoreState>>;
```

### 変更 web/src/app/review-stores.ts

`useDisplayStore.getState().reset()` を `useObjectsStore` の行の直後に足す。doc コメントの「8つ」を「9つ」にする。

### 変更 web/src/app/realtime-dispatch.ts

シグネチャは変えない。`useDisplayStore` を import し、`display` を他のストアと同じ形で取る。

- `case "welcome"` の `objects.applyWelcome(...)` の直後に
  `display.setMeshDisplay(msg.meshDisplay ?? DEFAULT_MESH_DISPLAY);`
  (**キーが無ければ既定へ戻す**。再接続時にサーバの状態と揃えるため。light とは違う)
- `case "mesh:display": display.setMeshDisplay(msg.mode); break;` を `case "object:added"` の直後に足す

## 振る舞い

### MeshDisplayModeSchema(shared/tests/types.test.ts に describe を追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `"solid"` / `"wireframe"` / `"solid-wireframe"` | 受理 |
| `"Solid"` / `"mesh"` / `""` / `1` / `undefined` | 拒否 |
| `DEFAULT_MESH_DISPLAY` | `"solid"` |

### protocol(shared/tests/protocol.test.ts)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| "accepts each client message shape" の配列に `{ type: "mesh:display", mode: "wireframe" }` | 受理 |
| "accepts all thirteen server message variants" に `{ type: "mesh:display", userId: "user-1", mode: "solid-wireframe" }` | 受理(テスト名を thirteen に改める) |
| `ClientMessageSchema` に `{ type: "mesh:display", mode: "mesh" }` | 拒否 |
| `ClientMessageSchema` に `{ type: "mesh:display" }` | 拒否 |
| `ServerMessageSchema` に `{ type: "mesh:display", mode: "solid" }`(userId なし) | 拒否 |
| `ServerMessageSchema` の `welcome` に `meshDisplay` なし | 受理し、`data` に `meshDisplay` キーを含まない |
| `ServerMessageSchema` の `welcome` に `meshDisplay: "wireframe"` | 受理し、その値を保つ |
| `ServerMessageSchema` の `welcome` に `meshDisplay: "x"` | 拒否 |
| `parseClientMessage(JSON.stringify({ type: "mesh:display", mode: "wireframe" }))` | `{ ok: true, msg: { type: "mesh:display", mode: "wireframe" } }` |

### RoomHub(server/tests/realtime-hub-display.test.ts に新規追加)

`server/tests/realtime-hub-light.test.ts` の `join()` / `welcomeLight()` ヘルパーと同じ書き方に倣う。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| join 済みの `a` が `{ type: "mesh:display", mode: "wireframe" }` | `[{ target: "others", msg: { type: "mesh:display", userId: "a", mode: "wireframe" } }]` |
| 上記の直後に `b` が join | `welcome.meshDisplay` が `"wireframe"`、`hub.meshDisplayIn("p1")` が `"wireframe"` |
| 誰も送っていないルームへの join | `welcome` に `meshDisplay` キーが存在しない(`"meshDisplay" in msg === false`)、`meshDisplayIn("p1")` が `null` |
| `a` が wireframe を送ったあと `b` が solid-wireframe を送る | 後勝ち。次の join の `welcome.meshDisplay` が `"solid-wireframe"` |
| `a` が wireframe のあと solid を送る | `welcome.meshDisplay` が `"solid"`(**既定値でも null に戻さず、明示的に載せる**) |
| 同じ値を続けて送る | 2回とも中継する(状態が変わらなくても送る) |
| join していない接続からの `mesh:display` | `[]` |
| 存在しない connId からの `mesh:display` | `[]` |
| 別プロジェクト `p2` の join | `p1` の値を引き継がない |
| 全員 disconnect したあと同じ projectId へ join | `welcome` に `meshDisplay` なし(ルームごと消える) |
| `mesh:display` が `usersIn()` / `strokesIn()` / `hiddenObjectsIn()` に与える影響 | なし |
| 存在しない projectId の `meshDisplayIn` | `null` |

### display ストア(web/tests/store-display.test.ts に新規追加)

`web/tests/store-objects.test.ts` と同じく `afterEach` で `reset()` する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `meshDisplay` が `"solid"`(`DEFAULT_MESH_DISPLAY` と一致) |
| `setMeshDisplay("wireframe")` | `meshDisplay` が `"wireframe"` |
| `setMeshDisplay("wireframe")` のあと同じ値をもう一度 | `useDisplayStore.getState()` の参照が変わらない(`toBe`) |
| `setMeshDisplay("solid-wireframe")` → `reset()` | `meshDisplay` が `"solid"` |
| `useDisplayStore.subscribe` で購読して同値を set | リスナーが呼ばれない |

### resetReviewStores(web/tests/review-stores.test.ts の既存テストに追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `setMeshDisplay("wireframe")` してから `resetReviewStores()` | `useDisplayStore.getState().meshDisplay` が `"solid"` |

### dispatchServerMessage(web/tests/realtime-dispatch.test.ts に追加)

`beforeEach` に `useDisplayStore.getState().reset()` を足す。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "mesh:display", userId: "u2", mode: "wireframe" }` | `meshDisplay` が `"wireframe"` |
| `welcome` に `meshDisplay: "solid-wireframe"` | `meshDisplay` が `"solid-wireframe"`。既存の selfId / presence / strokes の反映も従来どおり |
| `setMeshDisplay("wireframe")` のあと `welcome` に `meshDisplay` なし | `meshDisplay` が `"solid"` へ戻る |
| `{ type: "mesh:display", ... }` を受けたあと `error` を受ける | `meshDisplay` が変わらない |

### 結線後の全体像(073 / 074 の後に成立する。直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| 他の参加者が表示方法を切り替えた | 自分の画面のモデルも同じ表示方法になる |
| 途中から入室した | その時点のルームの表示方法で見え始める |
| 全員が退室してから入り直した | 「メッシュ」に戻っている |
| 別プロジェクトのレビュー画面 | 表示方法は共有されない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- 表示方法は**ルーム単位の1つの値**である。`PresenceUser` に生やさない
- 競合は**後から届いた値が勝つ**。順序制御・タイムスタンプ・排他は作らない
- サーバは値を検証しない(スキーマで列挙値に絞られている)。SQLite にも保存しない。ルームが消えれば失われる
- サーバは `"solid"` を受けても `null` に戻さない。「誰かが明示的に solid にした」と
  「誰も触っていない」は welcome 上は区別しなくてよいが、実装を単純に保つため値をそのまま持つ
- 送信元へはエコーしない(`target: "others"`)。したがって web ストアに `origin` のような
  エコー防止フラグは**不要**(objects ストアと同じ)
- 新規テストファイルは `server/tests/realtime-hub-display.test.ts` と `web/tests/store-display.test.ts` の2つだけ
- 4つの Summary(shared / server / store / app)を実態に合わせる。app_Summary の「8ストア」「8つ」は 9 に直す。
  server_Summary の hub の説明(:123-129)に `mesh:display` の保持・中継・welcome 反映と `meshDisplayIn` を足す

## やらないこと
- three.js への適用(`ModelMesh` / `ViewerCanvas` の変更)は 073
- 切替 UI と `send` は 074
- `web/src/features/viewer/` 配下、`server/src/realtime/ws.ts`、`shared/src/index.ts` の変更
- 表示方法の localStorage 保存・SQLite 保存

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md / server_Summary.md / store_Summary.md / app_Summary.md を更新している
- [ ] すべてのファイルが300行以内(特に hub.ts)
- [ ] verify: に書いたコマンドが成功する
