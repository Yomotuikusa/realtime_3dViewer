---
id: 145
title: web アウトライナの選択重ね描き不透明度・行の密度・ジョイント選択半径を表示設定から取る
feature: outliner
depends_on: [144, 147]
owns: [web/src/features/outliner/selection-highlight.ts, web/src/features/outliner/SelectionRig.tsx, web/src/features/outliner/SelectionPickLayer.tsx, web/src/features/outliner/Outliner.tsx, web/src/features/outliner/outliner.css, web/src/features/outliner/outliner_Summary.md, web/tests/outliner-highlight.test.ts, web/tests/outliner-styles.test.ts, web/tests/outliner-pick.test.ts]
reads: [web/src/store/view-settings.ts, web/src/features/view-settings/view-settings.ts, web/src/features/view-settings/view-settings_Summary.md, web/src/features/joint/joint-pick.ts, web/src/features/outliner/OutlinerRow.tsx, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
144 が定義した `selectionOpacity` / `outlinerRowHeightRem` / `outlinerIndentPx` / `jointPickRadiusPx` を
アウトライナ側の消費箇所へ結線する。

## 前提
- 144 のストア: `useViewSettingsStore`、`selectViewSetting(key)`(`web/src/store/view-settings.ts`)。既定値は
  `selectionOpacity` 0.6、`outlinerRowHeightRem` 1.75、`outlinerIndentPx` 16、`jointPickRadiusPx` 12
- `web/src/features/outliner/selection-highlight.ts:22` `SELECTION_MESH_OPACITY = 0.6` を `:41`(module 内部の `createMeshOverlay` の `MeshBasicMaterial`)が使う。
  公開関数は `createSelectionOverlay(object, color)`(`:84`)、`applySelectionHighlight(target, color)`(`:92`)、`clearSelectionHighlight(root)`(`:112`)。
  線・点の重ね描き(`createLineOverlay`、`:61`)は不透明度を持たない
- `SelectionRig.tsx:9-21` は `useThemeStore(selectViewerColor("selection"))` で色を取り、`useEffect`(deps `[scene, selected, color]`)で
  `applySelectionHighlight(target, hexToNumber(color))` を呼び、cleanup で `clearSelectionHighlight(scene)`
- `web/tests/outliner-highlight.test.ts:54, 66` が `SELECTION_MESH_OPACITY` を 0.6 と material.opacity で固定、`:213-217` が SelectionRig のソース契約
- `Outliner.tsx:56` のルートは `<section className="outliner" aria-label={OUTLINER_HEADING}>`(style なし)
- `outliner.css:46-52` `.outliner__row { … min-height: 1.75rem; padding-left: calc(var(--outliner-depth, 0) * var(--space-4)); }`。
  `--outliner-depth` は `OutlinerRow.tsx:38` が行ごとに inline で渡す。`web/tests/outliner-styles.test.ts:55` が `.outliner__row` に `var(--outliner-depth, 0)` を要求する
- `styles-rules.test.ts:149-159`: `var(--x)` はフォールバック付きなら宣言不要。フォールバックは数値で書く(`var(--space-4)` を入れ子にしない)
- ジョイントのピック: `web/src/features/outliner/SelectionPickLayer.tsx:40` `jointSelectionOf(pickJoint(camera, ndc, rect, scenes))`。
  147 で `pickJoint(camera, ndc, viewport, scenes, radiusPx?)` になっている(省略時 `JOINT_PICK_RADIUS_PX`)
- `web/tests/outliner-pick.test.ts` が SelectionPickLayer のソース契約を検査する(`outliner_Summary.md:50`)
- `Outliner.tsx` は `CSSProperties` を import していない(`:1-21`)。`react` から `type CSSProperties` を足す
- `outliner_Summary.md:15, 16, 20, 21, 29` が selection-highlight.ts / SelectionRig.tsx / Outliner.tsx / outliner.css の説明と公開インターフェイス

## インターフェイス契約

```ts
// web/src/features/outliner/selection-highlight.ts(既存 export はすべて残す)
/** Mesh の重ね描きの不透明度は opacity(既定 SELECTION_MESH_OPACITY)。線・点の重ね描きは従来どおり */
export function createSelectionOverlay(object: Object3D, color: number, opacity?: number): Object3D | null;
export function applySelectionHighlight(target: Object3D, color: number, opacity?: number): void;
```

```tsx
// web/src/features/outliner/SelectionRig.tsx
//   const opacity = useViewSettingsStore(selectViewSetting("selectionOpacity"));
//   applySelectionHighlight(target, hexToNumber(color), opacity); deps は [scene, selected, color, opacity]

// web/src/features/outliner/Outliner.tsx
//   const rowHeightRem = useViewSettingsStore(selectViewSetting("outlinerRowHeightRem"));
//   const indentPx = useViewSettingsStore(selectViewSetting("outlinerIndentPx"));
//   <section className="outliner" aria-label={OUTLINER_HEADING}
//     style={{ "--outliner-row-height": `${rowHeightRem}rem`, "--outliner-indent": `${indentPx}px` } as CSSProperties}>

// web/src/features/outliner/SelectionPickLayer.tsx:40
//   pickJoint(camera, ndc, rect, scenes, useViewSettingsStore.getState().settings.jointPickRadiusPx)
```

```css
/* web/src/features/outliner/outliner.css の .outliner__row(他の宣言は従来どおり) */
min-height: var(--outliner-row-height, 1.75rem);
padding-left: calc(var(--outliner-depth, 0) * var(--outliner-indent, 16px));
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createSelectionOverlay(mesh, color)`(opacity 省略) | Mesh 重ね描きの `material.opacity === SELECTION_MESH_OPACITY`(既存テストのまま) |
| `createSelectionOverlay(mesh, color, 0.2)` | `material.opacity === 0.2`、`transparent === true` |
| `applySelectionHighlight(group, color, 0.2)` で子孫に Mesh と Line | Mesh の重ね描きは 0.2、Line の重ね描きは従来どおり |
| `SelectionRig.tsx` のソース | `selectViewSetting("selectionOpacity")` と `applySelectionHighlight(target, hexToNumber(color), opacity)` を含む |
| `Outliner.tsx` のソース | `"--outliner-row-height"` と `"--outliner-indent"` を含み、`selectViewSetting("outlinerRowHeightRem")` / `("outlinerIndentPx")` を読む |
| `outliner.css` の `.outliner__row` | `var(--outliner-row-height, 1.75rem)`、`var(--outliner-depth, 0)`、`var(--outliner-indent, 16px)` を含み、`1.75rem` が `DEFAULT_VIEW_SETTINGS.outlinerRowHeightRem` と、`16px` が `outlinerIndentPx` と一致する |
| `SelectionPickLayer.tsx` のソース | `pickJoint(camera, ndc, rect, scenes, useViewSettingsStore.getState().settings.jointPickRadiusPx)` を含む |
| `styles-rules.test.ts` / 既存の outliner テスト | すべて通る |

### 目視確認(マージ後に人間が行う)
| 操作 | 期待する結果 |
| --- | --- |
| 「選択重ね描きの不透明度」を 10% にしてメッシュを選択 | 選択色が薄くなり、下の陰影が読める |
| 「行の高さ」を 1.25rem、「字下げ」を 8px にする | アウトライナが詰まり、深い階層の名前が読める |
| 「ジョイントを拾う半径」を 32px にする | ジョイントから離れたクリックでも選択できる |

## やらないこと
- 144 のストア・UI・ラベルは変更しない
- `OutlinerRow.tsx` の `--outliner-depth` の渡し方は変えない
- 線・点の重ね描きに不透明度を足さない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md の該当ファイルの説明と公開インターフェイスが更新され、`## 他フォルダとの関係` に view-settings への参照が入っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
