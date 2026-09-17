---
id: 160
title: タイムラインの目盛りのアクセント間隔を帯の幅に依存せず決まるようにし、3段階を CSS で色分けする
feature: timeline
depends_on: []
owns: [web/src/features/timeline/timeline.ts, web/src/features/timeline/timeline.css, web/src/features/timeline/timeline_Summary.md, web/tests/timeline.test.ts, web/tests/timeline-styles.test.ts]
reads: [web/src/features/timeline/TimelineRuler.tsx, web/src/features/timeline/PlaybackTimeline.tsx, web/src/features/layout/resize.ts, web/src/styles/tokens.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

タイムラインのアクセント目盛りが、帯の幅とクリップの長さの組み合わせによっては **1 本も描かれない**。
同じコードでも PC ごとに(画面幅とドック幅が違うため)見え方が変わり、片方では目盛りが
「ラベル + 3px の通常目盛り」だけになる。アクセント間隔をラベル間隔から決まる値として明示し、
幅に依存せず 3 段階が出るようにする。あわせて、長さの差しか手がかりが無い 3 段階に色の差を付ける。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 現在の分類は `rulerTicks`(`web/src/features/timeline/timeline.ts:48-58`)で、
  `frame % ticks.labelStep === 0` → `"label"`、それ以外で
  `frame % (ACCENT_TICK_MULTIPLE * ticks.tickStep) === 0` → `"accent"`、残りが `"minor"`。
  **label の判定が先なので、`ACCENT_TICK_MULTIPLE * tickStep`(= `5 * tickStep`)が
  `labelStep` の倍数になる幅では accent が 1 本も生成されない**。これがこのタスクで直す不具合。
  実測(2026-09-17、現行コードを読み込んで確認):

  | lastFrame | 帯の幅 | 現在の labelStep / tickStep | label | accent | minor |
  | --- | --- | --- | --- | --- | --- |
  | 150 | 1280px | 10 / 1 | 16 | 15 | 120 |
  | 150 | 1920px | 5 / 1 | 31 | **0** | 120 |
  | 100 | 1280px | 5 / 1 | 21 | **0** | 80 |

  accent が消える主因は `labelStep === 5`(1 フレームあたり 9.6〜24px)の帯で、幅 1280px なら
  lastFrame 53〜131、幅 1920px なら 80〜198 がまるごと該当する。
  副次的に、`MIN_LABEL_PX`(48) と `MIN_TICK_PX`(5) の比が 10 でないため
  `labelStep * pxPerFrame` が 48 以上 50 未満のとき `tickStep` が `labelStep / 5` に落ち、
  ここでも accent がゼロになる(幅 1280px で lastFrame 253〜263 と 506〜526)。
- `timelineTicks(lastFrame, widthPx)` の呼び出し元は `TimelineRuler.tsx:19` の 1 箇所だけで、
  戻り値はそのまま `rulerTicks(lastFrame, ticks)` と `tickFrames(lastFrame, ticks.labelStep)` に渡される
  (`TimelineRuler.tsx:65,75`)。**このタスクで `TimelineRuler.tsx` は変更しない**。
- `STEP_SERIES` と `ACCENT_TICK_MULTIPLE` の参照は `timeline.ts` 本体と `timeline_Summary.md` だけで、
  `web/tests/timeline.test.ts` は import していない(2026-09-17 に grep で確認)。
- `.timeline__tick` の CSS は `timeline.css:37-40` の 1 ルールのみで、
  `timeline__tick--label` / `--accent` / `--minor` に対応する規則は存在しない。
  クラス名自体は `TimelineRuler.tsx:68` が常に付けている。
- `tickLength(kind, heightPx)` は帯 32px のとき label 13 / accent 9 / minor 3 を返す
  (`TICK_LENGTH_RATIO` と `TICK_MIN_LENGTH_PX`)。**この値と `tickLength` の実装はこのタスクで変更しない**
  (129 と、その後の「アクセント目盛りを長くする」変更で決めた値)。
- `web/tests/timeline-styles.test.ts` の `ruleBody(text, selector)` は
  `(?:^|})\s*<selector>\s*\{([^{}]*)\}` でセレクタ完全一致のブロック本文を取る。
  `.timeline__tick` を探しても `.timeline__tick--accent {` にはマッチしない
  (セレクタ名の直後が `\s*\{` にならないため)。
- `web/tests/styles-rules.test.ts` が `src` 配下の全 CSS を横断で検査する。
  `tokens.css` 以外に生の色(`#rgb` / `rgb()` / `rgba()` / `hsl()`)を書けず、`@import` は禁止、
  `var(--x)` は宣言済みかフォールバック付きでなければならない。
- `--color-text`(ライト `#101828` / ダーク `#e7eaf0`)、`--color-text-muted`(`#667085` / `#9aa4b5`)、
  `--color-border-strong`(`#98a2b3` / `#4c566a`)はいずれも `web/src/styles/tokens.css` に
  ライト・ダーク両方の値がある(`tokens.css:24-30` と `:58-64`)。
- 現在の行数。新規ファイルは作らないので `summary-coverage.test.ts` への影響は無い。
  - `web/src/features/timeline/timeline.ts` … 95 行
  - `web/src/features/timeline/timeline.css` … 97 行
  - `web/tests/timeline.test.ts` … 109 行
  - `web/tests/timeline-styles.test.ts` … 97 行
  - `web/src/features/timeline/timeline_Summary.md` … 47 行

## インターフェイス契約

### web/src/features/timeline/timeline.ts

`TIMELINE_PAD_PX` / `MIN_TICK_PX` / `FPS_OPTIONS` / `TICK_LABEL_BAND_PX` / `TICK_LENGTH_RATIO` /
`TICK_MIN_LENGTH_PX` / `TickKind` / `RulerTick` / `tickFrames` / `tickLength` / `frameToX` /
`frameAtX` / `timelineKeyFrame` / `fpsOptions` は**値もシグネチャも変更しない**。

```ts
/**
 * ラベルの最小間隔(px)。MIN_TICK_PX * 10 に等しい。
 * この比が 10 であることによって tickStep が必ず labelStep / 10 になり、
 * アクセント間隔 labelStep / 2 が tickStep の倍数であることが保証される。
 */
export const MIN_LABEL_PX = 50;

/**
 * ラベル間隔の候補。5 を持たないのは labelStep / ACCENT_LABEL_DIVISOR を整数にするため。
 * (旧 STEP_SERIES。名前を変えて 5 を除く)
 */
export const LABEL_STEP_SERIES: readonly number[] =
  [1, 2, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

/** アクセント目盛りはラベル間隔をこの数で割った位置に置く */
export const ACCENT_LABEL_DIVISOR = 2;

export interface TimelineTicks {
  labelStep: number;
  /** アクセント目盛りの間隔。置けないときは 0 */
  accentStep: number;
  tickStep: number;
}

/**
 * labelStep / ACCENT_LABEL_DIVISOR が整数で、tickStep より大きく、tickStep の倍数なら
 * その値を返す。1 つでも満たさなければ 0(アクセント目盛りを置かない)。
 * tickStep が正の有限数でなければ 0。
 */
export function accentStepFor(labelStep: number, tickStep: number): number;

/**
 * 不正値・幅ゼロ以下では { labelStep: 1, accentStep: 0, tickStep: 1 }。
 * それ以外は pxPerFrame = (widthPx - 2 * TIMELINE_PAD_PX) / lastFrame として
 *   labelStep = LABEL_STEP_SERIES.find(s => s * pxPerFrame >= MIN_LABEL_PX) ?? 末尾
 *   tickStep  = labelStep < 10 ? 1
 *             : ([labelStep / 10, labelStep / 5, labelStep].find(s => s * pxPerFrame >= MIN_TICK_PX) ?? labelStep)
 *   accentStep = accentStepFor(labelStep, tickStep)
 * を返す。labelStep / tickStep の求め方は現在と同じで、series と MIN_LABEL_PX だけが変わる。
 */
export function timelineTicks(lastFrame: number, widthPx: number): TimelineTicks;

/**
 * tickFrames(lastFrame, ticks.tickStep) の各フレームを順に分類して返す。
 * - frame % ticks.labelStep === 0 → "label"
 * - それ以外で ticks.accentStep > 0 かつ frame % ticks.accentStep === 0 → "accent"
 * - それ以外 → "minor"
 * accentStep が 0 のときに frame % 0 を評価してはならない(NaN になる)。
 */
export function rulerTicks(lastFrame: number, ticks: TimelineTicks): RulerTick[];
```

`STEP_SERIES` と `ACCENT_TICK_MULTIPLE` は削除する(上の 2 つで置き換わる)。

### web/src/features/timeline/timeline.css

`.timeline__tick` の既存ルールは残したまま、直後に修飾子の 2 ルールを足す。
**修飾子は `.timeline__tick` と同じ詳細度(クラス 1 つ)なので、必ず `.timeline__tick` より後に置く**。
他のルールは一切変更しない。

```css
.timeline__tick {
  stroke: var(--color-border-strong);
  stroke-width: 1;
}

.timeline__tick--accent {
  stroke: var(--color-text-muted);
}

.timeline__tick--label {
  stroke: var(--color-text);
}
```

`--minor` の規則は作らない(基底の `.timeline__tick` がそのまま通常目盛りの見た目になる)。
`stroke-width` は 3 段階とも 1 のままにする(小数の線幅は座標が整数でないときにぼやけるため)。

## 振る舞い

`timelineTicks` の期待値は、下の式を幅 816px(= 既存テストの `width`、内側 800px)で計算したもの。
`pxPerFrame = 800 / lastFrame`、`labelStep` = `s * pxPerFrame >= 50` を満たす最小の候補。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `timelineTicks(48, 816)` | `{ labelStep: 10, accentStep: 5, tickStep: 1 }`(p=16.67。2×16.67=33.3<50、10×16.67=166.7≥50) |
| `timelineTicks(240, 816)` | `{ labelStep: 20, accentStep: 10, tickStep: 2 }`(p=3.333。10×3.333=33.3<50、20×3.333=66.7≥50) |
| `timelineTicks(1000, 816)` | `{ labelStep: 100, accentStep: 50, tickStep: 10 }`(p=0.8。50×0.8=40<50、100×0.8=80≥50) |
| `timelineTicks(10000, 816)` | `{ labelStep: 1000, accentStep: 500, tickStep: 100 }`(p=0.08) |
| `timelineTicks(24, 216)` | `{ labelStep: 10, accentStep: 5, tickStep: 1 }`(内側 200px、p=8.333) |
| `timelineTicks(24, 816)` | `{ labelStep: 2, accentStep: 0, tickStep: 1 }`(p=33.3。labelStep=2 では 2/2=1 が tickStep を超えないのでアクセント無し) |
| `timelineTicks(10, 816)` | `{ labelStep: 1, accentStep: 0, tickStep: 1 }`(p=80。全フレームがラベル) |
| `timelineTicks(1000000, 816)` | `{ labelStep: 10000, accentStep: 0, tickStep: 10000 }`(どの候補も 50px に届かず末尾へ) |
| `timelineTicks(0, 816)` / `timelineTicks(48, 10)` / `timelineTicks(48, 16)` | `{ labelStep: 1, accentStep: 0, tickStep: 1 }` |
| **回帰**: `timelineTicks(100, 1280)` と `timelineTicks(150, 1920)` | どちらも `{ labelStep: 10, accentStep: 5, tickStep: 1 }`。以前はどちらも `labelStep: 5` になり accent が 0 本だった |
| **回帰**: `timelineTicks(165, 816)` | `{ labelStep: 20, accentStep: 10, tickStep: 2 }`。以前は `labelStep * p` が 48〜50 の隙間に落ちて `tickStep` が `labelStep / 5` になり accent が 0 本だった |
| **不変条件**: 幅 320〜3840px(8px 刻み)× lastFrame 1〜2000 の全組 | `labelStep >= 10` なら必ず `accentStep > 0`。`accentStep > 0` のときは常に `tickStep < accentStep < labelStep` かつ `accentStep % tickStep === 0` かつ `labelStep % accentStep === 0` |
| `accentStepFor(10, 1)` / `(20, 2)` / `(100, 10)` | 5 / 10 / 50 |
| `accentStepFor(10, 2)` | 0(5 は 2 の倍数ではない) |
| `accentStepFor(10, 5)` | 0(5 は tickStep を超えない) |
| `accentStepFor(5, 1)` / `accentStepFor(1, 1)` | 0(5/2 も 1/2 も整数でない) |
| `accentStepFor(10, 0)` / `accentStepFor(10, Number.NaN)` | 0 |
| `rulerTicks(24, { labelStep: 10, accentStep: 5, tickStep: 1 })` | 25 本。label が `[0, 10, 20]`、accent が `[5, 15]`、残り 20 本が minor |
| `rulerTicks(240, { labelStep: 20, accentStep: 10, tickStep: 2 })` | 121 本。末尾は `{ frame: 240, kind: "label" }`、frame 10 は accent、frame 2 は minor |
| `rulerTicks(10, { labelStep: 2, accentStep: 0, tickStep: 1 })` | 11 本が label と minor の交互。accent は 0 本で、`kind` に `NaN` 由来の取りこぼしが無い |
| `rulerTicks(4, { labelStep: 1, accentStep: 0, tickStep: 1 })` | 5 本すべて label |
| `rulerTicks(0, { labelStep: 1, accentStep: 0, tickStep: 1 })` | `[{ frame: 0, kind: "label" }]` |
| 目盛りの色(CSS) | 通常 `--color-border-strong`、アクセント `--color-text-muted`、ラベル位置 `--color-text` の 3 段階。ライト・ダークとも `tokens.css` に値がある |
| `.timeline__tick--accent` / `--label` の位置 | `timeline.css` の中で `.timeline__tick` の基底ルールより後にある(同じ詳細度なので順序で勝つ) |
| 目盛りの長さ | 変わらない。帯 32px で label 13 / accent 9 / minor 3 |

## テスト

### web/tests/timeline.test.ts

- `"selects readable label and tick steps"` の全行を上の表の期待値に差し替える
  (`toEqual` の対象に `accentStep` が増えるため、既存 10 行はすべて書き換えになる)。
  `timelineTicks(24, 816)` と回帰 3 行(`(100, 1280)` / `(150, 1920)` / `(165, 816)`)を追加する。
- `"classifies ruler ticks by label and accent intervals"` の `TimelineTicks` リテラルに
  `accentStep` を足し、上の表の `rulerTicks` の行に合わせる。
- `accentStepFor` の単体テストを新しい `it` として追加する(上の表の 6 行)。
- 不変条件の総当たりを 1 つの `it` として追加する。二重ループで `expect` を呼ぶと
  1 件あたりの失敗メッセージが読みにくいので、違反した組を配列に集めて
  `expect(violations).toEqual([])` の形にする。

```ts
it("always places an accent step between the tick and label steps", () => {
  const violations: string[] = [];
  for (let widthPx = 320; widthPx <= 3840; widthPx += 8) {
    for (let lastFrame = 1; lastFrame <= 2000; lastFrame += 1) {
      const { labelStep, accentStep, tickStep } = timelineTicks(lastFrame, widthPx);
      const ok = accentStep > 0
        ? tickStep < accentStep && accentStep < labelStep
          && accentStep % tickStep === 0 && labelStep % accentStep === 0
        : labelStep < 10;
      if (!ok) violations.push(`${lastFrame}@${widthPx}: ${labelStep}/${accentStep}/${tickStep}`);
    }
  }
  expect(violations).toEqual([]);
});
```

`"scales tick lengths from the ruler height"` / `"generates tick frames"` /
`"maps between frames and ruler coordinates"` / `"handles keyboard frame movement and fps choices"`
は変更しない。

### web/tests/timeline-styles.test.ts

既存の 7 件はすべて残す。次を追加する。

```ts
it("separates the three tick kinds by stroke color", () => {
  expect(ruleBody(timelineCss, ".timeline__tick")).toContain("stroke: var(--color-border-strong)");
  expect(ruleBody(timelineCss, ".timeline__tick")).toContain("stroke-width: 1");
  expect(ruleBody(timelineCss, ".timeline__tick--accent")).toContain("stroke: var(--color-text-muted)");
  expect(ruleBody(timelineCss, ".timeline__tick--label")).toContain("stroke: var(--color-text)");
  expect(timelineCss).not.toContain(".timeline__tick--minor");
  const base = timelineCss.indexOf(".timeline__tick {");
  expect(base).toBeGreaterThan(-1);
  expect(timelineCss.indexOf(".timeline__tick--accent")).toBeGreaterThan(base);
  expect(timelineCss.indexOf(".timeline__tick--label")).toBeGreaterThan(base);
});
```

## Summary の更新

`web/src/features/timeline/timeline_Summary.md` を次のとおり直す。

- 「ファイル一覧と役割」の `timeline.ts` の行にある **`(label 6px / accent 4px / minor 3px)` は現在の
  実装(13 / 9 / 3)と食い違っている古い記述なので、あわせて直す**
- 同じ行に、アクセント間隔がラベル間隔の半分として決まり、置けないときは 0 になることを書く
- 「ファイル一覧と役割」の `TimelineRuler.tsx` と `timeline.css` の行に、
  3 段階を長さと色の両方で区別することを書く
- 「公開インターフェイス」の `timeline.ts` の行から `STEP_SERIES` と `ACCENT_TICK_MULTIPLE` を外し、
  `LABEL_STEP_SERIES`、`ACCENT_LABEL_DIVISOR`、`accentStepFor` を加える。
  `MIN_LABEL_PX` が 50(= `MIN_TICK_PX` × 10)であることと、`TimelineTicks` が
  `labelStep` / `accentStep` / `tickStep` の 3 つを持つことを書く
- 「テスト」の `tests/timeline-styles.test.ts` の説明に目盛り 3 段階の色分けの検査を足す

## やらないこと

- `TimelineRuler.tsx` を変更しない。SVG の組み立て、`useElementSize`、`viewBox`、PlayHead、
  ポインター／キーのシークには触れない
- `tickLength` の実装、`TICK_LENGTH_RATIO`、`TICK_MIN_LENGTH_PX`、`TICK_LABEL_BAND_PX` を変更しない。
  目盛りを長くしたり短くしたりしない(129 とその後の調整で決めた値)
- `MIN_TICK_PX`(5)、`TIMELINE_PAD_PX`(8)、`FPS_OPTIONS` を変更しない
- `LABEL_STEP_SERIES` から 1 や 2 を外さない。短いクリップで 1 フレームごとにラベルが出る挙動は残す
- `.timeline__tick--minor` という規則を作らない。通常目盛りは基底の `.timeline__tick` のままにする
- `tokens.css` に新しい色トークンを足さない。既存の 3 つを使う
- `stroke-width` を 3 段階で変えない。`stroke-dasharray` や `opacity` も使わない
- `PlaybackTimeline.tsx` / `timeline-labels.ts` / `transport-icons.tsx` / `PlaybackSourceSelect.tsx` を変更しない
- `features/layout` の `LAYOUT_SIZE_SPECS.timelineHeight` や帯の高さの下限・上限を変更しない
- `shared` / `server` は変更しない。ルーム共有の状態は増やさない(目盛りの見え方は端末ローカルの描画であり、D39 の共有対象ではない)

## 目視確認(マージ後に人間が行う)

`npm run dev:server` + `npm run dev:web` で、アニメーション付きモデルを開いて確認する。

- 1280×800 と 1920×1080 の両方で、**同じクリップの目盛りが同じ段階構成に見える**こと
  (ラベル位置 → アクセント → 通常の 3 段階が、どちらの幅でも出ている)
- 60 フレーム前後・150 フレーム前後・600 フレーム前後のクリップで、それぞれ 3 段階が出ること
- タイムライン帯の高さを最小(32px)まで縮めても 3 段階が判別できること
- ライトテーマ・ダークテーマの両方で、通常目盛りが背景に埋もれず、
  アクセントとラベル位置がそれより濃く見えること

不合格なら、このタスクを再実行せず修正タスクを新規起票する(`docs/task-breakdown.md` D38)。

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの export 名・定数値になっている(`STEP_SERIES` と `ACCENT_TICK_MULTIPLE` は消えている)
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] 不変条件の総当たりテストが違反 0 件で通る
- [ ] `TimelineRuler.tsx` が変更されていない
- [ ] `timeline_Summary.md` の目盛り最小長の記述が実装(13 / 9 / 3)と一致している
- [ ] すべてのファイルが 300 行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
