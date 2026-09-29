---
id: 167
title: MeshCompare に「差分だけを表示する」フラグ differencesOnly を足す
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/compare.ts, shared/tests/mesh-compare.test.ts, shared/shared_Summary.md]
reads: [shared/src/protocol.ts, server/src/realtime/room-display.ts, web/src/store/display.ts, web/src/features/objects/CompareControls.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
メッシュ比較で、対象メッシュの本体を描かず、しきい値を超えた赤(飛び出し)・青(へこみ)の
差分部分だけを描く「差分だけを表示」を 168(3D ビュー)と 169(チェックボックス)で足す。
その切り替え値をルーム共有の `MeshCompare` に任意フィールドとして載せる。153 で `baseVisible` を
足したのと同じ手順で、フィールド名だけ `differencesOnly` にする。

## 前提
- `MeshCompare` は `shared/src/types.ts:86-95`。`baseId` / `targetId` / `thresholdPermille` と任意の `baseVisible?: boolean`
- `MeshCompareSchema` は `shared/src/types.ts:200-205` の `z.object({...}) satisfies z.ZodType<MeshCompare>`。
  zod の `z.object` は未知キーを**捨てる**ので、スキーマに載せないフィールドは server を通らない
- `DEFAULT_MESH_COMPARE`(`shared/src/types.ts:111-115`)は `{ baseId: null, targetId: null, thresholdPermille: 5 }` で、
  `shared/tests/mesh-compare.test.ts:52`、`web/tests/store-display.test.ts:12,64,82` が `toEqual` で
  この 3 フィールドちょうどであることを検査している。**このタスクでは変えない**
- `meshCompareEquals` は `shared/src/compare.ts:43-48`。3 フィールドの `===` に加え
  `(a.baseVisible ?? false) === (b.baseVisible ?? false)` を比較している。`cloneMeshCompare` は `{ ...compare }` なので
  任意フィールドもそのまま複製される。`isMeshCompareActive` は baseId / targetId しか見ない
- server は `room-display.ts` で `state.meshCompare = { ...msg.compare }` として丸ごと保持・中継する。
  フィールドを足しても server の変更は不要
- `MeshCompare` は `ClientMessage` / `ServerMessage` の既存 variant(`mesh:compare`、welcome の `meshCompare`)の
  中身であり、variant を足さないので `server/src/realtime/hub.ts` と `web/src/app/realtime-dispatch.ts` に影響しない
- web の `CompareControls.tsx:29-34` は `{ ...meshCompare, ...patch }` で更新し `meshCompareEquals` で同値なら送らない。
  このタスクでは触らない(チェックボックスは 169)
- 既存テスト `shared/tests/mesh-compare.test.ts`(150 行)の `active` は `{ baseId: "v1", targetId: "v2", thresholdPermille: 5 }`(`:22`)。
  baseVisible の検査は `:33-42`(スキーマ)と `:95-107`(同値判定・複製)にある。同じ形で differencesOnly の行を足す

## インターフェイス契約

### `shared/src/types.ts`

```ts
export interface MeshCompare {
  baseId: string | null;
  targetId: string | null;
  thresholdPermille: number;
  baseVisible?: boolean;
  /** 対象の本体を描かず、しきい値を超えた差分だけを描くか。未指定は false(本体も描く) */
  differencesOnly?: boolean;
}

export const MeshCompareSchema = z.object({
  baseId: IdSchema.nullable(),
  targetId: IdSchema.nullable(),
  thresholdPermille: z.number().refine(isCompareThresholdPermille),
  baseVisible: z.boolean().optional(),
  differencesOnly: z.boolean().optional(),
}) satisfies z.ZodType<MeshCompare>;
```

### `shared/src/compare.ts`

```ts
/** 3 フィールドの === 比較に加え、baseVisible と differencesOnly は未指定を false とみなして比較する */
export function meshCompareEquals(a: MeshCompare, b: MeshCompare): boolean;
```

`isMeshCompareActive` と `cloneMeshCompare` のシグネチャ・実装は変えない。

## 振る舞い

`active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MeshCompareSchema.safeParse({ ...active, differencesOnly: true })` | `success === true`、`data.differencesOnly === true` |
| `MeshCompareSchema.safeParse({ ...active, differencesOnly: false })` | `success === true`、`data.differencesOnly === false` |
| `MeshCompareSchema.safeParse(active)`(未指定) | `success === true`、`"differencesOnly" in data` が `false` |
| `MeshCompareSchema.safeParse({ ...active, differencesOnly: "yes" })` / `1` / `null` | `success === false` |
| `MeshCompareSchema.safeParse({ ...active, baseVisible: true, differencesOnly: true })` | `success === true`、両フィールドとも `true` で残る |
| `DEFAULT_MESH_COMPARE` | `{ baseId: null, targetId: null, thresholdPermille: 5 }` のまま(`differencesOnly` キーを持たない) |
| `meshCompareEquals(active, { ...active, differencesOnly: false })` | `true`(未指定と false は同値) |
| `meshCompareEquals(active, { ...active, differencesOnly: true })` | `false` |
| `meshCompareEquals({ ...active, differencesOnly: true }, { ...active, differencesOnly: true })` | `true` |
| `meshCompareEquals({ ...active, baseVisible: true }, { ...active, baseVisible: true, differencesOnly: true })` | `false`(baseVisible が同じでも differencesOnly の差で不一致) |
| `meshCompareEquals({ ...active, differencesOnly: true }, { ...active, differencesOnly: true, thresholdPermille: 10 })` | `false`(既存 3 フィールドの比較はそのまま) |
| `cloneMeshCompare({ ...active, differencesOnly: true })` | `toEqual({ ...active, differencesOnly: true })` かつ別インスタンス |
| `isMeshCompareActive({ ...active, differencesOnly: true })` | `true`(differencesOnly は active 判定に無関係) |
| `parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: { ...active, differencesOnly: true } }))` | `{ ok: true, msg: { type: "mesh:compare", compare: { ...active, differencesOnly: true } } }`(フィールドが落ちない) |
| `ServerMessageSchema.safeParse({ type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { ...active, differencesOnly: true } })` | `success === true`、`data.meshCompare.differencesOnly === true` |
| 既存の検査(baseVisible の受理・拒否・同値判定、下限 0 の受理、負値・51・2.5・"5" の拒否 など) | すべてそのまま通る |

## やらないこと
- `DEFAULT_MESH_COMPARE` への `differencesOnly` の追加(既存の `toEqual` 検査を壊す)
- `server/` の変更。`room-display.ts` はスプレッドで丸ごと保持するので不要
- web 側(`CompareControls.tsx` のチェックボックスは 169、3D ビューでの本体非表示は 168)
- `hub.ts` / `realtime-dispatch.ts` の変更。variant は増えない
- `baseVisible` の意味や既定の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `shared/shared_Summary.md` の `tests/mesh-compare.test.ts` の行(現在「baseVisible の任意指定と同値判定」)に
      「differencesOnly」を、「他モジュールとの関係」の `mesh:compare` の説明(現在「任意の baseVisible(比較中も基準を描くか)」)に
      「任意の differencesOnly(対象の本体を描かず差分だけを描くか)」を追記している
- [ ] すべてのファイルが300行以内(`shared/src/types.ts` は現在 279 行、`mesh-compare.test.ts` は 150 行。
      追加は既存 `it` ブロックへの行追加にとどめ、types.ts は 2 行増に収める)
- [ ] verify: に書いたコマンドが成功する
