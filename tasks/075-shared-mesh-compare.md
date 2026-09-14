---
id: 075
title: shared/server/web メッシュ比較の設定(mesh:compare)をルーム全員で共有する(型・WS・hub・display ストア・dispatch)
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/compare.ts, shared/src/index.ts, shared/src/protocol.ts, shared/tests/mesh-compare.test.ts, shared/tests/protocol.test.ts, shared/shared_Summary.md, server/src/realtime/hub.ts, server/tests/realtime-hub-compare.test.ts, server/server_Summary.md, web/src/store/display.ts, web/tests/store-display.test.ts, web/src/app/realtime-dispatch.ts, web/tests/realtime-dispatch.test.ts, web/tests/review-stores.test.ts, web/src/store/store_Summary.md, web/src/app/app_Summary.md]
reads: [shared/tests/types.test.ts, server/src/realtime/ws.ts, server/tests/realtime-hub-display.test.ts, web/src/store/objects.ts, web/src/app/review-stores.ts, web/tests/store-objects.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
同じモデルのブラッシュアップ前後を比べるため、「基準の版」「着色する対象の版」「しきい値」の
3つを**ルーム単位の共有値**として持てるようにする。本タスクはその土台として、型・zod スキーマ・
WS メッセージ・サーバの保持と中継・web の display ストア拡張と受信反映を作る。
3D への計算と描画は 076〜078、UI は 079 で行う。したがって本タスク完了時点では画面上は何も変わらない。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### なぜ shared / server / web を1タスクにまとめてあるのか(072 と同じ理由)

`verify` の `npm run typecheck` は `tsc shared && tsc server && tsc web` の直列実行である。
`ClientMessage` / `ServerMessage` の union に種類を足すと、次の2つの網羅性検査が落ちる。

- `RoomHub.handle()` の `switch (msg.type)` に default が無く、union が増えると
  `TS2366: Function lacks ending return statement` になる。server/src/realtime/hub.ts:117-155
- web の `dispatchServerMessage` の `default: msg satisfies never`。web/src/app/realtime-dispatch.ts:70-71

**したがって union 追加とこの2つのハンドラは同じコミットに入れるしかない。タスクを分割しようとしないこと。**

### 既存の形(そのまま真似る)

- メッシュ表示方法の共有(072)が同型の実装済み例である。
  型と既定値: shared/src/types.ts:62-65、スキーマ: :117、
  protocol の union とスキーマ: shared/src/protocol.ts:34-35, :46-47, :62-63, :76, :87, :105、
  RoomHub の `Room.meshDisplay` 保持: server/src/realtime/hub.ts:45-46、`case "mesh:display"`: :143-145、
  join の初期化: :207、welcome への任意反映: :234、参照メソッド: :182-184、
  テスト: server/tests/realtime-hub-display.test.ts(`join` / `welcome` ヘルパー)
- `shared/src/types.ts` の `IdSchema`(:90)は `z.string().min(1).max(MAX_ID_LENGTH).regex(/^[A-Za-z0-9_-]+$/)`。
  スキーマ定義(:117 付近)より前に定義されている。protocol.ts のローカル `IdSchema`(:66)は `z.string().min(1)` で別物
- `shared/src/index.ts` は 5 行で、types / api / protocol / camera / stroke を `export *` している。
  新規ファイル compare.ts を足すので 1 行追加する
- `shared/tests/protocol.test.ts:89` の "accepts all thirteen server message variants" は server メッセージの
  種類数を固定している。本タスクで 14 種になるので、テスト名と配列を更新する。
  :44 の "accepts each client message shape" の配列にも新メッセージを足す。
  **これ以外の新しいテストは protocol.test.ts(252 行)/ types.test.ts(266 行)に足さず、
  新規の shared/tests/mesh-compare.test.ts に書く**(行数上限 300 のため)
- `hub.ts` は現在 273 行。**追加は 15 行以内**に収める(上限 300 行)
- web の display ストア(web/src/store/display.ts、23 行)は `meshDisplay` / `setMeshDisplay` / `reset` を持ち、
  同値なら state を更新しない。本タスクで `meshCompare` を**同じストアに**足す(新規ストアは作らない。
  `resetReviewStores()` は display ストアの `reset()` を既に呼んでいるので web/src/app/review-stores.ts は変更不要)
- `dispatchServerMessage` の welcome は `display.setMeshDisplay(msg.meshDisplay ?? DEFAULT_MESH_DISPLAY)` と、
  キーが無ければ**初期値へ戻す**。web/src/app/realtime-dispatch.ts:30。compare も同じ流儀にする
- web のテストは jsdom で `@testing-library` がない。検証できるのは純粋関数とストアだけ
- `web/tests/summary-coverage.test.ts` が、src の全ファイルが最寄りの `_Summary.md` に載っていること、
  `web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っていることを検査する

## インターフェイス契約

### 変更 shared/src/types.ts

`DEFAULT_MESH_DISPLAY`(:65)の直後に足す。

```ts
/** ルームで共有するメッシュ比較の設定。対象の版を基準の版と比べて着色する */
export interface MeshCompare {
  /** 基準にする版の id。未選択なら null */
  baseId: string | null;
  /** 基準と比べて着色する版の id。未選択なら null */
  targetId: string | null;
  /** しきい値。基準モデルの最大辺長に対する千分率。MIN〜MAX の整数 */
  thresholdPermille: number;
}
export const MIN_COMPARE_THRESHOLD_PERMILLE = 1;
export const MAX_COMPARE_THRESHOLD_PERMILLE = 50;
export const DEFAULT_COMPARE_THRESHOLD_PERMILLE = 5;
/** 誰も比較を設定していないルームの値 */
export const DEFAULT_MESH_COMPARE: MeshCompare = {
  baseId: null,
  targetId: null,
  thresholdPermille: DEFAULT_COMPARE_THRESHOLD_PERMILLE,
};
```

`MeshDisplayModeSchema`(:117)の直後に足す。

```ts
export const MeshCompareSchema = z.object({
  baseId: IdSchema.nullable(),
  targetId: IdSchema.nullable(),
  thresholdPermille: z.number().int().min(MIN_COMPARE_THRESHOLD_PERMILLE).max(MAX_COMPARE_THRESHOLD_PERMILLE),
}) satisfies z.ZodType<MeshCompare>;
```

### 新規 shared/src/compare.ts

three.js に依存しない純粋関数だけを置く。

```ts
import type { MeshCompare } from "./types";

/** baseId と targetId が両方あるときの型 */
export type ActiveMeshCompare = MeshCompare & { baseId: string; targetId: string };

/** baseId と targetId が両方 non-null で、かつ互いに異なるときだけ true */
export function isMeshCompareActive(compare: MeshCompare): compare is ActiveMeshCompare;

/** 3フィールドすべて === で等しいとき true */
export function meshCompareEquals(a: MeshCompare, b: MeshCompare): boolean;

/** 浅い複製(フィールドはプリミティブなので浅くてよい) */
export function cloneMeshCompare(compare: MeshCompare): MeshCompare;
```

### 変更 shared/src/index.ts

`export * from "./stroke";` の直後に `export * from "./compare";` を足す。

### 変更 shared/src/protocol.ts

`MeshCompareSchema` と `type MeshCompare` の import を足す。

```ts
export type ClientMessage =
  | /* 既存はそのまま */
  /** 自分がメッシュ比較の設定を変えた(値全体を送る) */
  | { type: "mesh:compare"; compare: MeshCompare };   // mesh:display の直後(末尾)

export type ServerMessage =
  | {
      type: "welcome";
      /* 既存はそのまま */
      /** ルームのメッシュ比較設定。誰も変えていなければ省略される */
      meshCompare?: MeshCompare;                        // meshDisplay の直後
    }
  | /* 既存はそのまま */
  /** userId がメッシュ比較の設定を変えた(送信元以外へ中継) */
  | { type: "mesh:compare"; userId: string; compare: MeshCompare }   // mesh:display の直後、error の前
  | { type: "error"; code: string; message: string };
```

スキーマは union と同じ位置に足す。

```ts
// ClientMessageSchema(末尾)
z.object({ type: z.literal("mesh:compare"), compare: MeshCompareSchema }),

// ServerMessageSchema の welcome に1行足す(meshDisplay の直後)
meshCompare: MeshCompareSchema.optional(),

// ServerMessageSchema(mesh:display の直後、error の前)
z.object({ type: z.literal("mesh:compare"), userId: IdSchema, compare: MeshCompareSchema }),
```

### 変更 server/src/realtime/hub.ts

```ts
interface Room {
  /* 既存はそのまま */
  /** ルームで共有するメッシュ比較の設定。誰も変えていなければ null */
  meshCompare: MeshCompare | null;
}
```

- `join()` の `existingRoom ?? {...}` に `meshCompare: null` を足す
- `handle()` の `switch` に `case "mesh:display"` の直後、`case "stroke:add"` の前に足す

```ts
case "mesh:compare":
  room.meshCompare = { ...msg.compare };
  return [{ target: "others", msg: { type: "mesh:compare", userId: connId, compare: { ...msg.compare } } }];
```

- `join()` の `welcome` は `...(room.meshCompare === null ? {} : { meshCompare: { ...room.meshCompare } })` を
  `meshDisplay` の spread の直後に足す
- `meshDisplayIn` の直後に参照用メソッドを足す(複製を返す)

```ts
meshCompareIn(projectId: string): MeshCompare | null
```

`copyUser` / `usersIn` / `strokesIn` / `hiddenObjectsIn` / `meshDisplayIn` / `disconnect` / `ws.ts` は**変更しない**。

### 変更 web/src/store/display.ts

```ts
export interface DisplayStoreState {
  meshDisplay: MeshDisplayMode;                 // 既存
  setMeshDisplay(mode: MeshDisplayMode): void;  // 既存
  /** メッシュ比較の設定。初期値は DEFAULT_MESH_COMPARE の複製 */
  meshCompare: MeshCompare;
  /** meshCompareEquals で同値なら state を更新しない。複製して保持する */
  setMeshCompare(compare: MeshCompare): void;
  /** meshDisplay と meshCompare の両方を初期値へ戻す */
  reset(): void;
}
```

### 変更 web/src/app/realtime-dispatch.ts

シグネチャは変えない。`DEFAULT_MESH_COMPARE` を import する。

- `case "welcome"` の `display.setMeshDisplay(...)` の直後に
  `display.setMeshCompare(msg.meshCompare ?? DEFAULT_MESH_COMPARE);`
- `case "mesh:compare": display.setMeshCompare(msg.compare); break;` を `case "mesh:display"` の直後に足す

## 振る舞い

### スキーマと純粋関数(shared/tests/mesh-compare.test.ts に新規追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MeshCompareSchema` に `{ baseId: "v1", targetId: "v2", thresholdPermille: 5 }` | 受理 |
| `{ baseId: null, targetId: null, thresholdPermille: 1 }` / 同 50 | 受理 |
| `thresholdPermille` が 0 / 51 / 2.5 / `"5"` | 拒否 |
| `baseId` が `""` / `"a b"`(regex 外) / `undefined` | 拒否 |
| `thresholdPermille` 欠落 | 拒否 |
| `DEFAULT_MESH_COMPARE` | `{ baseId: null, targetId: null, thresholdPermille: 5 }` かつ `MeshCompareSchema` を通る |
| `isMeshCompareActive({ baseId: "v1", targetId: "v2", ... })` | true |
| `isMeshCompareActive` で baseId と targetId が同じ / どちらかが null / 両方 null | false |
| `meshCompareEquals` で3フィールド一致 | true。1つでも違えば false |
| `cloneMeshCompare(c)` | `toEqual(c)` かつ `not.toBe(c)` |
| `ClientMessageSchema` に `{ type: "mesh:compare", compare: DEFAULT_MESH_COMPARE }` | 受理 |
| `ClientMessageSchema` に `{ type: "mesh:compare", compare: { baseId: "v1" } }` | 拒否 |
| `ClientMessageSchema` に `{ type: "mesh:compare" }` | 拒否 |
| `ServerMessageSchema` に `{ type: "mesh:compare", compare: DEFAULT_MESH_COMPARE }`(userId なし) | 拒否 |
| `ServerMessageSchema` の `welcome` に `meshCompare` なし | 受理し、`data` に `meshCompare` キーを含まない |
| `welcome` に `meshCompare: { baseId: "v1", targetId: "v2", thresholdPermille: 10 }` | 受理し、その値を保つ |
| `welcome` に `meshCompare: { baseId: "v1" }` | 拒否 |
| `parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: {...} }))` | `{ ok: true, msg: ... }` |

### protocol(shared/tests/protocol.test.ts の既存テストを更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| "accepts each client message shape" の配列に `{ type: "mesh:compare", compare: { baseId: "version-1", targetId: "version-2", thresholdPermille: 5 } }` | 受理 |
| "accepts all fourteen server message variants" に `{ type: "mesh:compare", userId: "user-1", compare: {...} }` | 受理(テスト名を fourteen に改める) |

### RoomHub(server/tests/realtime-hub-compare.test.ts に新規追加)

`server/tests/realtime-hub-display.test.ts` の `join()` / `welcome()` ヘルパーと同じ書き方に倣う。
`compare(baseId, targetId, permille)` のようなヘルパーで `ClientMessage` を作ってよい。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| join 済みの `a` が `{ type: "mesh:compare", compare: c }` | `[{ target: "others", msg: { type: "mesh:compare", userId: "a", compare: c } }]`(`toEqual`) |
| 中継された `compare` と `hub.meshCompareIn("p1")` | 送った `c` と `toEqual` だが `not.toBe`(複製されている) |
| 上記の直後に `b` が join | `welcome.meshCompare` が `c` と `toEqual`、`meshCompareIn("p1")` も同じ |
| 誰も送っていないルームへの join | `welcome` に `meshCompare` キーが存在しない(`"meshCompare" in msg === false`)、`meshCompareIn("p1")` が `null` |
| `a` が c1 を送ったあと `b` が c2 を送る | 後勝ち。次の join の `welcome.meshCompare` が c2 |
| `a` が c1 のあと `DEFAULT_MESH_COMPARE` を送る | `welcome.meshCompare` が既定値と `toEqual`(**既定値でも null に戻さず、明示的に載せる**) |
| 同じ値を続けて送る | 2回とも中継する |
| join していない接続からの `mesh:compare` | `[]` |
| 存在しない connId からの `mesh:compare` | `[]` |
| 別プロジェクト `p2` の join | `p1` の値を引き継がない |
| 全員 disconnect したあと同じ projectId へ join | `welcome` に `meshCompare` なし |
| `mesh:compare` が `usersIn()` / `strokesIn()` / `hiddenObjectsIn()` / `meshDisplayIn()` に与える影響 | なし |
| 存在しない projectId の `meshCompareIn` | `null` |
| 中継後に送信元が自分の `c` オブジェクトを書き換える | `meshCompareIn("p1")` は変わらない(保持値も複製) |

### display ストア(web/tests/store-display.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `meshCompare` が `DEFAULT_MESH_COMPARE` と `toEqual` かつ `not.toBe` |
| `setMeshCompare({ baseId: "v1", targetId: "v2", thresholdPermille: 10 })` | その値が入る。渡したオブジェクトと `not.toBe` |
| 同じ内容をもう一度 `setMeshCompare` | `useDisplayStore.getState()` の参照が変わらず、subscribe リスナーが呼ばれない |
| `thresholdPermille` だけ変えて `setMeshCompare` | 更新される |
| `setMeshCompare(...)` と `setMeshDisplay("wireframe")` のあと `reset()` | `meshCompare` が既定値、`meshDisplay` が `"solid"` |
| `setMeshDisplay` | `meshCompare` を変えない |

### resetReviewStores(web/tests/review-stores.test.ts の既存テストに追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `setMeshCompare({ baseId: "v1", targetId: "v2", thresholdPermille: 10 })` してから `resetReviewStores()` | `useDisplayStore.getState().meshCompare` が `DEFAULT_MESH_COMPARE` と `toEqual` |

### dispatchServerMessage(web/tests/realtime-dispatch.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "mesh:compare", userId: "u2", compare: c }` | `meshCompare` が `c` と `toEqual` |
| `welcome` に `meshCompare: c` | `meshCompare` が `c`。既存の selfId / presence / meshDisplay の反映も従来どおり |
| `setMeshCompare(c)` のあと `welcome` に `meshCompare` なし | `meshCompare` が既定値へ戻る |
| `{ type: "mesh:compare", ... }` を受けたあと `error` を受ける | `meshCompare` が変わらない |

### 結線後の全体像(076〜079 の後に成立する。直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| 他の参加者が基準・対象・しきい値を変えた | 自分の画面のハイライトも同じになる |
| 途中から入室した | その時点のルームの比較設定で見え始める |
| 全員が退室してから入り直した | 比較は解除されている |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- 比較設定は**ルーム単位の1つの値**であり、常に `MeshCompare` 全体を送る(差分パッチは作らない)
- 競合は**後から届いた値が勝つ**。順序制御・タイムスタンプ・排他は作らない
- サーバは `baseId` / `targetId` が project の版に実在するか**検証しない**(スキーマの id 形式だけ)。SQLite にも保存しない
- サーバは既定値を受けても `null` に戻さない
- 送信元へはエコーしない(`target: "others"`)。web ストアにエコー防止フラグは**不要**
- 新規テストファイルは `shared/tests/mesh-compare.test.ts` と `server/tests/realtime-hub-compare.test.ts` の2つだけ
- 4つの Summary(shared / server / store / app)を実態に合わせる。shared_Summary には compare.ts のファイル・公開関数・
  index.ts の再エクスポート一覧・protocol の `mesh:compare` を、server_Summary には hub の保持・中継・welcome 反映と
  `meshCompareIn` とテストファイルを、store_Summary には display.ts の `meshCompare` を、
  app_Summary には dispatch の `welcome.meshCompare` / `mesh:compare` を足す。ストア数は 9 のまま変わらない

## やらないこと
- three.js への計算・描画(076〜078)、UI と `send`(079)
- `web/src/features/` 配下、`web/src/app/review-stores.ts`、`server/src/realtime/ws.ts` の変更
- 比較設定の localStorage 保存・SQLite 保存
- `PresenceUser` への比較設定の追加

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md / server_Summary.md / store_Summary.md / app_Summary.md を更新している
- [ ] すべてのファイルが300行以内(特に hub.ts、protocol.test.ts)
- [ ] verify: に書いたコマンドが成功する
