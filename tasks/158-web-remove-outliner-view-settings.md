---
id: 158
title: web アウトライナのビュー設定(行の高さ・階層の字下げ)を廃止し、CSS の固定値にする
feature: view-settings
depends_on: []
owns: [web/src/features/view-settings/view-settings.ts, web/src/features/view-settings/view-settings-labels.ts, web/src/features/view-settings/ViewSettingsMenu.tsx, web/src/features/view-settings/view-settings_Summary.md, web/src/features/outliner/Outliner.tsx, web/src/features/outliner/outliner.css, web/src/features/outliner/outliner_Summary.md, web/tests/view-settings.test.ts, web/tests/view-settings-menu.test.ts, web/tests/view-settings-components.test.ts, web/tests/outliner-styles.test.ts]
reads: [web/src/store/view-settings.ts, web/src/features/view-settings/view-settings-storage.ts, web/src/features/view-settings/ViewSettings.tsx, web/src/features/view-settings/view-settings.css, web/src/features/view-settings/view-settings-menu.css, web/src/features/outliner/OutlinerRow.tsx, web/src/features/viewer/hud-menu.ts, web/tests/view-settings-storage.test.ts, web/tests/store-view-settings.test.ts, web/tests/summary-coverage.test.ts, web/tests/styles-rules.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

HUD の「表示」メニューにあるアウトライナのビュー設定 2 項目(行の高さ・階層の字下げ)は使われていない。設定キーごと廃止し、アウトライナの行高と字下げは CSS の固定値(既定値と同じ `1.75rem` / `16px`)にする。メニューから隠すだけでは設定キーと結線が死にコードとして残るため、定義・ラベル・結線・テストをすべて削除する。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- ビュー設定は 10 キー・5 グループで定義済み。`web/src/features/view-settings/view-settings.ts:6-91`。このうち削除対象は `outlinerRowHeightRem`(group `outliner`、unit `rem`、既定 1.75、範囲 1.25〜2.5、step 0.125)と `outlinerIndentPx`(group `outliner`、unit `px`、既定 16、範囲 8〜32、step 4)の 2 つ。
- `outliner` グループに属するキーはこの 2 つだけである(`VIEW_SETTING_SPECS` を全キー確認済み)。したがって `ViewSettingGroup` から `"outliner"` を削除できる。
- `unit: "rem"` を持つキーは `outlinerRowHeightRem` だけである。したがって `ViewSettingUnit` から `"rem"` も削除できる。
- `VIEW_SETTING_GROUP_SURFACE` と `VIEW_SETTING_GROUP_LABELS` は `Readonly<Record<ViewSettingGroup, ...>>` 型なので、`ViewSettingGroup` から `"outliner"` を消すと両者の `outliner:` 行も消さないと typecheck が落ちる。
- 消費側は `web/src/features/outliner/Outliner.tsx` の 3 箇所だけ。`:33-34` でストアから購読し、`:62` の `style` で CSS カスタムプロパティ `--outliner-row-height` / `--outliner-indent` へ渡している。他に購読箇所はない(`grep -rn "outlinerRowHeightRem\|outlinerIndentPx" web/src web/tests` で確認済み)。
- `web/src/features/outliner/outliner.css:50-51` が該当。現在は次のとおりフォールバック付きで、値が渡らなくても既定値で描かれる。

  ```css
  min-height: var(--outliner-row-height, 1.75rem);
  padding-left: calc(var(--outliner-depth, 0) * var(--outliner-indent, 16px));
  ```

- `--outliner-depth` は別物で、`web/src/features/outliner/OutlinerRow.tsx:38` が行ごとの深さとして設定している。ビュー設定とは無関係なので**残す**。
- `web/src/features/view-settings/view-settings-storage.ts` の `loadViewSettings` / `saveViewSettings` は `VIEW_SETTING_ORDER` をループして読み書きする。キーを削除すれば、localStorage に残った旧キーは読み込み時に無視され、次回保存で自動的に消える。`web/tests/view-settings-storage.test.ts` は「未知キーを無視する」ことを検査しているがキー名を直書きしていないため、このタスクでは storage 側の実装もテストも変更不要。
- `web/src/store/view-settings.ts` は `ViewSettingKey` をそのまま使う汎用実装で、`web/tests/store-view-settings.test.ts` は `strokeWidth` / `dollySensitivity` しか参照していない。どちらも変更不要。
- `ViewSettings.tsx`(ダイアログ側)と `ViewSettingsMenu.tsx`(HUD 側)はどちらもグループ配列を `map` する完全なデータ駆動で、キーやグループ名を直書きしていない。定義側を消すだけで描画も減る見込み。
- `web/tests/summary-coverage.test.ts` が各機能フォルダの `<名前>_Summary.md` の存在と記述を検査する。`web/tests/styles-rules.test.ts` が `src` 配下の全 CSS のデザイントークン使用を検査する。どちらも変更しない。
- 現在の行数はすべて上限 300 行に対し余裕がある(最大は `outliner.css` の 151 行)。

## インターフェイス契約

### web/src/features/view-settings/view-settings.ts

削除後の型と定数は次のとおりにする。ここに挙げていない公開シンボル(`ViewSettingSurface`、`ViewSettingSpec`、`ViewSettings`、`isViewSettingKey`、`clampViewSetting`、`viewSettingKeysInGroup`、`viewSettingKeysOnSurface`、`DIALOG_VIEW_SETTING_GROUP_ORDER`)は名前・シグネチャとも変更しない。

```ts
export type ViewSettingKey =
  | "strokeWidth"
  | "overlayOpacityRatio"
  | "selectionOpacity"
  | "wireframeOverlayOpacity"
  | "dollySensitivity"
  | "lightRotateSensitivity"
  | "jointRadiusScale"
  | "jointPickRadiusPx";

export type ViewSettingGroup = "annotation" | "viewer" | "input" | "joint";
export type ViewSettingUnit = "px" | "ratio" | "scale";

export const VIEW_SETTING_GROUP_ORDER: readonly ViewSettingGroup[] = ["annotation", "viewer", "input", "joint"];

export const VIEW_SETTING_GROUP_SURFACE: Readonly<Record<ViewSettingGroup, ViewSettingSurface>> = {
  annotation: "hud",
  viewer: "hud",
  input: "dialog",
  joint: "hud",
};

/** HUD の「表示」メニューに上から並べるグループ。 */
export const HUD_VIEW_SETTING_GROUP_ORDER: readonly ViewSettingGroup[] = ["annotation", "viewer", "joint"];

export const VIEW_SETTING_ORDER: readonly ViewSettingKey[] = [
  "strokeWidth",
  "overlayOpacityRatio",
  "selectionOpacity",
  "wireframeOverlayOpacity",
  "dollySensitivity",
  "lightRotateSensitivity",
  "jointRadiusScale",
  "jointPickRadiusPx",
];
```

`VIEW_SETTING_SPECS` と `DEFAULT_VIEW_SETTINGS` からも `outlinerRowHeightRem` / `outlinerIndentPx` の行を削除する。残る 8 キーの spec 値(group / unit / defaultValue / min / max / step)は一切変更しない。

### web/src/features/view-settings/view-settings-labels.ts

```ts
export const VIEW_SETTING_GROUP_LABELS: Readonly<Record<ViewSettingGroup, string>> = {
  annotation: "注釈",
  viewer: "3D ビュー",
  input: "操作",
  joint: "ジョイント",
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
};

/** rem 単位のキーが無くなったので rem 分岐も持たない。 */
export function formatViewSetting(key: ViewSettingKey, value: number): string {
  const unit = VIEW_SETTING_SPECS[key].unit;
  if (unit === "px") return `${Number(value.toFixed(1))}px`;
  if (unit === "ratio") return `${Math.round(value * 100)}%`;
  return `×${value.toFixed(2)}`;
}
```

`VIEW_SETTINGS_TITLE`、`VIEW_SETTINGS_HELP`、`RESET_VIEW_SETTING_LABEL`、`RESET_VIEW_SETTINGS_LABEL` は変更しない。

### web/src/features/outliner/Outliner.tsx

`export function Outliner({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement` のシグネチャは変更しない。次の 3 箇所を削除する。

```ts
// 削除する行(:33-34)
const rowHeightRem = useViewSettingsStore(selectViewSetting("outlinerRowHeightRem"));
const indentPx = useViewSettingsStore(selectViewSetting("outlinerIndentPx"));
```

```tsx
// 削除する属性(:62)。<section> には className と aria-label だけを残す。
style={{ "--outliner-row-height": `${rowHeightRem}rem`, "--outliner-indent": `${indentPx}px` } as CSSProperties}
```

これに伴い未使用になる import を削除する(`strict: true` のため残せない)。

- `:21` の `import { selectViewSetting, useViewSettingsStore } from "../../store/view-settings";` を行ごと削除
- `:1` の `import { useMemo, useState, type CSSProperties, type ReactElement } from "react";` から `type CSSProperties,` を削除(`useMemo` / `useState` / `ReactElement` は残る)

`OutlinerRow.tsx` の `CSSProperties`(`--outliner-depth` 用)は別ファイルなので触らない。

### web/src/features/outliner/outliner.css

`.outliner__row` の 2 行を固定値にする。他の宣言・他のルールは変更しない。

```css
min-height: 1.75rem;
padding-left: calc(var(--outliner-depth, 0) * 16px);
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| HUD の「表示」メニューを開く | `HUD_VIEW_SETTING_GROUP_ORDER` の順に **3 グループ**(注釈 / 3D ビュー / ジョイント)、計 **6 行**のスライダーが出る。アウトライナのグループ見出しも 2 行も出ない |
| HUD のスライダーを 1 つ動かしてから「すべて既定に戻す」 | hud 面の 6 キーだけが既定へ戻り、`dollySensitivity` / `lightRotateSensitivity` は変更前の値のまま |
| 設定ダイアログ第 3 タブを開く | 従来どおり `input` グループの 1 fieldset・2 行(寄り引き感度、ライト回転感度)だけが出る。このタスクで見た目は変わらない |
| `viewSettingKeysOnSurface("hud")` | `["strokeWidth", "overlayOpacityRatio", "selectionOpacity", "wireframeOverlayOpacity", "jointRadiusScale", "jointPickRadiusPx"]`(6 件) |
| `viewSettingKeysOnSurface("dialog")` | `["dollySensitivity", "lightRotateSensitivity"]`(2 件、変更なし) |
| `viewSettingKeysInGroup("joint")` | `["jointRadiusScale", "jointPickRadiusPx"]`(変更なし) |
| `VIEW_SETTING_ORDER.length` | `8` |
| `isViewSettingKey("outlinerRowHeightRem")` / `isViewSettingKey("outlinerIndentPx")` | いずれも `false` |
| アウトライナの行の描画 | 行高は `1.75rem`、深さ 1 段あたりの字下げは `16px`。削除前の既定値と同じ見た目になる |
| 深さ `n` の行の `padding-left` | `calc(var(--outliner-depth, 0) * 16px)` により `n * 16px`。`--outliner-depth` は `OutlinerRow.tsx` が設定し続ける |
| 旧キーを含む値が localStorage に保存された状態で再読み込み | 旧キーは無視され、残る 8 キーの保存値だけがスライダーに反映される。例外は起きない |
| その状態でいずれかの設定を変更 | `saveViewSettings` が 8 キーだけを書き直し、旧キーは保存内容から消える |

## テスト

owns に挙げた 4 つのテストを更新する。`web/tests/view-settings-storage.test.ts`、`web/tests/store-view-settings.test.ts`、`web/tests/summary-coverage.test.ts`、`web/tests/styles-rules.test.ts` は変更しない(これらが落ちる変更を入れないこと)。

### web/tests/view-settings.test.ts

- `:19` `expect(VIEW_SETTING_ORDER).toHaveLength(10)` → `8`
- `:21` `VIEW_SETTING_GROUP_ORDER` の期待値 → `["annotation", "viewer", "input", "joint"]`
- `:22-24` グループ列の期待値 → `["annotation", "annotation", "viewer", "viewer", "input", "input", "joint", "joint"]`
- `:44-50` `VIEW_SETTING_GROUP_SURFACE` の期待値から `outliner: "hud"` を削除
- `:51` `HUD_VIEW_SETTING_GROUP_ORDER` の期待値 → `["annotation", "viewer", "joint"]`
- `:54-57` `viewSettingKeysOnSurface("hud")` の期待値 → 振る舞い表の 6 件
- 追加: `isViewSettingKey("outlinerRowHeightRem")` と `isViewSettingKey("outlinerIndentPx")` がともに `false` であることを検査する
- hud 面 + dialog 面 = `VIEW_SETTING_ORDER` 全体という既存の検査はそのまま残す

### web/tests/view-settings-menu.test.ts

- `:48` テスト名 `"renders four grouped HUD sections and eight labelled ranges"` → 3 グループ・6 行を表す名前へ
- `:53` `.view-settings-menu__group` の件数 → `3`
- `:56` `.view-setting-hud-row` の件数 → `6`
- `:117` テスト名 `"covers the eight non-input keys"` と `:118` の `toHaveLength(8)` → `6`
- その他(ラベル・単位表記・`data-changed`・リセット挙動)は `viewSettingKeysOnSurface("hud")` 駆動なのでそのまま通るはず。通らなければ期待値側を新しい 6 キーに合わせる

### web/tests/view-settings-components.test.ts

- `:117` `expect(formatViewSetting("outlinerRowHeightRem", 1.75)).toBe("1.75rem")` を削除する。残る 3 行(`3px` / `35%` / `×1.00`)は変更しない
- ダイアログ側の DOM 検査(`input` 面 1 fieldset・2 行)は変更不要

### web/tests/outliner-styles.test.ts

- `:57-58` `var(--outliner-row-height, 1.75rem)` / `var(--outliner-indent, 16px)` を含む検査を、固定値の検査へ置き換える。

  ```ts
  expect(ruleBody(cssText, ".outliner__row")).toContain("min-height: 1.75rem");
  expect(ruleBody(cssText, ".outliner__row")).toContain("calc(var(--outliner-depth, 0) * 16px)");
  ```

- `:59-60` の `DEFAULT_VIEW_SETTINGS.outlinerRowHeightRem` / `.outlinerIndentPx` を参照する 2 行を削除する。これで `DEFAULT_VIEW_SETTINGS` の参照が無くなるので `:14` の import 行も削除する(未使用 import は typecheck が落とす)。
- `:77-80` の `selectViewSetting("outlinerRowHeightRem")` / `selectViewSetting("outlinerIndentPx")` / `"--outliner-row-height"` / `"--outliner-indent"` を検査する 4 行を削除する。
- 追加: `Outliner.tsx` がビュー設定を購読しなくなったことを検査する。

  ```ts
  expect(outlinerText).not.toContain("selectViewSetting");
  expect(outlinerText).not.toContain("--outliner-row-height");
  expect(outlinerText).not.toContain("--outliner-indent");
  ```

- `.outliner__row` の `var(--outliner-depth, 0)` を検査する `:56` はそのまま残す。同ファイルのそれ以外の検査(アイコン SVG 属性、CSS 状態規則、他のソース契約)も残す。

## Summary の更新

### web/src/features/view-settings/view-settings_Summary.md

- 「10 個の設定キー」→ 「8 個の設定キー」。グループは 4 つ、単位は px / ratio / scale の 3 種になった旨を反映する
- ViewSettingsMenu.tsx の説明「表示系 4 グループ・8 スライダー」→ 「表示系 3 グループ・6 スライダー」
- テスト節の view-settings-menu.test.ts の説明「4 グループ・8 行」→ 「3 グループ・6 行」

### web/src/features/outliner/outliner_Summary.md

- Outliner.tsx の説明から「`outlinerRowHeightRem` と `outlinerIndentPx` を CSS カスタムプロパティへ渡し」を削除する。objects / model-scenes / selection ストアを購読する旨は残す(view-settings ストアは購読しなくなる)
- outliner.css の説明「行高と字下げは CSS カスタムプロパティを使い、それぞれ `1.75rem` と `16px` をフォールバックにする」→ 行高 `1.75rem`・字下げ 1 段 `16px` の固定値である旨へ書き換える
- 「公開インターフェイス」節の `Outliner.tsx: ... view-settings の `outlinerRowHeightRem` と `outlinerIndentPx` を CSS カスタムプロパティへ渡す」から当該記述を削除する
- 「他機能との関係」節の「表示設定は view-settings ストアが管理し、アウトライナは行高・字下げを CSS カスタムプロパティへ、SelectionPickLayer はジョイント選択半径をピック関数へ渡す」から行高・字下げの記述を削除し、SelectionPickLayer のジョイント選択半径と SelectionRig の `selectionOpacity` の記述は残す(この 2 つは廃止しない)

## やらないこと

- `web/src/store/view-settings.ts` と `web/src/features/view-settings/view-settings-storage.ts` は変更しない。保存形式の移行処理(旧キーの明示的な削除など)も追加しない。ループ対象から外れることで自然に消える
- `outlinerRowHeightRem` / `outlinerIndentPx` 以外の 8 キーは、キー名・グループ・単位・既定値・範囲・step のいずれも変更しない
- `ViewSettings.tsx`(ダイアログ)、`view-settings.css`、`view-settings-menu.css`、`web/src/features/viewer/` 配下、`web/src/app/` 配下は変更しない
- `OutlinerRow.tsx` の `--outliner-depth` と `CSSProperties` は削除しない。`outliner.css` の `var(--outliner-depth, 0)` も残す
- アウトライナの行高・字下げを新しい別の設定手段(CSS 変数の別経路、独自ストアなど)で調整可能にしない。固定値にする
- `shared` / `server` は変更しない

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの型・定数・シグネチャになっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] view-settings_Summary.md と outliner_Summary.md を更新している
- [ ] すべてのファイルが 300 行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
