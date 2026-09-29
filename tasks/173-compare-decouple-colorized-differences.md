---
id: 173
title: 「差分を着色」と「差分だけを表示」の依存を切り、2つを独立したスイッチにする
feature: compare
depends_on: []
owns: [web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/src/features/objects/CompareControls.tsx, web/src/features/objects/objects.css, web/src/features/objects/objects_Summary.md, web/tests/compare-rig.test.ts, web/tests/compare-overlay-color.test.ts, web/tests/compare-visibility.test.ts, web/tests/objects-styles.test.ts]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/features/compare/overlay.ts, web/src/features/compare/target-surface.ts, web/src/features/objects/objects-labels.ts, web/tests/compare-threshold-slider.test.ts, web/tests/objects-labels.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
現在は `colorized`(差分を着色)が false のあいだ `differencesOnly`(差分だけを表示)が
UI では操作不能、3D ビューでは無視される。2つを互いに影響しない独立したスイッチにする。
`colorized` は比較重ね描きを描くかどうかだけを、`differencesOnly` は対象の本体を隠すかどうかだけを決める。

## 前提
- `MeshCompare` の `differencesOnly?: boolean`(未指定 false)と `colorized?: boolean`(未指定 true)は
  すでに互いに独立した任意フィールドである(`shared/src/types.ts:96,98`、Zod は `:209-210`)。
  `meshCompareEquals`(`shared/src/compare.ts:43-50`)も個別に比較している。
  **shared 側は一切変更しない**(型・スキーマ・等価判定・サーバ・realtime-dispatch のいずれも変更不要)
- 依存は次の 2 箇所にしかない:
  - `web/src/features/compare/MeshCompareRig.tsx:31` の `const hideSurfaces = differencesOnly && colorized;`
    と、それを使う `:48`(重ね描きの `depthWrite`)・`:50`(依存配列)・`:53`(layer 抑止の早期 return)・
    `:57`(依存配列)
  - `web/src/features/objects/CompareControls.tsx:110` の `disabled={meshCompare.colorized === false}`
- `applyCompareOverlay(mesh, signedDistance, threshold, colors, options)` の `options` は
  `{ depthWrite?: boolean; visible?: boolean }`(`web/src/features/compare/overlay.ts:32-37`)。
  `depthWrite` は重ね描き材質の深度書き込み、`visible` は重ね描き Mesh の表示。
  **`visible` が false のときは描かれないので `depthWrite` の値は見た目に影響しない**
- `setCompareSurfacesHidden(meshes, hidden)`(`target-surface.ts`)は対象 Mesh の layer 0 を切り替え、
  描画とレイキャストの両方から本体を外す。ワイヤーフレーム重ね描きの子は残る
- `objects.css:151-153` の `.compare__checkbox:disabled + .compare__label { opacity: 0.5; }` は
  `CompareControls.tsx:110` の `disabled` のためだけに 172 で足した規則で、他に `disabled` な入力は無い
- 次のソース検査テストが今の依存を文字列で固定しており、本タスクで更新する:
  - `web/tests/compare-rig.test.ts:48`(`const hideSurfaces = ...`)、`:49`(`depthWrite: hideSurfaces`)、
    `:50` と `:52`(依存配列)
  - `web/tests/compare-overlay-color.test.ts:63`(着色 effect の依存配列)
  - `web/tests/compare-visibility.test.ts:90`(`disabled={...}` の包含)、
    `:140-153` のテスト `"disables differences-only while colorized is off"`
  - `web/tests/objects-styles.test.ts:30`(`.compare__checkbox:disabled + .compare__label {`)、
    `:55`(`disabled={...}` の包含)
- `web/tests/objects-labels.test.ts`(ラベル文字列)と `web/tests/compare-threshold-slider.test.ts`
  (`#compare-threshold` と `output.compare__value` をセレクタで取る)は影響を受けない。触らない
- `web/tests/summary-coverage.test.ts` は src / tests のファイル名が Summary に載っていることを見る。
  ファイルは増減しないので Summary は記述の更新だけでよい
- jsdom では `disabled` が外れた `<input>` の `click()` は `change` を発火する

## インターフェイス契約

### `web/src/features/compare/MeshCompareRig.tsx`

