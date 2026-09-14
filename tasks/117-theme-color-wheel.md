---
id: 117
title: HSV の色相リングと彩度明度の四角を持つカラーホイール部品を作る
feature: theme
depends_on: [116]
owns: [web/src/features/theme/color-convert.ts, web/src/features/theme/color-wheel.ts, web/src/features/theme/ColorWheel.tsx, web/src/features/theme/theme_Summary.md, web/tests/color-convert.test.ts, web/tests/color-wheel.test.ts]
reads: [web/src/features/theme/viewer-colors.ts, web/src/features/viewer/viewer-pointer.ts, web/src/features/layout/ResizeHandle.tsx, web/tests/trail-bar.test.ts, web/tests/viewer-pointer.test.ts, web/src/features/annotation/AnnotationToolbar.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
Photoshop のように色を自由に選べる円形の UI を部品として作る。
外側に色相のリング、内側に彩度と明度の四角を置き、`"#rrggbb"` を受け取って
`"#rrggbb"` を返す制御部品にする。どの色に使うか・プリセットのパレット・保存は
すべて 118 の担当で、この部品は**色 1 つの入出力だけ**を受け持つ。

## 前提
- 115 の `web/src/features/theme/viewer-colors.ts` に `normalizeHex(value): string | null`、
  `hexToNumber(hex): number`、`numberToHex(value): string` がある。
  **同じ処理をこのタスクで作り直さず、そこから import して使う**
- 色の文字列は `"#rrggbb"` の小文字 7 文字に揃える(この部品が返す値もこの形)
- CSS は書かない。`theme.css` は 118 が作る。この部品は**契約に書いたクラス名を付けるだけ**で、
  CSS が無い状態でも壊れずに動く(位置は inline style の CSS 変数で渡す)
- D35 の決まりで、**データ由来の値だけ inline `style` に残し、CSS 変数として渡す**
  (前例: `web/src/features/annotation/AnnotationToolbar.tsx` の
  `style={{ "--stroke-color": strokeColor } as CSSProperties}`)。
  生の 16 進色を CSS ファイルへ書かない規約なので、色や座標は CSS 変数で渡す
- コンポーネントのテストは `react-dom/client` の `createRoot` と React の `act` で jsdom へ描く流儀。
  `web/tests/trail-bar.test.ts:1-60` が前例で、先頭に
  `Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });` を置く
- **jsdom の `HTMLCanvasElement.getContext("2d")` は `null` を返す**(canvas の実装が入っていない)。
  描画処理は `null` のとき黙って何もしないこと。そのためピクセルの見た目は
  コンポーネントではなく純粋関数 `renderWheelImage` のテストで検証する
- jsdom の `PointerEvent` と `setPointerCapture` は環境によって無い。
  **座標から色を決める処理はすべて純粋関数へ出し**、コンポーネント側は
  「イベントから座標を取り、純粋関数を呼び、結果が非 null なら `onChange` する」だけにする

## インターフェイス契約

### 新規 `web/src/features/theme/color-convert.ts`

```ts
/** h: 0 以上 360 未満、s / v: 0〜1 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** r / g / b: 0〜255 の整数 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 正規化できない値は { r: 0, g: 0, b: 0 } */
export function hexToRgb(hex: string): Rgb;
/** 各成分を 0〜255 に丸めて "#rrggbb" へ */
export function rgbToHex(rgb: Rgb): string;

/** 無彩色(s === 0)の h は 0 とする。正規化できない値は { h: 0, s: 0, v: 0 } */
export function hexToHsv(hex: string): Hsv;
/** h は 360 で正規化し、s / v は 0〜1 にクランプしてから変換する */
export function hsvToHex(hsv: Hsv): string;

/**
 * sRGB の相対輝度(WCAG の定義)。0〜1。
 * 各成分 c を 0〜1 にしてから c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 で線形化し、
 * 0.2126 * R + 0.7152 * G + 0.0722 * B を返す。
 */
export function relativeLuminance(hex: string): number;

/**
 * relativeLuminance が 0.179 未満なら true。スウォッチの上に置く印の色を決めるのに使う。
 * 0.179 は白い印と黒い印のコントラスト比がほぼ等しくなる境界
 * (sqrt(1.05 * 0.05) - 0.05 ≈ 0.179)。定数は `DARK_LUMINANCE_THRESHOLD = 0.179` として同ファイルに置く
 */
export function isDarkColor(hex: string): boolean;
export function isDarkColor(hex: string): boolean;
```

### 新規 `web/src/features/theme/color-wheel.ts`

canvas も React も触らない純粋関数だけを置く。

```ts
/** canvas の一辺(px)。正方形 */
export const WHEEL_SIZE = 176;
/** 色相リングの外半径 */
export const WHEEL_RING_OUTER = 88;
/** 色相リングの内半径 */
export const WHEEL_RING_INNER = 66;
/** 中央の彩度明度の四角の一辺。内半径の円に収まる大きさ */
export const WHEEL_SQUARE = 92;
/** 四角の左上の座標(= (WHEEL_SIZE - WHEEL_SQUARE) / 2) */
export const WHEEL_SQUARE_ORIGIN = 42;

/** canvas 座標 */
export interface WheelPoint {
  x: number;
  y: number;
}

/**
 * 中心から見た向きを色相(0 以上 360 未満)へ。
 * 真上を 0 とし、時計回りに増える(右が 90、下が 180、左が 270)。
 * 中心そのもの(dx === 0 かつ dy === 0)は 0。
 */
export function hueAtPoint(point: WheelPoint): number;

/** 色相をリングの中央(半径 (WHEEL_RING_OUTER + WHEEL_RING_INNER) / 2)上の canvas 座標へ */
export function pointAtHue(hue: number): WheelPoint;

/** 中心からの距離が内半径以上・外半径以下なら true */
export function isInRing(point: WheelPoint): boolean;

/** 四角の内側(境界を含む)なら true */
export function isInSquare(point: WheelPoint): boolean;

/** 左端で s=0、右端で s=1、上端で v=1、下端で v=0。範囲外は 0〜1 にクランプ */
export function saturationValueAtPoint(point: WheelPoint): { s: number; v: number };

/** 上の逆。s / v は 0〜1 にクランプしてから座標へ */
export function pointAtSaturationValue(s: number, v: number): WheelPoint;

/**
 * 押された座標と今の色から、新しい色を決める。
 * - リングの中: 今の s / v を保ったまま色相だけ差し替える。
 *   ただし今の色が無彩色(s === 0 または v === 0)のときは s = 1, v = 1 として純色にする
 *   (灰色のままだとリングを触っても色が変わらず、操作が効いていないように見えるため)
 * - 四角の中: 今の色相を保ったまま s / v を差し替える
 * - どちらでもない: null
 */
export function colorAtPoint(point: WheelPoint, hex: string): string | null;

/**
 * 色相 hue のときのホイール全体のピクセル。長さは WHEEL_SIZE * WHEEL_SIZE * 4 の RGBA。
 * - リングの中: その位置の色相の純色(s = 1, v = 1)、alpha 255
 * - 四角の中: 色相 hue で、位置から決まる s / v、alpha 255
 * - どちらでもない: 全成分 0(透明)
 * 四角がリングに重なることはない(WHEEL_SQUARE が内半径の円に収まる)。
 */
export function renderWheelImage(hue: number): Uint8ClampedArray;
```

### 新規 `web/src/features/theme/ColorWheel.tsx`

```ts
export interface ColorWheelProps {
  /** 今の色。"#rrggbb" */
  value: string;
  /** 操作されたときに新しい "#rrggbb" を返す */
  onChange: (hex: string) => void;
  /** 外枠に付ける aria-label。文言は呼び出し側(118)が持つ */
  label: string;
}

export function ColorWheel({ value, onChange, label }: ColorWheelProps): ReactElement;
```

描く DOM は次の形に固定する。

```
<div className="theme-wheel" role="group" aria-label={label}>
  <canvas className="theme-wheel__canvas" width={WHEEL_SIZE} height={WHEEL_SIZE} aria-hidden="true" />
  <i className="theme-wheel__marker theme-wheel__marker--hue" aria-hidden="true" style={...} />
  <i className="theme-wheel__marker theme-wheel__marker--sv" aria-hidden="true" style={...} />
</div>
```

- `hsv` は `hexToHsv(value)`
- **表示用の色相 `displayHue`**:hex だけでは無彩色(白・灰・黒)の色相が失われるため、
  部品内に `lastHueRef = useRef(0)` を持つ。描画のたびに
  `hsv.s > 0 && hsv.v > 0` なら `lastHueRef.current = hsv.h` とし、
  `displayHue = lastHueRef.current` とする(無彩色の間は直前の有彩色の色相を使い続ける。
  最初から無彩色なら 0)
- マーカーの `style` は `{ "--marker-x": `${x}px`, "--marker-y": `${y}px` } as CSSProperties`。
  hue のマーカーは `pointAtHue(displayHue)`、sv のマーカーは `pointAtSaturationValue(hsv.s, hsv.v)` の座標
- 描画は `useEffect` で行う。`canvas.getContext("2d")` が `null` なら**何もしない**。
  非 null のときは `context.createImageData(WHEEL_SIZE, WHEEL_SIZE)` を作り、
  その `data` へ `renderWheelImage(displayHue)` を `set` して `putImageData(image, 0, 0)` する。
  依存は `displayHue` のみ
- 操作は `onPointerDown` / `onPointerMove` を `<div className="theme-wheel">` に付ける。
  - 座標は `event.currentTarget.getBoundingClientRect()` から
    `{ x: event.clientX - rect.left, y: event.clientY - rect.top }` で求める
  - `onPointerDown`: 新しい色を次で決め、非 null なら `onChange` を呼び、
    `event.currentTarget.setPointerCapture?.(event.pointerId)` を試みる(無ければ呼ばない)。
    - `isInRing(point)`: `colorAtPoint(point, value)`
    - `isInSquare(point)`: `hsvToHex({ h: displayHue, ...saturationValueAtPoint(point) })`
      (`colorAtPoint` は value の色相を使うため、無彩色の value では色相 0 になってしまう。
      有彩色の value なら `colorAtPoint(point, value)` と同じ値になる)
    - どちらでもない: null(`onChange` を呼ばず、ドラッグも始めない)
  - さらに「今ドラッグ中か」を `useRef` に持ち、リング / 四角のどちらを掴んだかと、
    ドラッグ中に保つ値を覚える。**四角を掴んだときに保つ色相は `displayHue`**
    (決めた新しい色から `hexToHsv` で取り直さない。左上や下端を掴むと h が 0 になるため)。
    リングを掴んだときに保つ s / v は、決めた新しい色の `hexToHsv` の s / v
    (無彩色の value なら `colorAtPoint` が純色にするので s = 1, v = 1 になる)
  - `onPointerMove`: ドラッグ中でなければ何もしない。ドラッグ中は**掴んだ側だけ**を更新する
    (リングを掴んだまま四角へ入っても色相の変更を続ける)。
    そのため `colorAtPoint` ではなく `hueAtPoint` / `saturationValueAtPoint` を直接使い、
    座標がホイールの外へ出ても最後の値でクランプされた色を返す
  - `onPointerUp` / `onPointerCancel` でドラッグ中を解除し、`releasePointerCapture?.()` を試みる
- キーボード操作はこの部品では持たない(118 の hex 入力欄とパレットが代替手段になる)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `hexToRgb("#f97316")` | `{ r: 249, g: 115, b: 22 }` |
| `hexToRgb("#ABC")` | `{ r: 170, g: 187, b: 204 }` |
| `hexToRgb("bad")` | `{ r: 0, g: 0, b: 0 }` |
| `rgbToHex({ r: 249, g: 115, b: 22 })` | `"#f97316"` |
| `rgbToHex({ r: -5, g: 300, b: 12.6 })` | `"#00ff0d"` |
| `hexToHsv("#ff0000")` | `h` が 0、`s` が 1、`v` が 1 |
| `hexToHsv("#00ff00")` / `hexToHsv("#0000ff")` | `h` が 120 / 240 |
| `hexToHsv("#808080")` | `s` が 0、`h` が 0、`v` が約 0.502 |
| `hexToHsv("#000000")` | `{ h: 0, s: 0, v: 0 }` |
| `hexToHsv("bad")` | `{ h: 0, s: 0, v: 0 }` |
| `hsvToHex({ h: 0, s: 1, v: 1 })` | `"#ff0000"` |
| `hsvToHex({ h: 390, s: 1, v: 1 })` | `"#ff8000"`(360 で正規化して h=30) |
| `hsvToHex({ h: 0, s: -1, v: 2 })` | `"#ffffff"`(クランプ) |
| `hsvToHex(hexToHsv(hex))` を `#f97316` `#22d3ee` `#facc15` `#2563eb` `#000000` `#ffffff` で | 元の hex に戻る |
| `relativeLuminance("#ffffff")` / `("#000000")` | 1 / 0(誤差 1e-6 以内) |
| `isDarkColor("#101828")` / `("#f5f7fa")` | true / false |
| `isDarkColor("#f97316")` | false(輝度は約 0.3246) |
| `isDarkColor("#808080")` / `("#6b7280")` | false / true(輝度は約 0.216 / 約 0.167。閾値 0.179 の両側) |
| `hueAtPoint({ x: 88, y: 10 })` | 0(真上) |
| `hueAtPoint({ x: 166, y: 88 })` / `({ x: 88, y: 166 })` / `({ x: 10, y: 88 })` | 90 / 180 / 270 |
| `hueAtPoint({ x: 88, y: 88 })` | 0 |
| `hueAtPoint` の返り値 | 常に 0 以上 360 未満 |
| `pointAtHue(0)` | `{ x: 88, y: 88 - 77 }` |
| `pointAtHue(hueAtPoint(p))` を リング上の 8 点で | 元の点と距離 1e-6 以内(半径 77 上の点を使う) |
| `isInRing({ x: 88, y: 88 - 77 })` | true |
| `isInRing({ x: 88, y: 88 })` / `({ x: 0, y: 0 })` | false |
| `isInRing` 境界(距離ちょうど 66 と 88) | どちらも true |
| `isInSquare({ x: 88, y: 88 })` | true |
| `isInSquare({ x: 42, y: 42 })` / `({ x: 134, y: 134 })` | どちらも true(境界を含む) |
| `isInSquare({ x: 41, y: 88 })` | false |
| リングと四角の重なり | `isInRing` と `isInSquare` が同時に true になる点が無い(四角の 4 隅で確認) |
| `saturationValueAtPoint({ x: 42, y: 42 })` | `{ s: 0, v: 1 }` |
| `saturationValueAtPoint({ x: 134, y: 134 })` | `{ s: 1, v: 0 }` |
| `saturationValueAtPoint({ x: -100, y: 500 })` | `{ s: 0, v: 0 }`(クランプ) |
| `pointAtSaturationValue(0.5, 0.5)` | `{ x: 88, y: 88 }` |
| `pointAtSaturationValue` → `saturationValueAtPoint` の往復 | 誤差 1e-6 以内で戻る |
| `colorAtPoint(リング上の真上, "#22d3ee")` | 色相 0 で、s / v は `#22d3ee` のまま |
| `colorAtPoint(リング上の真上, "#808080")` | `"#ff0000"`(無彩色は純色にする) |
| `colorAtPoint(リング上の真上, "#000000")` | `"#ff0000"` |
| `colorAtPoint(四角の左上, "#22d3ee")` | `"#ffffff"`(s=0, v=1) |
| `colorAtPoint(四角の中心, "#22d3ee")` | 色相が `#22d3ee` と同じで、s / v が約 0.5 |
| `colorAtPoint({ x: 0, y: 0 }, "#22d3ee")` | `null`(リングでも四角でもない) |
| `renderWheelImage(0)` の長さ | `176 * 176 * 4` |
| `renderWheelImage(0)` の四隅のピクセル | alpha が 0 |
| `renderWheelImage(0)` のリング真上のピクセル | `#ff0000` 相当、alpha 255 |
| `renderWheelImage(120)` のリング真上のピクセル | `#ff0000` 相当(リングの色は引数の hue に依らない) |
| `renderWheelImage(120)` の四角の左上のピクセル | `#ffffff` 相当、alpha 255 |
| `renderWheelImage(120)` の四角の右上のピクセル | `#00ff00` 相当 |
| `renderWheelImage(120)` の四角の下端のピクセル | `#000000` 相当、alpha 255 |
| `ColorWheel` を描画(jsdom) | 例外にならず、`.theme-wheel` に `role="group"` と渡した `aria-label` が付く |
| `ColorWheel` の子 | `canvas.theme-wheel__canvas`(`width` / `height` が 176、`aria-hidden`)と マーカー 2 つ |
| `ColorWheel` の hue マーカーの style(有彩色の value) | `--marker-x` / `--marker-y` が `pointAtHue(hexToHsv(value).h)` の値(px つき) |
| 最初から `value="#ffffff"` で描画 | hue マーカーが `pointAtHue(0)` の位置 |
| `value="#f97316"` で描画 → `value="#ffffff"` で再描画 | hue マーカーが `pointAtHue(hexToHsv("#f97316").h)` の位置のまま |
| `value="#f97316"` → `"#ffffff"` と再描画した後、四角の中心 `{ x: 88, y: 88 }` で pointerdown | `onChange` が `hsvToHex({ h: hexToHsv("#f97316").h, s: 0.5, v: 0.5 })` で 1 回呼ばれる |
| `ColorWheel` の sv マーカーの style | `--marker-x` / `--marker-y` が `pointAtSaturationValue` の値(px つき) |
| `value` を変えて再描画 | マーカーの `--marker-x` / `--marker-y` が追従する |
| `getContext("2d")` が null | 例外にならず、マーカーは正しく描かれる |
| リング上で pointerdown | `onChange` が `colorAtPoint` と同じ値で 1 回呼ばれる |
| 四角の中で pointerdown | `onChange` が `colorAtPoint` と同じ値で 1 回呼ばれる |
| どちらでもない位置で pointerdown | `onChange` が呼ばれない |
| pointerdown せずに pointermove | `onChange` が呼ばれない |
| リングを掴んで四角の中へ pointermove | 色相だけが変わる(s / v は掴んだ時点のまま) |
| 四角を掴んでホイールの外へ pointermove | s / v がクランプされた値で `onChange` が呼ばれる |
| pointerup の後に pointermove | `onChange` が呼ばれない |
| `setPointerCapture` が未定義の環境 | 例外にならない |
| `value="#22d3ee"` で四角の左上 `{ x: 42, y: 42 }` を pointerdown → `value="#ffffff"` で再描画 → 四角の中心 `{ x: 88, y: 88 }` へ pointermove | pointerdown で `"#ffffff"`、pointermove で `hsvToHex({ h: hexToHsv("#22d3ee").h, s: 0.5, v: 0.5 })` が `onChange` に渡る(色相が失われない) |
| `value="#22d3ee"` で四角の下端 `{ x: 88, y: 134 }` を pointerdown → `value="#000000"` で再描画 → 四角の右上 `{ x: 134, y: 42 }` へ pointermove | pointermove で `hsvToHex({ h: hexToHsv("#22d3ee").h, s: 1, v: 1 })` が `onChange` に渡る |

## やらないこと
- **プリセットのパレット、hex の入力欄、どの色キーを編集するかの管理**。すべて 118 の担当
- **CSS**。`theme.css` は 118 が作る。この部品はクラス名と CSS 変数を出すだけで、
  `web/src/features/theme/` に CSS ファイルを追加しない
- theme ストア(`web/src/store/theme.ts`)の購読。この部品は props だけで動く制御部品にする
- `viewer-colors.ts` / `theme-mode.ts` / `theme-storage.ts` / `ThemeEffect.tsx` の変更
  (115 / 116 の成果物)。`normalizeHex` などは import して使う
- アルファ(不透明度)の編集。扱う色はすべて不透明な `"#rrggbb"` とする
- キーボードでの色操作。代替手段は 118 の hex 入力欄とパレットで用意する
- **`isDarkColor` の閾値を 0.3246 以上にしない**。`#f97316` の WCAG 輝度は約 0.3246 で、
  表は `isDarkColor("#f97316")` を false と要求している
  (出典: 旧版の閾値 0.35 がこの行と衝突し、`logs/117/loop1-2-review.md` で SPEC-UNSATISFIABLE)。
  閾値は契約の 0.179 から動かさない
- 色相の記憶を親へ出すこと(props に `hue` を足す、`onChange` に色相を渡す等)。
  色相の保持は `ColorWheel` 内の ref に閉じる。部品を作り直した(アンマウントした)ら記憶は消えてよい
- `colorAtPoint` の契約の変更。無彩色で色相を保つ処理は `ColorWheel.tsx` 側で行う

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `theme_Summary.md` に `color-convert.ts` / `color-wheel.ts` / `ColorWheel.tsx` を相対パスで、
      `tests/color-convert.test.ts` / `tests/color-wheel.test.ts` をファイル名で追記している
- [ ] `ColorWheel.tsx` が付けるクラス名(`theme-wheel`、`theme-wheel__canvas`、
      `theme-wheel__marker`、`theme-wheel__marker--hue`、`theme-wheel__marker--sv`)を
      `theme_Summary.md` に書き、118 が CSS を当てられるようにしている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
