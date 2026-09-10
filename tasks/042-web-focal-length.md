---
id: 042
title: web カメラの焦点距離をスライダーで調整する
feature: web
depends_on: [041]
owns: [web/src/features/viewer/focal-length.ts, web/src/features/viewer/FocalLengthRig.tsx, web/src/features/viewer/FocalLengthSlider.tsx, web/src/store/camera.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/tests/focal-length.test.ts, web/tests/store-camera.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [shared/shared_Summary.md, shared/src/types.ts, shared/src/camera.ts, web/src/features/viewer/CameraRig.tsx, web/src/features/viewer/ModelMesh.tsx, web/src/app/review.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
画角が fov 50° 固定で、広角ぎみのパースが付いたままになっている。
レンズの焦点距離(mm)をスライダーで 14〜300mm の範囲で調整できるようにする。
**既定は 50mm。今までより望遠寄り(パースの浅い)構図が初期表示になる。**

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 038 で `shared` に次が入っている。shared/shared_Summary.md
  - `MIN_FOCAL_LENGTH_MM = 14` / `MAX_FOCAL_LENGTH_MM = 300` /
    `DEFAULT_FOCAL_LENGTH_MM = 50`(`@shared/types`)
  - `clampFocalLength(focalLengthMm: number): number` — 範囲に丸め、
    有限数でなければ `DEFAULT_FOCAL_LENGTH_MM` を返す(`@shared/camera`)
  - `PresenceUser.focalLength?: number` と `camera` メッセージの `focalLength?: number`。
    **このタスクでは使わない。ネットワークへ流すのは 043 の仕事。**
- `Canvas` の初期カメラは `camera={{ fov: 50, position: DEFAULT_CAMERA.position }}`。
  web/src/features/viewer/ViewerCanvas.tsx:10
- `ViewerCanvas` の子の並びは
  `<color>` → `<SceneLights />`(040 で追加) → `<Suspense>` → `<Bounds fit={false} clip>` →
  `<CameraRig />` / `<ModelMesh />` / `{children}`。
  **`<Bounds>` の中に置いた要素はバウンディングボックスの計算に含まれる。**
  web/src/features/viewer/ViewerCanvas.tsx
- 「全体を表示」は `CameraRig` が `bounds.refresh().clip().fit()` を呼ぶ。
  `fit()` は**そのときの `camera.fov` を使って**距離を決める。
  web/src/features/viewer/CameraRig.tsx:53-59
- モデル読み込み直後に `ModelMesh` が `requestFit()` を呼ぶので、初期表示は必ず fit を通る。
  web/src/features/viewer/ModelMesh.tsx:21
- camera ストアの `requestReset()` は現在 `resetSeq` を 1 増やすだけ。
  実際に `DEFAULT_CAMERA` を適用するのは `CameraRig` の `useFrame`。
  web/src/store/camera.ts:61-63, web/src/features/viewer/CameraRig.tsx:62-75
- `setSelfCamera` は `cameraEquals` で同値なら `set` を呼ばない、という書き方をしている。
  同じ流儀に合わせる。web/src/store/camera.ts:40-45
- `.review-hud` の直下要素は `pointer-events: none` で、
  `.btn` / `[role="toolbar"]` / `[role="group"]` / `[role="status"]` / `[role="alert"]` だけが
  `pointer-events: auto` に戻される。**スライダーは `role="group"` の中に入れること。**
  web/src/app/review.css:92-105
- `viewer.css` に生の色(`#rrggbb` や `rgb()`)を書いてはならない。`!important` も禁止。
  `web/tests/styles-rules.test.ts` が機械的に検査している
- 使える CSS 変数は `web/src/styles/tokens.css` の `:root` にあるものだけ
  (`--space-1`〜`--space-6`、`--radius-sm/md/lg`、`--color-*`、`--text-xs`〜`--text-xl`、
  `--shadow-overlay` など)
- web のテストは jsdom 環境で `@testing-library` がない。
  **React コンポーネントのレンダリングテストは書けない。** web/vitest.config.ts
- `web/tests/store-camera.test.ts` は 115 行、`hud-labels.test.ts` は 84 行で、
  どちらも上限 300 行に余裕がある

## インターフェイス契約

### 新規 web/src/features/viewer/focal-length.ts

```ts
/** フルサイズ相当のセンサー高(mm)。焦点距離と垂直画角の換算に使う */
export const SENSOR_HEIGHT_MM = 24;

/** スライダーの刻み(mm) */
export const FOCAL_LENGTH_STEP_MM = 1;

/**
 * 焦点距離(mm)から three.js の fov(垂直画角・度)を返す。
 * 入力は clampFocalLength で丸めてから使う。
 */
export function fovFromFocalLength(focalLengthMm: number): number;

/**
 * fov(垂直画角・度)から焦点距離(mm)を返す。返り値は clampFocalLength 済み。
 */
export function focalLengthFromFov(fovDeg: number): number;

/** DEFAULT_FOCAL_LENGTH_MM に対応する fov(度)。Canvas の初期 fov に使う */
export const DEFAULT_FOV: number;
```

換算式は次のとおり(アスペクト比に依存させない)。

```
fovDeg      = 2 * atan((SENSOR_HEIGHT_MM / 2) / focalLengthMm) * 180 / π
focalLength = (SENSOR_HEIGHT_MM / 2) / tan(fovDeg * π / 180 / 2)
```

### 変更 web/src/store/camera.ts

既存のフィールドと action はすべて残す。次を追加・変更する。

```ts
export interface CameraStoreState {
  // 既存のフィールドはそのまま
  /** 焦点距離(mm)。初期値は DEFAULT_FOCAL_LENGTH_MM(50) */
  focalLength: number;

  /** clampFocalLength した値を入れる。現在値と等しければ state を更新しない */
  setFocalLength(focalLengthMm: number): void;

  /** resetSeq を 1 増やし、焦点距離も DEFAULT_FOCAL_LENGTH_MM へ戻す */
  requestReset(): void;
}
```

`reset()` は `focalLength: DEFAULT_FOCAL_LENGTH_MM` も初期値に含める。

### 新規 web/src/features/viewer/FocalLengthRig.tsx

```tsx
/** camera ストアの焦点距離を three.js の PerspectiveCamera へ反映する。描画物は持たない。 */
export function FocalLengthRig(): null;
```

### 新規 web/src/features/viewer/FocalLengthSlider.tsx

```tsx
/** HUD に置く焦点距離スライダー。 */
export function FocalLengthSlider(): ReactElement;
```

出力する DOM は次の形にする。

```tsx
<div className="hud-focal" role="group" aria-label={FOCAL_LENGTH_LABEL}>
  <label className="hud-focal__label" htmlFor="hud-focal-length">{FOCAL_LENGTH_LABEL}</label>
  <input
    id="hud-focal-length"
    className="hud-focal__range"
    type="range"
    min={MIN_FOCAL_LENGTH_MM}
    max={MAX_FOCAL_LENGTH_MM}
    step={FOCAL_LENGTH_STEP_MM}
    value={focalLength}
    onChange={(event) => setFocalLength(Number(event.target.value))}
  />
  <output className="hud-focal__value" htmlFor="hud-focal-length">{focalLengthText(focalLength)}</output>
</div>
```

### 変更 web/src/features/viewer/hud-labels.ts

既存の export はすべて残す。次を追加する。

```ts
export const FOCAL_LENGTH_LABEL = "焦点距離";

/** スライダー横の現在値表示。四捨五入した整数の mm にする。 */
export function focalLengthText(focalLengthMm: number): string;
```

### 変更 web/src/features/viewer/ViewerCanvas.tsx / ViewerHud.tsx

props のシグネチャは変更しない。

```tsx
export function ViewerCanvas({ modelSrc, children }: { modelSrc: string; children?: ReactNode }): ReactElement;
export function ViewerHud({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

## 振る舞い

### fovFromFocalLength / focalLengthFromFov / DEFAULT_FOV

`toBeCloseTo`(精度6)で比較する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `fovFromFocalLength(50)` | `26.991…`(`2 * Math.atan(12 / 50) * 180 / Math.PI`) |
| `fovFromFocalLength(14)` | `81.203…`(`2 * Math.atan(12 / 14) * 180 / Math.PI`) |
| `fovFromFocalLength(300)` | `4.581…`(`2 * Math.atan(12 / 300) * 180 / Math.PI`) |
| `fovFromFocalLength(5)` | `fovFromFocalLength(14)` と等しい(下限へ丸める) |
| `fovFromFocalLength(1000)` | `fovFromFocalLength(300)` と等しい(上限へ丸める) |
| `fovFromFocalLength(Number.NaN)` | `fovFromFocalLength(50)` と等しい |
| `fovFromFocalLength(0)` / `(-50)` | `fovFromFocalLength(14)` と等しい |
| 単調性 | `14 < f1 < f2 <= 300` なら `fovFromFocalLength(f1) > fovFromFocalLength(f2)` |
| `focalLengthFromFov(fovFromFocalLength(f))`(`f` は 14 / 25 / 50 / 135 / 300) | `f` と一致(精度6) |
| `focalLengthFromFov(0)` | `300`(`tan(0) = 0` から上限へ丸める) |
| `focalLengthFromFov(179)` | `14` |
| `focalLengthFromFov(Number.NaN)` | `50` |
| `focalLengthFromFov` の返り値 | 常に 14 以上 300 以下 |
| `DEFAULT_FOV` | `fovFromFocalLength(50)` と等しい |
| `SENSOR_HEIGHT_MM` / `FOCAL_LENGTH_STEP_MM` | `24` / `1` |

### camera ストア(追加分)

`beforeEach` で `useCameraStore.getState().reset()` する。既存のテストが通り続けることも条件。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `focalLength` が `50` |
| `setFocalLength(85)` | `focalLength` が `85` |
| `setFocalLength(14)` / `setFocalLength(300)` | そのまま入る |
| `setFocalLength(5)` | `focalLength` が `14` |
| `setFocalLength(1000)` | `focalLength` が `300` |
| `setFocalLength(Number.NaN)` | `focalLength` が `50` |
| `setFocalLength(85)` を2回 | 2回目で state オブジェクトの参照が変わらない(`set` を呼ばない) |
| `setFocalLength(85)` のあと `requestReset()` | `focalLength` が `50`、`resetSeq` が `1` |
| `requestReset()` を2回 | `resetSeq` が `2`、`focalLength` が `50` のまま |
| `setFocalLength(85)` のあと `requestFit()` | `focalLength` が `85` のまま、`fitSeq` が `1` |
| `setFocalLength(85)` のあと `reset()` | `focalLength` が `50` |
| `setFocalLength` が `selfCamera` / `pendingCamera` / `modelSize` に与える影響 | なし |

### focalLengthText

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `50` | `"50mm"` |
| `14` / `300` | `"14mm"` / `"300mm"` |
| `50.4` | `"50mm"` |
| `84.6` | `"85mm"` |
| `26.991` | `"27mm"` |
| `FOCAL_LENGTH_LABEL` | `"焦点距離"` |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| 初期表示 | 焦点距離 50mm(fov ≒ 27°)でモデルが全体表示される |
| スライダーを 14mm へ動かす | 広角になりパースが強くなる。カメラ位置と注視点は動かない |
| スライダーを 300mm へ動かす | 望遠になりパースが浅くなる |
| スライダー横の表示 | `"85mm"` のように現在値が出る |
| 焦点距離を変えたあとに「全体を表示」 | 新しい画角でモデル全体が収まる距離へ移動する |
| 「視点を戻す」 | 位置・注視点が初期値へ戻り、焦点距離も 50mm へ戻る |
| 焦点距離を変えたあとにペンで描く | 線が狙ったところに乗る(レイキャストは three.js のカメラを使うため自動で追随する) |
| 焦点距離を変えたあとに空間描画(035) | 注視点を通る視線垂直平面への投影が正しく効く |
| 焦点距離を変えたあとにコメントを投稿 → 再現 | 投稿時の位置と注視点は再現される。焦点距離は自分の現在値のまま(保存しない) |
| 他の参加者の画面 | このタスクの時点では影響を受けない(043 で追従時だけ反映される) |
| レビュー画面を離れて戻る | 焦点距離が 50mm に戻っている |
| スライダーの上でドラッグ | ビューアの回転やペン描画が始まらない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **換算はアスペクト比に依存させない。** three.js の
  `PerspectiveCamera.getFocalLength()` は `filmGauge` と `aspect` から
  横方向を基準に計算するため、ウィンドウ幅でスライダーの値が動いてしまう。
  ここでは `SENSOR_HEIGHT_MM = 24` を固定した独自換算を使い、`filmGauge` は触らない
- `fovFromFocalLength` は最初に `clampFocalLength(focalLengthMm)` を通す。
  これで `NaN` / `0` / 負値 / 範囲外がすべて安全な値になる
- `focalLengthFromFov` は `Number.isFinite(fovDeg)` が偽なら
  `clampFocalLength(Number.NaN)` の結果(= 50)を返す。
  `tan` が 0 になって `Infinity` が出る場合も `clampFocalLength` が 300 に丸めるので、
  `clampFocalLength` に通してから返す一本道で書く
- `DEFAULT_FOV` は `fovFromFocalLength(DEFAULT_FOCAL_LENGTH_MM)` で定義する。
  数値リテラルを直接書かない
- `setFocalLength` は `const next = clampFocalLength(focalLengthMm);` としてから
  `if (next === get().focalLength) return;` で早期 return する。
  既存の `setSelfCamera` / `setModelSize` と同じ流儀
- `requestReset()` は `set((state) => ({ resetSeq: state.resetSeq + 1, focalLength: DEFAULT_FOCAL_LENGTH_MM }))`
  の1回の `set` で書く。`CameraRig` 側は変更しない
- `FocalLengthRig` は `useThree((state) => state.camera)` と
  `useCameraStore((state) => state.focalLength)` を購読し、`useEffect` の中で

  ```ts
  if (!("isPerspectiveCamera" in camera) || camera.isPerspectiveCamera !== true) return;
  const perspective = camera as PerspectiveCamera;
  perspective.fov = fovFromFocalLength(focalLength);
  perspective.updateProjectionMatrix();
  ```

  を行い `null` を返す。`useFrame` は使わない
- **`updateProjectionMatrix()` を忘れないこと。** `fov` を代入しただけでは描画が変わらない
- `FocalLengthRig` は `<Bounds>` の**外**、`<SceneLights />` の直後に置く。
  中に入れるとバウンディングボックスの計算対象になる
- `ViewerCanvas` の `camera` プロップは `{ fov: DEFAULT_FOV, position: DEFAULT_CAMERA.position }`
  に変える。ハードコードの `50` を残さない
- `FocalLengthSlider` は `useCameraStore((state) => state.focalLength)` と
  `useCameraStore((state) => state.setFocalLength)` を購読する
- `ViewerHud` では `.hud-light` グループの**直後**に `<FocalLengthSlider />` を置く。
  `.hud__row` は `flex-wrap: wrap` なので幅が足りなければ折り返す
- `viewer.css` には次の3つのルールを足すだけにする。生の色を書かない。

  ```css
  .hud-focal {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-overlay);
    font-size: var(--text-sm);
  }

  .hud-focal__range {
    width: 8rem;
  }

  .hud-focal__value {
    min-width: 3.5rem;
    color: var(--color-text-muted);
    text-align: right;
  }
  ```

- `focalLengthText` は `` `${Math.round(focalLengthMm)}mm` `` で書く。単位の前に空白を入れない
- スライダーの `id` は `"hud-focal-length"` で固定する。`ViewerHud` は1画面に1つしか出ない

## やらないこと
- **焦点距離を WebSocket で送らない。** 043 の仕事である。
  `useCameraBroadcast` / `camera-throttle` / `store/presence.ts` /
  `realtime-dispatch.ts` / `follow.ts` を変更しない
- 焦点距離をコメントに保存しない。`CommentComposer` / `compose.ts` / comments ストアを変更しない
- 焦点距離を localStorage に永続化しない
- 焦点距離にキーボードショートカットを割り当てない
  (`ShortcutAction` と `features/shortcuts/` を変更しない)
- 焦点距離を変えたときに自動で fit / dolly しない。カメラ位置と注視点は動かさない
- 平行投影(`OrthographicCamera`)に対応しない
- `filmGauge` / `filmOffset` / `zoom` を触らない
- `CameraRig.tsx` / `follow.ts` / `ModelMesh.tsx` を変更しない
- ライティング(040)と既定カメラ(041)の挙動を変更しない
- `shared/` と `server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`focal-length.test.ts` に換算の系列を新規に追加し、
      `store-camera.test.ts` に `focalLength` / `setFocalLength` / `requestReset` の系列、
      `hud-labels.test.ts` に `focalLengthText` と `FOCAL_LENGTH_LABEL` の系列を足す)
- [ ] `web/tests/styles-rules.test.ts` が通る(`viewer.css` に生の色と `!important` がない)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`focal-length.ts` / `FocalLengthRig.tsx` / `FocalLengthSlider.tsx` の追加、
      camera ストアの `focalLength` / `setFocalLength`、
      `requestReset` が焦点距離も戻すこと、
      焦点距離はこの時点では送信も保存もされないこと)
- [ ] すべてのファイルが300行以内(`web_Summary.md` を含む)
- [ ] `npm run typecheck && npm run test:web` が成功する
