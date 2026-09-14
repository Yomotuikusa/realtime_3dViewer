---
id: 095
title: web アウトライナで選択したオブジェクトを 3D ビューでハイライトする
feature: web
depends_on: [094]
owns: [web/src/features/outliner/selection-highlight.ts, web/src/features/outliner/SelectionRig.tsx, web/src/features/outliner/outliner_Summary.md, web/tests/outliner-highlight.test.ts]
reads: [web/src/features/outliner/selection.ts, web/src/features/outliner/outliner-tree.ts, web/src/features/compare/model-scenes.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/overlay.ts, web/src/features/compare/deviation.ts, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/pick.ts, web/src/styles/tokens.css, web/tests/mesh-display.test.ts, web/tests/compare-overlay.test.ts, web/tests/compare-rig.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
094 のアウトライナで行を選択したとき、対応する three オブジェクト(とその子孫)を 3D ビュー上で
accent 色に重ね描きして、どこにあるかが分かるようにする。選択状態は 094 の `useSelectionStore` に
既にあるので、本タスクはそれを読んで重ね描きを付け外しする Canvas 用の Rig と純粋関数を作る。
Rig を `ViewerCanvas` の子として置くのは 096 の仕事。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 選択は `useSelectionStore` の `selected: { versionId, objectId } | null`。`objectId` は three オブジェクトの `uuid`。
  web/src/features/outliner/selection.ts
- 版の scene は `useModelScenesStore` の `scenes`(versionId → ルート `Object3D`)。`selectModelScene(scenes, versionId)` は
  未登録なら `null`。web/src/features/compare/model-scenes.ts:36-42
- three の `Object3D.getObjectByProperty("uuid", value)` は自身と子孫から最初に一致するものを返し、無ければ `undefined`
- 既存の重ね描きの作り方は `createWireframeOverlay(mesh)`(web/src/features/viewer/mesh-display.ts:44-60):
  同じ geometry を共有した `Mesh` / `SkinnedMesh` を作り、`SkinnedMesh` なら `bindMode` を写して
  `bind(mesh.skeleton, mesh.bindMatrix)`、`morphTargetInfluences` / `morphTargetDictionary` を共有、
  `raycast = () => undefined`、`userData[MESH_DISPLAY_OVERLAY_KEY] = true` と `userData[VIEWER_OVERLAY_KEY] = true`。
  比較重ね描き(compare/overlay.ts:52-75)も同じ流儀で、`renderOrder = -1` を加える
- `VIEWER_OVERLAY_KEY` を付けたオブジェクトは、`applyMeshDisplay`(表示モード適用)、比較の距離計算
  (`deviation.ts:17`)、094 のアウトライナ木から**自動的に除外される**。したがって本タスクの重ね描きにも
  必ずこのキーを付ける
- `applyMeshDisplay` は自分の重ね描き(`MESH_DISPLAY_OVERLAY_KEY`)だけを外す。他のキーの子には触らない。
  web/src/features/viewer/mesh-display.ts:78-100
- Canvas 用 Rig の前例は `MeshCompareRig`(web/src/features/compare/MeshCompareRig.tsx)。`null` を返す
  React コンポーネントで、ストアを購読し `useEffect` の cleanup で重ね描きを外す
- accent 色は tokens.css の `--color-accent: #175cd3`。TS 側の色定数は `WIREFRAME_OVERLAY_COLOR = 0x1f2937` の
  ように数値リテラルで書く(CSS の生色禁止は `.css` ファイルだけが対象)
- `InstancedMesh` は `createWireframeOverlay` の対象外(`applyMeshDisplay` が除外)。本タスクでも同じ扱い
- `web/tests/summary-coverage.test.ts` は新規ファイルとテストが outliner_Summary.md に載っていることを検査する

## インターフェイス契約

### 新規 web/src/features/outliner/selection-highlight.ts

```ts
import type { Object3D } from "three";

/** 選択重ね描きの userData キー。値は true */
export const SELECTION_OVERLAY_KEY = "outlinerSelectionOverlay";
/** tokens.css の --color-accent と同じ色 */
export const SELECTION_COLOR = 0x175cd3;
/** Mesh 重ね描きの不透明度 */
export const SELECTION_MESH_OPACITY = 0.35;

/** userData[SELECTION_OVERLAY_KEY] === true なら選択重ね描き */
export function isSelectionOverlay(object: Object3D): boolean;

/**
 * object と同じ geometry を共有する重ね描きを作る。対象外なら null。
 * - Mesh(InstancedMesh を除く。SkinnedMesh 含む): MeshBasicMaterial({ color: SELECTION_COLOR, transparent: true,
 *   opacity: SELECTION_MESH_OPACITY, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
 *   polygonOffsetUnits: -1, toneMapped: false })。SkinnedMesh は createWireframeOverlay と同じ bind / morph 共有
 * - Line / LineSegments / LineLoop: 元と同じクラスで LineBasicMaterial({ color: SELECTION_COLOR, depthTest: false, toneMapped: false })
 * - Points: PointsMaterial({ color: SELECTION_COLOR, size, sizeAttenuation, depthTest: false, toneMapped: false })。
 *   size / sizeAttenuation は元の material が PointsMaterial ならそれを写し、そうでなければ 1 / true
 * - それ以外(Group / Bone / Light / Camera / InstancedMesh など): null
 * 共通: raycast = () => undefined、renderOrder = 1、userData[SELECTION_OVERLAY_KEY] = true、userData[VIEWER_OVERLAY_KEY] = true
 */
export function createSelectionOverlay(object: Object3D): Object3D | null;

/**
 * target 自身と子孫のうち、isViewerOverlay でないものへ createSelectionOverlay の結果を子として add する。
 * 既に選択重ね描きを持つオブジェクトには追加しない(冪等)。traverse 中に add せず、先に対象を集めてから add する
 */
export function applySelectionHighlight(target: Object3D): void;

/** root 配下の選択重ね描きをすべて親から remove し、material を dispose する(geometry は共有なので触らない) */
export function clearSelectionHighlight(root: Object3D): void;
```

### 新規 web/src/features/outliner/SelectionRig.tsx

```tsx
/** Canvas に 1 つだけ置く描画なしの部品。選択ストアと scene レジストリから選択重ね描きを管理する */
export function SelectionRig(): null;
```

- `selected = useSelectionStore((state) => state.selected)`、`scenes = useModelScenesStore((state) => state.scenes)`
- `scene = selectModelScene(scenes, selected?.versionId ?? null)`
- `useEffect(() => { if (scene === null || selected === null) return; const target = scene.getObjectByProperty("uuid", selected.objectId); if (target === undefined) return; applySelectionHighlight(target); return () => clearSelectionHighlight(scene); }, [scene, selected])`
- JSX を返さない(`return null`)。`send` や props は受け取らない

## 振る舞い

### selection-highlight(web/tests/outliner-highlight.test.ts)

three のクラスを `new` して組み立てる(web/tests/mesh-display.test.ts の組み立て方を参照)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 定数 | `SELECTION_OVERLAY_KEY === "outlinerSelectionOverlay"`、`SELECTION_COLOR === 0x175cd3`、`SELECTION_MESH_OPACITY === 0.35` |
| `createSelectionOverlay(mesh)`(Mesh + BoxGeometry + MeshStandardMaterial) | `Mesh` を返す。`geometry` が同一参照。`material` が `MeshBasicMaterial` で `color.getHex() === 0x175cd3`、`transparent === true`、`opacity === 0.35`、`depthWrite === false`、`polygonOffset === true`、`polygonOffsetFactor === -1`、`toneMapped === false` |
| 上記の戻り値 | `renderOrder === 1`、`userData[SELECTION_OVERLAY_KEY] === true`、`userData[VIEWER_OVERLAY_KEY] === true`、`isSelectionOverlay` と `isViewerOverlay` が `true`。`raycast(new Raycaster(), [])` を呼んでも配列が空のまま |
| `createSelectionOverlay(skinnedMesh)`(`new Skeleton([bone])` を bind 済み) | `SkinnedMesh` を返し、`skeleton` が同一参照、`bindMode` が一致 |
| `createSelectionOverlay(new InstancedMesh(geometry, material, 2))` | `null` |
| `createSelectionOverlay(new Line(...))` / `LineSegments` / `LineLoop` | それぞれ `Line` / `LineSegments` / `LineLoop` の**同じクラス**(`constructor` が一致)。`material` が `LineBasicMaterial` で `depthTest === false`、`color.getHex() === 0x175cd3`。`geometry` が同一参照 |
| `createSelectionOverlay(points)`(PointsMaterial size 3, sizeAttenuation false) | `Points` を返し、`material` が `PointsMaterial` で `size === 3`、`sizeAttenuation === false`、`depthTest === false` |
| `createSelectionOverlay(points)`(material が `MeshBasicMaterial` など PointsMaterial でない) | `PointsMaterial` の `size === 1`、`sizeAttenuation === true` |
| `createSelectionOverlay(new Group())` / `new Bone()` / `new DirectionalLight()` / `new PerspectiveCamera()` | `null` |
| `applySelectionHighlight(group)`(group > Mesh "A" > Mesh "B"、group > Line "L"、group > Bone、A の子に `VIEWER_OVERLAY_KEY` 付き Mesh) | A・B・L の `children` にそれぞれ選択重ね描きが 1 つずつ。Bone と VIEWER_OVERLAY 付き Mesh には付かない。group 自身にも付かない |
| `applySelectionHighlight(group)` を 2 回呼ぶ | 重ね描きの数が増えない |
| `applySelectionHighlight(mesh)`(単体の Mesh を target に) | mesh の `children` に重ね描きが 1 つ |
| `clearSelectionHighlight(group)`(上記の後) | 選択重ね描きが 0 個(`traverse` で `isSelectionOverlay` を数える)。重ね描きの `material.dispose` が呼ばれる(`vi.spyOn`)。元の Mesh / Line の `material.dispose` は呼ばれない。VIEWER_OVERLAY 付きの既存 Mesh(他機能の重ね描き)は残る |
| `clearSelectionHighlight` を重ね描きの無い root に呼ぶ | 例外なし |
| Mesh 重ね描きを持つ mesh に `applyMeshDisplay(mesh, "wireframe")` → `"solid"` | 選択重ね描きが残る(mesh-display は他キーの子を外さない)。`applyMeshDisplay` が選択重ね描きの material の `wireframe` を変えない(`MeshBasicMaterial.wireframe` が `false` のまま) |

### ソース検査(同じ web/tests/outliner-highlight.test.ts に追加)

`web/tests/mesh-display.test.ts` の `readSource` をそのまま真似る。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `features/outliner/SelectionRig.tsx` | `export function SelectionRig(): null` を含む。`getObjectByProperty("uuid"`、`applySelectionHighlight(`、`clearSelectionHighlight(`、`useSelectionStore(`、`useModelScenesStore(`、`selectModelScene(` を含む |
| `features/outliner/SelectionRig.tsx` | `send` を含まない。`useFrame` を含まない(毎フレーム処理は不要) |
| `features/outliner/selection-highlight.ts` | `VIEWER_OVERLAY_KEY` を `../viewer/mesh-display` から import している |
| `features/viewer/ViewerCanvas.tsx` / `features/viewer/mesh-display.ts` / `features/compare/overlay.ts` | `SelectionRig` / `SELECTION_OVERLAY_KEY` を含まない(本タスクではこれらを変更しない) |

### 見た目と操作(手動確認。096 で配置後)

| 操作 | 期待する結果 |
| --- | --- |
| アウトライナでメッシュの行を選択 | そのメッシュだけが青(accent)の半透明で覆われる。他のメッシュは変わらない |
| グループやボーンの行を選択 | 配下のメッシュ・カーブ・ポイントがすべて覆われる |
| 版の行を選択 | そのモデル全体が覆われる |
| カーブの行を選択 | 線が青で描かれ、他のメッシュに隠れていても見える |
| 同じ行をもう一度クリック(解除) | 重ね描きが消える |
| 別の行をクリック | 前の重ね描きが消え、新しい対象だけが覆われる |
| 選択したままアニメーション再生 | 重ね描きが本体に追従する(SkinnedMesh も) |
| 選択したまま表示モードを切り替える | ワイヤフレーム表示に変わっても重ね描きはそのまま残る |
| 選択したまま比較(対象/基準)を有効にする | 比較の色分けと選択の重ね描きが共存する。選択したメッシュがレイキャスト(コメントのピン / ペン)を二重に拾わない |

## 実装メモ
- `SkinnedMesh` の bind は `createWireframeOverlay` と同じ手順にする。`mesh-display.ts` の関数を直接呼ばず
  (material が違うため)本ファイルで同じ処理を書く。ただし `VIEWER_OVERLAY_KEY` は import する
- 重ね描きの geometry は元と共有するので、`clearSelectionHighlight` で **geometry を dispose しない**
- `applySelectionHighlight` は target 自身から traverse する。target が Mesh なら target 自身にも付く
- `selected` はあるが `scenes` に scene がまだ無い(読み込み中)場合は何もしない。後で登録されれば
  `scenes` の参照が変わり effect が再実行される
- 選択中に scene がアンマウントされて `unregister` された場合、cleanup が旧 scene に対して走るだけで例外にしない

## やらないこと
- `ViewerCanvas.tsx` / `ReviewPage.tsx` への `SelectionRig` の配置(096)
- アウトリング(輪郭線)描画やポストプロセス(EffectComposer / OutlinePass)の導入
- `InstancedMesh` のハイライト
- 3D ビュー側のクリックでアウトライナの行を選択する(逆方向の連動)
- 選択のルーム共有
- `mesh-display.ts` / `overlay.ts` / `deviation.ts` / `model-scenes.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・material 設定・userData キーで実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md を更新している。具体的には `selection-highlight.ts` / `SelectionRig.tsx` を
      ファイル一覧と公開インターフェイスに追加し、他機能との関係に「重ね描きは `VIEWER_OVERLAY_KEY` を持つので
      表示モード・比較・アウトライナ木から除外される。Rig の配置は ReviewPage(096)」を書き、
      テスト節に `tests/outliner-highlight.test.ts` を載せる
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
