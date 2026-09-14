---
id: 107
title: web ジョイント可視化(球+リンク線)を作り 3D ビューへ適用する
feature: web
depends_on: [106]
owns: [web/src/features/joint/joint-display.ts, web/src/features/joint/JointRig.tsx, web/src/features/joint/joint_Summary.md, web/web_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/tests/joint-display.test.ts, web/tests/joint-update.test.ts, web/tests/joint-rig.test.ts, web/tests/layout-styles.test.ts]
reads: [web/src/store/display.ts, web/src/store/store_Summary.md, web/src/features/viewer/mesh-display.ts, web/src/features/compare/model-scenes.ts, web/src/features/compare/overlay.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/outliner/VisibilityRig.tsx, web/src/features/outliner/selection-highlight.ts, web/src/features/outliner/outliner-tree.ts, web/src/features/outliner/pick-selection.ts, web/src/features/compare/deviation.ts, web/tests/outliner-visibility.test.ts, web/tests/compare-overlay.test.ts, web/tests/summary-coverage.test.ts, shared/src/types.ts, shared/src/joint.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
各版の scene にジョイント(ボーン)の可視化を後付けする機能フォルダ `web/src/features/joint/` を作る。
ジョイントは球、親子の繋がりは線で描き、アニメーション再生中もボーンの現在位置へ追従させる。
x-ray(メッシュに隠さず常に手前へ描く)の切り替え口もここで用意する。
表示設定は display ストアの `jointDisplay`(106)を購読し、切り替える UI は 108。

## 前提
- `jointDisplay: { visible: boolean; xray: boolean }` が `useDisplayStore` にある(106)。web/src/store/display.ts
- 版の scene は `useModelScenesStore` の `scenes`(versionId → ルート `Object3D`)。
  web/src/features/compare/model-scenes.ts
- **ビューアが後付けした重ね描きは `userData[VIEWER_OVERLAY_KEY] = true` を付ける規約**がある。
  web/src/features/viewer/mesh-display.ts:7,25。これを付けた**オブジェクト自身**が次から除外される
  - `applyMeshDisplay` の走査(mesh-display.ts:78)
  - アウトライナ木と部位パスの数え方(outliner-tree.ts:32)
  - 部位の表示・非表示(outliner/visibility.ts:12)
  - 選択ハイライトの走査(outliner/selection-highlight.ts:92-95。`target.traverse` で潜るため**子孫にも必要**)
  - 選択ピック(outliner/pick-selection.ts:33)
  - 比較の対象メッシュ(compare/deviation.ts:17)
- `web/src/features/viewer/pick.ts` の `pickModel`(コメントの位置決め)は `isViewerOverlay` を見ていない。
  ピックに拾われないようにするには `raycast` を無効化するしかない
- Canvas 用 Rig の前例は `VisibilityRig`(props なし、`null` を返す、ストア購読 + `useEffect`)。
  `useFrame` を使う前例は `web/src/features/viewer/PlaybackRig.tsx`
- `web/tests/layout-styles.test.ts:64-75` は ReviewPage の Canvas の子の個数と前後関係を断言している
- `web/tests/summary-coverage.test.ts` は「全ソースが最も近い Summary に相対パスで載る」「全テストがどれかの
  Summary に載る」「全フォルダ Summary が `web/web_Summary.md` から索引される」を検査する。
  新しい機能フォルダを作るときは `web/web_Summary.md` の索引にも足す必要がある
- three.js は親の `visible === false` なら子孫を描かない。版の表示・非表示は scene ルートの `visible` で
  行われている(ModelMesh.tsx:40)ため、可視化を scene の子に置けば非表示の版では自動的に描かれない

## インターフェイス契約

### 新規 web/src/features/joint/joint-display.ts

```ts
import { Bone, Group, InstancedMesh, LineSegments, Object3D } from "three";

/** ジョイント可視化グループの userData キー。値は true */
export const JOINT_OVERLAY_KEY = "jointOverlay";
/** ジョイント球の色 */
export const JOINT_COLOR = 0x22d3ee;
/** 親子リンク線の色 */
export const JOINT_LINK_COLOR = 0x0e7490;
/** ジョイント球の半径 = モデルの最大辺長 * この比 */
export const JOINT_RADIUS_RATIO = 0.008;
/** 最大辺長が 0 のときに使う半径 */
export const JOINT_FALLBACK_RADIUS = 0.01;
/** x-ray のときに使う renderOrder */
export const JOINT_XRAY_RENDER_ORDER = 999;

/** 親も対象に含まれるボーンの [親, 子] 対 */
export type JointLink = readonly [parent: Bone, child: Bone];

/** ジョイント可視化グループ。球の InstancedMesh とリンク線の LineSegments を1つずつ子に持つ */
export interface JointOverlay extends Group {
  userData: Group["userData"] & {
    jointOverlay: true;
    viewerOverlay: true;
    joints: Bone[];
    links: JointLink[];
  };
}

/**
 * root 自身と配下の Bone を traverse 順に集める。
 * userData[VIEWER_OVERLAY_KEY] が付いたオブジェクトとその子孫は対象にしない。
 */
export function collectJoints(root: Object3D): Bone[];

/** joints のうち parent も joints に含まれるものを [親, 子] にした配列。joints の順 */
export function jointLinks(joints: readonly Bone[]): JointLink[];

/**
 * root 配下のボーンから可視化グループを作り root へ add して返す。
 * ボーンが1つも無ければ何もせず null。すでに付いていれば作り直さず既存をそのまま返す。
 * 作った直後の状態は x-ray 有効(setJointOverlayXray(overlay, true) と同じ)。
 */
export function addJointOverlay(root: Object3D): JointOverlay | null;

/** root の直下にある可視化グループ。無ければ null */
export function jointOverlayOf(root: Object3D): JointOverlay | null;

/**
 * ボーンの現在の matrixWorld から球の位置とリンク線の頂点を更新する。
 * 呼び出し側が root と各ボーンの matrixWorld を最新にしておくこと(描画ループでは r3f が更新済み)。
 */
export function updateJointOverlay(overlay: JointOverlay, root: Object3D): void;

/** 可視化の depthTest と renderOrder を切り替える。 */
export function setJointOverlayXray(overlay: JointOverlay, xray: boolean): void;

/** root から可視化グループを外し geometry と material を dispose する。無ければ何もしない */
export function removeJointOverlay(root: Object3D): void;
```

構造と値の取り決め(実装者はここから外れないこと):

- グループの子は **球の `InstancedMesh` が1つ目、リンク線の `LineSegments` が2つ目**の固定順
- 球: `new InstancedMesh(new SphereGeometry(radius, 8, 6), new MeshBasicMaterial({…}), joints.length)`。
  `radius` は `new Box3().setFromObject(root)` の各辺の最大値 × `JOINT_RADIUS_RATIO`。
  最大値が 0 以下・非有限なら `JOINT_FALLBACK_RADIUS`。**インスタンスの行列は平行移動のみ**(大きさは geometry 側)
- リンク線: `position` 属性が `links.length * 2` 頂点の `Float32BufferAttribute`。`links` が空でも
  `LineSegments` は作る(頂点 0)
- 球・線ともに材質は `depthWrite: false`、`toneMapped: false`。色は `JOINT_COLOR` / `JOINT_LINK_COLOR`
- `instanceMatrix` と `position` 属性は `setUsage(DynamicDrawUsage)` にし、
  `InstancedMesh` / `LineSegments` の `frustumCulled` は `false`(ボーンが動くと境界が古くなるため)
- グループと**2つの子すべて**に `userData[VIEWER_OVERLAY_KEY] = true` を付け、`raycast = () => undefined` にする。
  グループにだけ `userData[JOINT_OVERLAY_KEY] = true` と `userData.joints` / `userData.links` を持たせる
- `setJointOverlayXray(overlay, xray)` は 2つの子の material に `depthTest = !xray`、`needsUpdate = true` を設定し、
  グループと2つの子の `renderOrder` を `xray ? JOINT_XRAY_RENDER_ORDER : 0` にする
- `updateJointOverlay` は毎フレーム呼ばれる。`Matrix4` / `Vector3` はモジュールスコープの使い回しにして
  関数内で `new` しない。位置は `root.matrixWorld` の逆行列を掛けて root のローカル系へ変換する

### 新規 web/src/features/joint/JointRig.tsx

```tsx
/** Canvas に 1 つだけ置く描画なしの部品。jointDisplay と各版の scene から可視化を管理する */
export function JointRig(): null;
```

- `jointDisplay = useDisplayStore((state) => state.jointDisplay)`、
  `scenes = useModelScenesStore((state) => state.scenes)`
- effect 1(依存 `[scenes, jointDisplay.visible]`): `visible` が false なら何もしない。true なら
  各 scene に `addJointOverlay`。cleanup で各 scene に `removeJointOverlay`
- effect 2(依存 `[scenes, jointDisplay.visible, jointDisplay.xray]`): 各 scene の `jointOverlayOf` が
  null でなければ `setJointOverlayXray(overlay, jointDisplay.xray)`。cleanup なし
- `useFrame`: `visible` が false なら即 return。true なら各 scene の `jointOverlayOf` に
  `updateJointOverlay(overlay, scene)`
- `send` や props は受け取らない

### 変更 web/src/app/ReviewPage.tsx

`import { JointRig } from "../features/joint/JointRig";` を足し、`ViewerCanvas` の children の
`<VisibilityRig />` の**直後**に `<JointRig />` を置く。他は変更しない。

## 振る舞い

three のクラスを `new` して組み立てる(`web/tests/outliner-visibility.test.ts` と同じ流儀)。
共通の組み立て: `root`(Group) > `Mesh "Body"`、`root` > `Bone "Hip"` > `Bone "Spine"` > `Bone "Head"`、
`Hip` の下にもう1本 `Bone "Tail"`。`root` の子に `userData[VIEWER_OVERLAY_KEY] = true` の Group を置き、
その下に `Bone "Fake"` を入れる。

### web/tests/joint-display.test.ts(新規。構築・x-ray・破棄)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `collectJoints(root)` | `[Hip, Spine, Head, Tail]`(traverse 順)。`Fake` を含まない |
| root 自身が `Bone` の場合の `collectJoints(root)` | 先頭が root 自身 |
| ボーンの無い root | `[]` |
| `jointLinks([Hip, Spine, Head, Tail])` | `[[Hip,Spine],[Spine,Head],[Hip,Tail]]`(joints の順) |
| `jointLinks([Spine, Head])`(親が含まれない) | `[[Spine, Head]]` のみ |
| `jointLinks([Hip])` | `[]` |
| `addJointOverlay(root)` | 戻り値が非 null。`root.children` に1つだけ増える。`jointOverlayOf(root)` が同じ参照 |
| 同じ root に2回 `addJointOverlay` | 2回目は同じ参照を返し、`root.children` は増えない |
| ボーンの無い root への `addJointOverlay` | `null`。`root.children` は増えない。`jointOverlayOf(root)` も `null` |
| 生成された overlay の `userData` | `jointOverlay === true`、`viewerOverlay === true`、`joints` が `collectJoints(root)` と同じ並び、`links` が `jointLinks` と同じ並び |
| overlay の子 | 長さ2。`children[0] instanceof InstancedMesh`、`children[1] instanceof LineSegments` |
| overlay と2つの子の `userData[VIEWER_OVERLAY_KEY]` | すべて `true` |
| overlay と2つの子に raycaster を当てる(`raycast` を直接呼ぶ) | 交差を1つも積まない(`undefined` を返し配列は空のまま) |
| 球の `InstancedMesh.count` | `4`(ジョイント数) |
| リンク線の `position` 属性の頂点数 | `6`(リンク3本 × 2) |
| 2つの子の `frustumCulled` | `false` |
| 球・線の material | `depthWrite === false`、`toneMapped === false`、色が `JOINT_COLOR` / `JOINT_LINK_COLOR` |
| 半径: root の各辺 2/2/2 のときの球 geometry の `parameters.radius` | `2 * JOINT_RADIUS_RATIO` |
| 大きさ 0 の root(Mesh を持たず Bone がすべて同一点) | `JOINT_FALLBACK_RADIUS` |
| `addJointOverlay` 直後の `depthTest` / `renderOrder` | `false` / `JOINT_XRAY_RENDER_ORDER`(x-ray 有効の状態) |
| `setJointOverlayXray(overlay, false)` | 2つの子の material が `depthTest === true`、`needsUpdate === true`、overlay と子の `renderOrder` が `0` |
| 続けて `setJointOverlayXray(overlay, true)` | `depthTest === false`、`renderOrder === JOINT_XRAY_RENDER_ORDER` |
| `removeJointOverlay(root)` | `root.children` から外れ、`jointOverlayOf(root)` が `null`。2つの子の geometry と material の `dispose` が1回ずつ呼ばれる(spy) |
| overlay の無い root への `removeJointOverlay` | 例外なし、`root.children` は変わらない |
| `removeJointOverlay` 後に `addJointOverlay` | 新しい overlay が付く |

### web/tests/joint-update.test.ts(新規。位置の更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `Hip` を `(0,1,0)`、`Spine` を親からの相対 `(0,2,0)` に置き `root.updateMatrixWorld(true)` 後に `updateJointOverlay` | 球インスタンス0の行列の平行移動が `(0,1,0)`、インスタンス1が `(0,3,0)`(`getMatrixAt` で確認) |
| 同じ状況のリンク線 `position` 属性の先頭6要素 | `[0,1,0, 0,3,0]`(親 → 子の順) |
| `root.position` を `(10,0,0)`、`root.scale` を 2 にして `updateMatrixWorld(true)` 後 | 球と線の値は root のローカル系のままで変わらない(root のワールド変換を打ち消す) |
| ボーンを動かして `updateMatrixWorld(true)` 後に再度 `updateJointOverlay` | 新しい位置に更新される |
| 更新後の `instanceMatrix.needsUpdate` と線 `position` 属性の `needsUpdate` | `true` |
| 球インスタンスの行列 | 回転なし・スケール1(平行移動のみ。`decompose` で確認) |
| リンクが0本のモデル(単独 Bone 1つ)で `updateJointOverlay` | 例外なし。球1つが更新される |
| 同じ引数で2回呼ぶ | 結果が変わらない |

### web/tests/joint-rig.test.ts(新規。ソース検査)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `features/joint/JointRig.tsx` | `export function JointRig(): null`、`useDisplayStore(`、`useModelScenesStore(`、`useFrame(`、`addJointOverlay(`、`removeJointOverlay(`、`setJointOverlayXray(`、`updateJointOverlay(` を含む |
| 同上 | `send` を含まない。`props` を受け取らない(`JointRig()` の引数が空) |
| 同上の effect 依存配列 | `[scenes, jointDisplay.visible]` と `[scenes, jointDisplay.visible, jointDisplay.xray]` の2つを含む |
| `features/joint/joint-display.ts` | `VIEWER_OVERLAY_KEY` を `../viewer/mesh-display` から import している。`useDisplayStore` / `react` を import しない |
| `features/viewer/mesh-display.ts` / `features/outliner/visibility.ts` | `JointRig` / `addJointOverlay` を含まない(変更していない) |

### web/tests/layout-styles.test.ts(更新。"orders the outliner, viewer, and panel columns" に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `app/ReviewPage.tsx` | `<JointRig />` がちょうど1回。`<VisibilityRig />` より後、`</ViewerCanvas>` より前 |

## 実装メモ
- `collectJoints` は `root.traverse` ではなく自前の再帰にする(重ね描きの子孫ごと打ち切るため)。
  `isViewerOverlay(object)` が true のノードはそこで打ち切る
- `updateJointOverlay` の座標変換は
  `position.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inverseRoot)`。
  `inverseRoot` は `matrix.copy(root.matrixWorld).invert()` を関数の先頭で1回だけ作る
- `JointOverlay` の絞り込みは `jointOverlayOf` で行う。`root.children.find((child) =>
  child.userData[JOINT_OVERLAY_KEY] === true)` を `as JointOverlay` で返してよい
- `InstancedMesh` は `Mesh` の派生なので、`VIEWER_OVERLAY_KEY` を付け忘れると `applyMeshDisplay` が
  wireframe を適用したり選択ハイライトが重ね描きを足したりする。子2つへの付与を省略しないこと
- 球の分割数 8/6 は頂点数を抑えるための固定値。UI からは変えない

## やらないこと
- HUD のボタン・ラベル・アイコン(108)
- `web/src/store/display.ts` / `shared` / `server` の変更(106 で済んでいる)
- `web/src/features/viewer/` 配下の変更(`ViewerHud.tsx` への設置は 108)
- `viewer.css` や新規 CSS の追加(この機能は 3D 側だけで DOM を持たない)
- ジョイント球の大きさ・色をユーザーが変える UI(今回は自動決定のみ)
- 非表示にされた部位(`hiddenParts`)配下のボーンを可視化から外すこと。全ボーンを描く
- ジョイント名のラベル表示、ジョイントのクリック選択

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・定数名・構造で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存テストも通る
- [ ] `web/src/features/joint/joint_Summary.md` を新規作成している。節構成は
      `# joint` / `## 目的` / `## ファイル一覧と役割` / `## 公開インターフェイス` / `## 他フォルダとの関係` / `## テスト`。
      他フォルダとの関係に「表示設定は display ストアの `jointDisplay`(ルーム共有・設計書 §13.5)。
      可視化は `VIEWER_OVERLAY_KEY` を持つためアウトライナ・部位パス・選択・比較の対象にならない。
      配置は ReviewPage(107)」と書き、テスト節に `joint-display.test.ts` / `joint-update.test.ts` /
      `joint-rig.test.ts` を載せる
- [ ] `web/web_Summary.md` の Summary 索引に `src/features/joint/joint_Summary.md` を足している
- [ ] app_Summary.md の ReviewPage.tsx の説明(Canvas の子一覧)に `JointRig` を追加している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
