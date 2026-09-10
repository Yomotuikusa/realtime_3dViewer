---
id: 045
title: web カメラメニューをブロック分けして四方向を十字に並べる
feature: web
depends_on: [044]
owns: [web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/FocalLengthSlider.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/view-presets.ts, web/src/features/viewer/viewer.css, web/tests/hud-labels.test.ts, web/tests/view-presets.test.ts, web/web_Summary.md]
reads: [web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/focal-length.ts, web/src/store/camera.ts, web/src/store/shortcuts.ts, web/src/features/shortcuts/keymap.ts, web/src/app/review.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/styles-rules.test.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右上「カメラ」ドロップダウンの中身が縦1列に平らに並んでいて見づらい。焦点距離は
ラベル・スライダー・値が折り返して縦積みになっている。焦点距離／四方向の視点／その他の
3ブロックにグレーの区切り線で分け、四方向は十字に配置し、焦点距離はラベルと値を1行に
してその直下にスライダーを置く。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- カメラメニューの中身は `ViewerHud.tsx` の `<HudMenu id="camera">` の children として
  `<FocalLengthSlider />` → `VIEW_PRESET_ORDER.map(...)` の4ボタン → 視点リセット →
  全体を表示 の順に `.btn.btn--quiet.hud-menu__item` が並んでいる。
  web/src/features/viewer/ViewerHud.tsx:81-121
- `HudMenu` は開閉 state を持たない制御コンポーネントで、children をそのまま
  `.hud-menu__panel`(`role="group"`、`display: grid; gap: var(--space-1); min-width: 12rem`)
  に描く。web/src/features/viewer/HudMenu.tsx:36-40, web/src/features/viewer/viewer.css:53-66
- 焦点距離が縦積みになる原因: `.hud-focal` が `display: inline-flex` で3要素を横に並べ、
  `.hud-focal__range` が `width: 8rem` 固定のため、12rem のパネルに収まらず折り返している。
  パネル内では `.hud-menu__panel .hud-focal` で枠線と影だけ消している。
  web/src/features/viewer/viewer.css:73-99
- `FocalLengthSlider` の利用箇所はカメラメニューの中だけである(他からは import されていない)。
- `VIEW_PRESET_ORDER` は `["front", "back", "right", "left"]`。参照しているのは
  `ViewerHud.tsx:88`、`tests/hud-labels.test.ts:43`、`tests/view-presets.test.ts:51-52,67`
  の3か所のみで、`tests/view-presets.test.ts:51` はこの順序を `toEqual` で直書きしている。
  web/src/features/viewer/view-presets.ts:7
- 視点ボタンは `requestCamera(presetCamera(preset, useCameraStore.getState().selfCamera))` を
  呼び、視点リセットは `requestReset()`、全体を表示は `requestFit()` を呼んだあと、
  いずれも `setOpenMenu(null)` でメニューを閉じる。web/src/features/viewer/ViewerHud.tsx:93-96,104-107,114-117
- 視点リセットと全体を表示のラベルには `withShortcut(RESET_LABEL, keymap.viewReset)` /
  `withShortcut(FIT_LABEL, keymap.viewFit)` でショートカットを併記している。
  web/src/features/viewer/ViewerHud.tsx:109,119
- `.review-hud` は `pointer-events: none` で、子孫のうち `.btn` / `[role="toolbar"]` /
  `[role="group"]` / `[role="status"]` / `[role="alert"]` だけが `pointer-events: auto` になる。
  web/src/app/review.css:92-105
- CSS には生の色値を書けない(`tests/styles-rules.test.ts:106-111` が検査する)。区切り線の色は
  `var(--color-border)` を使う。`!important` と `@import` も禁止。
- `web_Summary.md` は現在 269 行で、上限 300 行に近い。

## インターフェイス契約

```ts
// web/src/features/viewer/view-presets.ts(既存に追記・変更)

/** HUD の十字に並べる順。上(正面)から時計回り。 */
export const VIEW_PRESET_ORDER: readonly ViewPreset[] = ["front", "right", "back", "left"];

/** 3×3 グリッド上のセル(1 始まり)。 */
export interface GridCell {
  row: number;
  column: number;
}

/** 十字の中央。全体を表示ボタンを置く。 */
export const VIEW_CROSS_CENTER: GridCell = { row: 2, column: 2 };

/** 各視点を置くセル。中央を囲む十字になる。 */
export const VIEW_PRESET_CELLS: Readonly<Record<ViewPreset, GridCell>> = {
  front: { row: 1, column: 2 },
  right: { row: 2, column: 3 },
  back: { row: 3, column: 2 },
  left: { row: 2, column: 1 },
};
```

```ts
// web/src/features/viewer/hud-labels.ts(既存に追記)

/** 十字の中央セルに入れる短い表示名。aria-label / title には FIT_LABEL を使う。 */
export const FIT_SHORT_LABEL = "全体";
/** 十字ブロックの role="group" の aria-label。 */
export const VIEW_PRESETS_LABEL = "既定の視点";
```

```tsx
// web/src/features/viewer/CameraMenu.tsx(新規)

export interface CameraMenuProps {
  /** ボタン操作後にメニューを閉じる。 */
  onClose: () => void;
}

/**
 * カメラメニューの中身。3つの .hud-menu__section を上から
 *   1. <FocalLengthSlider />
 *   2. 十字の視点ボタン(role="group" aria-label={VIEW_PRESETS_LABEL})
 *   3. 視点リセット
 * の順に描く。各 section は隣接する section との境界を区切り線で示す。
 */
export function CameraMenu({ onClose }: CameraMenuProps): ReactElement;
```

```tsx
// web/src/features/viewer/FocalLengthSlider.tsx(構造変更。props なしは維持)
// 生成する DOM:
// <div class="hud-focal" role="group" aria-label="焦点距離">
//   <div class="hud-focal__head">
//     <label class="hud-focal__label" for="hud-focal-length">焦点距離</label>
//     <output class="hud-focal__value" for="hud-focal-length">50mm</output>
//   </div>
//   <input id="hud-focal-length" class="hud-focal__range" type="range" ... />
// </div>
export function FocalLengthSlider(): ReactElement;
```

`ViewerHud.tsx` の `<HudMenu id="camera">` の children は `<CameraMenu onClose={() => setOpenMenu(null)} />`
の1つだけにする。`ViewerHud` の公開シグネチャ `ViewerHud({ send })` は変えない。

### CSS の要点(viewer.css)
- `.hud-menu__section`: `display: grid; gap: var(--space-1)`
- `.hud-menu__section + .hud-menu__section`: `margin-top: var(--space-1); padding-top: var(--space-2); border-top: 1px solid var(--color-border)`
  (これがブロック境界のグレーのライン)
- `.hud-menu__panel` の `min-width` を `13.5rem` に広げる(3列の十字が入る幅)
- `.hud-focal`: `display: grid; gap: var(--space-1); padding: var(--space-1) 0`。枠線・影・背景は持たない
  (単独利用が無くなるので `.hud-menu__panel .hud-focal` の上書きは統合して削除する)
- `.hud-focal__head`: `display: flex; justify-content: space-between; align-items: baseline; white-space: nowrap`
- `.hud-focal__range`: `width: 100%`
- `.hud-views`: `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-1)`
- 十字の各ボタン `.hud-view`: `justify-content: center; text-align: center; padding-inline: var(--space-2)`。
  セル位置は CSS クラスではなく `style={{ gridRow: cell.row, gridColumn: cell.column }}` で
  `VIEW_PRESET_CELLS` / `VIEW_CROSS_CENTER` から与える

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `VIEW_PRESET_ORDER` | `["front", "right", "back", "left"]`(上から時計回り) |
| `VIEW_PRESET_CELLS` の4セル | すべて異なり、いずれも `VIEW_CROSS_CENTER` と row または column のどちらか一方だけが 1 違う(十字) |
| `VIEW_PRESET_CELLS` と `VIEW_CROSS_CENTER` | 4セルのどれも中央 `{2,2}` と一致しない |
| `VIEW_PRESET_CELLS[front]` / `[back]` | それぞれ row 1 / row 3 の column 2(上が正面、下が背面) |
| `VIEW_PRESET_CELLS[right]` / `[left]` | それぞれ column 3 / column 1 の row 2(右が右、左が左) |
| `FIT_SHORT_LABEL`、`VIEW_PRESETS_LABEL` | `"全体"`、`"既定の視点"` |
| 既存の `VIEW_PRESET_LABELS`・`RESET_LABEL`・`FIT_LABEL`・`FOCAL_LENGTH_LABEL` | 文言を変えない(既存テストがそのまま通る) |
| カメラメニューを開く | 上から 焦点距離ブロック → 十字ブロック → 視点リセット の3ブロックが、ブロック間に区切り線を挟んで並ぶ |
| 焦点距離ブロック | 1行目に「焦点距離」(左)と現在値「NNmm」(右)が横並び、2行目にスライダーが幅いっぱいに出る。折り返さない |
| 十字ブロック | 正面が上、右が右、背面が下、左が左、中央に「全体」。DOM の順序(Tab 順)は 正面→右→背面→左→全体 |
| 中央の「全体」ボタン | 表示文字は `FIT_SHORT_LABEL`。`aria-label` と `title` は `withShortcut(FIT_LABEL, keymap.viewFit)`。押すと `requestFit()` を呼びメニューを閉じる |
| 視点ボタンを押す | `requestCamera(presetCamera(preset, selfCamera))` を呼びメニューを閉じる(従来どおり) |
| 視点リセットを押す | ラベルは `withShortcut(RESET_LABEL, keymap.viewReset)`。`requestReset()` を呼びメニューを閉じる |
| スライダーを動かす | メニューは閉じない(従来どおり) |
| ブロック見出しのテキスト | 置かない。区切り線のみでブロックを示す |
| `npm run test:web` の `styles-rules` | 生の色値を追加していないので通る |

## やらないこと
- 左上のペン／コメントのトグル、`AnnotationToolbar`、`.hud-follow`、`.hud-hint` は変更しない
- 「ライト」メニューの中身・`hud-menu.ts`・`HudMenu.tsx` は変更しない(ライトの UI 変更は task 046)
- `view-presets.ts` の `VIEW_PRESET_DIRECTIONS` / `presetCamera` の計算は変えない
- ブロック見出し(「視点」「その他」などの文字)を足さない
- 新しいトークンを `tokens.css` に足さない(既存トークンだけで組む)
- `FocalLengthSlider` に props を足さない
- `web_Summary.md` の追記は差分最小に留める(新規ファイル `CameraMenu.tsx` の行を「ファイル一覧と役割」
  と「公開インターフェイス」に1行ずつ足し、`ViewerHud.tsx` / `FocalLengthSlider.tsx` /
  `view-presets.ts` / `hud-labels.ts` / `viewer.css` の既存行を書き換える。300 行を超えない)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の純粋関数・定数の行に対応するテストが `tests/view-presets.test.ts` /
      `tests/hud-labels.test.ts` にあり、通る(`tests/view-presets.test.ts:51` の旧順序の assert は新順序に直す)
- [ ] web_Summary.md が更新されている(300 行以内)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
