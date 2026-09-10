---
id: 035
title: web 3D空間へのフリー描画(注視点を通る視線垂直平面への投影)
feature: web
depends_on: [034]
owns: [web/src/features/annotation/draw-plane.ts, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/ViewerHud.tsx, web/src/store/annotation.ts, web/tests/draw-plane.test.ts, web/tests/store-annotation.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [web/src/features/viewer/pick.ts, web/src/features/viewer/camera-input.ts, web/src/features/viewer/CameraRig.tsx, web/src/features/annotation/stroke-build.ts, web/src/features/annotation/stroke-overlay.ts, web/src/features/annotation/StrokeLines.tsx, web/src/features/annotation/RoomStrokes.tsx, web/src/features/comments/CommentPickLayer.tsx, web/src/store/camera.ts, web/src/store/session.ts, web/src/app/review-stores.ts, shared/shared_Summary.md, shared/src/types.ts, shared/src/camera.ts, shared/src/stroke.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
現在のペンはメッシュ表面のヒット点にしか描けず、モデルから外れた瞬間に線が途切れる。
Blender のアノテートのように 3D 空間へ直接描けるモードを足す。基準はカメラの注視点を通り
視線に垂直な平面とし、モデルの外へはみ出しても、メッシュを貫いても線が続くようにする。
貫いて埋もれた部分は 034 の透過表示で見える。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `AnnotationLayer` は `mode === "pen"` のときだけ `gl.domElement` の
  pointerdown / pointermove / pointerup / pointercancel を購読する。pointerdown は
  `event.button !== 0 || event.altKey` を弾き、`pickModel` が `null`(モデルに当たらない)なら
  何もせず返る。pointermove は `drafting === null` なら何もしない。
  web/src/features/annotation/AnnotationLayer.tsx:24-58
- `finishDraft` は `endDraft()` の点列を `buildStroke` に渡し、`null` でなければ `stroke:add` を送る。
  接続が open でない、または `selfId` が null なら送らない。
  web/src/features/annotation/AnnotationLayer.tsx:60-81
- `pickModel(raycaster, camera, ndc, target)` は最近傍の交点と世界座標の法線を返し、
  当たらなければ `null`。web/src/features/viewer/pick.ts:25-51
- `toNdc(rect, clientX, clientY)` は canvas の矩形から NDC を作る純粋関数。
  web/src/features/viewer/pick.ts:14-23
- three の `Raycaster.setFromCamera(new Vector2(x, y), camera)` を呼んだあと、
  `raycaster.ray.origin` と `raycaster.ray.direction` が `Vector3` で読める。`direction` は正規化済み。
- `useCameraStore` の `selfCamera` は `CameraRig` の `onChange` 経由で更新される「最後に確定した自分の視点」で、
  `target` が OrbitControls の注視点。`setSelfCamera` は `cameraEquals`(既定 eps `1e-4`)の範囲内の
  更新を無視するため、`selfCamera.position` は最大 `1e-4` だけ実際のカメラ位置とずれうる。
  web/src/store/camera.ts:41-46, shared/src/camera.ts:6
- `AnnotationLayer` は `useThree()` から `camera` を受け取っている。`camera.position` は
  ストアを経由しないため常に最新かつ丸めのない値である。web/src/features/annotation/AnnotationLayer.tsx:19
- OrbitControls は常にカメラを `target` へ向けるため、`target - position` の方向が視線方向になる。
- `offsetAlongNormal(point, normal, modelSize)` はヒット点を法線方向へ `modelSize * 0.002` 持ち上げる。
  `normal` が `null` なら点を複製して返すだけ。web/src/features/annotation/stroke-build.ts:6-16
- `buildStroke(points, meta)` は `simplify(points, simplifyTolerance(meta.modelSize))` をかけ、
  `isSendableStroke`(2〜2000点)を満たさなければ `null` を返す。
  web/src/features/annotation/stroke-build.ts:18-33, shared/src/stroke.ts:4, shared/src/stroke.ts:75
- `hint()` は `following` を最優先で返し、そのあと `mode` 別の文言を返す純粋関数。
  `ViewerHud` が `{ mode, canEdit, hasAnchor, following }` を渡している。
  web/src/features/viewer/hud-labels.ts:42-57, web/src/features/viewer/ViewerHud.tsx:65-67
- `setMode` は同値なら state をそのまま返し、値が変わるときだけ `drafting` を破棄する。
  web/src/store/annotation.ts:87-89
- Alt 押下中はカメラ操作(033)であり、`AnnotationLayer` は pointerdown で `altKey` を弾く。
  ドラッグ中に Alt を押しても描画は継続する(判定は pointerdown のときだけ)。
- 034 で annotation ストアに `overlay: boolean` と `setOverlay`、`hud-labels.ts` に `OVERLAY_LABEL`、
  `AnnotationToolbar` に「透過表示」ボタンが入っている。それらは変更しない。
- web のテストは jsdom 環境で、`@testing-library` は導入されていない。React コンポーネントの
  レンダリングテストは書けないため、検証対象は純粋関数とストアに限られる。web/vitest.config.ts

## インターフェイス契約

### 新規 web/src/features/annotation/draw-plane.ts

```ts
import type { Vec3 } from "@shared/types";

/** レイと平面が平行と見なす閾値。|dot(direction, normal)| がこれ未満なら交差なしとする。 */
export const PARALLEL_EPSILON = 1e-6;

/** 描画の基準平面。origin を通り normal を法線とする。normal は常に長さ 1。 */
export interface DrawPlane {
  origin: Vec3;
  normal: Vec3;
}

/** レイ。direction は正規化済みを前提とする。 */
export interface DrawRay {
  origin: Vec3;
  direction: Vec3;
}

/**
 * カメラ位置と注視点から、注視点を通り視線に垂直な平面を作る。
 * 法線は position から target へ向かう単位ベクトル(= 視線方向)。
 * position と target が同一点(距離 0)のときは向きが定まらないため null。
 * 引数は破壊的に変更せず、返り値は新しい配列にする。
 */
export function viewPlaneAt(position: Vec3, target: Vec3): DrawPlane | null;

/**
 * レイと平面の交点。次のときは null。
 *  - |dot(ray.direction, plane.normal)| < PARALLEL_EPSILON (平行)
 *  - 交点までの距離 t が 0 以下 (交点がレイの始点またはその後ろ)
 * 引数は破壊的に変更せず、返り値は新しい配列にする。
 */
export function intersectPlane(ray: DrawRay, plane: DrawPlane): Vec3 | null;
```

### 変更 web/src/store/annotation.ts

```ts
/** ペンの描画基準。"surface" はメッシュ表面、"space" は注視点を通る視線垂直平面。 */
export type PenPlacement = "surface" | "space";
```

`AnnotationStoreState` に次を足す。他のメンバーのシグネチャは変更しない。

```ts
  placement: PenPlacement;
  /** 同値なら state を更新しない。値が変わるときは drafting を破棄する */
  setPlacement(placement: PenPlacement): void;
```

`initialState` に `placement: "surface"` を加える。

### 変更 web/src/features/viewer/hud-labels.ts

```ts
import type { AnnotationMode, PenPlacement } from "../../store/annotation";

export const PLACEMENT_LABELS: Readonly<Record<PenPlacement, string>> = {
  surface: "表面",
  space: "空間",
};

export const PLACEMENT_ORDER: readonly PenPlacement[] = ["surface", "space"];

export interface HintInput {
  mode: AnnotationMode;
  canEdit: boolean;
  hasAnchor: boolean;
  following: boolean;
  placement: PenPlacement;
}
```

`hint(input: HintInput): string` のシグネチャは変わらない(入力に `placement` が増えるだけ)。
`MODE_LABELS` / `MODE_ORDER` / `RESET_LABEL` / `FIT_LABEL` / `UNDO_LABEL` / `CLEAR_LABEL` /
`UNFOLLOW_LABEL` / `OVERLAY_LABEL` / `colorName` / `followingLabel` は変更しない。

### 変更 web/src/features/annotation/AnnotationLayer.tsx

props のシグネチャは変更しない。

```tsx
export function AnnotationLayer({ send }: { send: (msg: ClientMessage) => boolean }): null;
```

### 変更 web/src/features/viewer/ViewerHud.tsx

`hint()` へ `placement` を渡すためにストアから購読する。それ以外のレイアウト・要素は変えない。

## 振る舞い

### viewPlaneAt

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `viewPlaneAt([0, 0, 5], [0, 0, 0])` | `origin` が `[0, 0, 0]`、`normal` が `[0, 0, -1]` |
| `viewPlaneAt([0, 0, -5], [0, 0, 0])` | `normal` が `[0, 0, 1]` |
| `viewPlaneAt([3, 3, 3], [0, 0, 0])` | `origin` が `[0, 0, 0]`、`normal` が `[-1/√3, -1/√3, -1/√3]`(長さ 1) |
| `viewPlaneAt([0, 0, 5], [1, 2, 3])` | `origin` が `[1, 2, 3]`(target をそのまま通る) |
| `viewPlaneAt([1, 2, 3], [1, 2, 3])` | `null`(position と target が同一点) |
| 返り値の `origin` / `normal` | 引数とは別の新しい配列 |
| 呼び出しの前後で引数の配列 | 変化しない |

### intersectPlane

平面はいずれも `{ origin: [0, 0, 0], normal: [0, 0, -1] }`(z = 0 の平面)とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ origin: [0, 0, 5], direction: [0, 0, -1] }` | `[0, 0, 0]` |
| `{ origin: [0, 0, 5], direction: 正規化([1, 0, -1]) }` | `[5, 0, 0]`(z = 0 で x が正) |
| `{ origin: [2, 3, 5], direction: [0, 0, -1] }` | `[2, 3, 0]`(平面上の位置は x, y を保つ) |
| `{ origin: [0, 0, 5], direction: [1, 0, 0] }` | `null`(平面と平行、dot が 0) |
| `direction` と `normal` の内積の絶対値が `PARALLEL_EPSILON` 未満 | `null` |
| `{ origin: [0, 0, 5], direction: [0, 0, 1] }` | `null`(交点がレイの後ろ、t < 0) |
| `{ origin: [0, 0, 0], direction: [0, 0, -1] }` | `null`(始点が平面上、t = 0) |
| 法線が逆向き `{ origin: [0,0,0], normal: [0,0,1] }` に `{ origin: [0,0,5], direction: [0,0,-1] }` | `[0, 0, 0]`(法線の向きは結果に影響しない) |
| 返り値 | 引数とは別の新しい配列 |
| 呼び出しの前後で引数の配列 | 変化しない |

### annotation ストアの placement

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `placement` が `"surface"` |
| `setPlacement("space")` | `placement` が `"space"` |
| `beginDraft` のあと `setPlacement("space")` | `placement` が `"space"`、`drafting` が `null` |
| `beginDraft` のあと `setPlacement("surface")`(同値) | `placement` は `"surface"` のまま、`drafting` は保持される |
| `setPlacement("space")` のあと `reset()` | `placement` が `"surface"` に戻る |
| `setPlacement` は他のメンバーに影響しない | `strokes` / `mode` / `color` / `overlay` / `replayStrokes` が変わらない |

### hint()

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `following: true`(mode / placement を問わず) | `"操作すると追従が解除されます"`(変更なし) |
| `mode: "none"` | `"Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動"`(変更なし) |
| `mode: "pen"`, `canEdit: true`, `placement: "surface"` | `"モデルの上をドラッグして表面に線を描きます(Alt を押している間は視点操作になります)"` |
| `mode: "pen"`, `canEdit: true`, `placement: "space"` | `"ドラッグして注視点の平面に線を描きます。モデルの外へはみ出しても途切れません(Alt を押している間は視点操作になります)"` |
| `mode: "pen"`, `canEdit: false` | `placement` を問わず `"接続が切れているため線を描けません"`(変更なし) |
| `mode: "comment"` | `placement` を問わず既存の2文言のまま(変更なし) |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| ペンモードの既定 | `placement` は `"surface"`。従来どおりメッシュ表面に貼り付く |
| ペン道具の「空間」を押す | `placement` が `"space"` になり、そのボタンの `aria-pressed` が `true`、「表面」が `false` |
| `"space"` でモデルの上から左ドラッグ | 注視点を通る視線垂直平面の上に線が乗る。ヒット点の深さは使わない |
| `"space"` でモデルの外から左ドラッグ | 線を描き始められる(`"surface"` では描き始められなかった) |
| `"space"` のドラッグ中にカーソルがモデルの外へ出る | 線が途切れず続く |
| `"space"` のドラッグ中にホイールでズームする | 平面は pointerdown 時のまま。線の深さは変わらない |
| `"space"` でカメラ位置と注視点が同一点 | 線を描き始めない(`viewPlaneAt` が `null`) |
| `"space"` の線 | `offsetAlongNormal` を通さない。平面上の点をそのまま積む |
| `"space"` の線 | `buildStroke`(`simplify` とトレランス `modelSize * 0.001`)は `"surface"` と同じものを通す |
| `"space"` の線がメッシュを貫く | 埋もれた部分は 034 の透過線として薄く見える |
| `"surface"` | 既存の挙動から一切変わらない |
| どちらでも Alt + 左ドラッグ | 線を描かず視点操作になる(033 のガードのまま) |
| ドラッグ中に「表面 / 空間」が切り替わる | 起きない。`placement` は pointerdown 時の値でそのストローク中固定される |
| ペンモードを抜ける / 接続が切れる | 既存どおり。`placement` は保持される |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- 平面の**法線は three の `camera.position` と ストアの `selfCamera.target` から作る**。
  `selfCamera.position` は使わない(epsilon による丸めがあるため)。
  `viewPlaneAt([camera.position.x, camera.position.y, camera.position.z],
  useCameraStore.getState().selfCamera.target)` の形にする
- **平面は pointerdown のときに1度だけ作り、`useRef` に保持してそのストローク中は固定する。**
  pointermove ごとに作り直さない。描画中のズームで平面が動くのを防ぐため
- `placement` も pointerdown のときに `useAnnotationStore.getState().placement` で読む。
  `useEffect` の依存配列に `placement` を入れない(切替でリスナーを張り直す必要はなく、
  ドラッグ中の切替も起こらない)
- `placement` を別の ref に持つ必要はない。**平面 ref が `null` でなければ空間モード、
  `null` なら表面モード**として pointermove を分岐させる。`finishDraft` と effect の cleanup で
  平面 ref を `null` に戻す
- レイは既存と同じ `raycaster.current.setFromCamera(new Vector2(ndc.x, ndc.y), camera)` で作り、
  `raycaster.current.ray` の `origin` / `direction` を `Vec3` に写して `intersectPlane` に渡す。
  `intersectPlane` は three の型に依存させない(純粋な数値関数としてテストするため)
- 空間モードの pointerdown で `intersectPlane` が `null` を返したら、表面モードで
  `pickModel` が `null` だったときと同様に描画を開始しない。pointermove で `null` のときは
  その点を積まないだけで、ドラッグは継続する
- 「表面 / 空間」の切替は `AnnotationToolbar` の中で色ボタン群の直後、`UNDO_LABEL` のボタンより前に、
  `<div role="group" aria-label="描画の基準">` として置く。中のボタンは `PLACEMENT_ORDER` を
  `map` し、`className="btn btn--quiet"` / `type="button"` / `aria-pressed={placement === value}` /
  `onClick={() => useAnnotationStore.getState().setPlacement(value)}` とする。
  トグル解除(押して `"surface"` に戻す)はしない。2値の排他選択である
- モードボタン(`MODE_ORDER`)と違い、`placement` に「未選択」はない。必ずどちらかが選ばれている
- `annotation.css` と `viewer.css` は変更しない。`.annotation-tools` は `inline-flex` + `gap` なので
  グループを足すだけで並ぶ

## やらないこと
- 基準平面を前後にずらす深度オフセットのUI(スライダや -/+ ボタン、修飾キー+ドラッグ)は追加しない。
  奥行きは常に注視点の深さである
- 3Dカーソルのような、カメラの注視点とは独立した基準点は導入しない
- Blender の他の placement(Surface 以外の Stroke = 既存の線の上に描く、View = 画面固定)は実装しない
- 空間モードで法線オフセット(`offsetAlongNormal`)を適用しない。`stroke-build.ts` は変更しない
- 表面モードの挙動を変更しない
- `simplify` のトレランス(`modelSize * 0.001`)と送信点数の上限(2000点)は変更しない
- `placement` を WebSocket で他の参加者へ送らない。`Stroke` に描画方式を示すフィールドを足さない
  (点列だけで表現でき、`shared` と `server` を変更せずに済む)
- `placement` を localStorage へ保存しない
- キーボードショートカット(モードや placement の切替キー)は追加しない
- OrbitControls とカメラ操作(033 の `camera-input.ts` / `viewer-pointer.ts` / `CameraRig.tsx`)は変更しない
- `CommentPickLayer`(コメントのアンカー配置)は表面のヒット点のままとし、変更しない
- 034 で入れた `overlay` / `setOverlay` / `OVERLAY_LABEL` / `StrokeLines` / `stroke-overlay.ts` の
  挙動は変更しない
- `shared/` と `server/` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`draw-plane.test.ts` を新規に追加し、`store-annotation.test.ts` に `placement` の系列を、
      `hud-labels.test.ts` に `PLACEMENT_LABELS` / `PLACEMENT_ORDER` と `hint` の placement 分岐を足す。
      既存の `hint` 呼び出しは `placement` が必須になるため全箇所を更新する)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`draw-plane.ts` の追加、`PenPlacement` / `placement` / `setPlacement` /
      `PLACEMENT_LABELS` / `PLACEMENT_ORDER`、`HintInput` に `placement` が増えたこと、
      空間モードが注視点の平面へ投影することを含む)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
