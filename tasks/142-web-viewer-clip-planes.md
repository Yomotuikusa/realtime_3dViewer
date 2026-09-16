---
id: 142
title: web ビューアのカメラ near / far をモデルの大きさから決める
feature: viewer
depends_on: []
owns: [web/src/features/viewer/clip-planes.ts, web/src/features/viewer/ClipPlanesRig.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/clip-planes.test.ts]
reads: [web/src/features/viewer/FocalLengthRig.tsx, web/src/store/camera.ts, web/src/features/viewer/useModelScene.ts, web/tests/focal-length.test.ts, web/tests/mesh-display.test.ts, web/tests/model-scene.test.ts, web/tests/pick.test.ts, web/tests/trail-rig.test.ts, web/tests/layout-styles.test.ts, web/tests/timeline-styles.test.ts, web/tests/outliner-highlight.test.ts, web/tests/mesh-display-color.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
`<Canvas>` に `near` / `far` を渡していないので three.js の既定(0.1 / 2000)がモデルの単位に関係なく使われ、
mm 単位の大きなモデルでは遠景が切れ、小さなモデルでは近づくと消える。焦点距離と同じ「描画なしの Rig」で、
既に camera ストアにあるモデルの最大辺長から near / far を決める。

## 前提
- `web/src/features/viewer/ViewerCanvas.tsx:31-34` `<Canvas camera={{ fov: DEFAULT_FOV, position: DEFAULT_CAMERA.position }} style={…}>`。
  直後に `<color …/>` `<SceneLights />` `<FocalLengthRig />` `<Bounds fit={false} clip>` と続く
- `web/src/store/camera.ts:15` `modelSize: number`(初期値 1、`:44`)、`:28` `setModelSize(size)`。`:75-80` は 0 以下や同値を無視する。
  `web/src/features/viewer/useModelScene.ts:30-37` が primary モデルのバウンディングボックスの最大辺長を `setModelSize` する
- `web/src/features/viewer/FocalLengthRig.tsx`(全 20 行)が写すべき形: `useThree((state) => state.camera)` で camera を取り、
  `"isPerspectiveCamera" in camera && camera.isPerspectiveCamera === true` でなければ何もせず、
  `PerspectiveCamera` の `fov` を書いて `updateProjectionMatrix()` を呼ぶ `useEffect`。返り値 `null`
- `near` / `far` / `updateProjectionMatrix` を扱うコードは web/src に無い(`grep` で `FocalLengthRig.tsx` のみ)
- R3F の Rig はヘッドレスでは描画しない(設計書 §19)。既存の viewer テストはソース文字列検査
  (例: `web/tests/camera-animation.test.ts:93-101`、`fit-camera.test.ts:66-74`)と純粋関数のテスト
- `ViewerCanvas.tsx` のソースを読む既存テスト: `mesh-display.test.ts:231-233`、`model-scene.test.ts:159`、`pick.test.ts:171`
  (`export function ViewerCanvas({ children }: { children?: ReactNode })` の一致)、`trail-rig.test.ts:197-202`、
  `layout-styles.test.ts:76`、`timeline-styles.test.ts:16`、`outliner-highlight.test.ts:228`、`mesh-display-color.test.ts:73`。
  いずれも子要素の順序や文字列の有無を見るので、`<FocalLengthRig />` の直後に 1 行足すだけなら影響しない
- `viewer_Summary.md:7`(ViewerCanvas.tsx)、`:11`(FocalLengthRig.tsx)、`:144-173`(テスト)

## インターフェイス契約

```ts
// web/src/features/viewer/clip-planes.ts(新規)
/** near = モデルの最大辺長 * この比 */
export const NEAR_PLANE_RATIO = 0.01;
/** far = モデルの最大辺長 * この比。far / near = 2×10^4 で three 既定(0.1 / 2000)と同じ深度精度を保つ */
export const FAR_PLANE_RATIO = 200;

export interface ClipPlanes {
  near: number;
  far: number;
}

/** modelSize が正の有限数でなければ 1 として扱う(camera ストアの初期値と同じ) */
export function clipPlanesFor(modelSize: number): ClipPlanes;
```

```tsx
// web/src/features/viewer/ClipPlanesRig.tsx(新規)
/** camera ストアの modelSize から PerspectiveCamera の near / far を更新する描画なしの Rig。Bounds の計算対象外 */
export function ClipPlanesRig(): null;
// useThree((state) => state.camera) と useCameraStore((state) => state.modelSize) を読み、
// FocalLengthRig と同じ判定で PerspectiveCamera のときだけ near / far を書いて updateProjectionMatrix() を呼ぶ
```

```tsx
// web/src/features/viewer/ViewerCanvas.tsx
//   <FocalLengthRig /> の直後(<Bounds …> の前)に <ClipPlanesRig /> を置く。他は変更しない
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `clipPlanesFor(1)` | `{ near: 0.01, far: 200 }` |
| `clipPlanesFor(1000)` | `{ near: 10, far: 200000 }` |
| `clipPlanesFor(0)` / `(-1)` / `(NaN)` / `(Infinity)` | `clipPlanesFor(1)` と同じ |
| `NEAR_PLANE_RATIO` / `FAR_PLANE_RATIO` | 0.01 / 200 |
| `ClipPlanesRig.tsx` のソース | `clipPlanesFor(`、`updateProjectionMatrix()`、`useCameraStore((state) => state.modelSize)`、`isPerspectiveCamera` を含む |
| `ViewerCanvas.tsx` のソース | `<ClipPlanesRig />` を 1 回含み、その位置は `<FocalLengthRig />` より後で `<Bounds` より前 |
| `ViewerCanvas.tsx` を読む既存テスト | すべて通る |

## やらないこと
- `<Canvas camera={…}>` の初期 `near` / `far` は書かない(Rig が最初の描画で設定する)
- `MIN_DOLLY_DISTANCE`(`camera-input.ts`)や `Bounds` の設定は変えない
- 比率を設定 UI に出さない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md に clip-planes.ts / ClipPlanesRig.tsx の役割と公開インターフェイス、`## テスト` に clip-planes.test.ts が載っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
