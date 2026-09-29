---
id: 170
title: MeshCompare に「差分を着色する」フラグ colorized を足す(未指定は true)
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/compare.ts, shared/tests/mesh-compare.test.ts, shared/shared_Summary.md]
reads: [shared/src/protocol.ts, server/src/realtime/room-display.ts, web/src/store/display.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/objects/CompareControls.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
メッシュ比較の赤(飛び出し)・青(へこみ)の着色を UI から ON / OFF できるようにする。
その切り替え値をルーム共有の `MeshCompare` に任意フィールド `colorized` として載せる。
171(3D ビュー)と 172(チェックボックス)が本フィールドを読む。

153 の `baseVisible`、167 の `differencesOnly` と同じ手順だが、**既定が true(着色する)である点だけが違う**。
未指定を false とみなす既存 2 フィールドと、未指定の扱いが逆になる。

## 前提
- `MeshCompare` は `shared/src/types.ts:86-97`。`baseId` / `targetId` / `thresholdPermille` と
  任意の `baseVisible?: boolean`(`:94`)、任意の `differencesOnly?: boolean`(`:96`)
- `MeshCompareSchema` は `shared/src/types.ts:202-208` の `z.object({...}) satisfies z.ZodType<MeshCompare>`。
  zod の `z.object` は未知キーを**捨てる**ので、スキーマに載せないフィールドは server を通らない
- `DEFAULT_MESH_COMPARE`(`shared/src/types.ts:113-117`)は
  `{ baseId: null, targetId: null, thresholdPermille: DEFAULT_COMPARE_THRESHOLD_PERMILLE }` で、
  `shared/tests/mesh-compare.test.ts:69` と `web/tests/store-display.test.ts` が `toEqual` で
  この 3 フィールドちょうどであることを検査している。**このタスクでは変えない**
- `meshCompareEquals` は `shared/src/compare.ts:43-50`。3 フィールドの `===` に加え
  `(a.baseVisible ?? false) === (b.baseVisible ?? false)` と
  `(a.differencesOnly ?? false) === (b.differencesOnly ?? false)` を比較している。
  `cloneMeshCompare`(`:53-55`)は `{ ...compare }` なので任意フィールドもそのまま複製される。
  `isMeshCompareActive`(`:39-41`)は baseId / targetId しか見ない
- server は `room-display.ts` で `state.meshCompare = { ...msg.compare }` として丸ごと保持・中継する。
  フィールドを足しても server の変更は不要
- `MeshCompare` は `ClientMessage` / `ServerMessage` の既存 variant(`mesh:compare`、welcome の `meshCompare`)の
  中身であり、variant を足さないので `server/src/realtime/hub.ts` と `web/src/app/realtime-dispatch.ts` に影響しない
- 既存テスト `shared/tests/mesh-compare.test.ts`(187 行)の `active` は
  `{ baseId: "v1", targetId: "v2", thresholdPermille: 5 }`。differencesOnly の検査は
  `:38-60`(スキーマ)、`:115-129`(同値判定・複製)、`:154-171`(protocol 往復)にある。同じ形で colorized の行を足す
- web の `CompareControls.tsx` の `update` は `{ ...meshCompare, ...patch }` を作り `meshCompareEquals` で
  同値なら送らない。未指定と true を同値とみなすため、既定状態でチェックを ON にしても送信は起きない。
  これは意図した振る舞いである(UI は 172)

## インターフェイス契約

### `shared/src/types.ts`

```ts
export interface MeshCompare {
  baseId: string | null;
  targetId: string | null;
  thresholdPermille: number;
  baseVisible?: boolean;
  differencesOnly?: boolean;
  /** しきい値を超えた差分を赤・青で着色するか。未指定は true(着色する) */
  colorized?: boolean;
}

export const MeshCompareSchema = z.object({
  baseId: IdSchema.nullable(),
  targetId: IdSchema.nullable(),
  thresholdPermille: z.number().refine(isCompareThresholdPermille),
  baseVisible: z.boolean().optional(),
  differencesOnly: z.boolean().optional(),
  colorized: z.boolean().optional(),
}) satisfies z.ZodType<MeshCompare>;
```

### `shared/src/compare.ts`

```ts
/**
 * 3 フィールドの === 比較に加え、baseVisible と differencesOnly は未指定を false、
 * colorized は未指定を true とみなして比較する。
 */
export function meshCompareEquals(a: MeshCompare, b: MeshCompare): boolean;
```

`isMeshCompareActive` と `cloneMeshCompare` のシグネチャ・実装は変えない。

## 振る舞い

`active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MeshCompareSchema.safeParse({ ...active, colorized: true })` | `success === true`、`data.colorized === true` |
| `MeshCompareSchema.safeParse({ ...active, colorized: false })` | `success === true`、`data.colorized === false` |
| `MeshCompareSchema.safeParse(active)`(未指定) | `success === true`、`"colorized" in data` が `false`(既定値を埋めない) |
| `MeshCompareSchema.safeParse({ ...active, colorized: "no" })` / `0` / `null` | `success === false` |
| `MeshCompareSchema.safeParse({ ...active, baseVisible: true, differencesOnly: true, colorized: false })` | `success === true`、3 フィールドともその値で残る |
| `DEFAULT_MESH_COMPARE` | `{ baseId: null, targetId: null, thresholdPermille: 5 }` のまま(`colorized` キーを持たない) |
| `meshCompareEquals(active, { ...active, colorized: true })` | `true`(未指定と true は同値) |
| `meshCompareEquals(active, { ...active, colorized: false })` | `false` |
| `meshCompareEquals({ ...active, colorized: false }, { ...active, colorized: false })` | `true` |
| `meshCompareEquals({ ...active, colorized: true }, { ...active, colorized: false })` | `false` |
| `meshCompareEquals({ ...active, differencesOnly: true }, { ...active, differencesOnly: true, colorized: false })` | `false`(differencesOnly が同じでも colorized の差で不一致) |
| `meshCompareEquals({ ...active, colorized: false }, { ...active, colorized: false, thresholdPermille: 10 })` | `false`(既存 3 フィールドの比較はそのまま) |
| `cloneMeshCompare({ ...active, colorized: false })` | `toEqual({ ...active, colorized: false })` かつ別インスタンス |
| `isMeshCompareActive({ ...active, colorized: false })` | `true`(colorized は active 判定に無関係) |
| `parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: { ...active, colorized: false } }))` | `{ ok: true, msg: { type: "mesh:compare", compare: { ...active, colorized: false } } }`(フィールドが落ちない) |
| `ServerMessageSchema.safeParse({ type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { ...active, colorized: false } })` | `success === true`、`data.meshCompare.colorized === false` |
| 既存の検査(baseVisible / differencesOnly の受理・拒否・同値判定、下限 0 の受理、負値・51・2.5・"5" の拒否 など) | すべてそのまま通る |

## やらないこと
- `DEFAULT_MESH_COMPARE` への `colorized` の追加(既存の `toEqual` 検査を壊す)
- 未指定を false とみなす実装(`(a.colorized ?? false)`)。既定は **true** である
- `server/` の変更。`room-display.ts` はスプレッドで丸ごと保持するので不要
- web 側(3D ビューの着色切り替えは 171、チェックボックスは 172)
- `hub.ts` / `realtime-dispatch.ts` の変更。variant は増えない
- `baseVisible` / `differencesOnly` の意味や既定の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `shared/shared_Summary.md` の `tests/mesh-compare.test.ts` の行(現在「baseVisible と differencesOnly の任意指定と同値判定」)に
      「colorized」を、「他モジュールとの関係」の `mesh:compare` の説明(現在「任意の differencesOnly(対象の本体を描かず差分だけを描くか)」)に
      「任意の colorized(差分を赤・青で着色するか。未指定は true)」を追記している
- [ ] すべてのファイルが300行以内(`shared/src/types.ts` は現在 282 行、`mesh-compare.test.ts` は 187 行。
      types.ts は 2 行増に収め、テストは既存 `it` ブロックへの行追加にとどめる)
- [ ] verify: に書いたコマンドが成功する
