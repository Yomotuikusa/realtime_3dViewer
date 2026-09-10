---
id: 053
title: web 既定視点・視点再現の補間を時間基準にし、慣性の残りとユーザー操作の干渉で回転ロックが効かなくなる問題を直す
feature: web
depends_on: [052]
owns: [web/src/features/viewer/camera-animation.ts, web/src/features/viewer/CameraRig.tsx, web/src/store/camera.ts, web/tests/camera-animation.test.ts, web/tests/store-camera.test.ts, web/src/features/viewer/viewer_Summary.md, web/src/store/store_Summary.md]
reads: [shared/src/camera.ts, shared/src/types.ts, web/src/features/viewer/view-presets.ts, web/src/features/viewer/viewer-pointer.ts, web/src/features/viewer/follow.ts, web/src/store/presence.ts, node_modules/three-stdlib/controls/OrbitControls.js, node_modules/@react-three/drei/core/OrbitControls.js]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
052 の回転ロックは「補間が終わった瞬間の `selfCamera` が `presetCamera` の返り値そのもの」で
あることを前提にしているが、実機では次の 2 つの理由でその前提が崩れ、右 / 左で
「少し回転できてしまう」「パンや拡大縮小が吸い込まれて効かない」が起きる。

1. OrbitControls の減衰(慣性)が残ったまま既定視点を押すと、補間が毎フレーム「現在位置」から
   目標へ 20% 進む方式のため、慣性の残りと綱引きになって到達まで数秒かかる。その間のパン / ホイール /
   dolly は補間に吸い込まれて元に戻され、Alt+左ドラッグはゴムのように少し回って戻る。
2. 到達時に `setSelfCamera(target)` を呼んでも、ストアの epsilon(1e-4)判定が「ほぼ同じ」として
   更新を捨てることがあり、`selfCamera` が軸から 1e-6 以上ずれた中間値のまま残って
   `matchViewPreset` が null になる(ロックが掛からない)。どのプリセットで起きるかは
   浮動小数の巡り合わせで決まり、右 / 左で再現しやすかった。

補間を「開始時のカメラから目標へ、経過時間で決める」方式に変え、開始時に慣性の残りを打ち切り、
ユーザー操作が入ったら補間をやめ、到達時はストアへ完全一致で書き込む。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `CameraRig` の `useFrame` は毎フレーム、Reset → `pendingCamera` の消費 → 補間 → Follow の順に処理する。
  補間は `lerpCamera(current, target, 0.2)` で `current = readCamera(camera, controls)`(実カメラ)から進み、
  `cameraEquals(next, target)`(eps 1e-4)で到達とみなす。web/src/features/viewer/CameraRig.tsx:66-128

- `useCameraStore.setSelfCamera(camera)` は `cameraEquals(get().selfCamera, camera)`(eps 1e-4)が
  真なら何もしない。web/src/store/camera.ts:47-52

- drei の `OrbitControls` は `enableDamping` の既定値が **true** で、`useFrame(() => { if (controls.enabled) controls.update() }, -1)` を
  毎フレーム呼ぶ。`enableDamping` / `enableRotate` などの props は `<primitive>` へそのまま渡される。
  node_modules/@react-three/drei/core/OrbitControls.js:11, 29-31, 72-76

- three-stdlib の `OrbitControls.update()` は、`enableDamping === true` のとき `sphericalDelta` と `panOffset` を
  `dampingFactor`(0.05)ぶんだけ適用して 0.95 倍に減衰させ、**`enableDamping === false` のときは残り全部を
  一度に適用してから `sphericalDelta.set(0,0,0)` / `panOffset.set(0,0,0)` にする。**
  node_modules/three-stdlib/controls/OrbitControls.js:190-196, 232-239
  この事実は本タスクの `flushControlsInertia` の根拠であり、jsdom 上で確認済み
  (回転ドラッグ後に `enableDamping=false; update(); enableDamping=true` すると、その後 120 フレーム update しても
  位置が 1e-6 も動かない)。

- three-stdlib の `OrbitControls` は、Alt+左ドラッグ(ROTATE)・Alt+中ドラッグ(PAN)の開始時と、
  ホイール操作時に `start` イベントを dispatch する。`enableRotate === false` のときの ROTATE 開始では dispatch しない。
  node_modules/three-stdlib/controls/OrbitControls.js:678-702, 725-733

