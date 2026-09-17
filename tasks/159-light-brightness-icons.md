---
id: 159
title: web ライト明るさスライダーの両端に強弱を示す太陽アイコンを置き、ギズモの CSS とスタイル検査を分割する
feature: viewer
depends_on: []
owns: [web/src/features/viewer/light-icons.tsx, web/src/features/viewer/light-gizmo.css, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/tests/light-gizmo-styles.test.ts, web/tests/viewer-styles.test.ts, web/tests/light-gizmo.test.ts]
reads: [web/src/features/viewer/display-icons.tsx, web/src/features/viewer/light-gizmo.ts, web/src/features/viewer/lighting.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/ViewerHud.tsx, web/src/styles/tokens.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

3D ビュー右下のライトギズモ下端にある明るさスライダーは、目盛りもアイコンも無い素の `range` が 1 本あるだけで、どちら向きに動かすと明るくなるのかが見て分からない。スライダーの両端に「弱い光」と「強い光」を表す太陽アイコンを置き、向きを直感的に示す。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 明るさスライダーは `web/src/features/viewer/LightGizmo.tsx:120-131` の `<input className="light-gizmo__brightness" type="range">` 1 本。`min={MIN_LIGHT_BRIGHTNESS}`(0.25)、`max={MAX_LIGHT_BRIGHTNESS}`(4)、`step={LIGHT_BRIGHTNESS_STEP}`(0.25)。定数は `shared/src/types.ts:75-76` と `web/src/features/viewer/lighting.ts:13`。
- `range` の既定の向き(`direction: ltr`)により、**左端が min = 暗い、右端が max = 明るい**。このタスクでもその向きは変えない。
- `LightGizmo` のルート `.light-gizmo` は 160×160 の絶対配置で、子は 3 つ(`.light-gizmo__stage` / `.light-gizmo__brightness` / `.light-gizmo__reset`)。スライダーだけが `bottom: calc(var(--space-3) * -1)` でルートの下へはみ出して置かれている。`web/src/features/viewer/viewer.css:233-278`。
- `GIZMO_SIZE_PX = 160` は `web/src/features/viewer/light-gizmo.ts` の定数で、`viewer.css` の `.light-gizmo` の幅・高さと `.hud-hint` の退避幅(`right: calc(160px + var(--space-3) * 2)`)の両方をテストが突き合わせている。**このタスクでは 160 を変えない**。
- SVG アイコンの書き方は `web/src/features/viewer/display-icons.tsx` に前例がある。`viewBox` とパスを名前付き定数として export し、`aria-hidden="true" focusable="false"` を付けた `<svg>` を返す関数コンポーネントにしている。同じ流儀に合わせる。
- `web/tests/styles-rules.test.ts` が `src` 配下の **全 CSS** を横断で検査しており、次の 3 点が守られていないと落ちる。このタスクで新設する CSS も対象になる。
  - `tokens.css` 以外のファイルに生の色(`#rgb` / `rgb()` / `rgba()` / `hsl()`)を書けない
  - CSS の `@import` は全ファイルで禁止(CSS は TSX 側から `import "./xxx.css"` する)
  - `var(--x)` はどこかの CSS で宣言されているか、フォールバック付きでなければならない
- 生のピクセル値(`14px` など)の使用は禁止されていない。`viewer.css` には既に `width: 160px` や `width: 14px` がある。
- `--color-text-muted`(`web/src/styles/tokens.css:28,62`)と `--space-1`(= 4px、同 :12)は定義済みのトークンで、ライト／ダークの両方に値がある。
- `web/tests/summary-coverage.test.ts` が、`src` 配下の **すべての** `.ts` / `.tsx` / `.css` を最寄りの `<名前>_Summary.md` に相対パスで列挙することと、`tests/` 配下のすべてのテストファイル名がどれかの Summary に現れることを強制する。このタスクで増える 3 ファイルは `viewer_Summary.md` へ追記しないと落ちる。
- `web/tests/viewer-styles.test.ts` の `ruleBody(text, selector)` は `(?:^|})\s*<selector>\s*\{([^{}]*)\}` でセレクタ完全一致のブロック本文を取る。`.light-gizmo__brightness` を探しても `.light-gizmo__brightness-row {` や `.light-gizmo__brightness-icon {` にはマッチしない(セレクタ名の直後が `\s*\{` にならないため)。新しいテストファイルでも同じ関数をそのまま使ってよい。
- 現在の行数と上限 300 行との関係。**このタスクは既存ファイルへ足すのではなく、先に分割してから足す**。
  - `web/src/features/viewer/viewer.css` … 278 行
  - `web/tests/viewer-styles.test.ts` … 270 行
  - `web/src/features/viewer/LightGizmo.tsx` … 151 行
  - `web/tests/light-gizmo.test.ts` … 123 行
  - `web/src/features/viewer/viewer_Summary.md` … 183 行

## インターフェイス契約

### web/src/features/viewer/light-icons.tsx(新規)

明るさスライダーの両端に置く飾りのアイコン。`display-icons.tsx` と同じく、形状を定数として export したうえでコンポーネントを返す。

```tsx
import type { ReactElement } from "react";

export const SUN_VIEW_BOX = "0 0 16 16";
/** 光源のコア。強弱どちらのアイコンも同じ半径で描き、光線の有無だけで強弱を表す */
export const SUN_CORE_CX = 8;
export const SUN_CORE_CY = 8;
export const SUN_CORE_RADIUS = 3.2;
/** コアから 45 度おきに 8 本。中心から 5.2 で始まり 7.2 で終わる線分 */
export const SUN_RAY_INNER_RADIUS = 5.2;
export const SUN_RAY_OUTER_RADIUS = 7.2;
export const SUN_RAYS =
  "M13.2 8 15.2 8M2.8 8 0.8 8M8 13.2 8 15.2M8 2.8 8 0.8" +
  "M11.68 11.68 13.09 13.09M4.32 11.68 2.91 13.09M4.32 4.32 2.91 2.91M11.68 4.32 13.09 2.91";
export const SUN_RAY_STROKE_WIDTH = 1.4;

/** 弱い側。光線を持たないコアだけの光源 */
export function LowBrightnessIcon(): ReactElement;

/** 強い側。同じコアに 8 本の光線が付いた光源 */
export function HighBrightnessIcon(): ReactElement;
```

両コンポーネントは次の `<svg>` を返す。`className` は共通の 1 つだけで、強弱でクラスを分けない(大きさも色も同じで、光線の有無だけが違う)。

```tsx
<svg className="light-gizmo__brightness-icon" viewBox={SUN_VIEW_BOX} aria-hidden="true" focusable="false">
  <circle cx={SUN_CORE_CX} cy={SUN_CORE_CY} r={SUN_CORE_RADIUS} fill="currentColor" />
  {/* HighBrightnessIcon だけが続けてこの path を描く */}
  <path
    d={SUN_RAYS}
    fill="none"
    stroke="currentColor"
    strokeWidth={SUN_RAY_STROKE_WIDTH}
    strokeLinecap="round"
  />
</svg>
```

`SUN_RAYS` の座標は中心 (8, 8) から算出済みで、変更してはならない。検算は次のとおり。

- 軸方向 4 本: `8 ± 5.2` = 13.2 / 2.8、`8 ± 7.2` = 15.2 / 0.8
- 斜め 4 本: `5.2 × cos45° = 3.677` → `8 ± 3.68` = 11.68 / 4.32、`7.2 × cos45° = 5.091` → `8 ± 5.09` = 13.09 / 2.91
- `strokeLinecap="round"` の丸い端は線幅の半分 0.7 だけ外へ出るが、最外 15.2 + 0.7 = 15.9、最内 0.8 − 0.7 = 0.1 で viewBox 16 に収まる

### web/src/features/viewer/light-gizmo.css(新規)

`viewer.css` の `.light-gizmo` 系 5 ルール(現 `viewer.css:233-278`)を**そのまま移設**したうえで、スライダー行を足す。移設するのは次の 5 つで、`.hud-hint` は HUD 側の規則なので移さない。

- `.light-gizmo`(position / right / bottom / width: 160px / height: 160px / border-radius。枠・背景・影・overflow は持たない)
- `.light-gizmo__stage`
- `.light-gizmo__stage:focus-visible`
- `.light-gizmo__reset`
- `.light-gizmo__reset svg`

`.light-gizmo__brightness` は、いま持っている `position` / `left` / `bottom` / `width: 100%` を新しい行ラッパへ譲り、自分は伸縮する要素になる。

```css
.light-gizmo__brightness-row {
  position: absolute;
  left: 0;
  bottom: calc(var(--space-3) * -1);
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.light-gizmo__brightness {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.light-gizmo__brightness-icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
}
```

160 − 14 × 2 − 4 × 2 = スライダー本体の幅は 124px になる。

### web/src/features/viewer/viewer.css

上の 5 ルールと `.light-gizmo__brightness` を削除する。`.hud-hint` の `right: calc(160px + var(--space-3) * 2)` を含む他のルールは一切変更しない。削除後 232 行になる見込み。

### web/src/features/viewer/LightGizmo.tsx

`export function LightGizmo(): ReactElement` のシグネチャ、ドラッグ／キー／リセットのハンドラ、`GizmoCamera` / `GizmoScene`、`.light-gizmo__stage` の `role="slider"` と aria 属性は**一切変更しない**。変更は次の 3 点だけ。

1. `import "./light-gizmo.css";` と `import { HighBrightnessIcon, LowBrightnessIcon } from "./light-icons";` を足す(`viewer.css` は `ViewerHud.tsx` が import し続ける。このタスクで `ViewerHud.tsx` は変更しない)。
2. `<input className="light-gizmo__brightness" …>` を行ラッパで包み、両端にアイコンを置く。`<input>` 自身の属性(`type` / `min` / `max` / `step` / `value` / `aria-label` / `aria-valuetext` / `title` / `onChange`)は現在のまま変えない。

```tsx
<div className="light-gizmo__brightness-row">
  <LowBrightnessIcon />
  <input
    className="light-gizmo__brightness"
    type="range"
    min={MIN_LIGHT_BRIGHTNESS}
    max={MAX_LIGHT_BRIGHTNESS}
    step={LIGHT_BRIGHTNESS_STEP}
    value={brightness}
    aria-label={LIGHT_BRIGHTNESS_LABEL}
    aria-valuetext={brightnessText(brightness)}
    title={LIGHT_BRIGHTNESS_LABEL}
    onChange={(event) => useLightingStore.getState().setBrightness(Number(event.currentTarget.value))}
  />
  <HighBrightnessIcon />
</div>
```

3. 行ラッパは `.light-gizmo` 直下の子として、`.light-gizmo__stage` と `.light-gizmo__reset` の間に置く。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| ライトギズモを表示する | スライダーの左端に光線なしのコアだけのアイコン、右端に光線 8 本付きのアイコンが出る。左が min 側(0.25)、右が max 側(4) |
| アイコンをスクリーンリーダーで読む | どちらも読み上げられない(`aria-hidden="true"`)。スライダーの読み上げは従来どおり「ライトの明るさ」と `×1.00` 形式の値 |
| アイコンをクリックする | 何も起きない。明るさは変わらず、フォーカスも移らない(`button` にも `tabIndex` 付き要素にもしない) |
| Tab でギズモへ入る | 従来どおり `.light-gizmo__stage` → スライダー → リセットボタンの順。アイコンはタブ順に現れない |
| スライダーを右へ動かす | 従来どおり 0.25 刻みで最大 4 まで明るくなる。同期・ストア・3D 側の挙動は一切変わらない |
| `SUN_RAYS` を `M` で分割する | 線分が 8 本ある |
| 各線分の始点の中心 (8, 8) からの距離 | `SUN_RAY_INNER_RADIUS`(5.2)に誤差 0.01 以内で一致する |
| 各線分の終点の中心 (8, 8) からの距離 | `SUN_RAY_OUTER_RADIUS`(7.2)に誤差 0.01 以内で一致する |
| `SUN_RAYS` に現れるすべての座標値 | 0.8 以上 15.2 以下(`viewBox` 16 の内側に収まる) |
| `LowBrightnessIcon` と `HighBrightnessIcon` のコア | どちらも `cx=8 cy=8 r=3.2` で同一。強弱でコアの大きさを変えない |
| `ruleBody(lightGizmoCssText, ".light-gizmo")` | `position` / `right` / `bottom` / `width: 160px` / `height: 160px` を持ち、`border` / `background` / `box-shadow` / `overflow` / `cursor: ew-resize` / `min-height: 0` のいずれも含まない(移設前と同じ判定が通る) |
| `viewer.css` の本文 | `.light-gizmo` という文字列を含まない。`.hud-hint` の `right: calc(160px + var(--space-3) * 2)` は残る |

## テスト

### web/tests/light-gizmo-styles.test.ts(新規)

`viewer-styles.test.ts` と同じ `ruleBody` / パス解決の書き出しを持ち、読むのは `features/viewer/light-gizmo.css` と `features/viewer/LightGizmo.tsx` と `features/viewer/viewer.css`。`viewer-styles.test.ts` から次の 4 件を**移設**する(判定内容は変えず、読む CSS を `light-gizmo.css` に差し替える)。

- `"removes the frame and surface styling from the light gizmo"`
- `"keeps the light gizmo positioned at its fixed size"`(`GIZMO_SIZE_PX` を `light-gizmo.ts` から import して突き合わせる)
- `"does not confuse light gizmo child selectors with the parent rule"`
- `"styles the light brightness slider with the theme accent"` — ただし `width: 100%` の検査は**行ラッパへ移った**ので、この 1 行を次に差し替える。

  ```ts
  const body = ruleBody(lightGizmoCssText, ".light-gizmo__brightness");
  expect(body).toContain("flex: 1 1 auto");
  expect(body).toContain("accent-color: var(--color-accent)");
  expect(body).toContain("cursor: pointer");
  expect(body).not.toContain("position: absolute");
  ```

そのうえで次を追加する。

```ts
it("lays the brightness slider out as a row between two icons", () => {
  const body = ruleBody(lightGizmoCssText, ".light-gizmo__brightness-row");

  expect(body).toContain("position: absolute");
  expect(body).toContain("bottom: calc(var(--space-3) * -1)");
  expect(body).toContain("width: 100%");
  expect(body).toContain("display: flex");
  expect(body).toContain("align-items: center");
  expect(body).toContain("gap: var(--space-1)");
});

it("sizes the brightness icons without letting them shrink", () => {
  const body = ruleBody(lightGizmoCssText, ".light-gizmo__brightness-icon");

  expect(body).toContain("flex: none");
  expect(body).toContain("width: 14px");
  expect(body).toContain("height: 14px");
  expect(body).toContain("color: var(--color-text-muted)");
});

it("moves the light gizmo rules out of viewer.css into their own sheet", () => {
  expect(viewerCssText).not.toContain(".light-gizmo");
  expect(lightGizmoText).toContain('import "./light-gizmo.css"');
});
```

### web/tests/viewer-styles.test.ts

上の 4 件を削除する。`"leaves enough room for the light gizmo beside the hint"` は `.hud-hint`(= `viewer.css`)の検査なので**残す**。そのため `GIZMO_SIZE_PX` の import も残す。他の検査は変更しない。削除後 235 行前後になる見込み。

### web/tests/light-gizmo.test.ts

既存の `"rotates only the gizmo cube mesh"` にあるソース検査へ次を足す(既存の `expect` はすべて残す)。

```ts
expect(source).toContain('className="light-gizmo__brightness-row"');
expect(source).toContain("<LowBrightnessIcon />");
expect(source).toContain("<HighBrightnessIcon />");
expect(source.indexOf("<LowBrightnessIcon />")).toBeLessThan(source.indexOf('type="range"'));
expect(source.indexOf("<HighBrightnessIcon />")).toBeGreaterThan(source.indexOf('type="range"'));
```

さらに、振る舞い表のアイコン形状の各行に対応する検査を追加する。`light-icons.tsx` から定数を import し、`SUN_RAYS` を自前でパースして検算する。

```ts
/** "M<x1> <y1> <x2> <y2>" の 8 本を [始点, 終点] の距離へ変換する */
function rayRadii(rays: string): Array<{ inner: number; outer: number; values: number[] }> { /* 実装する */ }
```

- 本数が 8 であること
- 各 `inner` が `SUN_RAY_INNER_RADIUS` と、各 `outer` が `SUN_RAY_OUTER_RADIUS` と 0.01 未満の差で一致すること。斜め 4 本は座標を小数第 2 位で丸めてあるため実際の差が 0.0043 あり、`toBeCloseTo(…, 2)`(許容 0.005)では余裕が無い。次のように差を直接比較する。

  ```ts
  expect(Math.abs(inner - SUN_RAY_INNER_RADIUS)).toBeLessThan(0.01);
  expect(Math.abs(outer - SUN_RAY_OUTER_RADIUS)).toBeLessThan(0.01);
  ```
- すべての座標値が 0.8 以上 15.2 以下であること
- `SUN_CORE_RADIUS` が 3.2、`SUN_VIEW_BOX` が `"0 0 16 16"` であること

`light-icons.tsx` のソースを読み、`LowBrightnessIcon` の本体が `SUN_RAYS` を参照しないこと(= 光線を描かないこと)と、両方が `aria-hidden="true"` を持つことも検査する。

追加で 135 行前後になる見込み。`light-gizmo.test.ts` が 300 行に近づいた場合は、アイコン形状の検査だけを `web/tests/light-icons.test.ts` へ分けてよい(その場合は `viewer_Summary.md` のテスト節にも追記すること)。

## Summary の更新

`web/src/features/viewer/viewer_Summary.md` を次のとおり直す。`summary-coverage.test.ts` がファイルの列挙を強制するため、追加漏れは即座に落ちる。

- ファイル一覧に `light-icons.tsx`(明るさスライダー両端の太陽アイコンと、その形状定数)と `light-gizmo.css`(ライトギズモと明るさスライダー行のプレーン CSS)を追加する
- `LightGizmo.tsx` の説明(:9 と :58)に、明るさスライダーを両端の強弱アイコンと同じ行に並べる旨を足す
- `viewer.css` の説明(:53)から「160px の枠を持たないライトギズモとテーマ色の明るさスライダー」を削除し、その記述を `light-gizmo.css` の行へ移す
- `:142` の「`LightGizmo` の range input は 0.25 刻みで 0.25〜4 倍を変更する」に、左端が最小・右端が最大であることをアイコンで示す旨を足す
- テスト節に `tests/light-gizmo-styles.test.ts` を追加し、`tests/viewer-styles.test.ts` の説明(:183)から「160px のライトギズモとヒントの退避幅、ライトギズモの枠廃止、明るさスライダーのテーマ色」のうちライトギズモ側の記述を外す(ヒントの退避幅は残る)
- `tests/light-gizmo.test.ts` の説明(:171)にアイコン形状の検査を足す

## やらないこと

- アイコンを `button` や `tabIndex` 付きの要素にしない。クリックやキーで明るさを変える機能は付けない。飾りに徹する(`aria-hidden="true"`)
- `MIN_LIGHT_BRIGHTNESS` / `MAX_LIGHT_BRIGHTNESS` / `LIGHT_BRIGHTNESS_STEP` の値、`brightnessText` の書式、`LIGHT_BRIGHTNESS_LABEL` の文言を変更しない。`hud-labels.ts` は変更しない
- `GIZMO_SIZE_PX`(160)をはじめ `light-gizmo.ts` の定数を変更しない。`.hud-hint` の退避幅も変更しない
- `shared` / `server` は変更しない。`SceneLights.tsx`、`useLightBrightnessBroadcast.ts`、`store/lighting.ts`、`app/realtime-dispatch.ts` も変更しない(同期とレンダリングの経路には触れない)
- `ViewerHud.tsx` を変更しない。`viewer.css` の import 元は `ViewerHud.tsx` のままで、`light-gizmo.css` だけを `LightGizmo.tsx` から import する
- 新しい CSS 変数やデザイントークンを `tokens.css` に足さない。既存の `--color-text-muted` / `--space-1` / `--space-3` / `--color-accent` を使う
- アイコンを画像ファイルやアイコンフォントで持ち込まない。インライン SVG で描く
- スライダーに目盛り(`<datalist>`)や数値ラベルを追加しない

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの export 名・定数値・クラス名になっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `viewer.css` から `.light-gizmo` 系のルールが消え、`light-gizmo.css` に移っている
- [ ] `viewer_Summary.md` に新規 3 ファイルとテストが記載されている
- [ ] すべてのファイルが 300 行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
