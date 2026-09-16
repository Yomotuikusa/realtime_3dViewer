---
id: 153
title: MeshCompare に「比較中も基準を表示する」フラグ baseVisible を足す
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/compare.ts, shared/tests/mesh-compare.test.ts, shared/shared_Summary.md]
reads: [shared/src/protocol.ts, server/src/realtime/room-display.ts, web/src/store/display.ts, web/src/features/objects/CompareControls.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
メッシュ比較で「へこみ」(青)は基準モデルの表面より内側にあるため、基準を不透明で描いている間は
基準の面に隠れて見えない(実画面で確認済み)。154 で「比較中は基準の描画を止める / 戻す」を
比較ブロックから切り替えられるようにするため、その切り替え値をルーム共有の `MeshCompare` に
任意フィールドとして載せる。

## 前提
- `MeshCompare` は `shared/src/types.ts:80-87`。`baseId` / `targetId` / `thresholdPermille` の 3 フィールド
- `MeshCompareSchema` は `shared/src/types.ts:173-177` の `z.object({...}) satisfies z.ZodType<MeshCompare>`。
  zod の `z.object` は未知キーを**捨てる**ので、スキーマに載せないフィールドは server を通らない
- `DEFAULT_MESH_COMPARE`(`shared/src/types.ts:93-97`)は `{ baseId: null, targetId: null, thresholdPermille: 5 }` で、
  `shared/tests/mesh-compare.test.ts:33`、`web/tests/store-display.test.ts:12,64,82` が `toEqual` で
  この 3 フィールドちょうどであることを検査している。**このタスクでは変えない**
- `meshCompareEquals` / `cloneMeshCompare` / `isMeshCompareActive` は `shared/src/compare.ts`(19 行)。
  `cloneMeshCompare` は `{ ...compare }` なので任意フィールドもそのまま複製される
- server は `room-display.ts:82-84` で `state.meshCompare = { ...msg.compare }` として丸ごと保持・中継する。
  フィールドを足しても server の変更は不要
- `MeshCompare` は `ClientMessage` / `ServerMessage` の既存 variant(`mesh:compare`、welcome の `meshCompare`)の
  中身であり、variant を足さないので `server/src/realtime/hub.ts` と `web/src/app/realtime-dispatch.ts` に影響しない
- web の `CompareControls.tsx:34` は `{ ...meshCompare, ...patch }` で更新し `meshCompareEquals` で同値なら送らない。
  このタスクでは触らない(チェックボックスは 154)

## インターフェイス契約

### `shared/src/types.ts`

```ts
export interface MeshCompare {
  /** 基準にする版の id。未選択なら null */
  baseId: string | null;
  /** 基準と比べて着色する版の id。未選択なら null */
  targetId: string | null;
  /** しきい値。基準モデルの最大辺長に対する千分率。MIN〜MAX の整数 */
  thresholdPermille: number;
  /** 比較中も基準の版を 3D ビューで描くか。未指定は false(比較中は基準を描かない) */
  baseVisible?: boolean;
}

export const MeshCompareSchema = z.object({
  baseId: IdSchema.nullable(),
  targetId: IdSchema.nullable(),
  thresholdPermille: z.number().int().min(MIN_COMPARE_THRESHOLD_PERMILLE).max(MAX_COMPARE_THRESHOLD_PERMILLE),
  baseVisible: z.boolean().optional(),
}) satisfies z.ZodType<MeshCompare>;
```

### `shared/src/compare.ts`

```ts
/** 3 フィールドの === 比較に加え、baseVisible は未指定を false とみなして比較する */
export function meshCompareEquals(a: MeshCompare, b: MeshCompare): boolean;
```

`isMeshCompareActive` と `cloneMeshCompare` のシグネチャ・実装は変えない。

## 振る舞い

`active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MeshCompareSchema.safeParse({ ...active, baseVisible: true })` | `success === true`、`data.baseVisible === true` |
| `MeshCompareSchema.safeParse({ ...active, baseVisible: false })` | `success === true`、`data.baseVisible === false` |
| `MeshCompareSchema.safeParse(active)`(未指定) | `success === true`、`"baseVisible" in data` が `false` |
| `MeshCompareSchema.safeParse({ ...active, baseVisible: "yes" })` / `1` / `null` | `success === false` |
| `DEFAULT_MESH_COMPARE` | `{ baseId: null, targetId: null, thresholdPermille: 5 }` のまま(`baseVisible` キーを持たない) |
| `meshCompareEquals(active, { ...active, baseVisible: false })` | `true`(未指定と false は同値) |
| `meshCompareEquals(active, { ...active, baseVisible: true })` | `false` |
| `meshCompareEquals({ ...active, baseVisible: true }, { ...active, baseVisible: true })` | `true` |
| `meshCompareEquals({ ...active, baseVisible: true }, { ...active, baseVisible: true, thresholdPermille: 10 })` | `false`(既存 3 フィールドの比較はそのまま) |
| `cloneMeshCompare({ ...active, baseVisible: true })` | `toEqual({ ...active, baseVisible: true })` かつ別インスタンス |
| `isMeshCompareActive({ ...active, baseVisible: true })` | `true`(baseVisible は active 判定に無関係) |
| `parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: { ...active, baseVisible: true } }))` | `{ ok: true, msg: { type: "mesh:compare", compare: { ...active, baseVisible: true } } }`(フィールドが落ちない) |
| `ServerMessageSchema.safeParse({ type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { ...active, baseVisible: true } })` | `success === true`、`data.meshCompare.baseVisible === true` |
| 既存の検査(下限 0 の受理、負値・51・2.5・"5" の拒否、`baseId` の空文字拒否 など) | すべてそのまま通る |

## やらないこと
- `DEFAULT_MESH_COMPARE` への `baseVisible` の追加(既存の `toEqual` 検査を壊す)
- `server/` の変更。`room-display.ts` はスプレッドで丸ごと保持するので不要
- web 側(`CompareControls.tsx` のチェックボックス、`ViewerCanvas.tsx` の描画抑止)。154 の担当
- `hub.ts` / `realtime-dispatch.ts` の変更。variant は増えない
- `thresholdPermille` の刻みや上下限の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `shared/shared_Summary.md` の `tests/mesh-compare.test.ts` の行に「baseVisible の任意指定と同値判定」を、
      「他モジュールとの関係」の `mesh:compare` の説明(現在「baseId / targetId / thresholdPermille 全体を…」)に
      「任意の baseVisible(比較中も基準を描くか)」を追記している
- [ ] すべてのファイルが300行以内(`shared/src/types.ts` は現在 251 行、`mesh-compare.test.ts` は 86 行)
- [ ] verify: に書いたコマンドが成功する