`hideSurfaces` を廃止し、2つのフラグを別々に使う。`differencesOnly` / `colorized` の定義行
(`:29-30`)と、それ以外(`thresholdWorld`、`ZERO_THRESHOLD_RATIO`、距離計算の effect、
ストア購読、戻り値 `null`)は変更しない。

```tsx
  const differencesOnly = compare.differencesOnly === true;
  const colorized = compare.colorized !== false;
  const [result, setResult] = useState<DeviationResult | null>(null);

  // …距離計算の effect(変更しない)…

  useEffect(() => {
    if (result === null) return;
    const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
    const colors = { outside: hexToNumber(outsideColor), inside: hexToNumber(insideColor) };
    for (const { mesh, signedDistance } of result.meshes) {
      applyCompareOverlay(mesh, signedDistance, threshold, colors, { depthWrite: differencesOnly, visible: colorized });
    }
  }, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly, colorized]);

  useEffect(() => {
    if (result === null || !differencesOnly) return;
    const meshes = result.meshes.map(({ mesh }) => mesh);
    setCompareSurfacesHidden(meshes, true);
    return () => setCompareSurfacesHidden(meshes, false);
  }, [result, differencesOnly]);
```

### `web/src/features/objects/CompareControls.tsx`

「差分だけを表示」の `<input>` から `disabled` 行だけを消す。他の属性・並び・
`update` の実装・`objects.length < 2` の条件は変えない。

```tsx
<input
  type="checkbox"
  className="compare__checkbox"
  checked={meshCompare.differencesOnly === true}
  onChange={(event) => update({ differencesOnly: event.target.checked })}
/>
```

### `web/src/features/objects/objects.css`

`.compare__checkbox:disabled + .compare__label` の規則(`:151-153`)を余分な空行を残さずに削除する。
`.compare__check`(`:144-149`)と `.compare__legend`(`:155-158`)を含む他の規則は変えない。

## 振る舞い

`active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 }` とする。
`input[type="checkbox"]` の並びは `[0]` 比較中も基準を表示 / `[1]` 差分を着色 / `[2]` 差分だけを表示(変更なし)。

### 3D ビュー(`MeshCompareRig`)

