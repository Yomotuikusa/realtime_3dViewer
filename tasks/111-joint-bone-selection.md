---
id: 111
title: web の 3D ビューでジョイントをクリックしてボーンを選択し、選択中を強調する
feature: joint
depends_on: []
owns: [web/src/features/joint/joint-pick.ts, web/src/features/joint/joint-highlight.ts, web/src/features/joint/joint-display.ts, web/src/features/joint/JointRig.tsx, web/src/features/joint/joint_Summary.md, web/src/features/outliner/SelectionPickLayer.tsx, web/src/features/outliner/outliner_Summary.md, web/tests/joint-pick.test.ts, web/tests/joint-highlight.test.ts, web/tests/joint-rig.test.ts, web/tests/joint-display.test.ts, web/tests/outliner-pick.test.ts]
reads: [web/src/features/viewer/pick.ts, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/model-target.ts, web/src/features/outliner/selection.ts, web/src/features/outliner/pick-selection.ts, web/src/features/outliner/selection-highlight.ts, web/src/features/compare/model-scenes.ts, web/src/features/comments/compose.ts, web/src/store/display.ts, web/src/store/annotation.ts, web/tests/joint-update.test.ts, web/tests/pick.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
アニメーション軌跡の対象にするボーンを、3D ビュー上で直接クリックして選べるようにする。
選択中のボーンはビュー上で見分けられなければ使えないので、強調表示まで本タスクに含める。
軌跡そのものは 112〜114 で作る。

## 前提
- ジョイント可視化は `web/src/features/joint/joint-display.ts` が作る。
  `addJointOverlay(root)` が root 直下へ `JointOverlay`(`Group`)を足し、
  その `userData.joints` に `Bone[]` を traverse 順で持つ。overlay と子は
  `VIEWER_OVERLAY_KEY` を持ち、`raycast = () => undefined` でレイキャストから外してある
- **ジョイント球は `InstancedMesh` でレイキャストを無効化してあるため、レイキャストでは拾えない。**
  有効化するとコメント配置(`viewer/pick.ts`)や版選択(`outliner/pick-selection.ts`)に
  干渉する。本タスクは**ボーンのワールド位置を NDC へ投影し、クリック位置からの
  画面ピクセル距離で選ぶ**方式をとる。既存のレイキャスト経路には一切触れない
- overlay は `JointRig.tsx` が `jointDisplay.visible` のときだけ追加し、false で取り除く。
  したがって「overlay が存在するか」がそのまま「ジョイントが見えているか」の判定になり、
  ピック側で display ストアを読む必要はない
- 選択は `web/src/features/outliner/selection.ts` の `useSelectionStore`。
  `OutlinerSelection = { versionId: string; objectId: string }` で `objectId` は `Object3D.uuid`。
  アウトライナのボーン行クリックでは既にこのストアにボーンの uuid が入る(ビュー上の表示は無い)
- `selection-highlight.ts` の `createSelectionOverlay` は Mesh / Line / Points にしか
  重ね描きを作らないため、`Bone` を選んでもビューには何も出ない。本タスクの
  `joint-highlight.ts` がこの穴を埋める
- 版全体のクリック選択は `web/src/features/outliner/SelectionPickLayer.tsx` が
  `pointerdown` / `pointerup` で行う。ジョイントと版全体が同じクリックを奪い合わないよう、
  判定の順序はこの 1 ファイルの中で決める
- `toNdc(rect, clientX, clientY)` は `web/src/features/viewer/pick.ts`、
  `isVisibleInScene(object)` も同じファイルにある
- `web/tests/joint-rig.test.ts` は `JointRig.tsx` のソースを検査しており、
  `expect(source).not.toContain("send")` と `expect(source).not.toContain("props")` を含む。
  新しく書くコードにこの 2 語を部分文字列として含めてはならない
  (`sendable` や `propsFor` のような名前も不可)

## インターフェイス契約

### `web/src/features/joint/joint-display.ts`(既存へ 1 関数を切り出す)

```ts
/**
 * ジョイント球の半径を求める。root 配下全体の Box3 の最大辺長 * JOINT_RADIUS_RATIO。
 * 最大辺長が 0 または非有限なら JOINT_FALLBACK_RADIUS。
 */
export function jointRadius(root: Object3D): number;
```

`addJointOverlay` は半径の計算をこの関数の呼び出しへ置き換える。値と既存の挙動は変えない。

### 新規 `web/src/features/joint/joint-pick.ts`

```ts
import type { Bone, Camera, Object3D } from "three";
import type { Ndc } from "../viewer/pick";
import type { OutlinerSelection } from "../outliner/selection";

/** クリック点からこのピクセル数以内のジョイントだけを拾う */
export const JOINT_PICK_RADIUS_PX = 12;

export interface JointHit {
  versionId: string;
  bone: Bone;
}

/**
 * 各 scene のジョイント overlay が持つボーンをカメラで NDC へ投影し、
 * クリック位置からの画面ピクセル距離が JOINT_PICK_RADIUS_PX 以内で最小のものを返す。
 * 距離が同じなら Object.entries(scenes) の順で先のものを選ぶ。
 * overlay が無い scene、isVisibleInScene が false の overlay、
 * カメラ後方(投影後の z が -1 未満または 1 を超える)のボーンは対象外。
 */
export function pickJoint(
  camera: Camera,
  ndc: Ndc,
  viewport: { width: number; height: number },
  scenes: Readonly<Record<string, Object3D>>,
): JointHit | null;

/** ピック結果を選択ストアの選択へ変換する。null なら null */
export function jointSelectionOf(hit: JointHit | null): OutlinerSelection | null;
```

ピクセル距離は、投影後の NDC を `(ndcX - x) * viewport.width / 2` と
`(ndcY - y) * viewport.height / 2` へ直した 2 成分のユークリッド距離とする。
ボーンのワールド位置は `bone.matrixWorld` から取る(`bone.position` ではない)。

### 新規 `web/src/features/joint/joint-highlight.ts`

```ts
import { Bone, Mesh, Object3D } from "three";

/** 選択ジョイントのマーカーの userData キー。値は true */
export const SELECTED_JOINT_MARKER_KEY = "selectedJointMarker";
/** マーカーの色。outliner の選択重ね描きと同じオレンジ */
export const SELECTED_JOINT_COLOR = 0xf97316;
/** マーカーの半径 = jointRadius(root) * この倍率 */
export const SELECTED_JOINT_RADIUS_SCALE = 1.8;
/** ジョイントの x-ray(999)より手前へ描く */
export const SELECTED_JOINT_RENDER_ORDER = 1000;

export interface SelectedJointMarker extends Mesh {
  userData: Mesh["userData"] & {
    selectedJointMarker: true;
    viewerOverlay: true;
    bone: Bone;
  };
}

/**
 * root 直下へマーカーを追加して返す。既にあるときは作り直さず userData.bone を差し替える。
 * 材質は depthTest = false / depthWrite = false / toneMapped = false、raycast は無効化する。
 */
export function addSelectedJointMarker(root: Object3D, bone: Bone): SelectedJointMarker;

/** root 直下のマーカー。無ければ null */
export function selectedJointMarkerOf(root: Object3D): SelectedJointMarker | null;

/** userData.bone の現在のワールド位置を root ローカルへ直してマーカーの position に入れる */
export function updateSelectedJointMarker(marker: SelectedJointMarker, root: Object3D): void;

/** root からマーカーを外し、geometry と material を破棄する。無ければ何もしない */
export function removeSelectedJointMarker(root: Object3D): void;
```

### `web/src/features/joint/JointRig.tsx`(既存へ追加)

既存の 2 つの `useEffect` と `useFrame` は残したまま、選択マーカーの管理を足す。

- `useSelectionStore` の `selected` を購読する
- 追加する `useEffect` は、`jointDisplay.visible` が true で、`selected` の版の scene が
  `scenes` にあり、その scene 配下に `selected.objectId` と同じ uuid の `Bone` があるときだけ
  `addSelectedJointMarker` を呼ぶ。条件を満たさない、または依存が変わったときは
  すべての scene から `removeSelectedJointMarker` する
- `useFrame` の中で、マーカーがある scene について `updateSelectedJointMarker` を呼ぶ

### `web/src/features/outliner/SelectionPickLayer.tsx`(既存の判定順を変える)

`pointerup` のクリック判定が通った後、版全体のレイキャストより先にジョイントを試す。

```ts
const rect = canvas.getBoundingClientRect();
const ndc = toNdc(rect, event.clientX, event.clientY);
const scenes = useModelScenesStore.getState().scenes;
const hit = jointSelectionOf(pickJoint(camera, ndc, rect, scenes))
  ?? pickSelection(raycaster.current, camera, ndc, getModelTarget(), scenes);
```

`hit` が null なら `clear()`、そうでなければ `select(hit)` という既存の分岐は変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `jointRadius`: 最大辺長 2 のモデル | `2 * JOINT_RADIUS_RATIO` |
| `jointRadius`: 空の Object3D(サイズ 0) | `JOINT_FALLBACK_RADIUS` |
| `addJointOverlay` の球半径 | 切り出し前と同じ値(既存テストが通る) |
| `pickJoint`: overlay が 1 つも無い | null |
| `pickJoint`: クリック点の 5px 先にボーンが 1 つ | そのボーンの `JointHit`(versionId は scenes の鍵) |
| `pickJoint`: 最も近いボーンが 20px 先 | null(`JOINT_PICK_RADIUS_PX` 超過) |
| `pickJoint`: 3px と 8px のボーンがある | 3px のほう |
| `pickJoint`: 2 つの版に等距離のボーン | `Object.entries(scenes)` の順で先の版 |
| `pickJoint`: overlay の scene が `visible = false` | その版は対象外 |
| `pickJoint`: カメラ後方のボーン | 対象外 |
| `pickJoint`: ボーンが親の変換で動いた後 | `matrixWorld` の現在位置で判定される |
| `jointSelectionOf(null)` | null |
| `jointSelectionOf(hit)` | `{ versionId: hit.versionId, objectId: hit.bone.uuid }` |
| `addSelectedJointMarker(root, bone)` | root.children に 1 つ増え、`userData` に 3 つのキー、`raycast()` が undefined、`material.depthTest === false`、`renderOrder === SELECTED_JOINT_RENDER_ORDER` |
| `addSelectedJointMarker` を同じ root へ 2 回 | children は増えず、同じインスタンスが返り、`userData.bone` が 2 回目の bone になる |
| マーカーの半径 | `jointRadius(root) * SELECTED_JOINT_RADIUS_SCALE` |
| `selectedJointMarkerOf`: 無い root | null |
| `updateSelectedJointMarker`: root が原点、bone がワールド (1,2,3) | `marker.position` が (1,2,3) |
| `updateSelectedJointMarker`: root 自身が移動・回転している | root ローカルへ変換した位置になる |
| `removeSelectedJointMarker` | children から外れ、geometry と material の `dispose` が呼ばれる |
| `removeSelectedJointMarker`: 無い root | 例外を投げず何もしない |
| マーカーは `isViewerOverlay` | true(アウトライナ木・表示モード・比較・部位可視から外れる) |
| SelectionPickLayer: ジョイントに当たるクリック | そのボーンが選択され、版全体の選択にはならない |
| SelectionPickLayer: ジョイントから遠くメッシュ上のクリック | 従来どおり版全体が選択される |
| SelectionPickLayer: 何も無い所のクリック | 従来どおり `clear()` |
| SelectionPickLayer: 注釈モードが `"none"` 以外 | 従来どおり何も選択しない |
| JointRig: `jointDisplay.visible` が false | マーカーを出さない。true から false にしたら取り除く |
| JointRig: 選択が Bone でない(版ルートやメッシュ) | マーカーを出さない |
| JointRig: 選択が別の版へ移った | 前の版の scene からマーカーが消える |
| JointRig: 選択が null になった | すべての scene からマーカーが消える |

## やらないこと
- ジョイント球のレイキャストを有効化すること。`markOverlay` の `raycast = () => undefined` は残す
- `viewer/pick.ts` と `outliner/pick-selection.ts` の変更。ジョイントは別経路で拾う
- `selection.ts`(選択ストア)の構造変更。`versionId` + `uuid` のまま使う
- `selection-highlight.ts` の変更。Bone 用の重ね描きは `joint-highlight.ts` に新設する
- `ReviewPage.tsx` の変更。新しい Canvas 部品は作らず、既存の `JointRig` と
  `SelectionPickLayer` に寄せるため配置の変更は要らない
- 軌跡の計算・描画・共有(112〜114)
- 既存テストの `expect` の削除・緩和。`joint-rig.test.ts` の依存配列検査
  (`}, [scenes, jointDisplay.visible]);` と `}, [scenes, jointDisplay.visible, jointDisplay.xray]);`)は
  そのまま通るよう、既存 2 つの `useEffect` の依存配列を変えない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] joint_Summary.md と outliner_Summary.md が更新されている
- [ ] すべてのファイルが300行以内(joint-display.ts は現在 204 行)
- [ ] verify: に書いたコマンドが成功する
