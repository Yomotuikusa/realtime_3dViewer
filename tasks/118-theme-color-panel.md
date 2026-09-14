---
id: 118
title: プリセットのパレットと 3D ビュー 11 色の表示色パネルを作る
feature: theme
depends_on: [117]
owns: [web/src/features/theme/theme-palette.ts, web/src/features/theme/theme-labels.ts, web/src/features/theme/ColorPicker.tsx, web/src/features/theme/ThemeSettings.tsx, web/src/features/theme/theme.css, web/src/features/theme/theme_Summary.md, web/tests/theme-palette.test.ts, web/tests/theme-labels.test.ts, web/tests/theme-settings.test.ts, web/tests/theme-styles.test.ts]
reads: [web/src/features/theme/viewer-colors.ts, web/src/features/theme/theme-mode.ts, web/src/features/theme/color-convert.ts, web/src/features/theme/color-wheel.ts, web/src/features/theme/ColorWheel.tsx, web/src/store/theme.ts, web/src/features/shortcuts/ShortcutSettings.tsx, web/src/features/shortcuts/shortcuts.css, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/annotation/annotation.css, web/src/styles/controls.css, web/tests/trail-bar.test.ts, web/tests/outliner-styles.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
テーマ(ライト / ダーク / OS 追従)と 3D ビューの 11 色を、利用者が画面から変えられるようにする。
プリセット色のパレットと 117 のカラーホイール、16 進の直接入力の 3 通りで色を決められるようにし、
1 色ずつ・まとめて既定値へ戻せるようにする。設定ダイアログへの組み込みは 119 で行うので、
このタスクの成果物は**まだどの画面からも開けない**。

## 前提
- 115 の `viewer-colors.ts` に `ViewerColorKey`、`VIEWER_COLOR_ORDER`(11 キーの表示順)、
  `VIEWER_COLOR_DEFAULTS`、`normalizeHex` がある
- 115 の `web/src/store/theme.ts` に次がある。**このタスクではストアの中身を変えない**
  - `useThemeStore` の `mode` / `colors` / `setMode` / `setColor` / `resetColor` / `resetColors`
  - `selectResolvedTheme(state)` / `selectViewerColor(key)` / `selectViewerColors(state)`
  - `setColor` は正規化できない値を無視し、既定値と同値なら override を消す。
    つまり**入力の検証をパネル側で二重に持つ必要はない**が、16 進入力欄の表示だけは
    自前の draft state で扱う(下の契約参照)
- 115 の `theme-mode.ts` に `THEME_MODE_ORDER`(`["light", "dark", "system"]`)がある
- 117 の `ColorWheel` は `{ value, onChange, label }` だけを取る制御部品で、
  `theme-wheel` / `theme-wheel__canvas` / `theme-wheel__marker` /
  `theme-wheel__marker--hue` / `theme-wheel__marker--sv` のクラス名を出す。
  **これらの CSS はこのタスクの `theme.css` で当てる**。マーカーの位置は
  inline の `--marker-x` / `--marker-y`(px つき)で渡ってくるので、
  `.theme-wheel` を `position: relative`、マーカーを `position: absolute` にして
  `left: var(--marker-x)` / `top: var(--marker-y)` で置き、`transform: translate(-50%, -50%)` で中心を合わせる
- 117 の `color-convert.ts` に `isDarkColor(hex)` がある。
  任意の色のスウォッチの上に置く印(選択中のチェック)の色を決めるのに使う
- **D35**: 生の 16 進色は `tokens.css` 以外の**CSS ファイル**に書けない
  (`web/tests/styles-rules.test.ts` が `src/**/*.css` を走査する)。
  データ由来の色は inline `style` の CSS 変数で渡し、CSS 側は `var(--変数名, フォールバック)` で読む。
  前例は `web/src/features/annotation/AnnotationToolbar.tsx` の
  `style={{ "--stroke-color": strokeColor } as CSSProperties}` と `annotation.css` の `.annotation-color`
- **D35**: 状態はクラスの付け替えではなく `aria-pressed` / `aria-expanded` / `disabled` / `data-*` の
  属性セレクタで表現する
- **D36**: UI 文言は日本語で、JSX に直書きせず `*-labels.ts` に定数・純粋関数として置いてテストする
- 既存のダイアログ内パネルの前例は `web/src/features/shortcuts/ShortcutSettings.tsx`。
  そこでは行を `display: grid` の `.shortcut-row` で組み、`.btn btn--quiet` を並べている。
  `.btn` / `.input` / `.alert` / `.badge` は `web/src/styles/controls.css` の共通クラスなので**再定義しない**
- CSS を持つ機能フォルダには `<名前>-styles.test.ts` を置く流儀がある
  (`web/tests/outliner-styles.test.ts` が最も近い前例。CSS を文字列で読み、
  セレクタと宣言の存在を検査する)
- コンポーネントのテストは `createRoot` + `act` で jsdom へ描く流儀
  (`web/tests/trail-bar.test.ts:1-60`)。先頭で
  `Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });` を宣言する

## インターフェイス契約

### 新規 `web/src/features/theme/theme-palette.ts`

```ts
export interface PaletteSwatch {
  /** "#rrggbb" の小文字 */
  hex: string;
  /** 日本語の色名 */
  name: string;
}

/**
 * パレットに並べるプリセット色。9 列 × 3 行のグリッドとして左上から右へこの順に並べる。
 * 1 行目が明るい段、2 行目が標準、3 行目が暗い段。
 */
export const THEME_PALETTE: readonly PaletteSwatch[];

/** THEME_PALETTE を並べるときの 1 行の数 */
export const THEME_PALETTE_COLUMNS = 9;

/** 明るい色の上に置く印の色 */
export const SWATCH_MARK_DARK = "#101828";
/** 暗い色の上に置く印の色 */
export const SWATCH_MARK_LIGHT = "#ffffff";

/** isDarkColor(hex) なら SWATCH_MARK_LIGHT、そうでなければ SWATCH_MARK_DARK */
export function swatchMarkColor(hex: string): string;
```

`THEME_PALETTE` は次の 27 色をこの順で持つ。

| # | hex | name | # | hex | name | # | hex | name |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `#ffffff` | 白 | 10 | `#98a2b3` | 灰 | 19 | `#101828` | 墨 |
| 2 | `#d0d5dd` | 明るい灰 | 11 | `#667085` | 暗い灰 | 20 | `#000000` | 黒 |
| 3 | `#fca5a5` | 明るい赤 | 12 | `#dc2626` | 赤 | 21 | `#7f1d1d` | 暗い赤 |
| 4 | `#fdba74` | 明るい橙 | 13 | `#f97316` | 橙 | 22 | `#9a3412` | 暗い橙 |
| 5 | `#fde68a` | 明るい黄 | 14 | `#facc15` | 黄 | 23 | `#a16207` | 暗い黄 |
| 6 | `#86efac` | 明るい緑 | 15 | `#16a34a` | 緑 | 24 | `#14532d` | 暗い緑 |
| 7 | `#67e8f9` | 明るい水 | 16 | `#22d3ee` | 水 | 25 | `#0e7490` | 暗い水 |
| 8 | `#93c5fd` | 明るい青 | 17 | `#2563eb` | 青 | 26 | `#1e3a8a` | 暗い青 |
| 9 | `#d8b4fe` | 明るい紫 | 18 | `#9333ea` | 紫 | 27 | `#581c87` | 暗い紫 |

配列の順は 1 → 27(1〜9 が 1 行目、10〜18 が 2 行目、19〜27 が 3 行目)。

### 新規 `web/src/features/theme/theme-labels.ts`

```ts
/** パネルの見出し。タブ名にも使う */
export const THEME_SETTINGS_TITLE = "表示色";
export const THEME_SETTINGS_HELP: string;
/** テーマ選択の role="group" の aria-label */
export const THEME_MODE_LABEL = "テーマ";
/** テーマ 3 値のボタン名 */
export const THEME_MODE_LABELS: Readonly<Record<ThemeMode, string>>;
/** 11 色の一覧の role="group" の aria-label */
export const VIEWER_COLORS_LABEL = "3D ビューの色";
/** 色キーごとの表示名 */
export const VIEWER_COLOR_LABELS: Readonly<Record<ViewerColorKey, string>>;
export const PALETTE_LABEL = "パレット";
export const WHEEL_LABEL = "色相と明るさ";
export const HEX_INPUT_LABEL = "16 進の色";
export const RESET_COLORS_LABEL = "すべての色を既定に戻す";
export const RESET_COLOR_LABEL = "既定に戻す";

/** スウォッチのボタン名。開いているかで文言を変えない */
export function colorPickerLabel(colorName: string): string;
/** 変更済みの色の行に出す印の説明 */
export const CHANGED_LABEL = "変更済み";
```

`THEME_MODE_LABELS` は `{ light: "ライト", dark: "ダーク", system: "OS に合わせる" }`。

`VIEWER_COLOR_LABELS` は次のとおり。

| キー | 表示名 |
| --- | --- |
| `background` | 背景 |
| `selection` | 選択したオブジェクト |
| `wireframe` | ワイヤフレームの線 |
| `joint` | ボーンの関節 |
| `jointLink` | ボーンのつながり |
| `jointSelected` | 選択したボーン |
| `trailLine` | 軌跡の線 |
| `trailPoint` | 軌跡のフレーム点 |
| `trailCurrent` | 軌跡の現在位置 |
| `compareOutside` | 比較で外へずれた面 |
| `compareInside` | 比較で内へずれた面 |

`colorPickerLabel("選択したオブジェクト")` は `"選択したオブジェクトの色を選ぶ"` を返す。

`THEME_SETTINGS_HELP` は「色はこの端末にだけ保存され、他の参加者の画面は変わらない」ことが
分かる 1 文にする(設計書 §13.5 の例外である旨を利用者に伝える)。

### 新規 `web/src/features/theme/ColorPicker.tsx`

theme ストアを購読しない制御部品にする。

```ts
export interface ColorPickerProps {
  /** 今の色。"#rrggbb" */
  value: string;
  /** 新しい "#rrggbb" を返す。正規化は呼び出し側(ストア)が行う */
  onChange: (hex: string) => void;
  /** 外枠に付ける aria-label */
  label: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps): ReactElement;
```

```
<div className="theme-picker" role="group" aria-label={label}>
  <ColorWheel value={value} onChange={onChange} label={WHEEL_LABEL} />
  <div className="theme-palette" role="group" aria-label={PALETTE_LABEL}>
    {THEME_PALETTE.map(swatch => (
      <button
        className="theme-palette__swatch"
        type="button"
        aria-label={swatch.name}
        aria-pressed={swatch.hex === value}
        style={{ "--swatch-color": swatch.hex, "--swatch-mark": swatchMarkColor(swatch.hex) }}
        onClick={() => onChange(swatch.hex)}
      />
    ))}
  </div>
  <input
    className="input theme-picker__hex"
    type="text"
    aria-label={HEX_INPUT_LABEL}
    value={draft}
    onChange={...}
    onBlur={...}
    maxLength={7}
  />
</div>
```

16 進入力欄の挙動。

- 表示している文字列は `useState` の `draft`。初期値は `value`
- `props.value` が変わったら `draft` をその値へ合わせる
  (`useEffect` で `setDraft(value)`。利用者がホイールやパレットを触ったときに入力欄も追いつく)
- `onChange`(入力): `draft` を打たれたままの文字列で更新し、`normalizeHex(打たれた値)` が
  非 null ならその正規化後の値で `props.onChange` を呼ぶ。null のときは呼ばない
  (入力途中の `"#f9"` などで親を更新しない)
- `onBlur`: `normalizeHex(draft)` が null なら `draft` を `props.value` に戻す。
  非 null なら正規化後の値を `draft` に入れる

### 新規 `web/src/features/theme/ThemeSettings.tsx`

このタスクで唯一 theme ストアを購読する部品。

```ts
/** 設定ダイアログの「表示色」タブの中身。ダイアログの枠は持たない */
export function ThemeSettings(): ReactElement;
```

```
<div className="theme-settings">
  <p className="review-dialog__help">{THEME_SETTINGS_HELP}</p>

  <div className="theme-modes" role="group" aria-label={THEME_MODE_LABEL}>
    {THEME_MODE_ORDER.map(mode => (
      <button className="btn btn--quiet" type="button" aria-pressed={mode === current}
        onClick={() => useThemeStore.getState().setMode(mode)}>
        {THEME_MODE_LABELS[mode]}
      </button>
    ))}
  </div>

  <div className="theme-colors" role="group" aria-label={VIEWER_COLORS_LABEL}>
    {VIEWER_COLOR_ORDER.map(key => 行と、開いていれば ColorPicker)}
  </div>

  <div className="theme-settings__footer">
    <button className="btn btn--quiet" type="button" disabled={変更が 0 件}
      onClick={() => useThemeStore.getState().resetColors()}>
      {RESET_COLORS_LABEL}
    </button>
  </div>
</div>
```

1 色の行。

```
<div className="theme-color-row" data-changed={変更済みなら "true" を付ける(未変更なら属性を出さない)}>
  <span className="theme-color-row__name">{VIEWER_COLOR_LABELS[key]}</span>
  <button
    className="theme-swatch"
    type="button"
    aria-label={colorPickerLabel(VIEWER_COLOR_LABELS[key])}
    aria-expanded={openKey === key}
    style={{ "--swatch-color": hex, "--swatch-mark": swatchMarkColor(hex) }}
    onClick={() => setOpenKey(openKey === key ? null : key)}
  />
  <span className="theme-color-row__hex">{hex}</span>
  <button className="btn btn--quiet" type="button" disabled={未変更}
    onClick={() => useThemeStore.getState().resetColor(key)}>
    {RESET_COLOR_LABEL}
  </button>
</div>
```

- `hex` は `selectViewerColor(key)` で購読した実効色
- 「変更済み」は `useThemeStore` の `colors` にそのキーがあるかどうか
- `openKey` は `useState<ViewerColorKey | null>(null)`。**同時に開くのは 1 つだけ**
- 開いている行の**直後**に `<ColorPicker value={hex} onChange={hex => setColor(key, hex)}
  label={colorPickerLabel(VIEWER_COLOR_LABELS[key])} />` を置く
- 行と ColorPicker は同じ `key={key}` のフラグメントにまとめてよい

### 新規 `web/src/features/theme/theme.css`

`ThemeSettings.tsx` が import する。次のセレクタを持つ。

- `.theme-settings`(縦並び、`gap: var(--space-3)`)
- `.theme-modes`(横並び)
- `.theme-colors` / `.theme-color-row`(`display: grid`、`grid-template-columns: 1fr auto auto auto`)
- `.theme-color-row__name` / `.theme-color-row__hex`(等幅、`white-space: nowrap`)
- `.theme-color-row[data-changed="true"] .theme-color-row__name`(変更済みを太字などで示す)
- `.theme-swatch` / `.theme-palette__swatch`(色は `background: var(--swatch-color, transparent)`、
  枠は `var(--color-border)`)
- `.theme-palette`(`display: grid`、`grid-template-columns: repeat(9, 1fr)`)
- `.theme-palette__swatch[aria-pressed="true"]`(選択中を `var(--swatch-mark, transparent)` の
  内側の枠 = `box-shadow: inset` などで示す)
- `.theme-picker`(縦並び)
- `.theme-wheel`(`position: relative`、`width` / `height` を 176px)
- `.theme-wheel__canvas`(`display: block`)
- `.theme-wheel__marker`(`position: absolute`、`left: var(--marker-x, 0)`、`top: var(--marker-y, 0)`、
  `transform: translate(-50%, -50%)`、`pointer-events: none`)
- `.theme-wheel__marker--hue` / `.theme-wheel__marker--sv`(大きさの違い)

**生の 16 進色・`rgb()` / `rgba()` / `hsl()` を書かない。`!important` を書かない。`@import` を書かない。**

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `THEME_PALETTE` | 長さ 27、hex に重複なし、全 hex が `/^#[0-9a-f]{6}$/`、全 name が空でない日本語 |
| `THEME_PALETTE` の name | 重複なし |
| `THEME_PALETTE` の並び | 表のとおり(先頭が `#ffffff`、10 番目が `#98a2b3`、19 番目が `#101828`、末尾が `#581c87`) |
| `THEME_PALETTE_COLUMNS` | 9。`THEME_PALETTE.length % THEME_PALETTE_COLUMNS === 0` |
| `swatchMarkColor("#000000")` / `("#ffffff")` | `SWATCH_MARK_LIGHT` / `SWATCH_MARK_DARK` |
| `VIEWER_COLOR_LABELS` | `VIEWER_COLOR_ORDER` の全 11 キーを持ち、値は空でなく重複しない |
| `THEME_MODE_LABELS` | `THEME_MODE_ORDER` の全 3 値を持ち、値は空でない |
| `THEME_SETTINGS_HELP` | 空でなく、「この端末」に相当する語を含む |
| `colorPickerLabel("背景")` | `"背景の色を選ぶ"` |
| 各ラベル定数 | 空文字でなく、日本語を含む |
| `ColorPicker` を描画 | `.theme-picker` に `role="group"` と渡した `aria-label` が付く |
| `ColorPicker` の子 | `ColorWheel`(`.theme-wheel`)、`.theme-palette`(子が 27 個)、`.theme-picker__hex` |
| パレットの各ボタン | `aria-label` が色名、`style` の `--swatch-color` が hex、`--swatch-mark` が `swatchMarkColor(hex)` |
| `value` と同じ hex のパレットボタン | `aria-pressed="true"`。他は `"false"` |
| パレットのボタンを click | `onChange` がその hex で 1 回呼ばれる |
| hex 入力欄の初期値 | `value` と同じ |
| hex 入力欄に `"#ff0000"` を入力 | `onChange` が `"#ff0000"` で呼ばれ、欄の表示も `"#ff0000"` |
| hex 入力欄に `"#FF0000"` を入力 | `onChange` が `"#ff0000"`(正規化後)で呼ばれ、欄の表示は打った `"#FF0000"` のまま |
| hex 入力欄に `"#f9"` を入力 | `onChange` が呼ばれず、欄の表示は `"#f9"` |
| `"#f9"` のまま blur | 欄の表示が `value` に戻る |
| `"#ABC"` を入力して blur | 欄の表示が `"#aabbcc"` |
| `value` を外から変更 | hex 入力欄の表示が新しい `value` に追従する |
| `ThemeSettings` を描画 | `.theme-settings` の中に `.theme-modes`(ボタン 3 個)と `.theme-colors`(行 11 個)がある |
| テーマのボタン | `mode` と一致するものだけ `aria-pressed="true"` |
| テーマのボタンを click | `useThemeStore` の `mode` がその値になる |
| 各色の行 | `.theme-color-row__name` が `VIEWER_COLOR_LABELS[key]`、`.theme-color-row__hex` が実効色 |
| 行の順 | `VIEWER_COLOR_ORDER` と同じ |
| 初期状態 | `ColorPicker`(`.theme-picker`)がどこにも無い |
| スウォッチを click | その行の直後に `.theme-picker` が 1 つだけ現れ、`aria-expanded="true"` になる |
| 別の行のスウォッチを click | 前の `.theme-picker` が消え、新しい行の直後に 1 つだけ現れる |
| 開いている行のスウォッチを再 click | `.theme-picker` が消える |
| 開いた `ColorPicker` でパレットを click | `useThemeStore` の `colors[key]` がその hex になり、行の hex 表示も変わる |
| override があるキーの行 | `data-changed="true"` が付き、「既定に戻す」ボタンが有効 |
| override がないキーの行 | `data-changed` 属性が無く、「既定に戻す」ボタンが `disabled` |
| 行の「既定に戻す」を click | そのキーの override が消え、他のキーの override は残る |
| override が 0 件のとき | フッタの「すべての色を既定に戻す」が `disabled` |
| override が 1 件以上のとき | フッタのボタンが有効。click で `colors` が空になる |
| `mode` を dark にしたとき | override のないキーの hex 表示が dark の既定値に変わる |
| スウォッチの `style` | `--swatch-color` が実効色、`--swatch-mark` が `swatchMarkColor(実効色)` |
| `theme.css` | 契約に挙げた全セレクタを含む |
| `theme.css` | 生の 16 進色・`rgb(` / `rgba(` / `hsl(` / `!important` / `@import` を含まない |
| `theme.css` | `.btn` / `.input` / `.alert` / `.badge` を再定義していない |
| `theme.css` の `.theme-palette` | `grid-template-columns: repeat(9, 1fr)` を含む(`THEME_PALETTE_COLUMNS` と一致) |
| `theme.css` の `.theme-wheel` | `position: relative` と 176px の大きさを含む |
| `ThemeSettings.tsx` のソース | 日本語の文言を直書きしていない(`theme-labels.ts` 由来の定数だけを使う) |

## やらないこと
- **設定ダイアログへの組み込み**。`ShortcutSettings.tsx` / `ReviewPage.tsx` / `ReviewHeader.tsx` /
  `review.css` は変更しない(119 の担当)。このタスクの `ThemeSettings` は
  **ダイアログの枠(`review-backdrop` / `review-dialog` / 閉じるボタン)を持たない**中身だけの部品にする
- **3D への色の適用**。`outliner/` `joint/` `trail/` `viewer/` `compare/` は変更しない(120〜122 の担当)。
  このタスクで色を変えても 3D の見た目はまだ変わらない(値がストアに入るところまでを作る)
- `web/src/store/theme.ts` / `viewer-colors.ts` / `theme-mode.ts` / `theme-storage.ts` /
  `ThemeEffect.tsx` / `ColorWheel.tsx` / `color-wheel.ts` / `color-convert.ts` の変更
  (115〜117 の成果物。import して使うだけ)
- `web/src/styles/` の変更。`.btn` / `.input` は共通クラスをそのまま使う
- アルファ(不透明度)・グラデーション・色の書き出し / 読み込み(エクスポート)機能
- パレットの利用者による編集(プリセットの追加・削除)。プリセットは固定とする
- キーボードでホイールを操作する仕組み。代替手段は 16 進入力欄とパレットのボタンで足りる

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `theme_Summary.md` に `theme-palette.ts` / `theme-labels.ts` / `ColorPicker.tsx` /
      `ThemeSettings.tsx` / `theme.css` を相対パスで、テスト 4 本をファイル名で追記している
- [ ] `theme_Summary.md` に「`ThemeSettings` はダイアログの枠を持たない中身の部品で、
      119 が設定ダイアログのタブとして使う」ことを書いている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
