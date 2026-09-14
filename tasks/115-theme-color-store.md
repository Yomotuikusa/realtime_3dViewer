---
id: 115
title: 3D ビューの表示色とテーマの基盤(色キー・既定値・永続化・ストア)を作る
feature: theme
depends_on: []
owns: [web/src/features/theme/viewer-colors.ts, web/src/features/theme/theme-mode.ts, web/src/features/theme/theme-storage.ts, web/src/features/theme/theme_Summary.md, web/src/store/theme.ts, web/src/store/store_Summary.md, web/web_Summary.md, web/tests/viewer-colors.test.ts, web/tests/theme-mode.test.ts, web/tests/theme-storage.test.ts, web/tests/store-theme.test.ts]
reads: [web/src/store/shortcuts.ts, web/src/features/shortcuts/keymap-storage.ts, web/src/features/shortcuts/keymap.ts, web/src/store/display.ts, web/src/app/review-stores.ts, web/src/features/outliner/selection-highlight.ts, web/src/features/joint/joint-display.ts, web/src/features/joint/joint-highlight.ts, web/src/features/trail/trail-overlay.ts, web/src/features/viewer/mesh-display.ts, web/src/features/compare/overlay.ts, web/tests/keymap-storage.test.ts, web/tests/store-shortcuts.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
3D ビュー上の色(選択・ボーン・軌跡・背景など 11 個)と UI テーマ(ライト / ダーク / OS 追従)を
利用者が変えられるようにするための土台を置く。このタスクは**状態と値の定義だけ**を作り、
3D への適用(120〜122)・ダークの CSS(116)・設定 UI(117〜119)はすべて後続タスクで行う。

## 前提
- 設計書 §13.5 の表に**ローカル(端末)**の行があり、そこに「UI テーマと 3D ビューの色設定」が
  2026-09-13 に追記された。**この機能は WebSocket に流さない**。`shared/src/protocol.ts`、
  `server/`、`web/src/app/realtime-dispatch.ts` は一切変更しない
- 同じ「localStorage に持つ端末ローカル設定」の完成した前例が `features/shortcuts` にある。
  - `web/src/features/shortcuts/keymap-storage.ts`: `try` で囲んで読み、壊れていたら既定値、
    書き込みの例外は握って何もしない(private browsing 対策のコメントつき)
  - `web/src/store/shortcuts.ts`: 初期値は `loadKeymap()`、変更する action の中で
    `set` の直後に `saveKeymap(next)` を呼ぶ
  - このストアは `web/src/app/review-stores.ts` の `resetReviewStores()` の対象に**入っていない**。
    theme ストアも同じく入れない(このタスクでは `review-stores.ts` を変更しない)
- 色の文字列表現は既存の annotation ストアと同じ **`"#rrggbb"` の小文字 7 文字**に揃える
  (`web/src/store/annotation.ts` の `setColor` が同じ正規化をしている)
- three.js の material の `color` には数値(`0xrrggbb`)を渡すのが既存コードの流儀なので、
  変換関数をこのタスクで用意する。実際に渡す側の変更は 120〜122 で行う
- **現在の色はすべて各機能フォルダのモジュール定数**である。値は次のとおりで、
  このタスクで作る `VIEWER_COLOR_DEFAULTS.light` は**この値と一致しなければならない**。

  | 色キー | 現在の定数 | 場所 |
  | --- | --- | --- |
  | `background` | `"#f5f7fa"` | `web/src/features/viewer/ViewerCanvas.tsx:32`(定数ではなく JSX の直値) |
  | `selection` | `SELECTION_COLOR = 0xf97316` | `web/src/features/outliner/selection-highlight.ts:19` |
  | `wireframe` | `WIREFRAME_OVERLAY_COLOR = 0x1f2937` | `web/src/features/viewer/mesh-display.ts:9` |
  | `joint` | `JOINT_COLOR = 0x22d3ee` | `web/src/features/joint/joint-display.ts:22` |
  | `jointLink` | `JOINT_LINK_COLOR = 0x0e7490` | `web/src/features/joint/joint-display.ts:24` |
  | `jointSelected` | `SELECTED_JOINT_COLOR = 0xf97316` | `web/src/features/joint/joint-highlight.ts:8` |
  | `trailLine` | `TRAIL_LINE_COLOR = 0xfacc15` | `web/src/features/trail/trail-overlay.ts:20` |
  | `trailPoint` | `TRAIL_POINT_COLOR = 0xfef3c7` | `web/src/features/trail/trail-overlay.ts:22` |
  | `trailCurrent` | `TRAIL_CURRENT_COLOR = 0xf97316` | `web/src/features/trail/trail-overlay.ts:24` |
  | `compareOutside` | `COMPARE_OUTSIDE_COLOR = 0xdc2626` | `web/src/features/compare/overlay.ts:15` |
  | `compareInside` | `COMPARE_INSIDE_COLOR = 0x2563eb` | `web/src/features/compare/overlay.ts:17` |

- `web/tests/summary-coverage.test.ts` が Summary を機械検証する。新しいフォルダを作るので
  次の 3 つを満たす必要がある。
  1. `web/src/features/theme/theme_Summary.md` を作り、**同フォルダの全ソースを相対パスで**載せる
     (`viewer-colors.ts` のように、Summary から見た相対パスの文字列がそのまま含まれること)
  2. 新しいテスト 4 本のファイル名を、そのフォルダの Summary の `## テスト` 節に載せる
  3. `web/web_Summary.md` の Summary 一覧に `src/features/theme/theme_Summary.md` の行を足す
- 節構成は `web/web_Summary.md` が定める
  `# <フォルダ名>` / `## 目的` / `## ファイル一覧と役割` / `## 公開インターフェイス` /
  `## 他フォルダとの関係` / `## テスト` に従う

## インターフェイス契約

### 新規 `web/src/features/theme/theme-mode.ts`

```ts
/** 利用者が選べるテーマ。system は OS の設定に従う */
export type ThemeMode = "light" | "dark" | "system";
/** 実際に適用されるテーマ。system を解決した結果 */
export type ResolvedThemeMode = "light" | "dark";

/** 設定画面に並べる順。3 値をこの順で含む */
export const THEME_MODE_ORDER: readonly ThemeMode[] = ["light", "dark", "system"];
/** 初期値。OS 追従 */
export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function isThemeMode(value: unknown): value is ThemeMode;

/** system のときだけ prefersDark を見る。light / dark はそのまま返す */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedThemeMode;

/**
 * OS がダークを好むか。`window.matchMedia` が無い環境(テストの jsdom を含む)では false。
 * 例外が出た場合も false を返す。
 */
export function prefersDarkScheme(): boolean;
```

### 新規 `web/src/features/theme/viewer-colors.ts`

`theme-mode.ts` の型を import する(逆向きの import はしない)。

```ts
/** 3D ビュー上で色を変えられる対象 */
export type ViewerColorKey =
  | "background"
  | "selection"
  | "wireframe"
  | "joint"
  | "jointLink"
  | "jointSelected"
  | "trailLine"
  | "trailPoint"
  | "trailCurrent"
  | "compareOutside"
  | "compareInside";

/** 設定画面に並べる順。11 キーを重複なく含む */
export const VIEWER_COLOR_ORDER: readonly ViewerColorKey[];

/** 既定値からの差分。値は "#rrggbb" */
export type ViewerColorOverrides = Readonly<Partial<Record<ViewerColorKey, string>>>;
/** 全キーの実効色 */
export type ViewerColors = Readonly<Record<ViewerColorKey, string>>;

/** テーマごとの既定色。値は "#rrggbb" の小文字 7 文字 */
export const VIEWER_COLOR_DEFAULTS: Readonly<Record<ResolvedThemeMode, ViewerColors>>;

/**
 * "#RRGGBB" / "#rgb" / 先頭 # なし / 前後の空白つきを "#rrggbb" へ正規化する。
 * 16 進 3 桁または 6 桁として読めなければ null。
 */
export function normalizeHex(value: string): string | null;

/** "#rrggbb" を three の material へ渡す 0xrrggbb の数値へ。正規化できない値は 0x000000 */
export function hexToNumber(hex: string): number;

/** 0x000000〜0xffffff を "#rrggbb" へ。範囲外は近い端へ丸め、非整数は四捨五入、NaN は "#000000" */
export function numberToHex(value: number): string;

/** overrides にキーがあればその値、無ければ mode の既定値 */
export function resolveViewerColor(
  mode: ResolvedThemeMode,
  overrides: ViewerColorOverrides,
  key: ViewerColorKey,
): string;

/** 11 キーすべての実効色 */
export function resolveViewerColors(
  mode: ResolvedThemeMode,
  overrides: ViewerColorOverrides,
): ViewerColors;
```

`VIEWER_COLOR_DEFAULTS` の値はこの表のとおりとする。

| キー | light | dark |
| --- | --- | --- |
| `background` | `#f5f7fa` | `#14171f` |
| `selection` | `#f97316` | `#fb923c` |
| `wireframe` | `#1f2937` | `#cbd5e1` |
| `joint` | `#22d3ee` | `#22d3ee` |
| `jointLink` | `#0e7490` | `#38bdf8` |
| `jointSelected` | `#f97316` | `#fb923c` |
| `trailLine` | `#facc15` | `#facc15` |
| `trailPoint` | `#fef3c7` | `#fde68a` |
| `trailCurrent` | `#f97316` | `#fb923c` |
| `compareOutside` | `#dc2626` | `#f87171` |
| `compareInside` | `#2563eb` | `#60a5fa` |

### 新規 `web/src/features/theme/theme-storage.ts`

```ts
export const THEME_STORAGE_KEY = "3dreviewer:theme";

export interface StoredTheme {
  mode: ThemeMode;
  colors: ViewerColorOverrides;
}

/** 読めない・壊れている・型が合わないときは既定値へ落とす。例外は投げない */
export function loadTheme(): StoredTheme;

/** localStorage が使えない環境では何もしない(例外を投げない) */
export function saveTheme(theme: StoredTheme): void;
```

`loadTheme` の復元規則。

- 保存値が無い / JSON として壊れている / オブジェクトでない / 配列 →
  `{ mode: DEFAULT_THEME_MODE, colors: {} }`
- `mode` が `isThemeMode` を満たさない → `DEFAULT_THEME_MODE`
- `colors` がオブジェクトでない → `{}`
- `colors` の各エントリは、キーが `VIEWER_COLOR_ORDER` に含まれ、かつ値が文字列で
  `normalizeHex` が非 null のものだけ採用し、**正規化後の値**を入れる。
  それ以外のエントリは黙って捨てる

### 新規 `web/src/store/theme.ts`

`web/src/store/shortcuts.ts` と同じ形で、初期値を `loadTheme()` から作り、
値を変える action の中で `set` の直後に `saveTheme` を呼ぶ。

```ts
export interface ThemeStoreState {
  /** 利用者の選択。初期値は localStorage の値、無ければ DEFAULT_THEME_MODE */
  mode: ThemeMode;
  /** OS がダークを好むか。初期値は prefersDarkScheme() */
  prefersDark: boolean;
  /** 既定値から変えた色だけを持つ。初期値は localStorage の値、無ければ {} */
  colors: ViewerColorOverrides;
  /** 同値なら state を更新せず保存もしない */
  setMode(mode: ThemeMode): void;
  /** 同値なら state を更新しない。OS 由来なので保存はしない */
  setPrefersDark(prefersDark: boolean): void;
  /**
   * normalizeHex が null を返す値は何もしない。
   * 正規化後の値が現在の実効テーマの既定値と同じなら override を削除する(= resetColor と同じ結果)。
   * 実効色が変わらないときは state を更新せず保存もしない。
   */
  setColor(key: ViewerColorKey, hex: string): void;
  /** そのキーの override を消す。もともと無ければ state を更新せず保存もしない */
  resetColor(key: ViewerColorKey): void;
  /** 全 override を消す。もともと空なら state を更新せず保存もしない。mode は変えない */
  resetColors(): void;
}

export const useThemeStore: UseBoundStore<StoreApi<ThemeStoreState>>;

/** mode と prefersDark から決まる実効テーマ */
export function selectResolvedTheme(state: ThemeStoreState): ResolvedThemeMode;
/** 1 つの実効色を購読するためのセレクタ */
export function selectViewerColor(key: ViewerColorKey): (state: ThemeStoreState) => string;
/** 11 キーすべての実効色 */
export function selectViewerColors(state: ThemeStoreState): ViewerColors;
```

- `colors` は毎回**新しいオブジェクト**を作って `set` する(既存オブジェクトを書き換えない)
- 保存は `saveTheme({ mode, colors })` の形で、`prefersDark` は保存しない
- `reset()` は作らない。この設定は `resetReviewStores()` の対象外である

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `VIEWER_COLOR_ORDER` | 長さ 11、重複なし、`VIEWER_COLOR_DEFAULTS.light` / `.dark` の全キーと一致 |
| `VIEWER_COLOR_DEFAULTS` の全値 | `/^#[0-9a-f]{6}$/` に一致する |
| `VIEWER_COLOR_DEFAULTS.light` と既存定数 | `hexToNumber(light.selection) === SELECTION_COLOR`。`wireframe` / `joint` / `jointLink` / `jointSelected` / `trailLine` / `trailPoint` / `trailCurrent` / `compareOutside` / `compareInside` も対応する既存定数と一致(9 件 + selection を import して比較する) |
| `VIEWER_COLOR_DEFAULTS.light.background` | `"#f5f7fa"` |
| `normalizeHex("#F97316")` | `"#f97316"` |
| `normalizeHex("f97316")` | `"#f97316"` |
| `normalizeHex("  #ABC  ")` | `"#aabbcc"` |
| `normalizeHex("#abcd")` / `normalizeHex("#gggggg")` / `normalizeHex("")` / `normalizeHex("#")` | `null` |
| `hexToNumber("#f97316")` | `0xf97316` |
| `hexToNumber("#ABC")` | `0xaabbcc` |
| `hexToNumber("not a color")` | `0x000000` |
| `numberToHex(0xf97316)` | `"#f97316"` |
| `numberToHex(0)` / `numberToHex(0xffffff)` | `"#000000"` / `"#ffffff"` |
| `numberToHex(-1)` / `numberToHex(0x1000000)` | `"#000000"` / `"#ffffff"` |
| `numberToHex(1.6)` / `numberToHex(NaN)` | `"#000002"` / `"#000000"` |
| `resolveViewerColor("dark", {}, "background")` | `"#14171f"` |
| `resolveViewerColor("dark", { background: "#ff0000" }, "background")` | `"#ff0000"` |
| `resolveViewerColors("light", { selection: "#ff0000" })` | 11 キーが揃い、`selection` だけ `#ff0000`、他は light 既定値 |
| `isThemeMode` | `"light"` / `"dark"` / `"system"` で true、`"Light"` / `null` / `undefined` / `0` / `{}` で false |
| `resolveThemeMode("light", true)` / `resolveThemeMode("dark", false)` | `"light"` / `"dark"`(prefersDark を無視する) |
| `resolveThemeMode("system", true)` / `resolveThemeMode("system", false)` | `"dark"` / `"light"` |
| `prefersDarkScheme()`(`window.matchMedia` 未定義) | `false` を返し、例外を投げない |
| `prefersDarkScheme()`(matchMedia が `{ matches: true }` を返す) | `true` |
| `prefersDarkScheme()`(matchMedia が例外を投げる) | `false` |
| `loadTheme()`(保存なし) | `{ mode: "system", colors: {} }` |
| `loadTheme()`(`"{"` など壊れた JSON) | 既定値 |
| `loadTheme()`(`"[]"` / `"null"` / `"3"`) | 既定値 |
| `loadTheme()`(`{"mode":"neon","colors":{}}`) | `mode` が `"system"` |
| `loadTheme()`(`{"mode":"dark","colors":"x"}`) | `{ mode: "dark", colors: {} }` |
| `loadTheme()`(`colors` に `{"selection":"#F97316","nope":"#fff","joint":"zz","trailLine":5}`) | `colors` が `{ selection: "#f97316" }` のみ |
| `loadTheme()`(localStorage の getItem が例外を投げる) | 既定値を返し、例外を投げない |
| `saveTheme` → `loadTheme` | 同じ `mode` と `colors` が戻る |
| `saveTheme`(setItem が例外を投げる) | 例外を投げず、何もしない |
| ストア初期値(保存なし) | `mode === "system"`、`colors` が空、`prefersDark` が `prefersDarkScheme()` と同じ |
| ストア初期値(`{"mode":"dark","colors":{"joint":"#ff0000"}}` を保存済み) | `mode === "dark"`、`colors.joint === "#ff0000"` |
| `setMode("dark")` | `mode` が `"dark"`、localStorage に `mode: "dark"` が入る |
| `setMode` に現在と同じ値 | state の参照が変わらず、`saveTheme` を呼ばない(購読者に通知されない) |
| `setPrefersDark(true)` | `prefersDark` が true。localStorage は変わらない |
| `setPrefersDark` に現在と同じ値 | state の参照が変わらない |
| `setColor("selection", "#FF0000")` | `colors.selection === "#ff0000"`、保存される |
| `setColor("selection", "zz")` | 何も変わらず、保存もされない |
| `setColor("selection", "#f97316")`(light、override なし) | 既定値と同値なので `colors` は空のまま、保存もされない |
| `setColor("selection", "#f97316")`(light、override が `#ff0000`) | override が削除され `colors` が空になり、保存される |
| `setColor` 後の `colors` | 呼び出し前のオブジェクトが書き換えられていない(別参照) |
| `resetColor("selection")`(override あり) | そのキーだけ消え、他の override は残り、保存される |
| `resetColor("selection")`(override なし) | state の参照が変わらず、保存もされない |
| `resetColors()`(override が 2 件) | `colors` が空になり保存される。`mode` は変わらない |
| `resetColors()`(override が空) | state の参照が変わらない |
| `selectResolvedTheme`(`mode: "system"`, `prefersDark: true`) | `"dark"` |
| `selectViewerColor("joint")`(dark、override なし) | `"#22d3ee"` |
| `selectViewerColors`(light、`selection` を override) | 11 キーが揃い override が反映される |
| `resetReviewStores()` を呼んだ後 | theme ストアの `mode` と `colors` が変わらない(`review-stores.ts` を変更していないことの確認) |

## やらないこと
- **3D への適用**。`outliner/` `joint/` `trail/` `viewer/` `compare/` の既存の色定数・生成関数・Rig は
  1 行も変更しない(120 / 121 / 122 の担当)。このタスクの成果物はまだどこからも使われない
- **`web/src/styles/tokens.css` の変更とダークテーマの CSS**(116 の担当)
- **設定 UI・カラーホイール・パレット**(117 / 118 / 119 の担当)
- `web/src/app/review-stores.ts` の変更。theme ストアは `resetReviewStores()` に**足さない**
- `shared/src/protocol.ts`、`server/` 配下、`web/src/app/realtime-dispatch.ts` の変更。
  この設定は WS に流さない
- `documentElement` への `data-theme` 付与や `matchMedia` の購読(116 の `ThemeEffect` の担当)。
  このタスクの `prefersDarkScheme()` は「今の値を 1 回読む」関数だけを提供する

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `theme_Summary.md` を新規作成し、`viewer-colors.ts` / `theme-mode.ts` / `theme-storage.ts` を
      相対パスで、テスト 4 本をファイル名で載せている
- [ ] `store_Summary.md` に `theme.ts` の役割・公開インターフェイス・`resetReviewStores()` 対象外である旨と
      `tests/store-theme.test.ts` を追記している
- [ ] `web/web_Summary.md` の一覧に `src/features/theme/theme_Summary.md` を足している
- [ ] すべてのファイルが300行以内(`store_Summary.md` は現在 61 行、`web_Summary.md` は 61 行)
- [ ] verify: に書いたコマンドが成功する
