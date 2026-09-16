# theme

## 目的

UI テーマの選択状態と、3D ビューの 11 種類の表示色を定義・正規化・永続化する。テーマと色は端末ローカル設定として扱い、WebSocket には送信しない。

## ファイル一覧と役割

- theme-mode.ts: light / dark / system のテーマ型、表示順、既定値、OS の配色設定の読み取りと system の解決
- viewer-colors.ts: 3D ビューの色キー、light / dark の既定色、16 進色の正規化・入力最大長 `HEX_INPUT_MAX_LENGTH`・数値変換、実効色の解決
- color-convert.ts: 16 進色と RGB / HSV の変換、相対輝度、`DARK_LUMINANCE_THRESHOLD` による暗色判定
- color-wheel.ts: 色相リングと彩度明度四角の座標計算、色決定、canvas 用 RGBA 画像生成
- ColorWheel.tsx: 色相リングと彩度明度四角を操作する props 駆動の React 部品
- theme-palette.ts: 9 列 3 行の固定パレットとスウォッチ上の印の色
- theme-labels.ts: 表示色設定パネルの日本語ラベルと aria-label 生成関数
- ColorPicker.tsx: カラーホイール、固定パレット、`HEX_INPUT_MAX_LENGTH` による上限付きの16 進入力をまとめた制御部品
- ThemeSettings.tsx: テーマ選択と 3D ビュー 11 色の変更・リセットを行う設定パネル本体
- theme.css: 表示色設定パネル、パレット、カラーホイールのレイアウトと状態表示
- theme-storage.ts: `localStorage` の `3dreviewer:theme` へのテーマ設定の読み書きと保存値の検証
- ThemeEffect.tsx: テーマストアの実効テーマを `documentElement` の `data-theme` 属性へ反映し、OS の配色変更を購読する描画なしの副作用部品

## 公開インターフェイス

- theme-mode.ts: `ThemeMode`、`ResolvedThemeMode`、`THEME_MODE_ORDER`、`DEFAULT_THEME_MODE`、`isThemeMode`、`resolveThemeMode`、`prefersDarkScheme`
- viewer-colors.ts: `ViewerColorKey`、`VIEWER_COLOR_ORDER`、`ViewerColorOverrides`、`ViewerColors`、`VIEWER_COLOR_DEFAULTS`、`HEX_INPUT_MAX_LENGTH`、`normalizeHex`、`hexToNumber`、`numberToHex`、`resolveViewerColor`、`resolveViewerColors`
- color-convert.ts: `Hsv`、`Rgb`、`DARK_LUMINANCE_THRESHOLD`、`hexToRgb`、`rgbToHex`、`hexToHsv`、`hsvToHex`、`relativeLuminance`、`isDarkColor`
- color-wheel.ts: `WHEEL_SIZE`、`WHEEL_RING_OUTER`、`WHEEL_RING_INNER`、`WHEEL_SQUARE`、`WHEEL_SQUARE_ORIGIN`、`WheelPoint`、`hueAtPoint`、`pointAtHue`、`isInRing`、`isInSquare`、`saturationValueAtPoint`、`pointAtSaturationValue`、`colorAtPoint`、`renderWheelImage`
- ColorWheel.tsx: `ColorWheelProps`、`ColorWheel`; DOM クラスは `theme-wheel`、`theme-wheel__canvas`、`theme-wheel__marker`、`theme-wheel__marker--hue`、`theme-wheel__marker--sv`
- theme-storage.ts: `THEME_STORAGE_KEY`、`StoredTheme`、`loadTheme`、`saveTheme`
- ThemeEffect.tsx: `ThemeEffect()`
- theme-palette.ts: `PaletteSwatch`、`THEME_PALETTE`、`THEME_PALETTE_COLUMNS`、`SWATCH_MARK_DARK`、`SWATCH_MARK_LIGHT`、`swatchMarkColor`
- theme-labels.ts: 表示色設定のラベル定数、`colorPickerLabel`
- ColorPicker.tsx: `ColorPickerProps`、`ColorPicker`
- ThemeSettings.tsx: `ThemeSettings()`

## 他フォルダとの関係

`../../store/theme.ts` がこのフォルダの型・値・永続化関数を利用する。既存の viewer、outliner、joint、trail、compare の色定数とは light の既定値を一致させるが、3D への適用は後続タスクが担当する。端末ローカル設定のため `../../app/review-stores.ts` の reset 対象外であり、共有プロトコルや server とは接続しない。

`ThemeSettings` はダイアログの枠を持たない中身の部品で、119 が設定ダイアログのタブとして使う。このタスクではどの画面からも直接開かない。

## テスト

- theme-mode.test.ts: テーマ型の検証、system 解決、matchMedia の未定義・成功・例外
- viewer-colors.test.ts: 色キーと既定値、既存定数との一致、正規化・数値変換・実効色解決、16 進入力上限の定数と ColorPicker の参照
- theme-storage.test.ts: 保存値の検証、既定値へのフォールバック、正規化、localStorage 例外、往復保存
- color-convert.test.ts: RGB / HSV 変換、相対輝度、暗色判定
- color-wheel.test.ts: ホイール座標、色決定、RGBA 画像、React 部品の DOM とポインター操作
- theme-palette.test.ts: 固定パレットの順序・一意性・スウォッチ印の色
- theme-labels.test.ts: 表示色設定のラベル、キー網羅、端末ローカルヘルプ
- theme-components.test.ts: `ColorPicker` と `ThemeSettings` の DOM、入力、開閉、ストア更新とリセット
- theme-styles.test.ts: 表示色設定 CSS のレイアウト、属性状態、固定色禁止
- store-theme.test.ts: テーマストアの初期値、同値更新抑止、色 override と reset、セレクタ、レビュー reset 非対象
- tests/theme-effect.test.ts: `data-theme` の反映、matchMedia の初期値・変更購読・例外、App の全ルートへの配置
