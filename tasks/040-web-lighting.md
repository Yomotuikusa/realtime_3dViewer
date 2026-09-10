---
id: 040
title: web ライトの向きを Shift+右ドラッグで変える
feature: web
depends_on: [037]
owns: [web/src/features/viewer/lighting.ts, web/src/features/viewer/SceneLights.tsx, web/src/features/viewer/CameraRig.tsx, web/src/store/lighting.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/viewer-pointer.ts, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/app/review-stores.ts, web/tests/lighting.test.ts, web/tests/store-lighting.test.ts, web/tests/viewer-pointer.test.ts, web/tests/hud-labels.test.ts, web/tests/review-stores.test.ts, web/web_Summary.md]
reads: [web/src/features/viewer/camera-input.ts, web/src/features/annotation/AnnotationLayer.tsx, web/src/store/camera.ts, web/src/app/review.css, web/src/styles/tokens.css, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
モデルの陰影が固定で、形状が見づらい向きがあっても直せない。
Substance Painter と同じ操作感で **`Shift`+右ドラッグ** によりライトの当たる向きを
変えられるようにする。ライトはワールド固定(カメラを回してもライトは動かない)。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- ライトは現在 `ViewerCanvas` に直書きされている。web/src/features/viewer/ViewerCanvas.tsx:14-16

  ```tsx
  <color attach="background" args={["#f5f7fa"]} />
  <ambientLight intensity={1.5} />
  <directionalLight position={[5, 8, 5]} intensity={2} />
  ```

  この2つのライトは `<Suspense>` / `<Bounds>` の**外**に置かれている。
- **`<Bounds>` は子要素の `Box3` から全体表示(fit)の範囲を計算する。**
  ライトを `<Bounds>` の中に入れると `position` がバウンディングボックスに含まれ、
  「全体を表示」が壊れる。ライトは必ず `<Bounds>` の外に置くこと。
  web/src/features/viewer/ViewerCanvas.tsx:17-23
- `viewer-pointer.ts` の `attachViewerPointer(controls, deps)` が
  `controls.domElement` に Maya 式のマウス操作を取り付けている。現在の割り当ては
  「pointerdown のたびに `controls.mouseButtons = mouseButtonsFor(event.altKey)` を書き換え、
  `event.altKey && event.button === 2` のときだけ自前 dolly を開始する」。
  web/src/features/viewer/viewer-pointer.ts:31-58
- `mouseButtonsFor(false)` は LEFT / MIDDLE / RIGHT をすべて `undefined` にする
  (OrbitControls が何もしない状態)。web/src/features/viewer/camera-input.ts:16-27
- `contextmenu` と `auxclick` は既に `preventDefault` 済みなので、
  右ドラッグでブラウザのコンテキストメニューは出ない。
  web/src/features/viewer/viewer-pointer.ts:76-82
- `AnnotationLayer` / `CommentPickLayer` の pointerdown は `event.button !== 0` を弾いている。
  **右ドラッグがペンやコメントの操作と衝突することはない。**
  web/src/features/annotation/AnnotationLayer.tsx:51-53
- `ViewerHud` の視点ボタンは次の形で、`.hud-view` は
  `viewer.css` で枠と影を持つボタン群として定義されている。
  web/src/features/viewer/ViewerHud.tsx:50-53, web/src/features/viewer/viewer.css:32-38
- `.review-hud` の直下要素は `pointer-events: none` で、
  `.btn` / `[role="toolbar"]` / `[role="group"]` / `[role="status"]` / `[role="alert"]` だけが
  `pointer-events: auto` に戻される。**HUD に足す要素はこのいずれかに該当させること**。
  web/src/app/review.css:92-105
- `viewer.css` に生の色(`#rrggbb` や `rgb()`)を書いてはならない。色は
  `web/src/styles/tokens.css` の CSS 変数だけを使う。`!important` も禁止。
  この規約は `web/tests/styles-rules.test.ts` が機械的に検査している
- `resetReviewStores()` は現在 session / presence / annotation / comments / camera の
  5ストアを初期化する。shortcuts ストアは意図的に対象外(キー設定は退室しても残す)。
  web/src/app/review-stores.ts:8-14
- `hint()` の `mode === "none"` の文言は現在
  `"Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動"`。
  web/src/features/viewer/hud-labels.ts:59-61
- web のテストは jsdom 環境で `@testing-library` がない。
  **React コンポーネントのレンダリングテストは書けない**。検証できるのは純粋関数とストアと
  `attachViewerPointer` のような DOM 直接操作の関数だけ。web/vitest.config.ts
- `web/tests/viewer-pointer.test.ts` の `pointerEvent()` ヘルパーは現在
  `altKey` / `button` / `clientX` / `pointerId` しか設定しない。
  **`shiftKey` と `clientY` を足す必要がある。** web/tests/viewer-pointer.test.ts:9-21
- `makeControls()` は `domElement` に `setPointerCapture` / `hasPointerCapture` /
  `releasePointerCapture` の `vi.fn()` を生やしたダミーを返す。
  web/tests/viewer-pointer.test.ts:27-45

## インターフェイス契約

### 新規 web/src/features/viewer/lighting.ts

```ts
import type { Vec3 } from "@shared/types";

/** ワールド固定のライトの向き。 */
export interface LightAngles {
  /** 方位角(ラジアン)。[-π, π) に正規化して保持する */
  yaw: number;
  /** 仰角(ラジアン)。0 が水平、正が上方 */
  pitch: number;
}

export const DEFAULT_LIGHT_ANGLES: LightAngles = { yaw: Math.PI / 4, pitch: Math.PI / 4 };

/** 仰角の絶対値の上限(85°)。真上・真下では陰影が潰れるため寄せきらない */
export const MAX_LIGHT_PITCH = (85 * Math.PI) / 180;

/** ドラッグ 1px あたりの回転量(ラジアン) */
export const LIGHT_ROTATE_SPEED = 0.008;

/** directionalLight を置く原点からの距離。向きだけが意味を持つ */
export const LIGHT_DISTANCE = 10;

export const AMBIENT_LIGHT_INTENSITY = 0.9;
export const KEY_LIGHT_INTENSITY = 2.2;
export const FILL_LIGHT_INTENSITY = 0.5;

/** yaw を [-π, π) へ畳む。有限数でなければ 0。 */
export function normalizeYaw(yaw: number): number;

/** pitch を ±MAX_LIGHT_PITCH に丸める。有限数でなければ 0。 */
export function clampPitch(pitch: number): number;

/**
 * ドラッグ量(px)ぶんライトを回した新しい角度を返す。引数は変更しない。
 * 右へ動かすと yaw が増え、上へ動かすと pitch が増える(ライトが持ち上がる)。
 * deltaX / deltaY のどちらかが有限数でなければ angles と同じ値の複製を返す。
 */
export function rotateLight(angles: LightAngles, deltaX: number, deltaY: number): LightAngles;

/** 主ライトのワールド座標。distance の既定は LIGHT_DISTANCE。 */
export function lightPosition(angles: LightAngles, distance?: number): Vec3;

/** 補助ライトのワールド座標。lightPosition の各成分の符号を反転したもの。 */
export function fillLightPosition(angles: LightAngles, distance?: number): Vec3;
```

`lightPosition` の定義は次のとおり。

```
x = distance * cos(pitch) * sin(yaw)
y = distance * sin(pitch)
z = distance * cos(pitch) * cos(yaw)
```

### 新規 web/src/store/lighting.ts

```ts
import { type LightAngles } from "../features/viewer/lighting";

export interface LightingStoreState {
  angles: LightAngles;
  /** rotateLight の規則でライトを回す */
  rotate(deltaX: number, deltaY: number): void;
  /** DEFAULT_LIGHT_ANGLES へ戻す */
  reset(): void;
}

export const useLightingStore: /* zustand の create<LightingStoreState>(...) */;
```

### 新規 web/src/features/viewer/SceneLights.tsx

```tsx
/** lighting ストアの向きに従って環境光・主ライト・補助ライトを置く。 */
export function SceneLights(): ReactElement;
```

出力する JSX は次の3つだけ(この順)。

```tsx
<ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
<directionalLight position={lightPosition(angles)} intensity={KEY_LIGHT_INTENSITY} />
<directionalLight position={fillLightPosition(angles)} intensity={FILL_LIGHT_INTENSITY} />
```

### 変更 web/src/features/viewer/viewer-pointer.ts

`ViewerControlsLike` と `attachViewerPointer` のシグネチャは次のとおり。
`ViewerPointerDeps` にコールバックを1つ足す。

```ts
export interface ViewerPointerDeps {
  /** ユーザー操作でカメラが動き始めたとき(追従解除に使う)。 */
  onUserInteract(): void;
  /** 自前 dolly でカメラを動かした直後。 */
  onCameraChange(): void;
  /** Shift+右ドラッグの移動量(px)。ライトの向きを回す。 */
  onLightRotate(deltaX: number, deltaY: number): void;
}

export function attachViewerPointer(
  controls: ViewerControlsLike,
  deps: ViewerPointerDeps,
): () => void;
```

### 変更 web/src/features/viewer/hud-labels.ts

既存の export はすべて残す。次を追加する。

```ts
export const LIGHT_RESET_LABEL = "ライトを戻す";
```

`hint()` の `mode === "none"` の返り値だけを次に変える。

```
"Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動、Shift+右ドラッグでライトの向き"
```

### 変更 web/src/features/viewer/ViewerCanvas.tsx / ViewerHud.tsx / web/src/app/review-stores.ts

props のシグネチャは変更しない。

```tsx
export function ViewerCanvas({ modelSrc, children }: { modelSrc: string; children?: ReactNode }): ReactElement;
export function ViewerHud({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
export function resetReviewStores(): void;
```

## 振る舞い

### normalizeYaw

期待値は `toBeCloseTo`(精度10)で比較する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `0` | `0` |
| `Math.PI / 4` | `Math.PI / 4` |
| `Math.PI` | `-Math.PI` |
| `-Math.PI` | `-Math.PI` |
| `Math.PI * 1.5` | `-Math.PI / 2` |
| `-Math.PI * 1.5` | `Math.PI / 2` |
| `Math.PI * 2` | `0` |
| `Math.PI * 5` | `-Math.PI` |
| `Number.NaN` / `Number.POSITIVE_INFINITY` / `Number.NEGATIVE_INFINITY` | `0` |
| 任意の入力 | 返り値が `-Math.PI` 以上 `Math.PI` 未満 |

### clampPitch

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `0` | `0` |
| `Math.PI / 4` | `Math.PI / 4` |
| `MAX_LIGHT_PITCH` / `-MAX_LIGHT_PITCH` | そのまま |
| `Math.PI / 2` | `MAX_LIGHT_PITCH` |
| `-Math.PI / 2` | `-MAX_LIGHT_PITCH` |
| `100` | `MAX_LIGHT_PITCH` |
| `Number.NaN` / `±Infinity` | `0` |

### rotateLight

`base` を `{ yaw: 0, pitch: 0 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `rotateLight(base, 100, 0)` | `{ yaw: 0.8, pitch: 0 }` |
| `rotateLight(base, -100, 0)` | `{ yaw: -0.8, pitch: 0 }` |
| `rotateLight(base, 0, -100)` | `{ yaw: 0, pitch: 0.8 }`(上へドラッグでライトが上がる) |
| `rotateLight(base, 0, 100)` | `{ yaw: 0, pitch: -0.8 }` |
| `rotateLight(base, 0, -1000)` | `pitch` が `MAX_LIGHT_PITCH` |
| `rotateLight(base, 0, 1000)` | `pitch` が `-MAX_LIGHT_PITCH` |
| `rotateLight({ yaw: 3, pitch: 0 }, 100, 0)` | `yaw` が `3.8 - Math.PI * 2`(正規化される) |
| `rotateLight(base, 0, 0)` | `base` と同じ値。ただし `base` とは別オブジェクト |
| `rotateLight(base, Number.NaN, 0)` | `base` と同じ値 |
| `rotateLight(base, 0, Number.POSITIVE_INFINITY)` | `base` と同じ値 |
| 呼び出しの前後で引数の `angles` | 変化しない |

### lightPosition / fillLightPosition

`toBeCloseTo`(精度10)で比較する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `lightPosition({ yaw: 0, pitch: 0 })` | `[0, 0, LIGHT_DISTANCE]` |
| `lightPosition({ yaw: Math.PI / 2, pitch: 0 })` | `[LIGHT_DISTANCE, 0, 0]` |
| `lightPosition({ yaw: -Math.PI / 2, pitch: 0 })` | `[-LIGHT_DISTANCE, 0, 0]` |
| `lightPosition({ yaw: Math.PI, pitch: 0 })` | `[0, 0, -LIGHT_DISTANCE]` |
| `lightPosition({ yaw: 0, pitch: Math.PI / 2 })` | `[0, LIGHT_DISTANCE, 0]` |
| `lightPosition(DEFAULT_LIGHT_ANGLES)` | `[5, 7.0710678…, 5]` |
| `lightPosition({ yaw: 0, pitch: 0 }, 2)` | `[0, 0, 2]` |
| `lightPosition(angles)` の長さ | 常に `LIGHT_DISTANCE`(`Math.hypot(...)` で確認) |
| `fillLightPosition(angles)` | `lightPosition(angles)` の各成分を `-1` 倍した値 |
| `fillLightPosition({ yaw: 0, pitch: 0 }, 2)` | `[-0, -0, -2]`(`toBeCloseTo` で比較するので符号付きゼロは問題にしない) |

### lighting ストア

`beforeEach` で `useLightingStore.getState().reset()` する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `angles` が `DEFAULT_LIGHT_ANGLES` と等しい |
| `rotate(100, 0)` | `angles.yaw` が `DEFAULT_LIGHT_ANGLES.yaw + 0.8`、`pitch` は据え置き |
| `rotate(100, 0)` を2回 | `yaw` が `DEFAULT_LIGHT_ANGLES.yaw + 1.6`(累積する) |
| `rotate(0, -1000)` | `pitch` が `MAX_LIGHT_PITCH` |
| `rotate(0, 0)` | `angles` の値が変わらない |
| `rotate(Number.NaN, 0)` | `angles` の値が変わらない |
| `rotate` のあと `reset()` | `angles` が `DEFAULT_LIGHT_ANGLES` と等しい |
| `rotate` の前後の `angles` オブジェクト | 別のオブジェクトになる(引数や既定値を破壊しない) |
| `rotate` を何度呼んでも `DEFAULT_LIGHT_ANGLES` | 値が変化しない |

### attachViewerPointer(追加分)

明記しない修飾キーは `false`、`pointerId` は `1` とする。
既存の6つのテストが通り続けることも条件に含める。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| pointerdown(`button: 2, shiftKey: true`) | `setPointerCapture` が呼ばれる。`onLightRotate` はまだ呼ばれない |
| 同上のあと pointermove(`clientX: 10, clientY: -4`) | `onLightRotate(10, -4)` が呼ばれる |
| 続けて pointermove(`clientX: 25, clientY: -4`) | `onLightRotate(15, 0)` が呼ばれる(前回位置との差分) |
| ライト回転中の pointermove | `controls.update` と `onCameraChange` が呼ばれない |
| pointerdown(`button: 2, shiftKey: true`) | `onUserInteract` が呼ばれない(追従は解除しない) |
| pointerdown(`button: 2, shiftKey: true`) 時の `controls.mouseButtons` | `MOUSE_BUTTONS_IDLE` と等しい |
| pointerdown(`button: 2, altKey: true, shiftKey: true`) | 既存の dolly が始まる。`onLightRotate` は呼ばれず `onUserInteract` が呼ばれる |
| pointerdown(`button: 0, shiftKey: true`) / (`button: 1, shiftKey: true`) | 何も始まらない。以降の pointermove で `onLightRotate` が呼ばれない |
| ライト回転中に別 `pointerId` の pointermove | `onLightRotate` が呼ばれない |
| ライト回転中の pointerup | 回転が終わる。`releasePointerCapture` が呼ばれ、以降の pointermove で `onLightRotate` が呼ばれない |
| ライト回転中の pointercancel | pointerup と同じ |
| ライト回転中に cleanup を呼ぶ | `releasePointerCapture` が呼ばれ、以降のイベントで `onLightRotate` が呼ばれない |
| ライト回転を終えたあとに Alt+右ドラッグ | 既存どおり dolly が動く |

### resetReviewStores

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `rotate` してから `resetReviewStores()` | `useLightingStore.getState().angles` が `DEFAULT_LIGHT_ANGLES` と等しい |
| 既存の5ストア | 既存どおり初期化される |

### hud-labels

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `LIGHT_RESET_LABEL` | `"ライトを戻す"` |
| `hint({ mode: "none", canEdit: true, hasAnchor: false, following: false, placement: "surface" })` | `"Shift+右ドラッグでライトの向き"` を含む |
| `hint` の `following: true` / `mode: "pen"` / `mode: "comment"` の各行 | 既存の文言のまま変わらない |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| ビューア上で Shift+右ドラッグ | ライトの当たる向きが動く。カメラは動かない |
| ドラッグ中にコンテキストメニュー | 出ない(既存の `preventDefault` のまま) |
| 他の参加者を追従中に Shift+右ドラッグ | 追従は解除されない |
| ペンモード / コメントモード中の Shift+右ドラッグ | ライトが動く。線もピンも作られない |
| HUD の「ライトを戻す」 | ライトが既定の向きへ戻る |
| ライトの向き | ワールド固定。カメラを回してもライトは動かない |
| 他の参加者の画面 | 影響を受けない(ライトの向きは送信しない) |
| レビュー画面を離れて戻る | ライトが既定の向きに戻っている |
| 「全体を表示」 | ライトを足す前と同じ範囲で収まる(ライトが Bounds に含まれない) |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **`SceneLights` は `<Bounds>` の外に置く。** 既存の `ambientLight` /
  `directionalLight` があった位置(`<color>` の直後、`<Suspense>` の前)にそのまま差し替える
- `<color attach="background" args={["#f5f7fa"]} />` は変更しない。
  これは JSX であり CSS ではないので `styles-rules.test.ts` の対象外である
- `normalizeYaw` は `((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI` の形で書く。
  範囲は **`[-π, π)`**(`π` は含まず `-π` に畳む)
- `rotateLight` は `yaw: normalizeYaw(angles.yaw + deltaX * LIGHT_ROTATE_SPEED)`、
  `pitch: clampPitch(angles.pitch - deltaY * LIGHT_ROTATE_SPEED)` とする。
  **pitch は `deltaY` を引く。** ブラウザの Y 軸は下向きなので、
  引かないと上ドラッグでライトが下がる
- `rotateLight` は `Number.isFinite(deltaX) && Number.isFinite(deltaY)` を先に確かめ、
  偽なら `{ ...angles }` を返す
- `fillLightPosition` は `lightPosition` を呼んで各成分に `-1` を掛けるだけにする。
  角度から独立に計算し直さない
- ライトの強度は 3 つの定数で固定する。**強度を変える UI は作らない**(今回の要件は向きだけ)。
  環境光を 1.5 から 0.9 へ下げるのは、下げないと向きを変えても陰影が変わって見えないため
- `SceneLights` は `useLightingStore((state) => state.angles)` を購読する。
  `useFrame` は使わない(角度が変わったときだけ再レンダリングされれば十分)
- `viewer-pointer.ts` の `handlePointerDown` は次の順で書く。
  1. `controls.mouseButtons = mouseButtonsFor(event.altKey);`(既存のまま)
  2. `if (event.button !== 2) return;`
  3. `if (event.altKey) { 既存の dolly 開始 ; return; }`
  4. `if (!event.shiftKey) return;`
  5. ライト回転を開始(`pointerId` / `clientX` / `clientY` を保持し `setPointerCapture`)
  **Alt が Shift より優先される。** Alt+Shift+右は dolly になる
- ライト回転の開始では `deps.onUserInteract()` を**呼ばない**。カメラが動かないため
- ライト回転の状態は dolly とは別の変数(`light: { pointerId, clientX, clientY } | null`)で持つ。
  dolly と同時には成立しない(どちらも `button === 2` で排他)
- pointermove では `deps.onLightRotate(event.clientX - light.clientX, event.clientY - light.clientY)`
  を呼んだあと `light.clientX` / `light.clientY` を更新する。
  `controls.update()` と `deps.onCameraChange()` は呼ばない
- 終了処理(`pointerup` / `pointercancel` / cleanup)は既存の `finishDolly` と同じ形で
  ライト用にも用意する。cleanup では進行中の capture を必ず解放する
- `attachViewerPointer` を呼んでいるのは `CameraRig` の `useEffect` である
  (web/src/features/viewer/CameraRig.tsx:42-51)。ここに
  `onLightRotate: (deltaX, deltaY) => useLightingStore.getState().rotate(deltaX, deltaY)` を足す。
  **`CameraRig.tsx` の変更はこの1箇所だけ。** `useFrame` の中身・follow 処理・
  `handleChange` / `handleStart` / 返り値の `<OrbitControls>` は一切変更しない。
  `onLightRotate` は `getState()` 経由で呼び、`useEffect` の依存配列を増やさない
- `ViewerHud` には視点グループ(`.hud-view`)の直後に次を足す。

  ```tsx
  <div className="hud-light" role="group" aria-label="ライト">
    <button className="btn btn--quiet" type="button" onClick={resetLighting}>{LIGHT_RESET_LABEL}</button>
  </div>
  ```

  `resetLighting` は `useLightingStore((state) => state.reset)` で取る
- `viewer.css` は `.hud-view {` のセレクタを `.hud-view,\n.hud-light {` に変えるだけにする。
  新しい宣言ブロックを足さない
- lighting ストアは `resetReviewStores()` の対象に**加える**。
  ライトの向きはモデルごとの見え方なので、camera ストアと同じ扱いにする
  (キー設定(shortcuts)とは違い、退室したら既定へ戻す)
- `review-stores.ts` の JSDoc「5つのストア」は「6つのストア」に直す
- テストで `pointerEvent()` に `shiftKey` と `clientY` を足すときは、
  既存の `Object.defineProperties` の並びに `shiftKey: { value: init.shiftKey ?? false }`、
  `clientY: { value: init.clientY ?? 0 }` を追加する形にする

## やらないこと
- **ライトの強度・色・種類を変える UI を作らない。** 今回は向きだけ
- HDRI や `Environment` などの環境マップを導入しない。追加のアセットを持ち込まない
- 影(`castShadow` / `receiveShadow` / `shadow-mapSize`)を有効にしない
- ライトの向きを WebSocket で他の参加者へ送らない。`shared/` と `server/` を変更しない
- ライトの向きを localStorage に永続化しない
- ライトの向きにキーボードショートカットを割り当てない
  (`ShortcutAction` と `features/shortcuts/` を変更しない)
- Shift+左ドラッグ / Shift+中ドラッグに機能を割り当てない
- `Alt` のカメラ操作(033)、透過表示(034)、空間描画(035)の挙動を変更しない
- 既定カメラ(041)と焦点距離(042 / 043)には手を付けない
- `store/camera.ts` / `follow.ts` / `camera-input.ts` を変更しない
- `CameraRig.tsx` の `useFrame`(reset / pendingCamera / follow の処理)を変更しない
- `hint()` の `pen` / `comment` / `following` の文言を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`lighting.test.ts` に `normalizeYaw` / `clampPitch` / `rotateLight` /
      `lightPosition` / `fillLightPosition` の系列、
      `store-lighting.test.ts` にストアの系列を新規に追加し、
      `viewer-pointer.test.ts` にライト回転の系列、
      `hud-labels.test.ts` に `LIGHT_RESET_LABEL` と `hint` の系列を足す)
- [ ] `web/tests/styles-rules.test.ts` が通る(`viewer.css` に生の色と `!important` がない)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`features/viewer/lighting.ts` / `SceneLights.tsx` / `store/lighting.ts` の追加、
      `onLightRotate` の追加、lighting ストアが `resetReviewStores` の対象であること)
- [ ] すべてのファイルが300行以内(`web_Summary.md` を含む)
- [ ] `npm run typecheck && npm run test:web` が成功する
