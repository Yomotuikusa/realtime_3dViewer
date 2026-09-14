---
id: 105
title: web 3D ビューのクリックで版全体を選択し、空クリックで解除する
feature: web
depends_on: [104]
owns: [web/src/features/outliner/pick-selection.ts, web/src/features/outliner/SelectionPickLayer.tsx, web/src/features/outliner/selection.ts, web/src/app/ReviewPage.tsx, web/tests/outliner-pick.test.ts, web/tests/outliner-selection.test.ts, web/src/features/outliner/outliner_Summary.md]
reads: [web/src/features/comments/CommentPickLayer.tsx, web/src/features/comments/compose.ts, web/src/features/viewer/pick.ts, web/src/features/viewer/model-target.ts, web/src/features/viewer/mesh-display.ts, web/src/features/compare/model-scenes.ts, web/src/features/outliner/SelectionRig.tsx, web/src/features/outliner/Outliner.tsx, web/src/store/annotation.ts, web/tests/pick.test.ts, web/tests/outliner-highlight.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
現在、選択の入力経路はアウトライナの行クリックだけで、3D ビューでモデルをクリックしても何も起きない。
3D ビューで左クリックした版(読み込んだモデル 1 つ)全体を選択し、何もない所をクリックしたら解除できるようにする。
モデル内の途中階層(個別のメッシュやグループ)は 3D からは選ばない。

## 前提
- 選択ストアは `web/src/features/outliner/selection.ts` の `useSelectionStore`。`selected: OutlinerSelection | null`
  (`{ versionId, objectId }`、`objectId` は Object3D の uuid)を 1 件だけ持つ。`toggleSelection` / `clear` / `reset` がある
- アウトライナの最上段の行は `toggleSelection({ versionId: version.id, objectId: root.id })` を呼ぶ。
  `root.id` は版の scene ルートの uuid(`Outliner.tsx:88-89`、`outliner-tree.ts:41-43`)。
  **3D クリックで作る選択もこれと同じ `{ versionId, objectId: scene.uuid }` にする**。こうすると既存の `SelectionRig` が
  `scene.getObjectByProperty("uuid", objectId)` で scene ルートを見つけ、配下全体にハイライトを付ける(`SelectionRig.tsx:14-18`)
- 版ごとの scene は `useModelScenesStore.getState().scenes`(versionId → scene ルート Object3D)に登録されている(`model-scenes.ts:4-12`)。
  各 scene は `ViewerCanvas` の単一 group(`getModelTarget()` が返す)の子孫としてマウントされる(`viewer/model-target.ts`)
- レイキャストの前例は `web/src/features/viewer/pick.ts` の `pickModel`。`isVisibleInScene(object)` が export されており、
  object から scene root まで全て `visible` のときだけ true(非表示の版は `<primitive visible={false}>` なので false になる)
- ワイヤフレーム・比較・選択の重ね描きは `raycast = () => undefined` なので交点に出ない。念のため `isViewerOverlay`
  (`viewer/mesh-display.ts:26`)で除外もする
- 3D ビューのクリック判定の前例は `web/src/features/comments/CommentPickLayer.tsx`。`gl.domElement`(canvas)へ
  `pointerdown` / `pointerup` を直接つなぎ、左ボタン(`button === 0`)かつ Alt なしの down を記録し、up との距離が
  5px 以内(`isClick`、`comments/compose.ts:10-15`)ならクリックとみなす。annotation ストアの `mode` で有効化を切り替える
- annotation ストアの `mode` は `"none" | "pen" | "comment"`(`store/annotation.ts:5`)。pen / comment モードでは
  `AnnotationLayer` / `CommentPickLayer` が左クリックを使うため、選択は `"none"` のときだけ動かす
- コメントピンは drei の `Html` で canvas の上に載る DOM ボタンで、pointerdown / pointerup を stopPropagation する。
  イベントの target が canvas ではないため canvas に付けたリスナには届かない(既存の CommentPickLayer と同じ)
- OrbitControls の左ドラッグ(回転)と競合しない。移動 5px 以内のクリックだけを選択に使う
- Canvas 内の Rig / レイヤは `web/src/app/ReviewPage.tsx:192-201` の `<ViewerCanvas>` の子として並べる(229 行)

## インターフェイス契約

### 変更 web/src/features/outliner/selection.ts(アクション追加)

```ts
export interface SelectionStoreState {
  selected: OutlinerSelection | null;
  /** selection をそのまま選択にする。既に同じ選択なら state を更新しない(参照も変えない) */
  select(selection: OutlinerSelection): void;
  toggleSelection(selection: OutlinerSelection): void;
  clear(): void;
  reset(): void;
}
```

既存の `toggleSelection` / `clear` / `reset` / `isSelected` は変えない。

### 新規 web/src/features/outliner/pick-selection.ts(純粋関数。React に依存しない)

```ts
import { Vector2, type Camera, type Object3D, type Raycaster } from "three";
import { isVisibleInScene, type Ndc } from "../viewer/pick";
import { isViewerOverlay } from "../viewer/mesh-display";
import type { OutlinerSelection } from "./selection";

/**
 * object 自身から親へ辿り、scenes に登録された scene ルートと同一参照のものに当たれば
 * その versionId を返す。どれにも当たらなければ null
 */
export function versionOfObject(
  scenes: Readonly<Record<string, Object3D>>,
  object: Object3D,
): string | null;

/**
 * ndc の位置で target を再帰的にレイキャストし、可視(isVisibleInScene)かつ重ね描きでない最も近い交点の
 * Object3D が属する版を選択として返す。返す objectId はその版の scene ルートの uuid。
 * target が null、交点なし、交点がどの登録 scene にも属さないときは null
 */
export function pickSelection(
  raycaster: Raycaster,
  camera: Camera,
  ndc: Ndc,
  target: Object3D | null,
  scenes: Readonly<Record<string, Object3D>>,
): OutlinerSelection | null;
```

`raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera)` → `raycaster.intersectObject(target, true)` →
`find((hit) => isVisibleInScene(hit.object) && !isViewerOverlay(hit.object))` の順で `pickModel` と同じ流儀にする。

### 新規 web/src/features/outliner/SelectionPickLayer.tsx(Canvas 用の描画なし部品)

```tsx
/** Canvas に 1 つだけ置く描画なしの部品。annotation モードが "none" のとき 3D ビューの左クリックで版を選択する */
export function SelectionPickLayer(): null;
```

実装の骨子(CommentPickLayer.tsx と同じ構造にする):
- `const mode = useAnnotationStore((state) => state.mode)`、`const { gl, camera } = useThree()`、
  `useRef(new Raycaster())`、`down = useRef<{ x: number; y: number } | null>(null)`
- `useEffect` は `[camera, gl, mode]` 依存。`mode !== "none"` なら `down.current = null` にして何もしない
- `pointerdown`: `event.button === 0 && !event.altKey` のとき `down.current = { x: clientX, y: clientY }`
- `pointerup`: `start = down.current; down.current = null;` `event.button !== 0 || start === null || !isClick(start, event)` なら return。
  `rect = gl.domElement.getBoundingClientRect()`、`toNdc(rect, clientX, clientY)`、
  `pickSelection(raycaster.current, camera, ndc, getModelTarget(), useModelScenesStore.getState().scenes)` を呼び、
  null なら `useSelectionStore.getState().clear()`、それ以外は `useSelectionStore.getState().select(hit)`
- クリーンアップで両リスナを外し `down.current = null`

### 変更 web/src/app/ReviewPage.tsx

`SelectionPickLayer` を import し、`<ViewerCanvas>` の子として `<CommentPickLayer />` の直後に `<SelectionPickLayer />` を追加する。
他は変えない。

## 振る舞い

### web/tests/outliner-selection.test.ts(追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `select({v1,o1})` を未選択から呼ぶ | `selected` が `{v1,o1}` |
| 同じ `{v1,o1}` で `select` を再度呼ぶ | `selected` が呼ぶ前と同じ参照(`toBe`) |
| `select({v1,o2})` | `selected` が `{v1,o2}` に置き換わる |
| `select` 後に `toggleSelection` で同じ選択 | `selected` が null(既存トグルと共存する) |
| 既存 it | 変更なしで通る |

### web/tests/outliner-pick.test.ts(新規。カメラと箱の作り方は `web/tests/pick.test.ts` を踏襲する)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `versionOfObject(scenes, object)`: object が `scenes.v1` の孫 | `"v1"` |
| `versionOfObject`: object が `scenes.v1` そのもの | `"v1"` |
| `versionOfObject`: object がどの scene の配下でもない | `null` |
| `pickSelection`: target(Group)の中に `scenes.v1`(Group)、その子に原点の箱。カメラは z=5 から原点を見る、ndc `{0,0}` | `{ versionId: "v1", objectId: scenes.v1.uuid }`(箱の uuid ではない) |
| `pickSelection`: 同じ構成で ndc `{0.99, 0.99}`(外れ) | `null` |
| `pickSelection`: `target === null` | `null` |
| `pickSelection`: v1 の箱に加え、`scenes.v2` の箱を z=2(手前)に置く、ndc `{0,0}` | `{ versionId: "v2", ... }`(最近傍を採用) |
| 同じ構成で `scenes.v2` の `visible = false` | `{ versionId: "v1", ... }`(非表示は飛ばし、その奥を採用) |
| `pickSelection`: target 配下にあるが scenes に未登録の Group の箱だけに当たる | `null` |
| `pickSelection`: 交点の候補が `userData[VIEWER_OVERLAY_KEY] = true` の Mesh だけ(raycast は上書きしない) | `null` |
| ソース契約: `SelectionPickLayer.tsx` を読む | `pickSelection(`、`state.mode`、`mode !== "none"`、`isClick(`、`getModelTarget()`、`useModelScenesStore.getState().scenes`、`.select(`、`.clear()`、`addEventListener("pointerdown"`、`addEventListener("pointerup"`、`removeEventListener("pointerdown"`、`removeEventListener("pointerup"`、`event.altKey` を含む |
| ソース契約: `app/ReviewPage.tsx` を読む | `<SelectionPickLayer />` を含み、`import { SelectionPickLayer } from "../features/outliner/SelectionPickLayer"` を含む |

`readSource` の `sourceRoot` の決め方は `web/tests/outliner-highlight.test.ts:36-44` と同じにする(`web/src` があればそこ、なければ `src`)。

### 目視確認(マージ後に人間が行う)

| 操作 | 期待する結果 |
| --- | --- |
| 通常モードでモデルを左クリック | そのモデル全体がオレンジで覆われ、アウトライナの最上段の行が選択状態になる |
| 別のモデルを左クリック | 選択がそのモデルへ移る |
| 選択中のモデルをもう一度左クリック | 選択されたまま(解除しない) |
| 何もない背景を左クリック | 選択が解除される |
| 左ドラッグでカメラを回す | 選択は変わらない |
| ペン / コメントモードでモデルをクリック | 選択は変わらない(各モードの動作のみ) |
| 非表示にした版の位置をクリック | その版は選ばれない(背後に別の版があればそれを選ぶ) |

## やらないこと
- モデル内の途中階層(個別メッシュ・グループ)の 3D からの選択。常に版全体
- Shift / Ctrl による複数選択、ホバー時のハイライト
- アウトライナ行の挙動変更(行クリックは従来どおりトグル)、選択行への自動スクロール・自動展開
- 選択のルーム共有(選択はローカル専用。設計書 §13.5)
- `viewer/pick.ts`・`CommentPickLayer.tsx`・`viewer-pointer.ts` の変更
- 選択ハイライトの色・material の変更(104 で済んでいる)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md に pick-selection.ts / SelectionPickLayer.tsx の役割と公開インターフェイス、selection.ts の `select`、
      tests/outliner-pick.test.ts を追記し、「他機能との関係」に 3D クリック選択の配置が ReviewPage(105)であることを書いている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