- `attachViewerPointer(controls, deps)` は Alt+右ドラッグ(自前 dolly)の pointerdown で `deps.onUserInteract()` を呼び、
  Shift+右ドラッグ(ライト回転)では呼ばない。web/src/features/viewer/viewer-pointer.ts:15, 43-59

- `rotationLocked(selfCamera, following)` は `matchViewPreset` が `PRESET_MATCH_EPSILON`(1e-6)で
  方向を比較する。`selfCamera` が `presetCamera` の返り値と完全一致していれば必ず一致する。
  web/src/features/viewer/view-presets.ts:36, 64-93

- `lerpCamera(from, to, t)` は `t` を [0, 1] にクランプし、NaN は 0 として扱う。`cameraEquals(a, b, eps)` の
  `eps` に 0 を渡すと完全一致判定になる。`cloneCamera` は独立した複製を返す。shared/src/camera.ts:12-44

- web のテストは jsdom 環境で `@testing-library` がない。**React コンポーネントのレンダリングテストは書けない。**
  web/vitest.config.ts

## インターフェイス契約

### 新規 web/src/features/viewer/camera-animation.ts

```ts
import type { CameraState } from "@shared/types";

/** 既定視点・視点再現の補間にかける時間(ms)。 */
export const CAMERA_ANIMATION_DURATION_MS = 300;

/** 進行中の補間。from / to は開始時に複製した独立の値。 */
export interface CameraAnimation {
  from: CameraState;
  to: CameraState;
  /** performance.now() 基準の開始時刻(ms) */
  startedAt: number;
}

/** 0→1 を減速しながら進む。1 - (1 - t)^3 */
export function easeOutCubic(t: number): number;

/** from / to を複製して補間を開始する。引数は変更しない。 */
export function startCameraAnimation(from: CameraState, to: CameraState, startedAt: number): CameraAnimation;

/**
 * now(ms)における補間結果。
 * 経過が CAMERA_ANIMATION_DURATION_MS 以上なら camera は to の複製で done は true。
 * それ未満なら from→to を easeOutCubic で進めた値で done は false。
 * animation は変更しない。
 */
export function stepCameraAnimation(animation: CameraAnimation, now: number): { camera: CameraState; done: boolean };

/** OrbitControls の減衰(慣性)を扱える最小構造型。three-stdlib の OrbitControls をそのまま渡せる。 */
export interface DampedControlsLike {
  enableDamping: boolean;
  update(): boolean | void;
}

/**
 * 減衰の残り(sphericalDelta / panOffset)を一度に適用して打ち切る。
 * enableDamping を false にして update() を 1 回呼び、enableDamping を元の値へ戻す。
 * update() が例外を投げても enableDamping は元に戻す。
 */
export function flushControlsInertia(controls: DampedControlsLike): void;
```

### 変更 web/src/store/camera.ts

既存の state と action はすべて残す。`setSelfCamera` だけ第 2 引数を足す。

```ts
export interface CameraStoreState {
  // ...既存のまま...

  /**
   * exact が false(既定)のときは従来どおり cameraEquals(既定 eps)で同じなら更新しない。
   * exact が true のときは cameraEquals(…, 0) の完全一致でない限り、cloneCamera した値で更新する。
   */
  setSelfCamera(camera: CameraState, exact?: boolean): void;
}
```

### 変更 web/src/features/viewer/CameraRig.tsx

props は無い。シグネチャは変更しない。

```tsx
export function CameraRig(): ReactElement;
```

## 振る舞い

### easeOutCubic

| 入力 | 期待する結果 |
| --- | --- |
| `0` | `0` |
| `1` | `1` |
| `0.5` | `0.875` |
| 任意の `t ∈ (0, 1)` | `t < easeOutCubic(t) < 1`(減速カーブ) |

### startCameraAnimation

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `startCameraAnimation(a, b, 100)` | `{ from, to, startedAt: 100 }` で `from` は `a` と `cameraEquals(…, 0)`、`to` は `b` と同様 |
| 返り値の `from.position` / `to.position` / `from.target` / `to.target` | 引数の配列と同一参照ではない |
| 呼び出し後に引数 `a` / `b` を書き換える | 返り値は変わらない |

### stepCameraAnimation

