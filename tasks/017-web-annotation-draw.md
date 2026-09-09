---
id: 017
title: web Annotation 描画入力(レイキャスト・間引き・送信)とツールバー
feature: web
depends_on: [016]
owns: [web/src/features/viewer/model-target.ts, web/src/features/viewer/pick.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/CameraRig.tsx, web/src/features/annotation/stroke-build.ts, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/annotation/AnnotationToolbar.tsx, web/src/app/ReviewPage.tsx, web/tests/pick.test.ts, web/tests/stroke-build.test.ts, web/tests/model-target.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/protocol.ts, shared/src/stroke.ts, web/src/store/annotation.ts, web/src/store/camera.ts, web/src/store/session.ts, web/src/app/useRealtime.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/follow.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
MVP #4(Annotation)の描く側。ペンモード中にポインタでモデル表面をなぞり、ヒット点を
集めて `simplify` し `stroke:add` を送る(§16.3)。色の変更、Undo(自分の最新の線を消す)、
Clear(自分の線を全消去)のツールバーを付ける。モデル表面へのピック(レイキャスト)は
019 のコメント配置でも使うので、`features/viewer/` に共通部品として置く(D29)。

## 前提
- 016 の annotation ストア(`mode` / `color` / `drafting` / `beginDraft` / `appendDraftPoint` /
  `endDraft` / `strokes`)が実装済み。描画中のプレビューは 016 の `RoomStrokes` が `drafting` を
  見て描くので、ここでは点を積むだけでよい
- `simplify` `simplifyTolerance` `isSendableStroke` は `@shared/stroke`(003)。
  `modelSize` は camera ストア(012)の `modelSize`
- サーバは受信 stroke の `userId` / `createdAt` を上書きする(D20)ので、クライアントの値は
  仮でよいが `StrokeSchema` を通る値を入れる。`id` は `nanoid(12)`(依存にある)
- サーバは `stroke:add` を送信者にも配信する(§15)。**送った線をローカルで `addStroke` しない**
  (二重になる)。`endDraft` で draft を消し、サーバ応答を待つ
- 012 の `ModelMesh` は `useGLTF(src)` の `scene` を `<primitive>` で描画している。
  **このタスクでロード完了時に `setModelTarget(scene)`、アンマウント時に `setModelTarget(null)` を足す**
  (他の責務は変えない)
- 015 の `CameraRig` に **`<OrbitControls enabled={mode !== "pen"} />` を足す**(D31)。
  他の責務は変えない
- three 0.186 の `Raycaster.setFromCamera(ndc, camera)` / `intersectObject(obj, true)`。
  法線は `intersection.face.normal` をオブジェクトの `matrixWorld` で `transformDirection` してワールド系にする
- ポインタイベントは `useThree().gl.domElement` に `addEventListener` で付ける(R3F のイベントは
  メッシュ単位なので使わない)。`setPointerCapture` で Canvas 外に出ても `pointerup` を受ける
- 切断中(`session.connection !== "open"`)や `selfId` が null のときは線を送らない(§17)。
  draft は捨てる
- 決定事項 **D15 / D20 / D29 / D31**(docs/task-breakdown.md §3)
- R3F コンポーネントの描画テストは書かない。テスト対象は `pick.ts` `stroke-build.ts` `model-target.ts`。
  `pick.ts` のテストは three の実オブジェクト(`BoxGeometry` / `PerspectiveCamera` / `Raycaster`)で行う
  (jsdom で動く。WebGL は使わない)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/viewer/model-target.ts(zustand ではない。React 外の単純なモジュール)
import type { Object3D } from "three";
export function setModelTarget(obj: Object3D | null): void;
export function getModelTarget(): Object3D | null;     // 初期値 null
```

```ts
// web/src/features/viewer/pick.ts
import type { Camera, Object3D, Raycaster } from "three";
import type { Vec3 } from "@shared/types";

export interface Ndc { x: number; y: number }
/** クライアント座標 → NDC(x 右+, y 上+、[-1,1])。rect は canvas.getBoundingClientRect() 相当 */
export function toNdc(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number, clientY: number,
): Ndc;

export interface PickHit { point: Vec3; normal: Vec3 | null }
/** target に対してレイキャストし、最も近いヒットを返す。target が null / ヒット無しなら null。
 *  normal はワールド系の単位ベクトル。face が無ければ null */
export function pickModel(raycaster: Raycaster, camera: Camera, ndc: Ndc, target: Object3D | null): PickHit | null;
```

```ts
// web/src/features/annotation/stroke-build.ts
import type { Stroke, Vec3 } from "@shared/types";

/** 法線方向のオフセット比(モデル最大辺長に対して。§16.3 の 0.2%) */
export const NORMAL_OFFSET_RATIO = 0.002;

/** point + normal * (modelSize * NORMAL_OFFSET_RATIO)。normal が null なら point の複製 */
export function offsetAlongNormal(point: Vec3, normal: Vec3 | null, modelSize: number): Vec3;

/** simplify(points, simplifyTolerance(modelSize)) して Stroke を組む。
 *  isSendableStroke を満たさなければ null(D15) */
export function buildStroke(
  points: Vec3[],
  meta: { id: string; userId: string; color: string; createdAt: number; modelSize: number },
): Stroke | null;

/** その userId の線のうち createdAt が最大のものの id(同値なら id 昇順の最後)。無ければ null */
export function latestOwnStrokeId(strokes: Record<string, Stroke>, userId: string): string | null;
```

```tsx
// web/src/features/annotation/AnnotationLayer.tsx
import type { ClientMessage } from "@shared/protocol";
/** 何も描画しない(null を返す)。Canvas 内に置き、mode === "pen" の間だけ
 *  gl.domElement に pointerdown / pointermove / pointerup / pointercancel を付ける */
export function AnnotationLayer(props: { send: (msg: ClientMessage) => boolean }): null;

// web/src/features/annotation/AnnotationToolbar.tsx
/** モード切替(Orbit / Pen / Comment の 3 ボタン、現在値を強調)、色スウォッチ(STROKE_COLORS)、
 *  Undo、Clear。Canvas 外(ビューア上部)に置く */
export function AnnotationToolbar(props: { send: (msg: ClientMessage) => boolean }): React.ReactElement;
```

`AnnotationLayer` のポインタ処理(mode === "pen" のときのみ。それ以外はリスナを外す):

| イベント | 動作 |
| --- | --- |
| `pointerdown`(主ボタン) | `pickModel` でヒットしたら `offsetAlongNormal` した点で `beginDraft`。外れたら何もしない。`setPointerCapture` |
| `pointermove`(draft 中) | ヒットしたら `appendDraftPoint`。外れた点は捨てる(§16.3) |
| `pointerup` / `pointercancel` | `endDraft()` → `buildStroke(points, { id: nanoid(12), userId: selfId, color, createdAt: Date.now(), modelSize })`。非 null かつ `connection === "open"` かつ `selfId` 非 null なら `send({type:"stroke:add", stroke})`。それ以外は捨てる |
| mode が "pen" 以外になった | リスナを外し、draft は 016 の `setMode` が捨てる |

`AnnotationToolbar` の動作:

| 操作 | 動作 |
| --- | --- |
| Orbit / Pen / Comment ボタン | `setMode(...)`。Comment モードの実際の動作は 019(ここではモードが変わるだけ) |
| 色スウォッチ | `setColor(c)`。現在色を強調 |
| Undo | `latestOwnStrokeId(strokes, selfId)` が非 null なら `send({type:"stroke:remove", strokeId})`。null なら disabled |
| Clear | 自分の線が 1 本以上あれば `send({type:"stroke:clear"})`。無ければ disabled |
| `connection !== "open"` | Undo / Clear を disabled |

`ReviewPage` への追加分: ビューア上部の Reset / 全体表示の並びに `<AnnotationToolbar send={realtime.send} />`、
`<ViewerCanvas>` の children に `<AnnotationLayer send={realtime.send} />`。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `getModelTarget()` 初期 | `null` |
| `setModelTarget(obj)` → `getModelTarget()` → `setModelTarget(null)` | `obj` → `null` |
| `toNdc({left:0,top:0,width:200,height:100}, 100, 50)` | `{x:0, y:0}` |
| `toNdc(同 rect, 200, 0)` / `(同 rect, 0, 100)` | `{x:1, y:1}` / `{x:-1, y:-1}` |
| `toNdc({left:50,top:20,width:100,height:100}, 50, 20)` | `{x:-1, y:1}`(rect のオフセットを引く) |
| `pickModel(rc, cam, {x:0,y:0}, box)`(`BoxGeometry(1,1,1)` 原点、`PerspectiveCamera(50,1,0.1,100)` を `[0,0,5]` に置き原点を lookAt、両方 `updateMatrixWorld()`) | 非 null。`point` ≈ `[0,0,0.5]`(各成分 1e-3 以内)、`normal` ≈ `[0,0,1]` |
| `pickModel(rc, cam, {x:0.9,y:0.9}, box)` | `null`(外れ) |
| `pickModel(rc, cam, {x:0,y:0}, null)` | `null` |
| `pickModel` で box を `position.set(0,0,-2)` して更新 | `point.z` ≈ `-1.5` |
| `offsetAlongNormal([1,1,1], [0,1,0], 10)` | `[1, 1.02, 1]` |
| `offsetAlongNormal([1,1,1], null, 10)` | `[1,1,1]` と等しく、別参照 |
| `buildStroke(直線上の 5 点, {…, modelSize:10})` | `points` が 2 点(simplify 済み)。`id/userId/color/createdAt` が meta のとおり |
| `buildStroke(1 点, …)` | `null` |
| `buildStroke(2 点, …)` | 非 null、2 点 |
| `buildStroke` の結果 | `StrokeSchema.safeParse` が成功する |
| `latestOwnStrokeId({a:u1@1, b:u1@3, c:u2@5}, "u1")` | `"b"` |
| `latestOwnStrokeId({a:u1@1, b:u1@1}, "u1")` | `"b"`(同値は id 昇順の最後) |
| `latestOwnStrokeId({c:u2@5}, "u1")` / `({}, "u1")` | `null` |
| `NORMAL_OFFSET_RATIO` | 0.002 |

## やらないこと
- コメント配置のクリック処理・`CommentPickLayer`(019)。Comment モードのボタンは置くが動作は 019
- annotation ストア / `StrokeLines` / `RoomStrokes` の変更(016 の成果物)
- 送った線のローカル追加(サーバ応答に任せる)
- タッチ用の 2 本指判定、ペンの筆圧(MVP 外)
- R3F コンポーネントの描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(model-target / pick の使い方、AnnotationLayer の送信規則)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
