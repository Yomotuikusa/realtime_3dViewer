---
id: 144
title: web 端末ローカルの「表示と操作」設定(ストア・保存・設定タブ)を作り、注釈の線幅から結線する
feature: view-settings
depends_on: [137]
owns: [web/src/store/view-settings.ts, web/src/store/store_Summary.md, web/src/features/view-settings/view-settings.ts, web/src/features/view-settings/view-settings-storage.ts, web/src/features/view-settings/view-settings-labels.ts, web/src/features/view-settings/ViewSettings.tsx, web/src/features/view-settings/view-settings.css, web/src/features/view-settings/view-settings_Summary.md, web/web_Summary.md, web/src/app/SettingsDialog.tsx, web/src/app/review-labels.ts, web/src/app/app_Summary.md, web/src/features/annotation/stroke-overlay.ts, web/src/features/annotation/StrokeLines.tsx, web/src/features/annotation/annotation_Summary.md, web/tests/view-settings.test.ts, web/tests/view-settings-storage.test.ts, web/tests/store-view-settings.test.ts, web/tests/view-settings-components.test.ts, web/tests/settings-dialog.test.ts, web/tests/review-labels.test.ts, web/tests/stroke-overlay.test.ts]
reads: [web/src/store/theme.ts, web/src/features/theme/theme-storage.ts, web/src/features/theme/viewer-colors.ts, web/src/features/theme/ThemeSettings.tsx, web/src/features/theme/theme-labels.ts, web/src/features/theme/theme.css, web/src/features/shortcuts/ShortcutSettings.tsx, web/src/features/shortcuts/shortcuts.css, web/src/app/review.css, web/src/app/review-stores.ts, web/src/features/annotation/RoomStrokes.tsx, web/src/features/comments/ReplayStrokes.tsx, web/tests/theme-components.test.ts, web/tests/store-theme.test.ts, web/tests/theme-storage.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, docs/3dreviewer-plan-and-architecture.md, docs/DESIGN_SKILL.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
線の太さ・重ね描きの不透明度・操作の感度・ジョイントの大きさ・アウトライナの密度は、ディスプレイや入力機器で
最適値が違う「端末の都合」なのに、すべて定数で固定されている。テーマ・色設定と同じ端末ローカルの設定として
zustand ストア + localStorage に持ち、設定ダイアログの第 3 タブで調整できるようにする。
このタスクで**全キーの既定値・範囲・ラベル・UI** を定義し(D28 の流儀。145〜147 は消費するだけ)、
最初の結線として注釈の線幅と透過線の比を `stroke-overlay.ts` へ通す。

## 前提
- 設計書 §13.5: 見え方の状態はルーム共有が原則だが、テーマと色設定は「ディスプレイや視力で最適値が違う端末の都合」として
  ローカルに置く意図的な例外(2026-09-13 確定)。本タスクの設定はすべて同じ理由で例外に含める。
  **`resetReviewStores()` の対象にしない**(`web/src/app/review-stores.ts:14-23` の 10 ストアに theme / shortcuts が入っていないのと同じ)
- 写すべき形(theme): ストア `web/src/store/theme.ts`(`ThemeStoreState`、module scope で `loadTheme()`、各 action の末尾で `saveTheme`、同値なら早期 return)、
  保存 `web/src/features/theme/theme-storage.ts`(`THEME_STORAGE_KEY = "3dreviewer:theme"`、`loadTheme()` は try/catch で壊れた値を既定に戻す、`saveTheme` は try/catch)、
  UI `ThemeSettings.tsx:51-76`(行 `div.theme-color-row[data-changed]`、行ごとのリセット、`:89-98` のフッタに全リセット)、
  文言 `theme-labels.ts`、CSS `theme.css:1`(`.theme-settings`)、`:18`(`.theme-color-row`)、`:131`(`.theme-settings__footer`)
- 設定ダイアログ: `web/src/app/SettingsDialog.tsx`(全 42 行)。`SETTINGS_TAB_ORDER`(`review-labels.ts:13-14`、`type SettingsTab = "shortcuts" | "theme"`)を map してタブを描き、
  `:31` でラベルを三項演算子、`:35` で内容を三項演算子で切り替える。`useState<SettingsTab>("shortcuts")`(`:16`)
- 既存テストの固定: `web/tests/settings-dialog.test.ts:54-56`(タブ数 = `SETTINGS_TAB_ORDER.length`、ラベル `[SETTINGS_TITLE, THEME_SETTINGS_TITLE]`、pressed `["true","false"]`)、
  `:79, :84`(pressed 2 要素)、`:146`(`useState<SettingsTab>("shortcuts")` の文字列)、`:163`(`SETTINGS_TAB_ORDER: readonly SettingsTab[] = ["shortcuts", "theme"]` の文字列)、
  `web/tests/review-labels.test.ts:70`(`toEqual(["shortcuts", "theme"])`)。これらは 3 タブに合わせて書き換える
- `review.css:154` に `.review-dialog__help` が既にある(ViewSettings の説明文に使う。review.css は変更しない。`.settings-tabs` は 3 つ目のタブをそのまま並べる)
- `web/src/store/theme.ts:1` が zustand から `UseBoundStore` / `StoreApi` を import している(契約の型名はこれに合わせる)
- 注釈の線: `web/src/features/annotation/stroke-overlay.ts:3-8` `BASE_LINE_WIDTH = 3` / `OVERLAY_LINE_WIDTH = 1.5` / `OVERLAY_OPACITY_RATIO = 0.35`。
  `strokeLineSpecs(stroke, options: { opacity; overlay })`(`:23`)が `:31` で `BASE_LINE_WIDTH`、`:48` で `OVERLAY_LINE_WIDTH`、`:52` で `options.opacity * OVERLAY_OPACITY_RATIO` を使う。
  `StrokeLines.tsx`(全 17 行)は `useAnnotationStore((state) => state.overlay)` を読んで `strokeLineSpecs(stroke, { opacity, overlay })` を呼ぶ。
  呼び出し側 `RoomStrokes.tsx:25`、`comments/ReplayStrokes.tsx:9` は変更しない
- `web/tests/stroke-overlay.test.ts:3-8` が 3 定数を import し、`:27, :37, :41` で `lineWidth: BASE_LINE_WIDTH` / `OVERLAY_LINE_WIDTH` / `opacity: OVERLAY_OPACITY_RATIO` を期待する(定数相対なので通る)
- CSS 規約(D35 / `styles-rules.test.ts`): 生の色は tokens.css 以外に書かない、`var(--x)` はフォールバック付きか宣言済み、状態は `aria-*` / `data-*` 属性セレクタ、
  クラス接頭辞はフォルダ名。新しい機能フォルダを作るので `view-settings_Summary.md`(`# view-settings` / `## 目的` / `## ファイル一覧と役割` / `## 公開インターフェイス` / `## 他フォルダとの関係` / `## テスト`)を作り、
  `web/web_Summary.md:15-30` の一覧に `src/features/view-settings/view-settings_Summary.md` を足す(`summary-coverage.test.ts`)
- テストの描画方法: `web/tests/theme-components.test.ts:14-20` の `createRoot` + `act`(jsdom、`IS_REACT_ACT_ENVIRONMENT`)、`beforeEach` で `localStorage.clear()` とストアの `setState`
- 対象環境はデスクトップ幅 1024px 以上(D37)。動きは `prefers-reduced-motion` で無効化(base.css)

## インターフェイス契約

```ts
// web/src/features/view-settings/view-settings.ts(新規)
export type ViewSettingKey =
  | "strokeWidth"              // 注釈の線の太さ(px)
  | "overlayOpacityRatio"      // 透過線の不透明度の比
  | "selectionOpacity"         // 選択重ね描きの不透明度
  | "wireframeOverlayOpacity"  // ワイヤー重ね描きの不透明度
  | "dollySensitivity"         // 右ドラッグ dolly の感度(倍率)
  | "lightRotateSensitivity"   // ライト回転の感度(倍率)
  | "jointRadiusScale"         // ジョイント球の大きさ(倍率)
  | "jointPickRadiusPx"        // ジョイントを拾う半径(px)
  | "outlinerRowHeightRem"     // アウトライナの行の高さ(rem)
  | "outlinerIndentPx";        // アウトライナの字下げ(px / 階層)
export type ViewSettingGroup = "annotation" | "viewer" | "input" | "joint" | "outliner";
export type ViewSettingUnit = "px" | "rem" | "ratio" | "scale";

export interface ViewSettingSpec {
  group: ViewSettingGroup;
  unit: ViewSettingUnit;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}

/** UI に並べる順。group ごとに固まっている */
export const VIEW_SETTING_ORDER: readonly ViewSettingKey[];
export const VIEW_SETTING_GROUP_ORDER: readonly ViewSettingGroup[];   // ["annotation", "viewer", "input", "joint", "outliner"]
export const VIEW_SETTING_SPECS: Readonly<Record<ViewSettingKey, ViewSettingSpec>>;
export type ViewSettings = Readonly<Record<ViewSettingKey, number>>;
export const DEFAULT_VIEW_SETTINGS: ViewSettings;

export function isViewSettingKey(value: unknown): value is ViewSettingKey;
/** 有限数でなければ既定値。min〜max に丸める(step には丸めない) */
export function clampViewSetting(key: ViewSettingKey, value: number): number;
```
既定値・範囲(既存定数と同じ値が既定):

| key | group | unit | default | min | max | step |
| --- | --- | --- | --- | --- | --- | --- |
| strokeWidth | annotation | px | 3 | 1 | 8 | 0.5 |
| overlayOpacityRatio | annotation | ratio | 0.35 | 0.05 | 1 | 0.05 |
| selectionOpacity | viewer | ratio | 0.6 | 0.1 | 1 | 0.05 |
| wireframeOverlayOpacity | viewer | ratio | 0.6 | 0.1 | 1 | 0.05 |
| dollySensitivity | input | scale | 1 | 0.25 | 4 | 0.25 |
| lightRotateSensitivity | input | scale | 1 | 0.25 | 4 | 0.25 |
| jointRadiusScale | joint | scale | 1 | 0.25 | 4 | 0.25 |
| jointPickRadiusPx | joint | px | 12 | 4 | 32 | 1 |
| outlinerRowHeightRem | outliner | rem | 1.75 | 1.25 | 2.5 | 0.125 |
| outlinerIndentPx | outliner | px | 16 | 8 | 32 | 4 |

```ts
// web/src/features/view-settings/view-settings-storage.ts(新規。theme-storage.ts と同じ形)
export const VIEW_SETTINGS_STORAGE_KEY = "3dreviewer:view-settings";
/** 無い・壊れている・キーが足りない・値が不正 → そのキーは既定値。各値は clampViewSetting を通す */
export function loadViewSettings(): ViewSettings;
export function saveViewSettings(settings: ViewSettings): void;
```

```ts
// web/src/store/view-settings.ts(新規。theme.ts と同じ形)
export interface ViewSettingsStoreState {
  settings: ViewSettings;
  /** clampViewSetting を通して保存する。同値なら何もしない */
  setSetting(key: ViewSettingKey, value: number): void;
  resetSetting(key: ViewSettingKey): void;
  resetAll(): void;
}
export const useViewSettingsStore: UseBoundStore<StoreApi<ViewSettingsStoreState>>;
/** useViewSettingsStore(selectViewSetting("strokeWidth")) の形で使う純粋セレクタ */
export function selectViewSetting(key: ViewSettingKey): (state: ViewSettingsStoreState) => number;
```

```ts
// web/src/features/view-settings/view-settings-labels.ts(新規。文言はすべてここ)
export const VIEW_SETTINGS_TITLE = "表示と操作";
export const VIEW_SETTINGS_HELP = "この端末だけに保存され、他の参加者の見え方は変わりません。";
export const VIEW_SETTING_GROUP_LABELS: Readonly<Record<ViewSettingGroup, string>> = {
  annotation: "注釈", viewer: "3D ビュー", input: "操作", joint: "ジョイント", outliner: "アウトライナ",
};
export const VIEW_SETTING_LABELS: Readonly<Record<ViewSettingKey, string>> = {
  strokeWidth: "線の太さ",
  overlayOpacityRatio: "透過線の濃さ",
  selectionOpacity: "選択の重ね描きの濃さ",
  wireframeOverlayOpacity: "ワイヤーの重ね描きの濃さ",
  dollySensitivity: "寄り引き(Alt+右ドラッグ)の感度",
  lightRotateSensitivity: "ライト回転の感度",
  jointRadiusScale: "ジョイント球の大きさ",
  jointPickRadiusPx: "ジョイントを拾う半径",
  outlinerRowHeightRem: "行の高さ",
  outlinerIndentPx: "階層の字下げ",
};
export const RESET_VIEW_SETTING_LABEL = "既定に戻す";
export const RESET_VIEW_SETTINGS_LABEL = "すべて既定に戻す";
/**
 * 表示用の値。unit ごとに:
 *   px    → `${Number(value.toFixed(1))}px`   (3 → "3px"、2.5 → "2.5px")
 *   rem   → `${Number(value.toFixed(3))}rem`  (1.75 → "1.75rem"、1.125 → "1.125rem")
 *   ratio → `${Math.round(value * 100)}%`     (0.35 → "35%")
 *   scale → `×${value.toFixed(2)}`            (1 → "×1.00"、0.25 → "×0.25")
 */
export function formatViewSetting(key: ViewSettingKey, value: number): string;
```

```tsx
// web/src/features/view-settings/ViewSettings.tsx(新規。ダイアログの枠は持たない。ThemeSettings と同じ位置づけ)
export function ViewSettings(): ReactElement;
// <div className="view-settings">
//   <p className="review-dialog__help">{VIEW_SETTINGS_HELP}</p>
//   VIEW_SETTING_GROUP_ORDER ごとに <fieldset className="view-settings__group"><legend>…</legend> を作り、
//   その group の key を VIEW_SETTING_ORDER の順に <div className="view-setting-row" data-changed={changed}> で並べる:
//     <label className="view-setting-row__name" htmlFor={id}>{label}</label>
//     <input id={id} className="view-setting-row__range" type="range" min max step value onChange → setSetting />
//     <output className="view-setting-row__value" htmlFor={id}>{formatViewSetting(key, value)}</output>
//     <button className="btn btn--quiet" type="button" disabled={!changed} onClick → resetSetting>{RESET_VIEW_SETTING_LABEL}</button>
//   <div className="view-settings__footer"><button className="btn btn--quiet" disabled={changedCount === 0} onClick → resetAll>{RESET_VIEW_SETTINGS_LABEL}</button></div>
// </div>
// changed は settings[key] !== DEFAULT_VIEW_SETTINGS[key]。id は部品で 1 回 useId() を呼び `${baseId}-${key}` にする
```

```ts
// web/src/app/review-labels.ts
export type SettingsTab = "shortcuts" | "theme" | "view";
export const SETTINGS_TAB_ORDER: readonly SettingsTab[] = ["shortcuts", "theme", "view"];
// SettingsDialog.tsx: タブのラベルは shortcuts → SETTINGS_TITLE、theme → THEME_SETTINGS_TITLE、view → VIEW_SETTINGS_TITLE。
//   内容は view のとき <ViewSettings />。useState<SettingsTab>("shortcuts") は変えない
```

```ts
// web/src/features/annotation/stroke-overlay.ts(既存 export はすべて残す)
/** 透過線の太さ = 通常線の太さ * この比 */
export const OVERLAY_LINE_WIDTH_RATIO = 0.5;
export const OVERLAY_LINE_WIDTH = BASE_LINE_WIDTH * OVERLAY_LINE_WIDTH_RATIO;   // 1.5 のまま
export interface StrokeLineOptions {
  opacity: number;
  overlay: boolean;
  /** 通常線の太さ。既定 BASE_LINE_WIDTH */
  lineWidth?: number;
  /** 透過線の不透明度の比。既定 OVERLAY_OPACITY_RATIO */
  overlayOpacityRatio?: number;
}
export function strokeLineSpecs(stroke: Stroke, options: StrokeLineOptions): StrokeLineSpec[];
// 透過線の lineWidth は lineWidth * OVERLAY_LINE_WIDTH_RATIO、opacity は options.opacity * overlayOpacityRatio

// web/src/features/annotation/StrokeLines.tsx(props は変えない)
//   useViewSettingsStore(selectViewSetting("strokeWidth")) と selectViewSetting("overlayOpacityRatio") を読み、
//   strokeLineSpecs(stroke, { opacity, overlay, lineWidth, overlayOpacityRatio }) を呼ぶ
```

## 振る舞い

### view-settings.ts / storage / store
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `VIEW_SETTING_SPECS` | 上の表のとおり。`VIEW_SETTING_ORDER` は 10 キーすべてを 1 回ずつ含み、group の並びが `VIEW_SETTING_GROUP_ORDER` と同じ |
| `DEFAULT_VIEW_SETTINGS` | 各 key の `defaultValue`。`strokeWidth` は `BASE_LINE_WIDTH`、`overlayOpacityRatio` は `OVERLAY_OPACITY_RATIO` と一致する(import して比較) |
| `clampViewSetting("strokeWidth", 100)` / `(…, 0)` / `(…, NaN)` / `(…, Infinity)` | 8 / 1 / 3 / 3 |
| `clampViewSetting("strokeWidth", 2.3)` | 2.3(step には丸めない) |
| `isViewSettingKey("strokeWidth")` / `("foo")` / `(1)` | true / false / false |
| `loadViewSettings()` で localStorage が空 | `DEFAULT_VIEW_SETTINGS` と等しい新しいオブジェクト |
| 保存値が壊れた JSON / 配列 / 一部のキーだけ / 値が文字列 / 範囲外 | 壊れた・無いキーは既定値、範囲外は丸めた値。他のキーは保存値 |
| 保存値に知らないキー | 無視する |
| `localStorage` が throw する(getItem / setItem を throw にモック) | load は既定値を返し、save は例外を外に出さない |
| `saveViewSettings` → `loadViewSettings` | 往復で等しい |
| `useViewSettingsStore` 初期値 | module 読み込み時の `loadViewSettings()`(localStorage に値を入れてから import する) |
| `setSetting("strokeWidth", 5)` | `settings.strokeWidth === 5`、`localStorage` の `3dreviewer:view-settings` に反映。`settings` は新しいオブジェクト |
| `setSetting("strokeWidth", 5)` を 2 回 | 2 回目は `settings` の参照が変わらず、`setItem` も呼ばれない |
| `setSetting("strokeWidth", 100)` | 8 に丸めて保存 |
| `resetSetting("strokeWidth")` | 既定値に戻り保存。他のキーは変わらない |
| `resetAll()` | `DEFAULT_VIEW_SETTINGS` と等しくなり保存 |
| `resetReviewStores()` | view-settings ストアは変わらない(`store-theme.test.ts` の「レビュー reset 非対象」と同じ形) |
| `selectViewSetting("strokeWidth")(state)` | `state.settings.strokeWidth` |

### ViewSettings.tsx / SettingsDialog
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ViewSettings` を描画 | `.view-setting-row` が `VIEW_SETTING_ORDER.length` 個、`fieldset.view-settings__group` が 5 個で `legend` が `VIEW_SETTING_GROUP_LABELS` の順。`.review-backdrop` / `[role="dialog"]` / `h2` は無い |
| 各行の `input[type="range"]` | `min` / `max` / `step` / `value` が spec とストア値。`aria-label` は無くてよい(`<label for>` で結ぶ)。`output` の文字が `formatViewSetting` |
| range を変更(`input` イベントで value "5") | ストアの `strokeWidth` が 5、行の `data-changed="true"`、行のリセットが有効、フッタの全リセットが有効 |
| 行のリセットを押す | そのキーが既定に戻り、`data-changed="false"`、ボタン disabled |
| 全部既定のとき | すべての行のリセットとフッタのボタンが disabled |
| `formatViewSetting` | `("strokeWidth", 3)` → `"3px"`、`("outlinerRowHeightRem", 1.75)` → `"1.75rem"`、`("overlayOpacityRatio", 0.35)` → `"35%"`、`("dollySensitivity", 1)` → `"×1.00"` |
| `VIEW_SETTING_LABELS` / `VIEW_SETTING_GROUP_LABELS` | 全キー・全グループに空でない日本語がある |
| `SettingsDialog` を描画 | タブが 3 つ、ラベル `[SETTINGS_TITLE, THEME_SETTINGS_TITLE, VIEW_SETTINGS_TITLE]`、pressed `["true","false","false"]` |
| 3 つ目のタブを押す | `.view-settings` が現れ、`.shortcut-settings` / `.theme-settings` は無い。pressed `["false","false","true"]`。枠とフッタの要素は同じまま |
| 表示と操作タブ表示中に `keydown KeyQ` | ショートカットは捕捉されない(theme タブと同じ) |
| `review-labels.ts` のソース | `SETTINGS_TAB_ORDER: readonly SettingsTab[] = ["shortcuts", "theme", "view"]` を含む |
| `view-settings.css` | 生の色・`!important`・`@import` を含まず、`.view-settings` `.view-settings__group` `.view-setting-row` `.view-setting-row__range` `.view-setting-row__value` `.view-settings__footer` を定義し、`.view-setting-row[data-changed="true"] .view-setting-row__name` の規則がある |

### stroke-overlay.ts / StrokeLines.tsx
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `strokeLineSpecs(stroke, { opacity: 1, overlay: true })` | 従来どおり(`lineWidth: BASE_LINE_WIDTH`、透過線 `OVERLAY_LINE_WIDTH`、`opacity: OVERLAY_OPACITY_RATIO`)。既存テストがそのまま通る |
| `strokeLineSpecs(stroke, { opacity: 0.5, overlay: true, lineWidth: 6, overlayOpacityRatio: 0.2 })` | 通常線 `lineWidth: 6`、透過線 `lineWidth: 3`、透過線 `opacity: 0.1` |
| `overlay: false` で `lineWidth: 6` | 通常線 1 本だけ、`lineWidth: 6` |
| `OVERLAY_LINE_WIDTH` | `BASE_LINE_WIDTH * OVERLAY_LINE_WIDTH_RATIO` = 1.5 |
| `StrokeLines.tsx` のソース | `selectViewSetting("strokeWidth")`、`selectViewSetting("overlayOpacityRatio")`、`lineWidth,` `overlayOpacityRatio` を含み、`RoomStrokes.tsx` / `ReplayStrokes.tsx` は変更しない |

### 目視確認(マージ後に人間が行う)
| 操作 | 期待する結果 |
| --- | --- |
| 設定 → 「表示と操作」タブ | 5 つのグループにスライダーが並び、値の表示が単位付きで読める。ライト / ダークどちらでも生色の混入が無い |
| 「注釈の線の太さ」を 8px にしてペンで描く | 線が太くなる。透過線も比例して太くなる |
| 「透過線の不透明度」を 5% にする | モデルの裏に隠れた線がほぼ見えなくなる |
| ページを再読み込み | 値が保持されている |
| 別のブラウザプロファイルで同じ URL を開く | 既定値のまま(共有されていない) |

## やらないこと
- 145〜147 の結線(選択・ワイヤー不透明度、感度、ジョイント、アウトライナ密度)はしない。キーとスライダーは出すが、この時点では効かない
- ライトの明るさはルーム共有(148 / 149)なのでこのストアには入れない
- 設定値を WS に流さない。`resetReviewStores()` に足さない
- `RoomStrokes.tsx` / `ReplayStrokes.tsx` / annotation ストアは変更しない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] view-settings_Summary.md が 6 節構成で作られ、web_Summary.md から索引され、store_Summary.md / app_Summary.md / annotation_Summary.md が更新されている
- [ ] 実装役は docs/DESIGN_SKILL.md §16 の監査結果を最終メッセージに書く(D38)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
