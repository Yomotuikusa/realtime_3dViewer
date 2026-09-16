---
id: 151
title: メッシュ比較のしきい値の下限を 0 にする
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/tests/mesh-compare.test.ts, shared/shared_Summary.md, web/tests/objects-labels.test.ts]
reads: [shared/src/protocol.ts, web/src/features/objects/CompareControls.tsx, web/src/features/objects/objects-labels.ts, web/tests/objects-styles.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
メッシュ比較で「少しでも基準からはみ出た部分に色を付ける」ため、しきい値スライダーと
ルーム共有スキーマが受け付ける最小値を 0.1%(千分率 1)から 0.0%(千分率 0)へ下げる。
0 のときの誤差対策(換算の下限)は 152 が compare 側で行う。

## 前提
- `MIN_COMPARE_THRESHOLD_PERMILLE = 1` は `shared/src/types.ts:88` の定数で、
  `MeshCompareSchema`(`shared/src/types.ts:175`)の `.min()` と、スライダーの `min`
  (`web/src/features/objects/CompareControls.tsx:79` の `min={MIN_COMPARE_THRESHOLD_PERMILLE}`)の
  両方がこの定数を参照している。**定数を変えれば UI は無修正で 0 まで動く**
- `web/tests/objects-styles.test.ts:47` は `CompareControls.tsx` のソースに
  `min={MIN_COMPARE_THRESHOLD_PERMILLE}` が含まれることを検査する。UI は変更しないので通る
- しきい値の表示は `thresholdPermilleText(permille)`(`web/src/features/objects/objects-labels.ts:61`)で、
  `(permille / 10).toFixed(1) + "%"` を返す。`thresholdPermilleText(0)` は既に `"0.0%"` を返す
- `shared/tests/mesh-compare.test.ts:24` は `[0, 51, 2.5, "5"]` を拒否値として検査しており、
  **0 の行はこのタスクで反転する**(0 は受理、-1 を拒否に追加)
- `MeshCompare` は `ClientMessage` / `ServerMessage` の既存 variant の中身であり、
  variant を足さないので `server/src/realtime/hub.ts` と `web/src/app/realtime-dispatch.ts` に影響しない
- `DEFAULT_COMPARE_THRESHOLD_PERMILLE = 5` と `MAX_COMPARE_THRESHOLD_PERMILLE = 50` は変えない

## インターフェイス契約

### `shared/src/types.ts`

```ts
/** しきい値の下限。0 は「換算後の誤差下限を超えた差分をすべて着色」を意味する */
export const MIN_COMPARE_THRESHOLD_PERMILLE = 0;
export const MAX_COMPARE_THRESHOLD_PERMILLE = 50;
export const DEFAULT_COMPARE_THRESHOLD_PERMILLE = 5;
```

`MeshCompare` の `thresholdPermille` の doc コメント(`shared/src/types.ts:85` 付近の `/** しきい値。基準モデルの最大辺長に対する千分率。MIN〜MAX の整数 */`)は
「MIN〜MAX の整数」のままでよい。`MeshCompareSchema` は定数参照のまま変えない。

### `web/tests/objects-labels.test.ts`

`thresholdPermilleText` の既存検査(`:43-46`)に 1 行足す。

```ts
expect(thresholdPermilleText(0)).toBe("0.0%");
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MIN_COMPARE_THRESHOLD_PERMILLE` | `0` |
| `MeshCompareSchema.safeParse({ baseId: "v1", targetId: "v2", thresholdPermille: 0 })` | `success === true` |
| 同上で `thresholdPermille: -1` | `success === false` |
| 同上で `thresholdPermille: 51` / `2.5` / `"5"` | `success === false`(既存どおり) |
| 同上で `thresholdPermille: 1` / `50` | `success === true`(既存どおり) |
| `DEFAULT_MESH_COMPARE` | `{ baseId: null, targetId: null, thresholdPermille: 5 }`(既存どおり) |
| `parseClientMessage` で `mesh:compare` の `thresholdPermille: 0` | 受理される(`shared/tests/mesh-compare.test.ts` の protocol 検査に 1 ケース足す) |
| `thresholdPermilleText(0)` | `"0.0%"` |

## やらないこと
- `web/src/features/objects/CompareControls.tsx` / `objects-labels.ts` の変更。定数参照なので不要
- 0 のときの誤差下限(`thresholdWorld`)や重ね描きの着色方法の変更。152 の担当
- `server/` の変更。`room-display.ts` はスキーマ経由で値を受けるだけで下限を持たない
- 既定値・上限の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `shared/shared_Summary.md` の `tests/mesh-compare.test.ts` の行に「下限 0 の受理と負値の拒否」を追記している
- [ ] すべてのファイルが300行以内(`shared/src/types.ts` は現在 250 行、`mesh-compare.test.ts` は 79 行)
- [ ] verify: に書いたコマンドが成功する
