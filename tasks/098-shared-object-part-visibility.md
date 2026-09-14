---
id: 098
title: shared 版内オブジェクト(部位)の識別子と表示・非表示メッセージを追加する
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/object-part.ts, shared/src/index.ts, shared/src/protocol.ts, shared/tests/object-part.test.ts, shared/tests/protocol.test.ts, shared/shared_Summary.md, server/src/realtime/hub.ts, web/src/app/realtime-dispatch.ts]
reads: [shared/src/compare.ts, shared/tests/types.test.ts, shared/tests/mesh-compare.test.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:shared
status: done
---

## 目的
アウトライナから版内の個々のオブジェクト(以下「部位」)の表示・非表示を切り替え、ルーム全員で
共有する(設計書 §13.5)。そのための共有鍵 `ObjectPath`、参照型 `ObjectPartRef`、WS メッセージ
`object:part-visibility`、welcome の復元フィールド `hiddenObjectParts` を shared に定義する。

## 前提
- three.js の `Object3D.uuid` は読み込みごと・クライアントごとに変わるので共有鍵に使えない。
  部位は「版の scene ルートからの子インデックスのパス」で識別する(設計書 §13.5)。
  例: `"0/2/1"` = ルートの 0 番目の子 → その 2 番目の子 → その 1 番目の子。
  ビューアが後付けした重ね描きは数えない(数え方は web 側 102 の責務。shared は文字列の形だけ定める)
- ルート自身は部位ではなく版そのもの(既存の `object:visibility` / `versionId`)。したがって `ObjectPath` は空文字を認めない
- ドメイン zod スキーマは interface と同じファイル(`shared/src/types.ts`)に `<型名>Schema` として置き、
  `satisfies z.ZodType<T>` で型整合を取る(台帳 D1)。three.js 非依存の純粋関数は `compare.ts` のように別ファイルに置く
- `protocol.ts` の `IdSchema` は同ファイル内のローカル定義 `z.string().min(1)`(protocol.ts:74)。既存の
  `object:visibility` はこれを使う。types.ts の `IdSchema`(nanoid 文字種)とは別物である
- `shared/tests/types.test.ts` は 266 行で上限に近い。新しいスキーマのテストは新規ファイル
  `shared/tests/object-part.test.ts` に置き、types.test.ts は変更しない
- `shared/tests/protocol.test.ts:90` の it 名 "accepts all fourteen server message variants" は件数を名前に含む。
  Server は 15 種になるので it 名と配列を更新する。Client も同様に追加する
- `shared/src/index.ts` は各ファイルを `export *` で再エクスポートする。`object-part.ts` も同じ流儀で追加する
- **`ClientMessage` / `ServerMessage` の union に variant を足すと、server / web を触らない限り
  `npm run typecheck` は必ず落ちる**(060 の実測)。server の `RoomHub.handle()` の `switch (msg.type)`
  (server/src/realtime/hub.ts:113 付近)と web の `dispatchServerMessage` の `default: msg satisfies never`
  (web/src/app/realtime-dispatch.ts:74 付近)が union の網羅性検査になっているためである。
  そのため本タスクは hub.ts と realtime-dispatch.ts も owns に含め、下記の「仮の最小分岐」だけを足す。
  本実装は後続の 100(server)/ 101(web)がこの仮分岐を差し替える
- switch の外に `return [];` を足して typecheck を通す方法は採らない。網羅性検査そのものが消え、
  以後 variant の追加漏れを型で検出できなくなる

## インターフェイス契約

### 変更 shared/src/types.ts(`PresenceUser` の interface の直後に追加。他は変更しない)

```ts
/**
 * 版内オブジェクト(部位)の共有鍵。版の scene ルートからの子インデックスを "/" で繋いだもの(例 "0/2/1")。
 * ルート自身は表せない(空文字は不正)。
 */
export type ObjectPath = string;

/** 版内の 1 つの部位を指す参照 */
export interface ObjectPartRef {
  versionId: string;
  objectPath: ObjectPath;
}
```

スキーマ(`PresenceUserSchema` の直後に追加):

```ts
export const MAX_OBJECT_PATH_LENGTH = 256;

/** "0" や "0/2/1" の形。先頭・末尾の "/"、空要素、数字以外を認めない */
export const ObjectPathSchema = z.string().min(1).max(MAX_OBJECT_PATH_LENGTH).regex(/^\d+(\/\d+)*$/) satisfies z.ZodType<ObjectPath>;

export const ObjectPartRefSchema = z.object({
  versionId: IdSchema,
  objectPath: ObjectPathSchema,
}) satisfies z.ZodType<ObjectPartRef>;
```

### 新規 shared/src/object-part.ts

```ts
import type { ObjectPartRef, ObjectPath } from "./types";

/** ObjectPath を子インデックスの配列にする。"0/2/1" → [0, 2, 1] */
export function objectPathIndices(path: ObjectPath): number[];

/** 子インデックスの配列を ObjectPath にする。[0, 2, 1] → "0/2/1"。空配列は Error("ObjectPath must not be empty") を送出 */
export function joinObjectPath(indices: readonly number[]): ObjectPath;

/** Map / Set のキーに使う一意文字列。`${versionId}:${objectPath}` */
export function objectPartKey(part: ObjectPartRef): string;

/** versionId と objectPath がともに === で等しい */
export function isSameObjectPart(a: ObjectPartRef, b: ObjectPartRef): boolean;
```

### 変更 shared/src/index.ts
`export * from "./compare";` の直後に `export * from "./object-part";` を追加する。

### 変更 shared/src/protocol.ts

`ClientMessage` の `object:visibility` の直後に追加:

```ts
  /** 自分が versionId の版内オブジェクト(部位)の表示・非表示を切り替えた */
  | { type: "object:part-visibility"; versionId: string; objectPath: ObjectPath; visible: boolean }
```

`ServerMessage` の welcome に `hiddenObjectIds` の直後のフィールドとして追加:

```ts
      /** ルームで非表示になっている部位。空なら省略される */
      hiddenObjectParts?: ObjectPartRef[];
```

`ServerMessage` の `object:visibility` の直後に追加:

```ts
  /** userId が versionId の部位 objectPath の表示・非表示を切り替えた(送信元以外へ中継) */
  | { type: "object:part-visibility"; userId: string; versionId: string; objectPath: ObjectPath; visible: boolean }
```

スキーマ(位置は型と同じ並び):

```ts
  z.object({ type: z.literal("object:part-visibility"), versionId: IdSchema, objectPath: ObjectPathSchema, visible: z.boolean() }),
  // welcome 内
    hiddenObjectParts: z.array(ObjectPartRefSchema).optional(),
  // Server
  z.object({ type: z.literal("object:part-visibility"), userId: IdSchema, versionId: IdSchema, objectPath: ObjectPathSchema, visible: z.boolean() }),
```

`ObjectPartRefSchema` / `ObjectPathSchema` / 型 `ObjectPartRef` / `ObjectPath` は `./types` から import する。

### 変更 server/src/realtime/hub.ts(仮の最小分岐。これ以外は変更しない)

`handle()` の `switch (msg.type)` に、`case "stroke:clear":` の直前として 1 つの case を足す。
既存の `case "light": ... case "mesh:compare":` のグループには入れない(`applyDisplayMessage` の
引数型に含まれていないため型が合わない。そこへ統合するのは 100 の責務)。

```ts
      case "object:part-visibility":
        // 仮の分岐。ルーム状態の保持と中継は 100 が実装する
        return [];
```

### 変更 web/src/app/realtime-dispatch.ts(仮の最小分岐。これ以外は変更しない)

`dispatchServerMessage` の `switch` に、`case "error":` の直前として 1 つの case を足す。
`default: msg satisfies never;` は残す。

```ts
    case "object:part-visibility":
      // 仮の分岐。ストアへの反映は 101 が実装する
      break;
```

welcome の `hiddenObjectParts` は任意フィールドなので、この 2 ファイルでの追加対応は不要である。

## 振る舞い

### shared/tests/object-part.test.ts(新規)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ObjectPathSchema.safeParse` に `"0"`、`"0/2/1"`、`"12/0"` | success |
| `ObjectPathSchema.safeParse` に `""`、`"/0"`、`"0/"`、`"0//1"`、`"a/1"`、`"0/-1"`、`"0 /1"`、`"1".repeat(257)` | 失敗 |
| `"1".repeat(256)` | success(上限ちょうど) |
| `ObjectPartRefSchema.safeParse({ versionId: "v1", objectPath: "0/1" })` | success。余分なキー `{ extra: 1 }` は取り除かれる |
| `ObjectPartRefSchema.safeParse({ versionId: "", objectPath: "0" })` / `{ versionId: "v1", objectPath: "" }` / `{ versionId: "v1" }` | 失敗 |
| `objectPathIndices("0/2/1")` / `objectPathIndices("7")` | `[0, 2, 1]` / `[7]` |
| `joinObjectPath([0, 2, 1])` / `joinObjectPath([7])` | `"0/2/1"` / `"7"` |
| `joinObjectPath([])` | throw |
| `joinObjectPath(objectPathIndices(p))` | p に戻る(`"0/2/1"` で確認) |
| `objectPartKey({ versionId: "v1", objectPath: "0/1" })` | `"v1:0/1"` |
| `isSameObjectPart` | 両方一致で true、versionId 違い・objectPath 違いで false |
| `MAX_OBJECT_PATH_LENGTH` | 256 |
| `import { objectPartKey, ObjectPathSchema } from "../src/index"` | いずれも関数 / オブジェクトとして解決される(再エクスポートの確認) |

### shared/tests/protocol.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| Client の "accepts each client message shape" の配列に `{ type: "object:part-visibility", versionId: "version-1", objectPath: "0/2", visible: false }` を追加 | success |
| `ClientMessageSchema.safeParse({ type: "object:part-visibility", versionId: "version-1", objectPath: "", visible: false })` / `objectPath: "a"` / `visible: "false"` / `objectPath` 欠落 | 失敗 |
| Server の配列に `{ type: "object:part-visibility", userId: "user-1", versionId: "version-1", objectPath: "0/2", visible: true }` を追加し、it 名を "accepts all fifteen server message variants" にする | success |
| welcome に `hiddenObjectParts: [{ versionId: "v1", objectPath: "0" }, { versionId: "v1", objectPath: "0/1" }]` | success で同値が得られる |
| welcome に `hiddenObjectParts: [{ versionId: "v1", objectPath: "" }]` | 失敗 |
| welcome を `hiddenObjectParts` なしで parse | success で `"hiddenObjectParts" in data` が false |
| `parseClientMessage` / `parseServerMessage` に `object:part-visibility` の JSON | `{ ok: true, msg }` で同値 |

## やらないこと
- 上記の仮の最小分岐(hub.ts / realtime-dispatch.ts に 1 case ずつ)以外の server / web の変更。
  ルーム状態の保持・中継・welcome への `hiddenObjectParts` の詰め込みは 100、ストア反映は 101 の責務
- server / web のテストの追加・変更(仮分岐は動作を変えないので既存テストで足りる)
- `object:visibility`(版単位)の変更や統合
- `types.test.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md を更新している。ファイル一覧に `src/object-part.ts` と `tests/object-part.test.ts`、
      公開インターフェイスに `ObjectPath` / `ObjectPartRef` / `ObjectPathSchema` / `ObjectPartRefSchema` /
      `MAX_OBJECT_PATH_LENGTH` と object-part の 4 関数、protocol の説明に `object:part-visibility` と
      `welcome.hiddenObjectParts` を追加し、他機能との関係に「部位の共有鍵は uuid ではなく ObjectPath(設計書 §13.5)」と書く
- [ ] すべてのファイルが300行以内
- [ ] hub.ts と realtime-dispatch.ts の変更が仮の最小分岐 1 case ずつに留まり、`default: msg satisfies never` が残っている
- [ ] verify: に書いたコマンドが成功する