`A = startCameraAnimation({position:[0,0,10], target:[0,0,0]}, {position:[10,0,0], target:[0,0,0]}, 1000)` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `stepCameraAnimation(A, 1000)`(経過 0) | `camera` は `from` と完全一致、`done: false` |
| `stepCameraAnimation(A, 900)`(開始前) | `camera` は `from` と完全一致、`done: false` |
| `stepCameraAnimation(A, 1150)`(経過 150ms = 半分) | `camera.position` は `lerpVec3([0,0,10],[10,0,0], 0.875)` と `vec3Equals(…, 1e-9)`、`done: false` |
| `stepCameraAnimation(A, 1300)`(経過ちょうど DURATION) | `camera` は `to` と `cameraEquals(…, 0)`、`done: true` |
| `stepCameraAnimation(A, 5000)`(大幅に超過) | `camera` は `to` と `cameraEquals(…, 0)`、`done: true` |
| `stepCameraAnimation(A, NaN)` | `camera` は `from` と完全一致、`done: false` |
| `done: true` のときの `camera.position` / `camera.target` | `A.to.position` / `A.to.target` と同一参照ではない |
| 呼び出し前後で `A` | 変化しない |

### flushControlsInertia

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `enableDamping: true` の fake(`update` は呼ばれた時点の `enableDamping` を記録する) | `update` が 1 回、`enableDamping === false` の状態で呼ばれ、戻り後 `enableDamping === true` |
| `enableDamping: false` の fake | `update` が 1 回呼ばれ、戻り後 `enableDamping === false` |
| `update` が throw する fake(`enableDamping: true`) | 例外はそのまま伝播し、`enableDamping` は `true` に戻っている |

### setSelfCamera(camera, exact)

既存のテスト(`store-camera.test.ts`)はすべてそのまま通ること。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `setSelfCamera(c)`(第 2 引数省略)で現在値と 1e-6 だけ違う `c` | 従来どおり更新しない(参照が変わらない) |
| `setSelfCamera(c, true)` で現在値と 1e-6 だけ違う `c` | 更新する。`selfCamera` は `c` と `cameraEquals(…, 0)` で一致し、`c` と同一参照ではない |
| `setSelfCamera(c, true)` で現在値と完全一致する `c` | 更新しない(参照が変わらない) |
| `setSelfCamera(c, false)` | 第 2 引数省略と同じ |

### 結線後の全体像(CameraRig)

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。
`now` は各フレームで `performance.now()` を 1 回読んで使う。

| 状況 | 期待する結果 |
| --- | --- |
| `resetSeq` が増えた | 進行中の補間を破棄し、`flushControlsInertia(controls)` → `applyCamera(DEFAULT_CAMERA)` → `setSelfCamera(DEFAULT_CAMERA, true)`。Follow 解除と `consumePendingCamera()` は従来どおり |
| `pendingCamera` が非 null で `controlsRef.current` が非 null | `consumePendingCamera()` → `presence.unfollow()` → `flushControlsInertia(controls)` → `startCameraAnimation(readCamera(camera, controls), target, now)` を保持して return。**flush の後に readCamera すること** |
| `pendingCamera` が非 null で `controlsRef.current` が null | そのフレームでは消費せず、次のフレームへ持ち越す |
| 補間が進行中(`done: false`) | `applyCamera(camera, controls, step.camera)` と `setSelfCamera(step.camera)`(exact なし)。Follow の処理はしない |
| 補間が到達(`done: true`) | `applyCamera(camera, controls, step.camera)` → 補間を破棄 → `setSelfCamera(step.camera, true)`。以後 `selfCamera` は目標そのものになり、目標が既定視点なら `rotationLocked` が true になる |
| 補間中に Alt+左 / Alt+中ドラッグ、ホイール(OrbitControls の `start`) | 補間を破棄し、`presence.unfollow()`。カメラはその時点の値で止まり、ユーザー操作がそのまま効く |
| 補間中に Alt+右ドラッグ(`attachViewerPointer` の `onUserInteract`) | 同上 |
| 補間中に Shift+右ドラッグ(ライト回転) | 補間は続く(`onUserInteract` は呼ばれない) |
| 補間中に別の既定視点を押す | 次のフレームで新しい補間に置き換わる(その時点のカメラから開始) |
| 回転ドラッグの慣性が残った状態で既定視点を押す | 押した次のフレームで慣性の残りが一度に適用され、そこから 300ms で目標へ到達してロックされる。到達後は慣性で動かない |
| 既定視点にロック中の Alt+中ドラッグ / ホイール / Alt+右ドラッグ | 052 と同じく従来どおり効き、方向が変わらないのでロックは続く |
| 既定視点にロック中の Alt+左ドラッグ | 052 と同じく回らない |
| 既定視点到達後の視点が他の参加者へ配信されること | 従来どおり(`setSelfCamera` で `selfCamera` が変わる) |
| Follow 中の毎フレーム処理(`followStep`)、Fit(`bounds.refresh().clip().fit()`) | 変更しない |
| `enableRotate={!locked}` と、その理由コメント | 052 のまま |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `pendingTarget: useRef<CameraState | null>` は `animation: useRef<CameraAnimation | null>` に置き換える。
  `lerpCamera(current, target, 0.2)` と `cameraEquals(next, target)` による到達判定は削除する
