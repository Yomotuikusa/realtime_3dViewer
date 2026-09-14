---
id: 094
title: web アウトライナ機能(シーン階層ツリー・種別アイコン・折りたたみ・行選択)を作る
feature: web
depends_on: []
owns: [web/src/features/outliner/outliner-tree.ts, web/src/features/outliner/selection.ts, web/src/features/outliner/outliner-labels.ts, web/src/features/outliner/outliner-icons.tsx, web/src/features/outliner/OutlinerRow.tsx, web/src/features/outliner/Outliner.tsx, web/src/features/outliner/outliner.css, web/src/features/outliner/outliner_Summary.md, web/web_Summary.md, web/tests/outliner-tree.test.ts, web/tests/outliner-selection.test.ts, web/tests/outliner-labels.test.ts, web/tests/outliner-styles.test.ts]
reads: [web/src/features/compare/model-scenes.ts, web/src/features/compare/compare_Summary.md, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/display-icons.tsx, web/src/features/viewer/useModelScene.ts, web/src/store/objects.ts, web/src/features/objects/ObjectList.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/mesh-display.test.ts, web/tests/compare-model-scenes.test.ts, web/tests/display-mode-bar.test.ts, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
DCC ツール(Blender / Maya)のアウトライナに相当する、読み込み済みモデルのシーン階層を
親子関係のまま木構造で見せるパネルを作る。各行の先頭に種別アイコン(メッシュ / カーブ /
ポイント / ボーン / ライト / カメラ / グループ)を置き、何が入っているかを一目で分かるようにする。
行はクリックで選択でき、選択状態はストアに持つ(3D ビュー側のハイライトは 095、
レビュー画面への配置は 096 が行う)。**既定ではすべての行が畳まれた状態**にする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 各版の読み込み済み three シーンは、`useModelScene` が `useModelScenesStore.register(versionId, scene)` で
  登録している。`scenes: Readonly<Record<string, Object3D>>`(versionId → シーンのルート `Object3D`)。
  アンマウント時に `unregister` される。web/src/features/compare/model-scenes.ts:4-13、web/src/features/viewer/useModelScene.ts:47-50
- ルートは glTF なら `gltf.scene`(Group)、FBX / OBJ ならローダーが返す Group。**ルート自身も 1 つのノードとして
  扱う**(版の行がルートに対応する)
- ビューアが後付けする重ね描き(ワイヤフレーム重ね描き、比較重ね描き)は `userData.viewerOverlay === true` が付き、
  `isViewerOverlay(object)` で判定できる。これらは Mesh の子として追加される。
  web/src/features/viewer/mesh-display.ts:7, :26-28
- three の継承関係: `SkinnedMesh` / `InstancedMesh` は `Mesh` の派生、`LineSegments` / `LineLoop` は `Line` の派生、
  `Bone` は `Object3D` の直接派生、`Light` / `Camera` は抽象基底、`Group` は `Object3D` の派生。
  FBX の NurbsCurve は `Line`、glTF の LINES / LINE_STRIP / LINE_LOOP は `LineSegments` / `Line` / `LineLoop`、
  OBJ の l 行は `LineSegments` として読み込まれる
- 版の一覧は `useObjectsStore` の `objects: ModelVersion[]`(number 昇順)と `hiddenIds`。`isObjectVisible(hiddenIds, id)` で
  表示中判定。web/src/store/objects.ts:4-8, :69-71。`ModelVersion` は `{ id, projectId, number, fileName, byteSize, createdAt }`。shared/src/types.ts:45-52
- 版タグ `versionTag(version)` は `"v<number>"` を返す。web/src/features/objects/objects-labels.ts:20-22
- 右ドックのオブジェクト一覧の行は `.badge objects__tag`(data-tone="neutral") + `.objects__name` の構成。
  非表示の版は `data-hidden="true"` で文字色を muted にする。web/src/features/objects/ObjectList.tsx:87-101、objects.css:18-31
- インライン SVG アイコンの前例は web/src/features/viewer/display-icons.tsx。`viewBox="0 0 16 16"`、`aria-hidden="true"`、
  `focusable="false"`、`currentColor`。立方体の外形と稜線のパス定数 `CUBE_OUTLINE` / `CUBE_FRONT_EDGES` /
  `CUBE_VIEW_BOX` がエクスポートされており、**メッシュのアイコンはこれを import して再利用する**
- zustand ストアの前例は web/src/features/compare/model-scenes.ts(`create<State>((set, get) => ({...}))`、
  `UseBoundStore<StoreApi<State>>` 型注釈、`reset()`)。テストの前例は web/tests/compare-model-scenes.test.ts
- CSS の規約: 生の色は `tokens.css` 以外で禁止、`var(--x)` は宣言済みトークンかフォールバック付きのみ、
  状態は `aria-*` / `data-*` で表現、`!important` / `@import` 禁止。`web/tests/styles-rules.test.ts` が機械検証する。
  使えるトークンは tokens.css の `:root` にあるもの(`--space-1..6`、`--text-xs/sm/md`、`--radius-sm/md`、
  `--color-text-muted`、`--color-surface-muted`、`--color-accent`、`--color-accent-subtle`、`--duration-fast` など)
- `web/tests/summary-coverage.test.ts` は「src の全ファイルが最寄りの `_Summary.md` に相対パスで載っている」
  「`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っている」「全フォルダ Summary が
  `web/web_Summary.md` に相対パスで索引されている」を検査する。**新フォルダを作るので web_Summary.md の索引追加が必須**
- web のテストは jsdom で `@testing-library` が無い。React コンポーネントのレンダリングテストは書けないが、
  props なしで呼べる関数コンポーネントを直接呼べば `ReactElement` が返り、`.type` / `.props` を検査できる。
  three のクラスは jsdom 上でそのまま `new` できる(web/tests/mesh-display.test.ts が前例)

## インターフェイス契約

### 新規 web/src/features/outliner/outliner-tree.ts

```ts
import type { Object3D } from "three";

export type OutlinerNodeKind = "mesh" | "curve" | "points" | "bone" | "light" | "camera" | "group";

export interface OutlinerNode {
  /** object.uuid */
  id: string;
  /** object.name そのまま(空文字あり)。表示名への変換は outliner-labels の nodeLabel が行う */
  name: string;
  kind: OutlinerNodeKind;
  /** object.children の順。ビューア重ね描き(isViewerOverlay)とその子孫は含めない */
  children: OutlinerNode[];
}

/**
 * 種別判定。判定順は mesh → curve → points → bone → light → camera → group。
 * Mesh(SkinnedMesh / InstancedMesh 含む)= "mesh"、Line(LineSegments / LineLoop 含む)= "curve"、
 * Points = "points"、Bone = "bone"、Light = "light"、Camera = "camera"、それ以外(Group / 素の Object3D)= "group"
 */
export function classifyObject(object: Object3D): OutlinerNodeKind;

/** root 自身をルートノードとするプレーンな木を作る。three のオブジェクトへの参照は持たない */
export function buildOutlinerTree(root: Object3D): OutlinerNode;

/** ids に id があれば除いた新しい配列、無ければ末尾に加えた新しい配列を返す(展開状態の切替) */
export function toggleId(ids: readonly string[], id: string): string[];
```

### 新規 web/src/features/outliner/selection.ts

```ts
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface OutlinerSelection {
  versionId: string;
  /** 選択した Object3D の uuid(OutlinerNode.id) */
  objectId: string;
}

export interface SelectionStoreState {
  selected: OutlinerSelection | null;
  /** 現在と同じ versionId + objectId なら null に戻す(解除)。違えば置き換える */
  toggleSelection(selection: OutlinerSelection): void;
  clear(): void;
  reset(): void;
}

export const useSelectionStore: UseBoundStore<StoreApi<SelectionStoreState>>;

/** selected が非 null で versionId と objectId が両方一致するとき true */
export function isSelected(selected: OutlinerSelection | null, versionId: string, objectId: string): boolean;
```

### 新規 web/src/features/outliner/outliner-labels.ts

```ts
import type { OutlinerNodeKind } from "./outliner-tree";

export const OUTLINER_HEADING = "アウトライナ";
/** 096 が左ドックの境界ハンドルの aria-label に使う */
export const OUTLINER_RESIZE_LABEL = "アウトライナの幅";
export const OUTLINER_EMPTY = "オブジェクトがありません";
export const OUTLINER_LOADING = "読み込み中…";
export const UNNAMED_LABEL = "(名前なし)";

export const KIND_LABELS: Readonly<Record<OutlinerNodeKind, string>> = {
  mesh: "メッシュ",
  curve: "カーブ",
  points: "ポイント",
  bone: "ボーン",
  light: "ライト",
  camera: "カメラ",
  group: "グループ",
};

/** name を trim し、空なら UNNAMED_LABEL */
export function nodeLabel(name: string): string;

/** expanded なら "<label> を折りたたむ"、そうでなければ "<label> を展開" */
export function expandAriaLabel(label: string, expanded: boolean): string;
```

### 新規 web/src/features/outliner/outliner-icons.tsx

全アイコンは `<svg className="outliner__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" data-kind={kind}>`。
`width` / `height` 属性は付けない。色は `currentColor` のみ。図案は次のとおりに固定する。

```tsx
import type { ReactElement } from "react";
import type { OutlinerNodeKind } from "./outliner-tree";

export const OUTLINER_ICON_VIEW_BOX = "0 0 16 16";

/** display-icons の CUBE_OUTLINE + CUBE_FRONT_EDGES を stroke で描く(fill="none", strokeWidth 1, strokeLinejoin round) */
export function MeshIcon(): ReactElement;
/** S 字カーブ path "M2 12C5 2 11 14 14 4"(stroke, fill none, strokeWidth 1.25)+ 両端に r=1.25 の circle(fill) */
export function CurveIcon(): ReactElement;
/** r=1.25 の circle(fill)5 つ。中心 (4,4) (11,3) (8,8) (4,12) (12,12) */
export function PointsIcon(): ReactElement;
/** 斜線 "M4 12L12 4"(stroke, strokeWidth 2, strokeLinecap round)+ 両端に r=1.75 の circle(fill)。中心 (3.5,12.5) (12.5,3.5) */
export function BoneIcon(): ReactElement;
/** 中心 (8,7) r=3 の circle(stroke, fill none)+ 放射 4 本 "M8 1v2M8 11v2M2 7h2M12 7h2"(stroke)+ 台座 "M6 14h4"(stroke) */
export function LightIcon(): ReactElement;
/** rect x=2 y=5 width=8 height=7 rx=1(stroke, fill none)+ レンズ "M10 8l4-2v5l-4-2z"(stroke, fill none) */
export function CameraIcon(): ReactElement;
/** フォルダ "M2 4h4l1.5 1.5H14v7H2z"(stroke, fill none, strokeLinejoin round) */
export function GroupIcon(): ReactElement;
/** 右向き山形 "M6 3l5 5-5 5"(stroke, fill none, strokeWidth 1.5, strokeLinecap round, strokeLinejoin round)。
 *  className は "outliner__chevron"、data-kind は付けない */
export function ChevronIcon(): ReactElement;

export const OUTLINER_KIND_ICONS: Readonly<Record<OutlinerNodeKind, () => ReactElement>> = {
  mesh: MeshIcon,
  curve: CurveIcon,
  points: PointsIcon,
  bone: BoneIcon,
  light: LightIcon,
  camera: CameraIcon,
  group: GroupIcon,
};

/** OUTLINER_KIND_ICONS[kind] を描く */
export function OutlinerKindIcon({ kind }: { kind: OutlinerNodeKind }): ReactElement;
```

### 新規 web/src/features/outliner/OutlinerRow.tsx

```tsx
import type { ReactElement, ReactNode } from "react";
import type { OutlinerNode, OutlinerNodeKind } from "./outliner-tree";
import type { OutlinerSelection } from "./selection";

export interface OutlinerRowProps {
  /** 展開状態のキー(OutlinerNode.id、または読み込み中の版なら versionId) */
  id: string;
  /** 0 = 版の行。1 以上はその子孫 */
  depth: number;
  /** 表示名(版の行は fileName、ノードは nodeLabel(name)) */
  label: string;
  /** null = 読み込み中(アイコンと種別ラベルを描かない) */
  kind: OutlinerNodeKind | null;
  /** 版の行だけ versionTag(version) を渡す */
  badge?: string;
  /** 版の行だけ。右ドックで非表示にした版なら true */
  hidden?: boolean;
  /** 版の行だけ。scene 未登録なら true(選択ボタンを disabled、種別の代わりに OUTLINER_LOADING を出す) */
  loading?: boolean;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  onToggleExpand(id: string): void;
  onSelect(): void;
  /** 展開時に role="group" の ul へ入れる子行 */
  children?: ReactNode;
}

/** 1 行(li)を描く。子は expanded && hasChildren のときだけ描く */
export function OutlinerRow(props: OutlinerRowProps): ReactElement;

export interface OutlinerBranchProps {
  versionId: string;
  node: OutlinerNode;
  depth: number;
  expandedIds: readonly string[];
  selected: OutlinerSelection | null;
  onToggleExpand(id: string): void;
  onSelect(selection: OutlinerSelection): void;
}

/** node とその子孫を OutlinerRow で再帰的に描く(node 自身の行を含む) */
export function OutlinerBranch(props: OutlinerBranchProps): ReactElement;
```

`OutlinerRow` の描画(この構造から外れないこと):

```html
<li class="outliner__item" role="treeitem"
    aria-expanded={hasChildren ? expanded : undefined} aria-selected={selected}
    data-depth={depth} data-hidden={hidden === true} data-loading={loading === true}>
  <div class="outliner__row" style="--outliner-depth: {depth}">
    <!-- hasChildren のとき -->
    <button type="button" class="outliner__expand" aria-expanded={expanded}
            aria-label={expandAriaLabel(label, expanded)} onClick={() => onToggleExpand(id)}>
      <ChevronIcon />
    </button>
    <!-- hasChildren でないとき(幅を揃える空要素) -->
    <span class="outliner__expand outliner__expand--leaf" aria-hidden="true"></span>

    <button type="button" class="outliner__select" aria-pressed={selected} disabled={loading === true} onClick={onSelect}>
      {kind !== null && <OutlinerKindIcon kind={kind} />}
      {badge !== undefined && <span class="badge outliner__tag" data-tone="neutral">{badge}</span>}
      <span class="outliner__name" title={label}>{label}</span>
      {kind !== null && <span class="outliner__kind">{KIND_LABELS[kind]}</span>}
      {loading === true && <span class="outliner__kind">{OUTLINER_LOADING}</span>}
    </button>
  </div>
  {hasChildren && expanded && <ul class="outliner__group" role="group">{children}</ul>}
</li>
```

`OutlinerBranch` は `OutlinerRow` に `id=node.id`、`label=nodeLabel(node.name)`、`kind=node.kind`、
`hasChildren=node.children.length > 0`、`expanded=expandedIds.includes(node.id)`、
`selected=isSelected(selected, versionId, node.id)`、`onSelect=() => onSelect({ versionId, objectId: node.id })` を渡し、
子として `node.children.map(child => <OutlinerBranch key={child.id} ... depth={depth + 1} />)` を入れる。

### 新規 web/src/features/outliner/Outliner.tsx

```tsx
export function Outliner(): ReactElement;
```

- 購読: `useObjectsStore` の `objects` / `hiddenIds`、`useModelScenesStore` の `scenes`、
  `useSelectionStore` の `selected` / `toggleSelection`
- 展開状態は `const [expandedIds, setExpandedIds] = useState<string[]>([]);`(**既定はすべて畳む**)。
  切替は `setExpandedIds((ids) => toggleId(ids, id))`
- 木は `useMemo(() => 各 scenes[versionId] を buildOutlinerTree した Record<string, OutlinerNode>, [scenes])`
- 描画:

```html
<section class="outliner" aria-label={OUTLINER_HEADING}>
  <h2 class="outliner__heading">{OUTLINER_HEADING}</h2>
  <!-- objects.length === 0 -->
  <p class="outliner__empty">{OUTLINER_EMPTY}</p>
  <!-- それ以外 -->
  <ul class="outliner__tree" role="tree" aria-label={OUTLINER_HEADING}>
    {objects.map(version => 版の行)}
  </ul>
</section>
```

- 版の行は `OutlinerRow` に `id={root?.id ?? version.id}`、`depth={0}`、`label={version.fileName}`、
  `kind={root?.kind ?? null}`、`badge={versionTag(version)}`、`hidden={!isObjectVisible(hiddenIds, version.id)}`、
  `loading={root === null}`、`hasChildren={root !== null && root.children.length > 0}`、
  `expanded={expandedIds.includes(root?.id ?? version.id)}`、
  `selected={root !== null && isSelected(selected, version.id, root.id)}`、
  `onSelect={() => { if (root !== null) toggleSelection({ versionId: version.id, objectId: root.id }); }}` を渡し、
  子として `root.children.map(child => <OutlinerBranch key={child.id} versionId={version.id} node={child} depth={1} ... />)` を入れる
  (`root = trees[version.id] ?? null`)
- `import "./outliner.css";` を持つ

### 新規 web/src/features/outliner/outliner.css

次のセレクタを定義する(宣言は一例。トークン以外の色を使わないこと)。

```css
.outliner { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--space-2); min-width: 0; min-height: 0; padding: var(--space-3); }
.outliner__heading { color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 600; }
.outliner__empty { color: var(--color-text-muted); font-size: var(--text-sm); }
.outliner__tree, .outliner__group { margin: 0; padding: 0; list-style: none; }
.outliner__row { display: flex; align-items: center; gap: var(--space-1); min-height: 1.75rem; padding-left: calc(var(--outliner-depth, 0) * var(--space-4)); }
.outliner__expand { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; padding: 0; border: 0; background: transparent; color: var(--color-text-muted); cursor: pointer; }
.outliner__expand--leaf { cursor: default; }
.outliner__chevron { width: 0.75rem; height: 0.75rem; transition: transform var(--duration-fast); }
.outliner__expand[aria-expanded="true"] .outliner__chevron { transform: rotate(90deg); }
.outliner__select { display: flex; flex: 1 1 auto; align-items: center; gap: var(--space-2); min-width: 0; padding: var(--space-1) var(--space-2); border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.outliner__select:hover { background: var(--color-surface-muted); }
.outliner__select[aria-pressed="true"] { border-color: var(--color-accent); background: var(--color-accent-subtle); color: var(--color-accent); }
.outliner__select[disabled] { cursor: default; }
.outliner__icon { flex: 0 0 auto; width: 1rem; height: 1rem; }
.outliner__tag { flex: 0 0 auto; }
.outliner__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outliner__kind { flex: 0 0 auto; margin-left: auto; color: var(--color-text-muted); font-size: var(--text-xs); }
.outliner__item[data-hidden="true"] > .outliner__row { color: var(--color-text-muted); }
```

`--outliner-depth` は inline style で与えるため CSS 側に宣言が無い。**必ず `var(--outliner-depth, 0)` とフォールバック付きで参照する**
(styles-rules.test.ts の「宣言かフォールバック」検査に掛かる)。

### 変更 web/web_Summary.md

「構成と Summary の置き場」の箇条書きに `- \`src/features/outliner/outliner_Summary.md\`` を 1 行追加する。他は変更しない。

## 振る舞い

### outliner-tree(web/tests/outliner-tree.test.ts)

three のクラスを `new` して組み立てる。`Mesh` には `BoxGeometry` と `MeshStandardMaterial`、`Line` 系には `BufferGeometry` と
`LineBasicMaterial`、`Points` には `PointsMaterial`、`SkinnedMesh` は `new Skeleton([bone])` を `bind` する
(web/tests/mesh-display.test.ts の組み立て方を参照)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `classifyObject(new Mesh(...))` / `new SkinnedMesh(...)` / `new InstancedMesh(geometry, material, 2)` | `"mesh"` |
| `classifyObject(new Line(...))` / `new LineSegments(...)` / `new LineLoop(...)` | `"curve"` |
| `classifyObject(new Points(...))` | `"points"` |
| `classifyObject(new Bone())` | `"bone"` |
| `classifyObject(new DirectionalLight())` / `new PointLight()` | `"light"` |
| `classifyObject(new PerspectiveCamera())` / `new OrthographicCamera()` | `"camera"` |
| `classifyObject(new Group())` / `new Object3D()` / `new Scene()` | `"group"` |
| `buildOutlinerTree(root)`(root = Group 名 "Root"、子に Mesh "Body"、Group "Rig" > Bone "Hip" > Bone "Spine"、Line "Guide") | ルート `{ id: root.uuid, name: "Root", kind: "group" }`、children が `["Body","Rig","Guide"]` の順、`Rig.children[0].name === "Hip"`、`Hip.children[0].name === "Spine"`、`Spine.children` が `[]` |
| 上記で "Body" の子に `userData[VIEWER_OVERLAY_KEY] = true` の Mesh(さらにその子に Mesh)を add | "Body" の `children` が `[]`(重ね描きとその子孫は含まれない) |
| 名前が空の Object3D | `name` が `""`(木の段階では変換しない) |
| `buildOutlinerTree` の戻り値 | `JSON.stringify` できる(three のオブジェクト参照を持たない)。`Object.keys(node)` が `["id","name","kind","children"]` と同じ集合 |
| `toggleId([], "a")` | `["a"]` |
| `toggleId(["a","b"], "a")` | `["b"]`。元配列は変更されない |
| `toggleId(["a"], "b")` | `["a","b"]` |

### selection(web/tests/outliner-selection.test.ts)

`afterEach(() => useSelectionStore.getState().reset())`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期状態 | `selected` が `null` |
| `toggleSelection({ versionId: "v1", objectId: "o1" })` | `selected` が `{ versionId: "v1", objectId: "o1" }` |
| 続けて同じ値で `toggleSelection` | `selected` が `null` |
| `toggleSelection(v1/o1)` → `toggleSelection(v1/o2)` | `selected` が `{ v1, o2 }` |
| `toggleSelection(v1/o1)` → `toggleSelection(v2/o1)` | `selected` が `{ v2, o1 }`(versionId が違えば置き換え) |
| `clear()` | `selected` が `null`。`null` のときに呼んでも例外なし |
| `reset()` | `selected` が `null` |
| `isSelected(null, "v1", "o1")` | `false` |
| `isSelected({ v1, o1 }, "v1", "o1")` | `true` |
| `isSelected({ v1, o1 }, "v1", "o2")` / `isSelected({ v1, o1 }, "v2", "o1")` | `false` |

### labels(web/tests/outliner-labels.test.ts)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 定数 | `OUTLINER_HEADING === "アウトライナ"`、`OUTLINER_RESIZE_LABEL === "アウトライナの幅"`、`OUTLINER_EMPTY === "オブジェクトがありません"`、`OUTLINER_LOADING === "読み込み中…"`、`UNNAMED_LABEL === "(名前なし)"` |
| `KIND_LABELS` | キーが 7 種(sort して `["bone","camera","curve","group","light","mesh","points"]`)。値は契約の日本語 |
| `nodeLabel("Body")` / `nodeLabel("  Body ")` | `"Body"` |
| `nodeLabel("")` / `nodeLabel("   ")` | `"(名前なし)"` |
| `expandAriaLabel("Body", false)` | `"Body を展開"` |
| `expandAriaLabel("Body", true)` | `"Body を折りたたむ"` |

### icons とソース検査(web/tests/outliner-styles.test.ts)

関数コンポーネントを直接呼んで `.type` / `.props` を検査する。CSS とソースは
`web/tests/viewer-styles.test.ts` の `srcDir` 解決と `ruleBody` をそのまま真似て読む。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `OUTLINER_KIND_ICONS` のキー | `KIND_LABELS` のキーと同じ集合 |
| 7 つのアイコンすべて(`OUTLINER_KIND_ICONS[kind]()`) | `.type === "svg"`、`props.viewBox === "0 0 16 16"`、`props.className === "outliner__icon"`、`props["aria-hidden"] === "true"`、`props.focusable === "false"`、`props["data-kind"] === kind`、`props.width` と `props.height` が `undefined` |
| `ChevronIcon()` | `.type === "svg"`、`props.className === "outliner__chevron"`、`props["data-kind"]` が `undefined` |
| `OUTLINER_KIND_ICONS.mesh` | `MeshIcon` と同一参照 |
| `outliner-icons.tsx` のソース | `CUBE_OUTLINE` と `CUBE_FRONT_EDGES` を `../viewer/display-icons` から import している。`#` 始まりの生色を含まない |
| `outliner.css` | `.outliner__select[aria-pressed="true"]` の本文に `var(--color-accent-subtle)` を含む。`.outliner__row` の本文に `var(--outliner-depth, 0)` を含む。`.outliner__expand[aria-expanded="true"] .outliner__chevron` の本文に `rotate(90deg)` を含む。`.outliner__item[data-hidden="true"] > .outliner__row` のルールがある(`ruleBody` が非 null) |
| `Outliner.tsx` のソース | `useState<string[]>([])` を含む(既定で全て畳む)。`role="tree"`、`useModelScenesStore`、`useSelectionStore`、`buildOutlinerTree(`、`toggleId(`、`versionTag(`、`isObjectVisible(`、`import "./outliner.css"` を含む |
| `OutlinerRow.tsx` のソース | `role="treeitem"`、`role="group"`、`aria-expanded={`、`aria-selected={`、`aria-pressed={selected}`、`expandAriaLabel(`、`data-tone="neutral"`、`"--outliner-depth"` を含む。`<OutlinerBranch` を含む(再帰) |
| `Outliner.tsx` / `OutlinerRow.tsx` | `send(` / `ClientMessage` を含まない(選択はローカル状態であり送信しない) |

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| 096 で配置後にビューを開く | 「アウトライナ」見出しの下に版ごとの行(`v1` バッジ + ファイル名 + グループアイコン + 「グループ」)が並び、**すべて畳まれている** |
| 版の行の山形をクリック | 山形が 90° 回転し、直下の子だけが 1 段インデントして現れる。孫はまだ畳まれている |
| メッシュ / カーブ / ボーンの行 | それぞれ立方体 / S 字 / 骨のアイコンと「メッシュ」「カーブ」「ボーン」の種別ラベルが右端に出る |
| 名前のないノード | 「(名前なし)」と表示 |
| 行をクリック | accent 色の枠と薄い背景で選択表示。もう一度クリックで解除。別の行をクリックすると移る |
| 右ドックで版を非表示にする | その版の行が淡色になる(子は展開・選択できる) |
| 読み込み中の版 | 行に「読み込み中…」が出て、山形が無く、クリックできない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- 木は **three のオブジェクトを持たないプレーンなデータ**にする(`id` は uuid)。三次元側の参照は 095 の Rig が
  `scene.getObjectByProperty("uuid", id)` で引く
- 木の再計算は `scenes` の参照が変わったときだけ(`useMemo`)。アニメーション再生や表示モード切替で
  階層は変わらない(重ね描きの追加は除外対象なので影響しない)
- 展開状態はローカルの React state(`string[]`)。ストアや localStorage に保存しない。
  scene が再登録されて uuid が変わった場合、古い id が残るが実害はない
- 選択は `useSelectionStore` のローカル状態。**ルームへ送信しない**(`send` を受け取らない)
- 行のボタンに `.btn` クラスは付けない(`min-height: 2rem` と枠線が行に合わない)。
  `aria-pressed` による選択の見た目は `.outliner__select[aria-pressed="true"]` で自前に定義する
- `role="tree"` / `treeitem` / `group` は付けるが、矢印キーによるツリー内移動(`aria-activedescendant` 等)は
  実装しない。Tab で各ボタンへ移動し Enter / Space で押せれば十分
- `mesh` の判定に `InstancedMesh` を含める。種別は 7 種で固定し、`SkinnedMesh` 用の別種別は作らない
- ノードの `object.visible` は見ない(ファイル由来の非表示フラグは扱わない)

## やらないこと
- レビュー画面(`ReviewPage.tsx` / `review.css`)への配置と幅の保存(096)
- 3D ビュー側の選択ハイライト(095)
- 選択・展開状態のルーム共有や localStorage 保存
- ノード単位の表示/非表示切替、名前変更、ドラッグ並べ替え、検索フィルタ
- 矢印キーによるツリーナビゲーション
- `web/src/features/viewer/` `web/src/features/compare/` `web/src/store/` `web/src/features/objects/` のファイル変更
  (`display-icons.tsx` の定数と `objects-labels.ts` の `versionTag`、`model-scenes.ts` のストアは import して使うだけ)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・描画構造・SVG 図案で実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md を作成している。節構成は `# outliner` / `## 目的` / `## ファイル一覧と役割` /
      `## 公開インターフェイス` / `## 他機能との関係` / `## テスト` とし、テスト節に
      `tests/outliner-tree.test.ts` / `tests/outliner-selection.test.ts` / `tests/outliner-labels.test.ts` /
      `tests/outliner-styles.test.ts` を載せる。他機能との関係に「版一覧は objects ストア、scene は compare の
      model-scenes ストア、選択は selection ストアで 095 の Rig が読む、配置は 096 の ReviewPage」を書く
- [ ] web_Summary.md の索引に `src/features/outliner/outliner_Summary.md` を追加している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