| 差分を着色 | 差分だけを表示 | 比較重ね描き | 対象の本体 |
| --- | --- | --- | --- |
| ON(未指定含む) | OFF(未指定含む) | `{ depthWrite: false, visible: true }` | 描く(`setCompareSurfacesHidden` を呼ばない) |
| ON | ON | `{ depthWrite: true, visible: true }` | 隠す(`setCompareSurfacesHidden(meshes, true)`) |
| OFF | OFF | `{ depthWrite: false, visible: false }` | 描く |
| OFF | ON | `{ depthWrite: true, visible: false }` | 隠す(重ね描きも描かれないので対象は何も見えない。これでよい) |

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MeshCompareRig.tsx` のソース | `const hideSurfaces` を**含まない**(文字列 `hideSurfaces` がソース全体に 1 度も出ない) |
| `MeshCompareRig.tsx` のソース | `const differencesOnly = compare.differencesOnly === true;` と `const colorized = compare.colorized !== false;` を含む |
| `MeshCompareRig.tsx` のソース | `applyCompareOverlay(mesh, signedDistance, threshold, colors, { depthWrite: differencesOnly, visible: colorized })` を含む |
| `MeshCompareRig.tsx` のソース | `}, [result, compare.thresholdPermille, outsideColor, insideColor, differencesOnly, colorized]);` を含む |
| `MeshCompareRig.tsx` のソース | `}, [result, differencesOnly]);` と `if (result === null || !differencesOnly) return;` を含む |
| `MeshCompareRig.tsx` のソース | 距離計算の effect は従来どおり `}, [base, target]);` で、中身に `thresholdPermille` を含まない(既存検査を維持) |

### UI(`CompareControls`)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `CompareControls.tsx` のソース | `disabled=` を**含まない** |
| `CompareControls.tsx` のソース | `type="checkbox"` が 3 回、`<select` が 2 回、`type="range"` が 1 回(変更なし) |
| `CompareControls.tsx` のソース | `checked={meshCompare.baseVisible === true}` / `baseVisible: event.target.checked` / `checked={meshCompare.colorized !== false}` / `colorized: event.target.checked` / `checked={meshCompare.differencesOnly === true}` / `differencesOnly: event.target.checked` をすべて含む(変更なし) |
| `CompareControls.tsx` のソースの出現順 | `COMPARE_BASE_VISIBLE_LABEL` < `COMPARE_COLORIZED_LABEL` < `COMPARE_DIFFERENCES_ONLY_LABEL` < `compare__legend`(変更なし) |
| `objects.css` | `.compare__checkbox:disabled` を**含まない**。`.compare {` / `.compare__field {` / `.compare__range {` / `.compare__check {` / `.compare__legend {` は従来どおり含む |
| 実行時: `setup({ ...active, colorized: false })` でマウント | `[1].checked === false`、**`[2].disabled === false`** |
| 実行時: 上の状態で `[2]` を click | ストアが `toEqual({ ...active, colorized: false, differencesOnly: true })`、`send` が 1 回、引数は `{ type: "mesh:compare", compare: { ...active, colorized: false, differencesOnly: true } }` |
| 実行時: `setup({ ...active, colorized: false, differencesOnly: true })` で `[1]` を click(着色 ON へ) | ストアが `toEqual({ ...active, colorized: true, differencesOnly: true })`(`differencesOnly` は保たれる)、`send` が 1 回 |
| 実行時: `setup(active)`(どちらも未指定)でマウント | `[1].checked === true`、`[2].checked === false`、`[2].disabled === false` |
| 実行時: 既存の `colorized` / `differencesOnly` / `baseVisible` の各切り替えと、同値のときに `send` しない挙動 | 従来どおり(既存テストをそのまま通す) |
| 実行時: `objects.length < 2` | 従来どおり null |

## やらないこと
- `shared/src/types.ts` / `shared/src/compare.ts` / `server/` / `web/src/app/realtime-dispatch.ts` の変更。
  両フィールドは既に独立しており、protocol の union も増えない
- `overlay.ts` / `overlay-material.ts` / `target-surface.ts` / `compare-visibility.ts` の変更。
  `CompareOverlayOptions` の意味も `setCompareSurfacesHidden` の API も変えない
- 着色 OFF のときに重ね描きを別の色や単色で描くこと。OFF のあいだは `visible: false` のまま描かない
- 着色 OFF + 差分だけを表示 ON で対象が見えなくなることへの救済(警告表示・自動 OFF・凡例の出し分けなど)。
  仕様として許容する
- チェックボックスの並び替え、ラベル文言(`objects-labels.ts`)の変更、`COMPARE_LEGEND` の変更
- `web/tests/objects-labels.test.ts` と `web/tests/compare-threshold-slider.test.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`compare-rig.test.ts` の `hideSurfaces` 3 行を新しい文字列へ差し替え、`hideSurfaces` を含まない検査を足す。
      `compare-overlay-color.test.ts:63` の依存配列を差し替え。
      `compare-visibility.test.ts` は `:90` の `disabled` 包含検査を削り、
      `"disables differences-only while colorized is off"` を「着色 OFF でも差分だけを表示を切り替えられる」
      テストに置き換える。`objects-styles.test.ts` は `:30` と `:55` の 2 行を削る)
- [ ] `compare_Summary.md` の「他フォルダとの関係」から「`colorized` が false のあいだは重ね描きを
      `visible = false` にして描画から外し、`differencesOnly` は無視して対象の本体を描く」を、
      「`colorized` と `differencesOnly` は互いに独立で、`colorized` が false のあいだは重ね描きを
      `visible = false` にして描画から外し、`differencesOnly` が true のあいだは着色の有無に関わらず
      対象の本体を layer 0 から外す(両方が効いているときは対象が見えなくなる)」に書き換えている
- [ ] `objects_Summary.md` の `CompareControls.tsx` の行から「着色 OFF のあいだ差分だけを表示を無効化する」を
      外し、2つのチェックボックスが互いに独立であることを書いている。`objects.css` の行から
      「無効なチェックのラベルは薄く表示する」を外している
- [ ] すべてのファイルが300行以内(`MeshCompareRig.tsx` 60 行、`CompareControls.tsx` 119 行、
      `objects.css` 158 行、`compare-rig.test.ts` 53 行、`compare-overlay-color.test.ts` 66 行、
      `compare-visibility.test.ts` 197 行、`objects-styles.test.ts` 75 行)
- [ ] verify: に書いたコマンドが成功する
