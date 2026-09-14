---
id: 113
title: web に軌跡の重ね描き(線・フレーム点・現在位置)を作り 3D ビューへ適用する
feature: trail
depends_on: [110, 111, 112]
owns: [web/src/features/trail/trail-overlay.ts, web/src/features/trail/TrailRig.tsx, web/src/features/trail/trail_Summary.md, web/src/app/ReviewPage.tsx, web/tests/trail-overlay.test.ts, web/tests/trail-rig.test.ts]
reads: [web/src/features/trail/trail-sample.ts, web/src/features/trail/trail-target.ts, web/src/features/trail/model-clips.ts, web/src/features/joint/joint-display.ts, web/src/features/joint/JointRig.tsx, web/src/features/compare/model-scenes.ts, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/playback-frames.ts, web/src/store/display.ts, web/src/store/playback.ts, web/tests/joint-display.test.ts, web/tests/joint-rig.test.ts, web/tests/layout-styles.test.ts, shared/src/trail.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
共有された軌跡設定(110)と、サンプリング結果(112)を結び付け、
選択ボーンの軌道を 3D ビューへ描く。Maya の Motion Trail に倣い、
軌跡の折れ線・各フレームの点・現在フレームの位置マーカーの 3 つを出す。

## 前提
- 軌跡の共有設定は display ストアの `motionTrail: MotionTrail`(110)。
  `{ visible: boolean; target: ObjectPartRef | null }` で、`setMotionTrail` は
  同値なら state を更新しないため、参照は安定している
- サンプリングは `web/src/features/trail/trail-sample.ts` の
  `sampleTrail(root, object, clip, fps, currentTime): TrailSample`(112)。
  `TrailSample` は `{ positions: Float32Array; frameCount: number }` で、
  座標は **root ローカル**。呼び出しの前後で root のポーズは変わらない
- 対象の解決は `trail-target.ts` の `resolveTrailTarget(scenes, target)`(112)。
  クリップの取得は `model-clips.ts` の `selectModelClips(clips, versionId)`(112)
- ジョイント球の半径は `web/src/features/joint/joint-display.ts` の
  `jointRadius(root)`(111)。軌跡のマーカーもこの寸法に合わせる
- 重ね描きの作法は `joint-display.ts` に前例がある。`VIEWER_OVERLAY_KEY` を付け、
  `raycast = () => undefined` を入れておくと、アウトライナ木・表示モード・比較・
  部位可視・選択・ジョイント収集のすべてから自動で外れる
- ジョイントの x-ray は `renderOrder` 999、選択ジョイントのマーカー(111)は 1000。
  軌跡はその手前に重ねる必要がないので 998 を使う
- 毎フレームの更新は React Three Fiber の `useFrame`。再生時刻 `time` は
  `usePlaybackStore.getState().time` から読む。**`time` を `useEffect` の依存に入れると
  毎フレーム再サンプリングが走るので入れない**
- `web/tests/layout-styles.test.ts:74-76` が ReviewPage 内の Rig の順序を
  `<JointRig />` が `<VisibilityRig />` より後、`</ViewerCanvas>` より前、と検査している。
  `<TrailRig />` は `<JointRig />` の後・`</ViewerCanvas>` の前に置けばこの検査は通る

## インターフェイス契約

### 新規 `web/src/features/trail/trail-overlay.ts`

```ts
import { Group, Object3D } from "three";
import type { TrailSample } from "./trail-sample";

/** 軌跡グループの userData キー。値は true */
export const TRAIL_OVERLAY_KEY = "motionTrailOverlay";
/** 軌跡の折れ線の色 */
export const TRAIL_LINE_COLOR = 0xfacc15;
/** 各フレームの点の色 */
export const TRAIL_POINT_COLOR = 0xfef3c7;
/** 現在フレームのマーカーの色 */
export const TRAIL_CURRENT_COLOR = 0xf97316;
/** フレーム点の大きさ = markerRadius * この倍率 */
export const TRAIL_POINT_SIZE_SCALE = 1.6;
/** 現在フレームのマーカーの半径 = markerRadius * この倍率 */
export const TRAIL_CURRENT_RADIUS_SCALE = 1.2;
/** 軌跡の renderOrder。メッシュに隠されず手前へ描く */
export const TRAIL_RENDER_ORDER = 998;

/** 軌跡グループ。折れ線・フレーム点・現在位置マーカーをこの順で持つ */
export interface TrailOverlay extends Group {
  userData: Group["userData"] & {
    motionTrailOverlay: true;
    viewerOverlay: true;
    /** サンプルのフレーム数。1 以上 */
    frameCount: number;
    /** サンプルの root ローカル座標。長さは frameCount * 3 */
    positions: Float32Array;
  };
}

/**
 * sample の座標から軌跡を作って root 直下へ追加する。
 * 既に軌跡があるときは removeTrailOverlay してから作り直す。
 * 子は [0] LineSegments でない Line(折れ線)、[1] Points、[2] Mesh(球)の順。
 * 3 つとも depthTest = false / depthWrite = false / toneMapped = false、
 * raycast 無効、VIEWER_OVERLAY_KEY = true、renderOrder = TRAIL_RENDER_ORDER。
 * 追加直後の現在位置マーカーはフレーム 0 の位置に置く。
 */
export function addTrailOverlay(
  root: Object3D,
  sample: TrailSample,
  markerRadius: number,
): TrailOverlay;

/** root 直下の軌跡。無ければ null */
export function trailOverlayOf(root: Object3D): TrailOverlay | null;

/**
 * 現在フレームのマーカーを frame 番目のサンプル位置へ移す。
 * 整数でない frame は Math.round し、[0, frameCount - 1] へ丸める。
 */
export function setTrailCurrentFrame(overlay: TrailOverlay, frame: number): void;

/** root から軌跡を外し、3 つの子の geometry と material を破棄する。無ければ何もしない */
export function removeTrailOverlay(root: Object3D): void;
```

### 新規 `web/src/features/trail/TrailRig.tsx`

```ts
/** Canvas に 1 つだけ置く描画なしの部品。軌跡のライフサイクルと現在位置の更新を管理する */
export function TrailRig(): null;
```

- 購読するもの: display ストアの `motionTrail`、`useModelScenesStore` の `scenes`、
  `useModelClipsStore` の `clips`、playback ストアの `clipIndex` と `fps`
- `useEffect` は次をすべて満たすときだけ軌跡を作る。依存配列は
  `[scenes, clips, motionTrail, clipIndex, fps]`
  1. `motionTrail.visible` が true
  2. `resolveTrailTarget(scenes, motionTrail.target)` が非 null
  3. `selectModelClips(clips, versionId)?.[clipIndex]` が存在する
  作るときは `sampleTrail(root, object, clip, fps, usePlaybackStore.getState().time)` の結果を
  `addTrailOverlay(root, sample, jointRadius(root))` へ渡す
- 条件を満たさないときと cleanup では、`scenes` のすべての値に対して
  `removeTrailOverlay` を呼ぶ(対象の版が変わったときに前の軌跡を残さない)
- `useFrame` では、軌跡がある scene について
  `setTrailCurrentFrame(overlay, frameOfTime(usePlaybackStore.getState().time, fps))` を呼ぶ

### `web/src/app/ReviewPage.tsx`

`ViewerCanvas` の子として `<JointRig />` の直後に `<TrailRig />` を置く。
import は `import { TrailRig } from "../features/trail/TrailRig";`。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `addTrailOverlay`: frameCount 3 のサンプル | root.children に 1 つ増え、その children が 3 つ |
| 子 [0] の position 属性 | 要素数 `frameCount * 3` で、値が sample の positions と一致 |
| 子 [1] の position 属性 | 子 [0] と同じ座標を持つ |
| 子 [2] の初期位置 | フレーム 0 の座標 |
| 子 [2] の半径 | `markerRadius * TRAIL_CURRENT_RADIUS_SCALE` |
| 3 つの子と group の userData | `viewerOverlay` が true、`raycast()` が undefined |
| 3 つの子の material | `depthTest === false`、`depthWrite === false`、`toneMapped === false` |
| group と 3 つの子の renderOrder | `TRAIL_RENDER_ORDER` |
| group の userData | `motionTrailOverlay` が true、`frameCount` と `positions` を持つ |
| `addTrailOverlay` を同じ root へ 2 回 | children は 1 つのまま。前の geometry と material が破棄される |
| `addTrailOverlay`: frameCount 1 | 例外を投げず、3 つの子ができる |
| `trailOverlayOf`: 無い root | null |
| `setTrailCurrentFrame(overlay, 2)` | マーカーがフレーム 2 の座標へ移る |
| `setTrailCurrentFrame(overlay, -5)` | フレーム 0 の座標 |
| `setTrailCurrentFrame(overlay, 999)` | 最終フレームの座標 |
| `setTrailCurrentFrame(overlay, 1.6)` | フレーム 2 の座標(四捨五入) |
| `setTrailCurrentFrame(overlay, NaN)` | フレーム 0 の座標 |
| `removeTrailOverlay` | children から外れ、3 つの子の geometry と material の `dispose` が呼ばれる |
| `removeTrailOverlay`: 無い root | 例外を投げず何もしない |
| 軌跡は `isViewerOverlay` | true |
| `collectJoints`(joint-display.ts)が軌跡の枝を通る | 軌跡配下の Bone を拾わない(重ね描きなので枝ごと飛ばされる) |
| TrailRig: `visible` が false | どの scene にも軌跡が無い |
| TrailRig: `target` が null | どの scene にも軌跡が無い |
| TrailRig: 版が未登録 / path が解決不能 | どの scene にも軌跡が無い |
| TrailRig: 対象の版にクリップが無い | 軌跡が無い |
| TrailRig: `clipIndex` が範囲外 | 軌跡が無い |
| TrailRig: 条件が揃う | 対象の版の scene にだけ軌跡ができる |
| TrailRig: `target` が別の版へ移った | 前の版から軌跡が消え、新しい版に付く |
| TrailRig: `clipIndex` / `fps` が変わった | 作り直される |
| TrailRig のソース検査 | `useFrame(` を持ち、`useEffect` の依存配列に `time` を含まない |

## やらないこと
- 軌跡の ON/OFF を切り替える UI。114 の仕事であり、ここでは行わない
- `web/src/features/joint/` の変更。`jointRadius` は import して使うだけにする
- `web/src/features/trail/trail-sample.ts` / `trail-target.ts` / `model-clips.ts` の変更(112 の成果物)
- `web/src/store/display.ts` の変更(110 の成果物)
- キーフレームだけを大きい点にする表示。トラック名の解析が要るため、必要になったら別タスクで行う
- 前後フレーム数(Maya の pre/post frame)の指定。本タスクはクリップ全体を描く
- `ViewerCanvas.tsx` の変更。Rig は ReviewPage から children として渡す既存の形に従う
- `layout-styles.test.ts` の変更。`<TrailRig />` は `<JointRig />` の後・`</ViewerCanvas>` の前に
  置けば既存の順序検査は通る

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] trail_Summary.md が更新されている(新ファイル 2 つと新テスト 2 つ)
- [ ] すべてのファイルが300行以内(ReviewPage.tsx は現在 233 行)
- [ ] verify: に書いたコマンドが成功する
