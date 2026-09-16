---
id: 155
title: メッシュ比較のしきい値スキーマを 0.1‰ 刻みにし、スライダーの目盛一覧を共有する
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/compare.ts, shared/tests/mesh-compare.test.ts, shared/shared_Summary.md]
reads: [shared/src/protocol.ts, shared/tests/protocol.test.ts, web/src/features/objects/CompareControls.tsx, web/src/features/compare/MeshCompareRig.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
メッシュ比較のしきい値は今は整数の千分率(0.1% 刻み)で、0 の次が 0.1% になる。
0.01%〜0.1% の帯を刻めるように、ルーム共有スキーマが 0.1‰(0.01%)刻みの小数を受け付けるようにし、
スライダーが使う目盛の一覧と「任意の値から最寄りの目盛番号を求める関数」を shared に置く。
スライダー UI の書き換えは 156 が行う。

## 前提
- `MeshCompare.thresholdPermille` は `shared/src/types.ts:86`。スキーマは `shared/src/types.ts:178` の
  `z.number().int().min(MIN_COMPARE_THRESHOLD_PERMILLE).max(MAX_COMPARE_THRESHOLD_PERMILLE)`。
  `MIN = 0` / `MAX = 50` / `DEFAULT = 5`(`shared/src/types.ts:91-93`)は変えない
- `shared/src/compare.ts` は `types.ts` から **型だけ** import している。`types.ts` は `compare.ts` を import していない。
  循環 import を避けるため、**スキーマが使う格子判定は `types.ts` に置き、`compare.ts` は `types.ts` の値を import する**(逆方向は禁止)
- `shared/tests/mesh-compare.test.ts:37` は `[-1, 51, 2.5, "5"]` を拒否値として検査している。
  **2.5 は 0.1‰ の格子に乗るので受理に反転する**。他の 3 つは拒否のまま
- `MeshCompare` は `ClientMessage` / `ServerMessage` の既存 variant の中身であり、variant を足さないので
  `server/src/realtime/hub.ts` と `web/src/app/realtime-dispatch.ts` に影響しない。`server/` はスキーマ経由で値を受けるだけ
- web 側の換算 `thresholdWorld(baseSize, permille) = max(baseSize * permille / 1000, baseSize * 1e-6)`
  (`web/src/features/compare/MeshCompareRig.tsx:15`)は小数の千分率でもそのまま正しい。変更しない
- `shared/src/types.ts` は現在 254 行、`compare.ts` は 22 行、`mesh-compare.test.ts` は 106 行

## インターフェイス契約

### `shared/src/types.ts`(既存の定数の直後に追加)

```ts
/** しきい値の格子。ルーム共有値はこの倍数(0.01%)だけを受け付ける */
export const COMPARE_THRESHOLD_STEP_PERMILLE = 0.1;

/** 有限で MIN〜MAX の範囲にあり、0.1‰ の格子に乗っている(|v*10 − round(v*10)| < 1e-6)とき true */
export function isCompareThresholdPermille(value: number): boolean;
```

`MeshCompareSchema` の `thresholdPermille` は次に置き換える(`.int()` を外し、格子判定を refine にする)。

```ts
thresholdPermille: z.number().refine(isCompareThresholdPermille),
```

### `shared/src/compare.ts`

```ts
import { DEFAULT_COMPARE_THRESHOLD_PERMILLE, type MeshCompare } from "./types";

/**
 * しきい値スライダーの目盛(千分率)。昇順・長さ 60。
 * 添字 0..9 は 0, 0.1, …, 0.9(0.01% 刻み)、添字 10..59 は 1, 2, …, 50(0.1% 刻み)。
 * `i / 10`(i = 0..9)と `i + 1`(i = 0..49)で生成する
 */
export const COMPARE_THRESHOLD_STEPS_PERMILLE: readonly number[];

/**
 * 値に最も近い目盛の添字。添字 0 を初期値として昇順に走査し、
 * |目盛 − 値| が現在の最小より**真に小さい**ときだけ更新する(同距離なら小さい添字が残る)。
 * 非有限の値には DEFAULT_COMPARE_THRESHOLD_PERMILLE の添字(14)を返す
 */
export function nearestCompareThresholdIndex(permille: number): number;
```

`isMeshCompareActive` / `meshCompareEquals` / `cloneMeshCompare` は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `COMPARE_THRESHOLD_STEP_PERMILLE` | `0.1` |
| `isCompareThresholdPermille(v)` で `v` = 0 / 0.1 / 0.3 / 0.7 / 2.5 / 50 | `true` |
| 同上で `v` = 0.05 / 2.55 / -0.1 / 50.1 / NaN / Infinity | `false` |
| `COMPARE_THRESHOLD_STEPS_PERMILLE.length` | `60` |
| `COMPARE_THRESHOLD_STEPS_PERMILLE[3]` / `[9]` / `[10]` / `[14]` / `[59]` | `0.3` / `0.9` / `1` / `5` / `50` |
| `COMPARE_THRESHOLD_STEPS_PERMILLE` の全要素 | 昇順(各要素が直前より真に大きい)かつ `isCompareThresholdPermille` が `true` |
| `COMPARE_THRESHOLD_STEPS_PERMILLE[14]` | `DEFAULT_COMPARE_THRESHOLD_PERMILLE` と等しい |
| `nearestCompareThresholdIndex(v)` で `v` = 5 / 0 / 50 / 0.3 / 1 | `14` / `0` / `59` / `3` / `10` |
| 同上で `v` = 0.04 / 0.06 / 0.55 / 0.65 / 0.95 / 2.5 / 3.7 | `0` / `1` / `6` / `7` / `9` / `11` / `13`(浮動小数で検算済み。0.55 は 0.6 側が真に近い、2.5 は同距離で小さい側) |
| 同上で `v` = 100 / -5 | `59` / `0` |
| 同上で `v` = NaN / Infinity | `14` |
| `MeshCompareSchema.safeParse({ baseId: "v1", targetId: "v2", thresholdPermille: 0.3 })` | `success === true` で `data.thresholdPermille === 0.3` |
| 同上で `thresholdPermille: 2.5` | `success === true`(既存の拒否行を反転) |
| 同上で `thresholdPermille: 0.05` / `2.55` / `-1` / `51` / `"5"` | `success === false` |
| 同上で `thresholdPermille: 0` / `1` / `50` | `success === true`(既存どおり) |
| `DEFAULT_MESH_COMPARE` | `{ baseId: null, targetId: null, thresholdPermille: 5 }`(既存どおり) |
| `parseClientMessage` で `mesh:compare` の `thresholdPermille: 0.3` | `ok: true` で値が `0.3` のまま(JSON 往復で変わらない) |
| `ServerMessageSchema` の welcome に `meshCompare.thresholdPermille: 0.3` | `success === true` |
| `meshCompareEquals(a, { ...a, thresholdPermille: 0.3 })`(a は 5) | `false` |

## やらないこと
- `web/` の変更。スライダーと表示文字列は 156 が行う
- `server/` の変更
- `MIN_COMPARE_THRESHOLD_PERMILLE` / `MAX_COMPARE_THRESHOLD_PERMILLE` / `DEFAULT_COMPARE_THRESHOLD_PERMILLE` の値やフィールド名 `thresholdPermille` の変更
- 目盛の刻み(0.1‰ × 10、1‰ × 50)以外の並び(対数刻みなど)にすること
- しきい値 0 の誤差下限(`ZERO_THRESHOLD_RATIO`)の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `shared/shared_Summary.md` を更新している: 「types の定数」の行に `COMPARE_THRESHOLD_STEP_PERMILLE` と `isCompareThresholdPermille` を足し、
      「compare:」の行に `COMPARE_THRESHOLD_STEPS_PERMILLE`, `nearestCompareThresholdIndex` を足し、
      `tests/mesh-compare.test.ts` の行の「下限 0 の受理と負値の拒否」を「0.1‰ 格子の受理・拒否と目盛一覧・最寄り添字」に改め、
      「他機能との関係」の `mesh:compare` の説明に「thresholdPermille は 0.1‰ 刻みの小数」を添える
- [ ] すべてのファイルが300行以内(`shared/src/types.ts` は現在 254 行)
- [ ] verify: に書いたコマンドが成功する
