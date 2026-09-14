---
id: 102
title: web アウトライナ木に部位パスを持たせ、共有された非表示を 3D ビューへ適用する
feature: web
depends_on: [099, 101]
owns: [web/src/features/outliner/outliner-tree.ts, web/src/features/outliner/visibility.ts, web/src/features/outliner/VisibilityRig.tsx, web/src/features/outliner/outliner_Summary.md, web/tests/outliner-tree.test.ts, web/tests/outliner-visibility.test.ts, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/tests/layout-styles.test.ts]
reads: [shared/src/types.ts, shared/src/object-part.ts, web/src/store/objects.ts, web/src/store/store_Summary.md, web/src/features/compare/model-scenes.ts, web/src/features/outliner/SelectionRig.tsx, web/src/features/outliner/Outliner.tsx, web/src/features/outliner/OutlinerRow.tsx, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/pick.ts, web/tests/outliner-highlight.test.ts, web/tests/summary-coverage.test.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
部位(版内オブジェクト)をルーム共有の鍵 `ObjectPath`(子インデックスのパス)で扱えるように、
アウトライナ木の各ノードに `path` を持たせる。そして objects ストアの `hiddenParts` を購読して
各版の scene の `visible` を同期する Canvas 用 Rig を作り、ReviewPage に置く。
これにより他者が非表示にした部位が自分の 3D ビューにも反映される。切り替える UI は 103。

## 前提
- `OutlinerNode` は `{ id(uuid), name, kind, children }`。`buildNode` は `isViewerOverlay` でない子だけを木に入れる。
  web/src/features/outliner/outliner-tree.ts:6-34。`web/tests/outliner-tree.test.ts:91` は `Object.keys(tree)` の順序を断言している
- `ObjectPath` は `"0/2/1"` の形で、ルート自身は表せない(空文字は不正)。shared/src/types.ts(098)。
  `objectPathIndices(path)` / `joinObjectPath(indices)` が `@shared/object-part` にある
- 「子インデックス」は **`isViewerOverlay` でない子だけを数えた** インデックスである(設計書 §13.5)。
  重ね描き(表示モード・比較・選択)は `object.add` で末尾に足されるが、それに依存せず常に除外して数える
- objects ストアに `hiddenParts: ObjectPartRef[]` と `hiddenObjectPaths(hiddenParts, versionId): ObjectPath[]` がある(101)。web/src/store/objects.ts
- 版の scene は `useModelScenesStore` の `scenes`(versionId → ルート `Object3D`)。web/src/features/compare/model-scenes.ts
- 版のルートの `visible` は `ModelMesh` の `<primitive object={scene} visible={…} />` が版単位の表示状態から制御している
  (web/src/features/viewer/ModelMesh.tsx:40)。本タスクの Rig は **ルート自身の `visible` を触ってはならない**
- three.js は親の `visible === false` なら子孫を描かない。コメントのピック(pick.ts `isVisibleInScene`)も祖先まで見るので、
  `visible` を切るだけで描画とピックの両方が非表示になる
- Canvas 用 Rig の前例は `SelectionRig`(props なし、`null` を返す、ストア購読 + `useEffect`)。web/src/features/outliner/SelectionRig.tsx
- `web/tests/layout-styles.test.ts:64-72` は ReviewPage の `<SelectionRig />` の位置と個数を断言している。
  `web/tests/summary-coverage.test.ts` は新規ファイルとテストが Summary に載っていることを検査する

## インターフェイス契約

### 変更 web/src/features/outliner/outliner-tree.ts

```ts
export interface OutlinerNode {
  /** object.uuid(ローカル専用。ルーム共有には使わない) */
  id: string;
  /** 版の scene ルートからの子インデックスのパス(ObjectPath)。ルートは ""。ルーム共有の鍵 */
  path: string;
  name: string;
  kind: OutlinerNodeKind;
  children: OutlinerNode[];
}

/** 重ね描きを除いた子の配列 */
export function plainChildren(object: Object3D): Object3D[];

/** 親のパスと子インデックスから子のパスを作る。"" + 0 → "0"、"0" + 2 → "0/2" */
export function childPath(parentPath: string, index: number): string;

/**
 * path が指すオブジェクト。"" は root 自身。各インデックスは plainChildren の中で数える。
 * 範囲外・不正な形式(空要素・数字以外・負数)なら null
 */
export function objectAtPath(root: Object3D, path: string): Object3D | null;
```

- `buildNode` はノードを `{ id, path, name, kind, children }` の**この順のキー**で作る
- 既存の `classifyObject` / `buildOutlinerTree` / `toggleId` のシグネチャは変えない

### 新規 web/src/features/outliner/visibility.ts

```ts
import type { Object3D } from "three";

/**
 * scene 配下(scene 自身は除く)の、重ね描きでないすべてのオブジェクトについて、
 * その path が hiddenPaths に含まれるなら visible = false、含まれないなら visible = true にする。
 * 非表示にした親の子孫も走査して自身の値を設定する(親の表示復帰時に子の状態が正しくなるように)。
 * 重ね描き(isViewerOverlay)とその子孫の visible は触らない。scene 自身の visible も触らない。
 */
export function applyPartVisibility(scene: Object3D, hiddenPaths: readonly string[]): void;
```

### 新規 web/src/features/outliner/VisibilityRig.tsx

```tsx
/** Canvas に 1 つだけ置く描画なしの部品。objects ストアの hiddenParts を各版の scene の visible に同期する */
export function VisibilityRig(): null;
```

- `hiddenParts = useObjectsStore((state) => state.hiddenParts)`、`scenes = useModelScenesStore((state) => state.scenes)`
- `useEffect(() => { for (const [versionId, scene] of Object.entries(scenes)) applyPartVisibility(scene, hiddenObjectPaths(hiddenParts, versionId)); return () => { for (const scene of Object.values(scenes)) applyPartVisibility(scene, []); }; }, [scenes, hiddenParts])`
- `send` や props は受け取らない。`useFrame` は使わない

### 変更 web/src/app/ReviewPage.tsx

`import { VisibilityRig } from "../features/outliner/VisibilityRig";` を追加し、`ViewerCanvas` の children の
`<SelectionRig />` の**直後**に `<VisibilityRig />` を置く。他は変更しない。

## 振る舞い

### web/tests/outliner-tree.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 既存 "builds an ordered plain hierarchy and omits overlays" の期待値 | 各ノードに `path` を足す: Root `""`、Body `"0"`、Rig `"1"`、Hip `"1/0"`、Spine `"1/0/0"`、Guide `"2"`。`Object.keys(tree)` が `["id", "path", "name", "kind", "children"]` |
| 重ね描きが子の**先頭**にある場合(`body.children` の先頭に VIEWER_OVERLAY 付き Mesh、その後ろに通常の Mesh "Inner") | Inner の `path` は `"0/0"`(重ね描きを数えない) |
| `plainChildren(body)` | 重ね描きを含まない配列 |
| `childPath("", 0)` / `childPath("0", 2)` / `childPath("0/2", 1)` | `"0"` / `"0/2"` / `"0/2/1"` |
| `objectAtPath(root, "")` | root 自身 |
| `objectAtPath(root, "1/0/0")` | spine |
| `objectAtPath(root, "0/0")`(上記の重ね描き先頭ケース) | Inner(重ね描きではない) |
| `objectAtPath(root, "9")` / `"1/0/0/0"` / `"a"` / `"/0"` / `"0/"` / `"-1"` | `null` |
| 既存の他の it | 変更なしで通る |

### web/tests/outliner-visibility.test.ts(新規)

three のクラスを `new` して組み立てる(outliner-highlight.test.ts と同じ流儀)。
構成: root > A(Mesh "0") > A1(Mesh "0/0")、root > B(Group "1") > B0(Mesh "1/0")、A の子に VIEWER_OVERLAY 付き Mesh(先頭に add)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyPartVisibility(root, ["0"])` | A.visible false、A1.visible true、B / B0 true、root.visible true(触らない)、重ね描き.visible true |
| 続けて `applyPartVisibility(root, ["0/0", "1"])` | A true、A1 false、B false、B0 true |
| 続けて `applyPartVisibility(root, [])` | すべて true |
| 重ね描きの `visible` を手で false にしてから `applyPartVisibility(root, [])` | 重ね描きは false のまま(触らない) |
| root.visible を false にしてから `applyPartVisibility(root, [])` | root は false のまま |
| `applyPartVisibility(root, ["9", "0/5"])`(存在しないパス) | 例外なし、すべて true |
| 同じ引数で 2 回呼ぶ | 結果が変わらない |

### ソース検査(同じ web/tests/outliner-visibility.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `features/outliner/VisibilityRig.tsx` | `export function VisibilityRig(): null`、`useObjectsStore(`、`useModelScenesStore(`、`hiddenObjectPaths(`、`applyPartVisibility(` を含む。`send`、`useFrame` を含まない |
| `features/outliner/visibility.ts` | `isViewerOverlay` を `../viewer/mesh-display` から import している |
| `features/viewer/ModelMesh.tsx` / `features/viewer/mesh-display.ts` | `VisibilityRig` / `applyPartVisibility` を含まない(変更しない) |

### web/tests/layout-styles.test.ts(更新。"orders the outliner, viewer, and panel columns" に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `app/ReviewPage.tsx` | `<VisibilityRig />` がちょうど 1 回。`<SelectionRig />` より後、`</ViewerCanvas>` より前 |

## 実装メモ
- `applyPartVisibility` は `plainChildren` と `childPath` を使って再帰し、`hiddenPaths` は `Set` にしてから照合する
- `objectAtPath` は `objectPathIndices` を使ってよいが、不正形式は先に `/^\d+(\/\d+)*$/` で弾く(`objectPathIndices` は形式を検証しない)
- `useGLTF` は同じ URL の scene をキャッシュするため、画面を出入りしても同じ `Object3D` が再利用される。
  Rig の effect は「hiddenPaths に無いものを true に戻す」ので、前回の非表示が残らない

## やらないこと
- アウトライナの UI(チェックボックス・瞳アイコン・送信)(103)
- `Outliner.tsx` / `OutlinerRow.tsx` の変更(`path` の追加は既存の描画に影響しない)
- 読み込み時点で `visible === false` だったオブジェクトの保持(Rig は一律に戻す。既知の制限として Summary に書く)
- 比較の距離計算からの非表示部位の除外
- `mesh-display.ts` / `ModelMesh.tsx` / `model-scenes.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・キー順で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存テストも通る
- [ ] outliner_Summary.md を更新している。`visibility.ts` / `VisibilityRig.tsx` をファイル一覧と公開インターフェイスに追加し、
      outliner-tree.ts に `path` / `plainChildren` / `childPath` / `objectAtPath` を追加し、他機能との関係に
      「部位の表示・非表示はルーム共有(設計書 §13.5)。鍵は uuid ではなく `path`(重ね描きを数えない子インデックス)。
      Rig は objects ストアの `hiddenParts` を読む。配置は ReviewPage(102)」と書き、テスト節に
      `tests/outliner-visibility.test.ts` を載せる
- [ ] app_Summary.md の ReviewPage.tsx の説明(Canvas の子一覧)に `VisibilityRig` を追加している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
