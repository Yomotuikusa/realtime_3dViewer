---
id: 171
title: 着色 OFF のあいだ比較重ね描きを非表示にし、「差分だけを表示」を無視して対象の本体を描く
feature: compare
depends_on: [170]
owns: [web/src/features/compare/overlay.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/compare-overlay.test.ts, web/tests/compare-rig.test.ts, web/tests/compare-overlay-color.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/features/compare/deviation.ts, web/src/features/compare/target-surface.ts, web/src/features/compare/overlay-material.ts, web/src/features/compare/overlay-geometry.ts, web/src/store/display.ts, web/tests/compare-overlay-shader.test.ts, web/tests/compare-target-surface.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
170 で `MeshCompare` に載った `colorized`(未指定 true)が false のあいだ、比較の赤・青の重ね描きを
3D ビューから消す。基準・対象・しきい値の選択は保持したまま、対象を素のメッシュとして見比べられるようにする。
着色 OFF のときに `differencesOnly` まで効くと対象が本体も差分も描かれず完全に消えてしまうため、
このあいだは `differencesOnly` を無視して本体を描く。チェックボックス(172)は別タスク。

## 前提
- 170 で `MeshCompare` に任意フィールド `colorized?: boolean` が入っている(`shared/src/types.ts`)。
  **未指定は true(着色する)**。`meshCompareEquals` は未指定と true を同値として比較する。
  web の display ストア(`web/src/store/display.ts`)は `MeshCompare` を丸ごと `meshCompare` に持つ
- 現在の `MeshCompareRig.tsx`(56 行)は 3 つの `useEffect` を持つ。
  1 つ目(`:32-39`、依存 `[base, target]`)が `computeDeviation(target, base)` の結果を `result` state に置き、
  cleanup で `clearCompareOverlays(target)` と `setResult(null)` を行う。
  2 つ目(`:41-46`、依存 `[result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly]`)が
  `result.meshes` の各 `{ mesh, signedDistance }` に
  `applyCompareOverlay(mesh, signedDistance, threshold, colors, differencesOnly)` を呼ぶ。
  3 つ目(`:48-53`、依存 `[result, differencesOnly]`)が `differencesOnly` のとき
  `setCompareSurfacesHidden(meshes, true)` を呼び、cleanup で `false` に戻す
- `applyCompareOverlay`(`overlay.ts:61-79`)は現在
  `(mesh, signedDistance, threshold, colors, differencesOnly = false)` の 5 引数で、
  既存の重ね描き(`isMeshCompareOverlay` な子)を再利用し、無ければ `createCompareOverlay(mesh)` で作って
  `mesh.add(overlay)` する。`(overlay.material as Material).depthWrite = differencesOnly;` を毎回書いてから
  距離と uniform を更新する。**このタスクで第 5 引数をオプションオブジェクトへ変える**
- `createCompareOverlay`(`overlay.ts:40-58`)は `overlay.raycast = () => undefined`、`renderOrder = -1`、
  `userData[MESH_COMPARE_OVERLAY_KEY] = true` を設定する。`visible` には触れないので既定の `true` である。
  材質は `createCompareOverlayMaterial()` の `MeshBasicMaterial`(`transparent: true`、`opacity: 0.85`、`depthWrite: false`)。
  **`createCompareOverlayMaterial` と `createCompareOverlay` の振る舞いは変えない**。
  `web/tests/compare-overlay-shader.test.ts:23` が生成直後の `depthWrite === false` を検査しており、このタスクでは触らない
- three の描画(`WebGLRenderer.projectObject`)は `object.visible === false` ならその子ごと描画しない。
  重ね描きは葉なので `overlay.visible = false` だけで描画から外れる。`raycast` は元から無効化済み
- `setCompareSurfacesHidden(meshes, hidden)`(`target-surface.ts`)は対象本体の layer 0 を外す / 戻す。
  このタスクでは呼び出し条件だけを変え、関数自体は変更しない
- `applyCompareOverlay` の呼び出し元は `MeshCompareRig.tsx` と web/tests の 3 本
  (`compare-overlay.test.ts`、`compare-overlay-color.test.ts`、および型のみ参照)だけである(grep 済み)。
  すべて owns: に含めてある
- 次のソース検査テストが Rig の依存配列を文字列で見ており、本タスクで書き換える:
  - `web/tests/compare-rig.test.ts:47-49`:
    `applyCompareOverlay(mesh, signedDistance, threshold, colors, differencesOnly)`、
    `}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly]);`、
    `}, [result, differencesOnly]);`
  - `web/tests/compare-overlay-color.test.ts:63`:
    `}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly]);`
  - `compare-rig.test.ts:39-47` の計算 effect の正規表現
    `/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[base, target\]\);/` と
    `setCompareSurfacesHidden(` / `not.toContain("useFrame")` の検査は**そのまま残す**
- `web/tests/compare-overlay.test.ts`(203 行)は `function mesh()`(`:27`)で
  `new Mesh(new BoxGeometry(), new MeshStandardMaterial())` を作る。`:141-161` が depthWrite の検査で、
  第 5 引数を `true` / `false` / 省略で呼んでいる。ここをオプションオブジェクトに書き換え、`visible` の検査を足す
- `web/tests/summary-coverage.test.ts` は src 配下の各ファイルの相対パスと tests 配下の各テストファイル名が
  Summary に載っていることを検査する。**このタスクでファイルは増えない**ので記述の更新だけでよい

## インターフェイス契約

### `web/src/features/compare/overlay.ts`

```ts
/** 比較重ね描きの見え方。呼び出しごとに必ず書き直す(省略時は既定値を書く) */
export interface CompareOverlayOptions {
  /** 材質の depthWrite。未指定は false */
  depthWrite?: boolean;
  /** 重ね描き Mesh の visible。未指定は true */
  visible?: boolean;
}

/**
 * 比較重ね描きを作成または再利用し、距離と uniform を更新する。
 * options の depthWrite / visible は作成時・再利用時とも毎回書く(未指定なら既定値を書き戻す)。
 */
export function applyCompareOverlay(
  mesh: Mesh,
  signedDistance: Float32Array,
  threshold: number,
  colors: CompareColors,
  options: CompareOverlayOptions = {},
): Mesh;
```

他の export(`createCompareOverlay`、`clearCompareOverlays`、`isMeshCompareOverlay`、`MESH_COMPARE_OVERLAY_KEY`、
再 export 群)は変えない。`CompareOverlayOptions` は overlay.ts で定義して export する。

### `web/src/features/compare/MeshCompareRig.tsx`

`differencesOnly` の宣言の直後に次の 2 行を置き、2 つ目・3 つ目の effect を次の形にする
(ソース検査テストが文字列で見るので**この通り**に書く)。

```tsx
const differencesOnly = compare.differencesOnly === true;
const colorized = compare.colorized !== false;
const hideSurfaces = differencesOnly && colorized;

// 1 つ目の計算 effect(依存 [base, target])は変えない

useEffect(() => {
  if (result === null) return;
  const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
  const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) };
  for (const { mesh, signedDistance } of result.meshes) {
    applyCompareOverlay(mesh, signedDistance, threshold, colors, { depthWrite: hideSurfaces, visible: colorized });
  }
}, [result, compare.thresholdPermille, outsideColor, insideColor, hideSurfaces, colorized]);

useEffect(() => {
  if (result === null || !hideSurfaces) return;
  const meshes = result.meshes.map(({ mesh }) => mesh);
  setCompareSurfacesHidden(meshes, true);
  return () => setCompareSurfacesHidden(meshes, false);
}, [result, hideSurfaces]);
```

`ZERO_THRESHOLD_RATIO` と `thresholdWorld` は変えない。

## 振る舞い

`box()` = `new Mesh(new BoxGeometry(), new MeshStandardMaterial())`、
`d` = `new Float32Array(24)`、`colors` = `{ outside: 1, inside: 2 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyCompareOverlay(a, d, 0.5, colors)`(第 5 引数なし) | 材質の `depthWrite === false`、重ね描きの `visible === true`、`transparent === true`、`opacity === 0.85`、`renderOrder === -1` |
| `applyCompareOverlay(a, d, 0.5, colors, {})` | 同上(空オブジェクトでも既定値が書かれる) |
| `applyCompareOverlay(a, d, 0.5, colors, { depthWrite: true })` | 同じ重ね描きインスタンスで `depthWrite === true`、`visible === true` |
| `applyCompareOverlay(a, d, 0.5, colors, { visible: false })` | 同じ重ね描きインスタンスで `visible === false`、`depthWrite === false` |
| `{ depthWrite: true, visible: false }` で呼んだ後に第 5 引数なしで呼ぶ | 同じインスタンス(`a.children.length === 1`)で `depthWrite === false`、`visible === true` に戻る |
| `{ visible: false }` の後に `{ visible: true }` | `visible === true`。距離属性と uniform は最後の呼び出しの値で更新されている |
| `{ visible: false }` で呼んでも | `a.children.length === 1`(重ね描きは外さない)。`writeCompareDistance` / `setCompareOverlayUniforms` は通常どおり走り、`compareThreshold` uniform が引数どおりに更新される |
| 既存の検査(geometry の属性共有、SkinnedMesh、再利用で同一インスタンス、`raycast` 無効、`clearCompareOverlays` での破棄、色 uniform の更新) | すべてそのまま通る |
| Rig のソース | `const colorized = compare.colorized !== false;` と `const hideSurfaces = differencesOnly && colorized;` を含む |
| Rig のソース | `applyCompareOverlay(mesh, signedDistance, threshold, colors, { depthWrite: hideSurfaces, visible: colorized })` を含む |
| Rig のソース | `}, [result, compare.thresholdPermille, outsideColor, insideColor, hideSurfaces, colorized]);`、`}, [result, hideSurfaces]);`、`}, [base, target]);` を含む(`compare-rig.test.ts` と `compare-overlay-color.test.ts:63` の両方を新文字列に合わせる) |
| Rig のソース | `setCompareSurfacesHidden(` を含み、`useFrame` を含まない。計算 effect の中身は `computeDeviation(target, base)` を含み `thresholdPermille` を含まない(既存検査をそのまま残す) |
| 実行時: `colorized` が true → false | 2 つ目の effect が再実行され重ね描きが `visible = false` になる。`differencesOnly` が true だった場合は `hideSurfaces` が false になるので 3 つ目の effect の cleanup が走り、対象本体の layer 0 が戻る(本体が描かれる) |
| 実行時: `colorized` が false のまま `differencesOnly` を ON / OFF | `hideSurfaces` は false のままなので何も変わらない(本体は描かれ続け、重ね描きは非表示のまま) |
| 実行時: `colorized` が false → true で `differencesOnly` が true | `hideSurfaces` が true になり、重ね描きが `visible = true`・`depthWrite = true`、対象本体が layer 0 から外れる |
| 実行時: `colorized` が false のまま対象の版を切り替える | 新しい `result` で重ね描きが作り直され、2 つ目の effect が同じコミットで走って `visible = false` になる |
| 実行時: `computeDeviation` が null を返す(基準に三角形が無い) | `result` が null なので何も起きない |

## やらないこと
- `colorized` のチェックボックスと「差分だけを表示」の `disabled` 化(`CompareControls.tsx`、`objects-labels.ts`)。172 の担当
- `createCompareOverlayMaterial` / `createCompareOverlay` の既定値(`depthWrite: false`、`opacity`、`transparent`、`visible`)の変更。
  `web/tests/compare-overlay-shader.test.ts` は触らない
- `target-surface.ts` の変更。`setCompareSurfacesHidden` は呼び出し条件だけを変える。
  `web/tests/compare-target-surface.test.ts` も触らない
- 着色 OFF のときに距離計算(`computeDeviation`)や重ね描きの生成そのものを止めること。
  再 ON を即時に反映するため、計算結果と重ね描きは保持して `visible` だけで切る
- `compare-visibility.ts` / `ViewerCanvas.tsx` の変更(基準の描画抑止は従来どおり `baseVisible` で決める)。
  `web/tests/compare-visibility.test.ts` は 172 が所有するので触らない
- `deviation.ts` / `overlay-geometry.ts` / `overlay-material.ts` / `model-scenes.ts` の変更
- 凡例(`COMPARE_LEGEND`)の文言変更や着色 OFF 時の非表示化

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`applyCompareOverlay` のオプションは `web/tests/compare-overlay.test.ts`、
      Rig のソース検査は `web/tests/compare-rig.test.ts` と `web/tests/compare-overlay-color.test.ts`)
- [ ] `compare_Summary.md` の「公開インターフェイス」の overlay.ts の行を
      `applyCompareOverlay(mesh, signedDistance, threshold, colors, options)` と `CompareOverlayOptions` に更新し、
      「他フォルダとの関係」に「`colorized` が false のあいだは重ね描きを `visible = false` にして描画から外し、
      `differencesOnly` は無視して対象の本体を描く」を追記している
- [ ] すべてのファイルが300行以内(`overlay.ts` は現在 104 行、`MeshCompareRig.tsx` は 56 行、
      `compare-overlay.test.ts` は 203 行、`compare-rig.test.ts` は 51 行、`compare-overlay-color.test.ts` は 66 行)
- [ ] verify: に書いたコマンドが成功する
