---
id: 033
title: web 視点モードの廃止と Maya 式カメラ操作(Alt+ドラッグ)への移行
feature: web
depends_on: []
owns: [web/src/features/viewer/camera-input.ts, web/src/features/viewer/viewer-pointer.ts, web/src/features/viewer/CameraRig.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/ViewerHud.tsx, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/comments/CommentPickLayer.tsx, web/src/store/annotation.ts, web/tests/camera-input.test.ts, web/tests/viewer-pointer.test.ts, web/tests/hud-labels.test.ts, web/tests/store-annotation.test.ts, web/tests/review-stores.test.ts, web/web_Summary.md]
reads: [web/src/store/camera.ts, web/src/store/presence.ts, web/src/store/session.ts, web/src/store/comments.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/follow.ts, web/src/features/viewer/pick.ts, web/src/features/annotation/stroke-build.ts, web/src/features/comments/compose.ts, web/src/features/viewer/viewer.css, web/src/app/review-stores.ts, shared/shared_Summary.md, shared/src/types.ts, shared/src/camera.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
専用の「視点」モードを廃止し、どのモードにいても Alt を押している間だけカメラを操作できる
Maya 系の操作体系へ移行する。Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、
Alt+中ドラッグで移動とする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `AnnotationMode` は `"orbit" | "pen" | "comment"` の排他値で、初期値は `"orbit"`。
  web/src/store/annotation.ts:4, web/src/store/annotation.ts:36
- `setMode` は同値なら state をそのまま返し、値が変わるときだけ `drafting` を破棄する。
  web/src/store/annotation.ts:85
- `CameraRig` は drei の `OrbitControls` を `makeDefault` 付きで描画し、`enabled={mode !== "pen"}`
  でペン中だけ無効化している。web/src/features/viewer/CameraRig.tsx:113-125
- `CameraRig` の `onChange` は `readCamera(camera, controls)` を `useCameraStore.setSelfCamera` に渡す。
  `setSelfCamera` は `cameraEquals` の epsilon 内の更新を無視するため、同じ値で複数回呼んでも副作用はない。
  web/src/features/viewer/CameraRig.tsx:36-43, web/src/store/camera.ts
- `CameraRig` の `onStart` は `usePresenceStore.getState().unfollow()` を呼ぶ。これは OrbitControls が
  ドラッグを開始したときだけ発火し、自前で動かすカメラでは発火しない。
  web/src/features/viewer/CameraRig.tsx:109-111
- `AnnotationLayer` は Pen モード中だけ `gl.domElement` の pointerdown/pointermove/pointerup/pointercancel を
  購読し、`event.button !== 0` を無視する。web/src/features/annotation/AnnotationLayer.tsx:24-40
- `CommentPickLayer` は Comment モード中だけ pointerdown/pointerup を購読し、pointerdown で
  `down.current` に座標を記録し、pointerup で `isClick` 判定してアンカーを置く。
  web/src/features/comments/CommentPickLayer.tsx:24-45
- `hint()` は follow 中を最優先で返し、そのあと mode 別の文言を返す純粋関数。
  web/src/features/viewer/hud-labels.ts:39-54
- `Vec3` は `[number, number, number]`。shared/src/types.ts:3
- three の `MOUSE` は enum で、`import { MOUSE } from "three"` として値で使える。
- three の OrbitControls は `mouseButtons` を pointerdown の時点でしか読まない。したがって
  ドラッグ開始後に `mouseButtons` を書き換えても、進行中の操作は中断されない。
- three の OrbitControls は `mouseButtons.LEFT/MIDDLE/RIGHT` が `undefined` の場合、
  内部 state を NONE にして何もしない。
- web のテストは jsdom 環境で、`@testing-library` は導入されていない。React コンポーネントの
  レンダリングテストは書けないため、検証対象は純粋関数と DOM イベントを直接 dispatch できる
  モジュールに限られる。web/vitest.config.ts

## インターフェイス契約

### 新規 web/src/features/viewer/camera-input.ts

```ts
import { MOUSE } from "three";
import type { Vec3 } from "@shared/types";

/** OrbitControls の mouseButtons と構造的に互換な最小型。 */
export interface ViewerMouseButtons {
  LEFT?: MOUSE;
  MIDDLE?: MOUSE;
  RIGHT?: MOUSE;
}

/** Alt 押下中の割り当て。RIGHT は自前 dolly が処理するため OrbitControls では無効。 */
export const MOUSE_BUTTONS_ALT: Readonly<ViewerMouseButtons> = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.PAN,
  RIGHT: undefined,
};

/** Alt 非押下中の割り当て。すべて無効で、左ドラッグはペン/コメントへ届く。 */
export const MOUSE_BUTTONS_IDLE: Readonly<ViewerMouseButtons> = {
  LEFT: undefined,
  MIDDLE: undefined,
  RIGHT: undefined,
};

export function mouseButtonsFor(altKey: boolean): Readonly<ViewerMouseButtons>;

/** 右ドラッグ 1px あたりの dolly 係数。 */
export const DOLLY_SPEED = 0.005;
/** target とカメラの最小距離。これ以上は寄れない。 */
export const MIN_DOLLY_DISTANCE = 0.001;

/**
 * 右ドラッグの水平移動量から、target からの距離を指数的に縮めた新しい位置を返す。
 * 右へ動かす(deltaX > 0)とズームイン。position / target は変更しない。
 */
export function dollyPosition(position: Vec3, target: Vec3, deltaX: number): Vec3;
```

### 新規 web/src/features/viewer/viewer-pointer.ts

```ts
import type { Vector3 } from "three";
import type { ViewerMouseButtons } from "./camera-input";

/** OrbitControls インスタンスをそのまま渡せる最小構造型。 */
export interface ViewerControlsLike {
  domElement: HTMLElement;
  mouseButtons: ViewerMouseButtons;
  object: { position: Vector3 };
  target: Vector3;
  update(): void;
}

export interface ViewerPointerDeps {
  /** ユーザー操作でカメラが動き始めたとき(追従解除に使う)。 */
  onUserInteract(): void;
  /** 自前 dolly でカメラを動かした直後。 */
  onCameraChange(): void;
}

/**
 * controls.domElement に Maya 式の入力を取り付け、後始末をする関数を返す。
 * 取り付ける内容は「振る舞い」の表のとおり。
 */
export function attachViewerPointer(
  controls: ViewerControlsLike,
  deps: ViewerPointerDeps,
): () => void;
```

### 変更 web/src/store/annotation.ts

```ts
/** "none" はツール未選択。左ドラッグで何も起きない状態を指す。 */
export type AnnotationMode = "none" | "pen" | "comment";
```

`initialState.mode` を `"none"` にする。`setMode` の実装は変更しない。

### 変更 web/src/features/viewer/hud-labels.ts

```ts
/** HUD のボタンに出すモード。"none" は解除状態でありボタンを持たない。 */
export type ToolMode = Exclude<AnnotationMode, "none">;

export const MODE_LABELS: Readonly<Record<ToolMode, string>> = {
  pen: "ペン",
  comment: "コメント",
};

export const MODE_ORDER: readonly ToolMode[] = ["pen", "comment"];
```

`RESET_LABEL` / `FIT_LABEL` / `UNDO_LABEL` / `CLEAR_LABEL` / `UNFOLLOW_LABEL` / `colorName` /
`followingLabel` / `HintInput` / `hint` のシグネチャは変更しない(`HintInput.mode` は
`AnnotationMode` のまま)。

## 振る舞い

### camera-input.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `mouseButtonsFor(true)` | `MOUSE_BUTTONS_ALT` を返す |
| `mouseButtonsFor(false)` | `MOUSE_BUTTONS_IDLE` を返す |
| `dollyPosition([0,0,10], [0,0,0], 100)` | target からの距離が `10 * Math.exp(-0.5)` になる位置(ズームイン)。向きは変わらない |
| `dollyPosition([0,0,10], [0,0,0], -100)` | 距離が `10 * Math.exp(0.5)` になる位置(ズームアウト) |
| `deltaX` が 0 | 入力と同値の新しい配列を返す(引数の配列は返さない) |
| `position` と `target` が同一点 | 距離 0 のため計算せず、入力と同値の新しい配列を返す |
| 縮めた結果が `MIN_DOLLY_DISTANCE` を下回る<br>(例: `dollyPosition([0,0,0.001],[0,0,0],10000)`) | 距離を `MIN_DOLLY_DISTANCE` にクランプした位置を返す |
| 引数の配列 | どの場合も破壊的に変更しない |

### viewer-pointer.ts / attachViewerPointer

リスナーはすべて `controls.domElement` に登録する。`gl.domElement` ではない
(drei は `events.connected` を domElement に使うことがあり、両者が一致しない可能性がある)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `pointerdown`(capture フェーズ) | 何よりも先に `controls.mouseButtons = mouseButtonsFor(event.altKey)` を代入する。これにより OrbitControls が同じイベントを読む時点で割り当てが確定している |
| `altKey` あり + `button === 2` の `pointerdown` | 自前 dolly を開始。`event.clientX` を記録し、`domElement.setPointerCapture(event.pointerId)` を呼び、`deps.onUserInteract()` を1回呼ぶ |
| `altKey` なしの `button === 2` の `pointerdown` | dolly を開始しない |
| dolly 中の `pointermove` | `event.clientX - 前回の clientX` を `deltaX` として `dollyPosition` を適用し、`controls.object.position.set(...)` → `controls.update()` → `deps.onCameraChange()` の順に呼ぶ。記録座標を今回の `clientX` に更新する |
| dolly 中に Alt を離してからの `pointermove` | dolly を継続する(判定は pointerdown 時の `altKey` だけ) |
| dolly 中でない `pointermove` | 何もしない。`deps` を呼ばない |
| dolly 中の `pointerup` / `pointercancel` | dolly を終了し、capture を保持していれば `releasePointerCapture` する |
| `contextmenu` | 常に `preventDefault()` する |
| `button === 1` の `mousedown` | `preventDefault()` する(Windows のオートスクロール抑止) |
| `auxclick` | `preventDefault()` する |
| 返り値の関数を呼ぶ | 登録した全リスナーを解除し、dolly 状態を破棄する。以後どのイベントでも `deps` を呼ばない |

### モードと入力の対応(結線後の全体像)

| 状況 | 期待する結果 |
| --- | --- |
| 初期状態 | `mode` は `"none"`。HUD のペン/コメントはどちらも `aria-pressed="false"` |
| HUD で未選択のモードボタンを押す | そのモードになる |
| HUD で選択中のモードボタンを押す | `"none"` に戻る(トグル解除) |
| Alt なしの左ドラッグ / `mode === "none"` | 何も起きない。カメラも動かない |
| Alt なしの左ドラッグ / `mode === "pen"` | 従来どおり線を描く |
| Alt なしの左クリック / `mode === "comment"` | 従来どおりアンカーを置く |
| Alt + 左ドラッグ | どのモードでも回転する。ペン描画もアンカー配置も起きない |
| Alt + 中ドラッグ | どのモードでも平行移動する |
| Alt + 右ドラッグ(右へ) | どのモードでもズームインする |
| ホイール | Alt の有無によらずズームする |
| 描画中(Alt なしで開始)に Alt を押す | 線の描画は途切れず継続する。回転は始まらない |
| Alt+左ドラッグ中に Alt を離す | 回転が途切れず継続する |
| ペン中のホイール | ズームする(従来は `enabled=false` で効かなかった) |

### hint() の返り値

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `following: true`(mode を問わず) | `"操作すると追従が解除されます"`(変更なし) |
| `mode: "none"` | `"Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動"` |
| `mode: "pen"`, `canEdit: true` | `"モデルの上をドラッグして線を描きます(Alt を押している間は視点操作になります)"` |
| `mode: "pen"`, `canEdit: false` | `"接続が切れているため線を描けません"`(変更なし) |
| `mode: "comment"`, `hasAnchor: false` | `"モデルをクリックしてコメントの位置を決めます"`(変更なし) |
| `mode: "comment"`, `hasAnchor: true` | `"右のパネルで本文を入力してください"`(変更なし) |

## 実装メモ

判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `CameraRig` は `OrbitControls` の `enabled` 属性を削除し、常に有効にする。ペン中の無効化はやめる。
  `mouseButtons` による制御に一本化する
- `CameraRig` で `attachViewerPointer` に渡す controls は `useThree((state) => state.controls)` から
  取得する。`makeDefault` により OrbitControls が登録され、React state なので変化時に effect が
  張り直される。`controlsRef` は既存の毎フレーム処理のために残してよいが、attach の依存には使わない
  (ref の更新では effect が再実行されないため)
- `deps.onUserInteract` は `usePresenceStore.getState().unfollow()`、`deps.onCameraChange` は
  既存の `handleChange` と同じ `setSelfCamera(readCamera(...))` を呼ぶ。`controls.update()` が
  OrbitControls の `change` を発火して `onChange` 経由でも同じ更新が走る可能性があるが、
  `setSelfCamera` は epsilon 判定で冪等なので二重呼び出しを避ける工夫はしない
- `AnnotationLayer` の `handlePointerDown` に `event.altKey` のガードを足す。判定するのは
  pointerdown だけで、pointermove / pointerup では `altKey` を見ない
- `CommentPickLayer` の `handlePointerDown` に `event.altKey` のガードを足す。pointerup 側は
  `down.current === null` で自然に無視されるためガードを足さない
- `ViewerHud` のモードボタンの `onClick` は `setMode(mode === modeValue ? "none" : modeValue)` とする
- `viewer.css` は変更しない。解除状態は既存の `aria-pressed="false"` のスタイルで表現できる

## やらないこと
- Alt の左右判別はしない。`event.altKey` をそのまま使い、右 Alt でも同じ操作にする
- ホイールのズーム速度や `OrbitControls` の `zoomSpeed` / `rotateSpeed` / `panSpeed` は変更しない
- `RESET_LABEL`(視点を戻す)と `FIT_LABEL`(全体を表示)のボタンは視点モードとは別機能なので削除しない
- `web/src/features/viewer/viewer.css` と HUD のレイアウトは変更しない
- キーボードショートカット(モード切替のキー割り当てなど)は追加しない
- `OrbitControls` を独自のカメラコントロールへ置き換えることはしない。回転と平行移動は
  OrbitControls に任せ、自前で書くのは右ドラッグの dolly だけとする
- `shared/` と `server/` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
  (`camera-input.test.ts` と `viewer-pointer.test.ts` を新規に追加し、`hud-labels.test.ts` /
  `store-annotation.test.ts` / `review-stores.test.ts` の `"orbit"` 前提を更新する)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (mode が none / pen / comment であること、Alt によるカメラ操作の割り当てを含む)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
