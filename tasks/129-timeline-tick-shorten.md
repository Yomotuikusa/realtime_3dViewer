---
id: 129
title: タイムラインの目盛り線を現在の3割程度の長さに短くし、種類ごとの最小長を設ける
feature: timeline
depends_on: []
owns: [web/src/features/timeline/timeline.ts, web/src/features/timeline/timeline_Summary.md, web/tests/timeline.test.ts]
reads: [web/src/features/timeline/TimelineRuler.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
タイムラインの目盛り線のうちラベル位置の線が数字のすぐ下まで届いており、長すぎる。
3段階の長さの比(ラベル > アクセント > 通常)は保ったまま、すべての目盛りを現在の 0.3 倍の長さにする。
短くすると帯が低いときに目盛りが見えなくなるため、種類ごとに最小の長さを設ける。

## 前提
- 目盛りの長さは現在 `tickLength(kind, heightPx)` = `Math.max(0, (heightPx - TICK_LABEL_BAND_PX) * TICK_LENGTH_RATIO[kind])`
  で決まり、比率は `TICK_LENGTH_RATIO = { label: 1, accent: 0.6, minor: 0.35 }`(timeline.ts:11, 57-60)
- `TICK_LABEL_BAND_PX = 16`(timeline.ts:7)。帯の高さの下限は 32px なので、実際の描画では使える高さは 16px 以上ある
- TimelineRuler.tsx:71 が `y1={height - tickLength(tick.kind, height)}` で線の上端を決めている。変更しない
- 既存テスト web/tests/timeline.test.ts:54-64「scales tick lengths from the ruler height」が
  現在の比率での値を検査している。これを下の振る舞い表の値に置き換える

## インターフェイス契約

```ts
// web/src/features/timeline/timeline.ts
// TICK_LENGTH_RATIO の値を変更し、TICK_MIN_LENGTH_PX を追加する。他のエクスポートは不変
/** (高さ - TICK_LABEL_BAND_PX) に掛ける長さの比率 */
export const TICK_LENGTH_RATIO = { label: 0.3, accent: 0.18, minor: 0.105 } as const;
/** 目盛りの種類ごとの最小の長さ(px)。ただし (高さ - TICK_LABEL_BAND_PX) を超えない */
export const TICK_MIN_LENGTH_PX = { label: 6, accent: 4, minor: 3 } as const;

/**
 * heightPx が有限数でなければ 0。
 * available = Math.max(0, heightPx - TICK_LABEL_BAND_PX) として
 * Math.min(available, Math.max(TICK_MIN_LENGTH_PX[kind], available * TICK_LENGTH_RATIO[kind])) を返す。
 */
export function tickLength(kind: TickKind, heightPx: number): number;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `tickLength("label", 32)` / `("accent", 32)` / `("minor", 32)` | 6 / 4 / 3(比率では 4.8 / 2.88 / 1.68 なので最小長が効く) |
| `tickLength("label", 60)` / `("accent", 60)` / `("minor", 60)` | 13.2 / 7.92 / 4.62(`toBeCloseTo`。比率の値が最小長を上回る) |
| `tickLength("label", 240)` / `("accent", 240)` / `("minor", 240)` | 67.2 / 40.32 / 23.52(`toBeCloseTo`) |
| `tickLength("label", 20)` / `("accent", 20)` / `("minor", 20)` | 4 / 4 / 3(使える高さ 4 を超えない) |
| `tickLength("label", 16)` / `("minor", 10)` / `("accent", NaN)` | 0 / 0 / 0 |
| `TICK_LENGTH_RATIO` / `TICK_MIN_LENGTH_PX` | `{ label: 0.3, accent: 0.18, minor: 0.105 }` / `{ label: 6, accent: 4, minor: 3 }` と `toEqual` |

## やらないこと
- `TICK_LABEL_BAND_PX`、`ACCENT_TICK_MULTIPLE`、`rulerTicks` など他の関数・定数の変更
- TimelineRuler.tsx、timeline.css の変更(色・太さ・ラベル位置は変えない)
- 振る舞い表以外の既存テストの期待値変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] timeline_Summary.md が更新されている(比率 label 0.3 / accent 0.18 / minor 0.105、最小長 6 / 4 / 3px、`TICK_MIN_LENGTH_PX` を公開インターフェイスに追記)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
