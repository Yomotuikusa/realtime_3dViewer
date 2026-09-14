---
id: 128
title: タイムラインの目盛り線を帯の高さに比例して伸縮させ、一定間隔ごとにアクセントを付ける
feature: timeline
depends_on: []
owns: [web/src/features/timeline/timeline.ts, web/src/features/timeline/TimelineRuler.tsx, web/src/features/timeline/timeline_Summary.md, web/tests/timeline.test.ts, web/tests/timeline-styles.test.ts]
reads: [web/src/features/layout/resize.ts, web/src/features/timeline/timeline.css]
verify: npm run typecheck && npm run test
status: done
---

## 目的
タイムライン帯の高さを変えると、目盛り線が固定長のまま下端に取り残される。目盛り線の長さを帯の高さに
比例させ、さらに目盛りを「ラベル位置 / アクセント / 通常」の3段階の長さに分けて読み取りやすくする。

## 前提
- 現在の TimelineRuler.tsx:65-72 は目盛り線を固定長で描いている:
  `tickFrames(lastFrame, tickStep)` の各フレームに `y1={height - 6} y2={height}`、
  `tickFrames(lastFrame, labelStep)` の各フレームに `<g>` で `y1={height - 12}` の線と `<text y={12}>` を描く
- `height` は `useElementSize(trackRef)` で測った帯(`.timeline__track`)の高さ。
  帯の高さは `TIMELINE_TRACK_MIN_PX = 32` 〜 `TIMELINE_TRACK_MAX_PX = 240`(web/src/features/layout/resize.ts:12-13)
- `timelineTicks(lastFrame, widthPx)` は `{ labelStep, tickStep }` を返す(timeline.ts:12-24)。
  labelStep は tickStep の整数倍で、どちらも正の整数
- `tickFrames(lastFrame, step)` は 0 から step 刻みで lastFrame 以下のフレーム配列を返し、不正入力では `[0]`(timeline.ts:26-31)
- tests/timeline-styles.test.ts の「measures the ruler track width and height with useElementSize」は
  TimelineRuler.tsx に `useElementSize` と `'"0 0 " + width + " " + height'` が含まれることを検査している。維持する
- `.timeline__tick` の CSS(timeline.css:37-40)は変更しない

## インターフェイス契約

```ts
// web/src/features/timeline/timeline.ts に追加(既存のエクスポートは変更しない)
/** 帯の上端に数字ラベル用として空けておく高さ */
export const TICK_LABEL_BAND_PX = 16;
/** tickStep の何倍ごとにアクセント目盛りにするか */
export const ACCENT_TICK_MULTIPLE = 5;
/** (高さ - TICK_LABEL_BAND_PX) に掛ける長さの比率 */
export const TICK_LENGTH_RATIO = { label: 1, accent: 0.6, minor: 0.35 } as const;

export type TickKind = "label" | "accent" | "minor";

export interface RulerTick {
  frame: number;
  kind: TickKind;
}

/**
 * tickFrames(lastFrame, ticks.tickStep) の各フレームを順に分類して返す。
 * - frame % ticks.labelStep === 0 → "label"
 * - それ以外で frame % (ACCENT_TICK_MULTIPLE * ticks.tickStep) === 0 → "accent"
 * - それ以外 → "minor"
 */
export function rulerTicks(lastFrame: number, ticks: TimelineTicks): RulerTick[];

/**
 * Math.max(0, (heightPx - TICK_LABEL_BAND_PX) * TICK_LENGTH_RATIO[kind]) を返す。
 * heightPx が有限数でなければ 0。
 */
export function tickLength(kind: TickKind, heightPx: number): number;
```

```tsx
// web/src/features/timeline/TimelineRuler.tsx(props・RULER_HEIGHT_PX は不変)
// svg 内の目盛り部分を次の形に置き換える。PlayHead の描画は変更しない。
const ticks = timelineTicks(lastFrame, width); // labelStep / tickStep を得る(既存の分割代入を置き換えてよい)
{rulerTicks(lastFrame, ticks).map((tick) => (
  <line
    key={"tick-" + tick.frame}
    className={"timeline__tick timeline__tick--" + tick.kind}
    x1={frameToX(tick.frame, lastFrame, width)}
    x2={frameToX(tick.frame, lastFrame, width)}
    y1={height - tickLength(tick.kind, height)}
    y2={height}
  />
))}
{tickFrames(lastFrame, ticks.labelStep).map((label) => (
  <text key={"label-" + label} className="timeline__label" x={frameToX(label, lastFrame, width)} y={12}>{label}</text>
))}
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `rulerTicks(24, { labelStep: 10, tickStep: 1 })` | 長さ 25。frame 0/10/20 が label、5/15 が accent、1・24 などその他が minor |
| `rulerTicks(240, { labelStep: 20, tickStep: 2 })` | frame は 0,2,…,240(121 件)。0/20 が label、10/30 が accent、2/4 が minor、240 が label |
| `rulerTicks(10, { labelStep: 5, tickStep: 1 })` | 0/5/10 が label(accent 間隔 5 がラベルと一致するため label 優先)、その他は minor、accent は 0 件 |
| `rulerTicks(4, { labelStep: 1, tickStep: 1 })` | frame 0〜4 がすべて label |
| `rulerTicks(0, { labelStep: 1, tickStep: 1 })` | `[{ frame: 0, kind: "label" }]` |
| `tickLength("label", 32)` / `("accent", 32)` / `("minor", 32)` | 16 / 9.6 / 5.6(`toBeCloseTo`) |
| `tickLength("label", 240)` / `("accent", 240)` / `("minor", 240)` | 224 / 134.4 / 78.4(`toBeCloseTo`) |
| `tickLength("label", 16)` / `("minor", 10)` / `("accent", NaN)` | 0 / 0 / 0 |
| ソース検査: TimelineRuler.tsx | `rulerTicks(` と `tickLength(` を含み、`height - 6` と `height - 12` を含まない。既存の useElementSize / viewBox 検査も維持 |

## やらないこと
- `timelineTicks` / `tickFrames` / `frameToX` など既存関数の変更、既存テストの期待値変更
- 目盛りの色・太さの変更(timeline.css は変更しない。`timeline__tick--<kind>` クラスは付けるだけ)
- 数字ラベルの位置(`y={12}`)や PlayHead の変更
- 帯の高さの範囲(layout/resize.ts)の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] timeline_Summary.md が更新されている(目盛りが高さに比例して伸縮し、3段階の長さを持つこと、追加エクスポート)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