- `handleStart`(OrbitControls の `onStart`)と `attachViewerPointer` の `onUserInteract` は同じ関数
  `handleUserInteract` にし、`animation.current = null` と `usePresenceStore.getState().unfollow()` を行う。
  `useEffect` の依存配列に入れるため `useCallback` で作り、依存は `[]` でよい(ref とストアの `getState` しか使わない)
- `handleChange`(`onChange` と自前 dolly の `onCameraChange`)は従来どおり `setSelfCamera(readCamera(...))` で、exact は付けない
- `flushControlsInertia` は `controlsRef.current` に対して呼ぶ。drei が `enableDamping` を props から再適用するのは
  再レンダー時だけなので、同期的に元へ戻す限り競合しない
- `stepCameraAnimation` は `const t = (now - animation.startedAt) / CAMERA_ANIMATION_DURATION_MS` を求め、
  `t >= 1` なら `{ camera: cloneCamera(animation.to), done: true }`、そうでなければ
  `{ camera: lerpCamera(animation.from, animation.to, easeOutCubic(Math.max(0, t))), done: false }`。
  `t` が NaN のときは `t >= 1` が false になり、`Math.max(0, NaN)` は NaN だが `lerpCamera` が 0 として扱うので `from` になる。
  この経路で `done` が true にならないことをテストで確認する
- `easeOutCubic` は `1 - (1 - t) ** 3` をそのまま書く。クランプは呼び出し側(`stepCameraAnimation`)の責務
- `setSelfCamera` の exact 分岐は `cameraEquals(get().selfCamera, camera, 0)` を使う。新しい比較関数を作らない
- `CameraRig` 内で `performance.now()` を使う。`useFrame` の `state.clock` は使わない(テスト不能な差異を増やさない)
- 補間中は `setSelfCamera(step.camera)` を毎フレーム呼ぶ(配信のため)。到達フレームだけ exact を付ける

## やらないこと
- `enableDamping` を false にして慣性そのものを止めない(通常操作の手触りを変えない)
- `enablePan` / `enableZoom` / `enabled` を触らない。補間中の操作を「無効化」ではなく「補間の中断」で扱う
- `view-presets.ts`(`matchViewPreset` / `rotationLocked` / `PRESET_MATCH_EPSILON`)を変更しない
- `follow.ts` / `followStep` / Follow 中の毎フレーム処理を変更しない。Follow 開始時の慣性打ち切りも扱わない
- `viewer-pointer.ts` / `camera-input.ts` / `CameraMenu.tsx` / `ViewerHud.tsx` を変更しない
- `pendingCamera` / `requestCamera` / `consumePendingCamera` の意味を変えない。ストアに補間の state を持たせない
- `shared/` と `server/` を変更しない
- Bounds の Fit アニメーション(drei 内部)には手を入れない
- 補間の時間や easing を設定で変えられるようにしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の `easeOutCubic` / `startCameraAnimation` / `stepCameraAnimation` / `flushControlsInertia` の全行に
      対応するテストが `web/tests/camera-animation.test.ts` にあり、通る
- [ ] 振る舞い表の `setSelfCamera(camera, exact)` の全行に対応するテストが `web/tests/store-camera.test.ts` に追加され、
      既存のテストもすべて通ったままである
- [ ] `CameraRig.tsx` から `lerpCamera` による毎フレーム到達判定が消え、`startCameraAnimation` / `stepCameraAnimation` /
      `flushControlsInertia` を使っている
- [ ] `viewer_Summary.md` のファイル一覧・公開インターフェイス・他フォルダとの関係・テスト一覧が実態に合っている
      (`camera-animation.ts` の追加、`CameraRig` の補間方式と中断条件、Reset / 既定視点で慣性を打ち切ること、
      `tests/camera-animation.test.ts` の追加)
- [ ] `store_Summary.md` の `setSelfCamera` の説明に exact 引数が反映されている
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
