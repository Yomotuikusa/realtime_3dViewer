---
id: 055
title: web 全体表示を CameraRig の補間に統一し、Bounds 内部アニメーションを使わない
feature: web
depends_on: [054]
owns: [web/src/features/viewer/fit-camera.ts, web/src/features/viewer/CameraRig.tsx, web/tests/fit-camera.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/camera-animation.ts, web/src/features/viewer/view-presets.ts, web/src/features/viewer/model-target.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/store/camera.ts, web/tests/light-gizmo.test.ts, shared/src/camera.ts, shared/src/types.ts, node_modules/@react-three/drei/core/Bounds.js, node_modules/@react-three/drei/core/Bounds.d.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
「全体を表示」(以下 Fit)は drei の `Bounds.fit()` を使っており、これは**向きを保ったまま**注視点と距離だけを
変える。既定視点(正面 / 右 / 背面 / 左)は注視点と距離を保って向きだけ変えるため、Fit 状態から既定視点を
押した直後に Fit を押すと目標が現在位置と一致して何も動かない。
さらに Fit は `Bounds` 内部の 1 秒補間、既定視点は `CameraRig` の時間基準補間で、どちらも毎フレーム
`camera.position` を書くため、300ms 以内 / 1 秒以内に続けて押すと結果が不定になる。

Fit を「モデル本体を中心に、初期視点と同じ斜め方向から全体が収まる距離で見る視点」と定義し直し、
その目標を純粋関数で作って既存の `requestCamera` に積む。以後 Fit も既定視点も視点再現も
`CameraRig` の 1 本の補間だけを通り、競合が消える。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `CameraRig` は `fitSeq` が変わった `useEffect` で `bounds.refresh().clip().fit()` を呼んでいる。
  これが Fit の唯一の経路である。web/src/features/viewer/CameraRig.tsx:69-75

- `ModelMesh` はロード完了時に `setModelTarget(scene)` → `requestFit()` の順で呼ぶ。
  web/src/features/viewer/ModelMesh.tsx:13-23。`getModelTarget()` はその `scene`(`Object3D`)か、
  ロード前 / アンマウント後は `null` を返す。web/src/features/viewer/model-target.ts:9-11

- `ViewerCanvas` は `<Bounds fit={false} clip>` の中に `CameraRig`、`ModelMesh`、`children`
  (RemoteCameras / RoomStrokes / CommentPins など)を置く。したがって引数なしの `bounds.refresh()` が
  計算する箱には**他の参加者のカメラ表示やストロークも含まれる**。web/src/features/viewer/ViewerCanvas.tsx:21-25

- drei `Bounds` の API(`useBounds()` の返り値、型は `BoundsApi`):
  - `refresh(object?: Object3D | Box3)` は `object` があればそれだけから、なければ `Bounds` 配下全体から箱を作る。
    箱が空なら原点中心の代替箱を使う。`this` を返す。node_modules/@react-three/drei/core/Bounds.js:66-85
  - `clip()` は箱の大きさから `camera.near / far` と `controls.maxDistance` を設定し `controls.update()` を呼ぶ。
    **アニメーションは開始しない。** Bounds.js:155-166
  - `getSize()` は `{ box, size, center: Vector3, distance: number }` を返す。`distance` は
    `margin(1.2) * max(fitHeightDistance, fitWidthDistance)` で、現在の `camera.fov` / `camera.aspect` から
    計算した「箱全体が収まる距離」である。Bounds.js:53-64, Bounds.d.ts:4-11
  - `fit()` / `reset()` だけが `animationState = START` にして `Bounds` 内部の `useFrame` 補間を始める。
    **呼ばなければ `Bounds` の `useFrame` は何もしない。** Bounds.js:86-96, 214-243

- `requestCamera(camera)` は `pendingCamera` に複製を積み、`CameraRig` の `useFrame` が次のフレームで消費して
  `presence.unfollow()` → `startCameraAnimation(readCamera(...), target, now)` を行う。補間中の Alt 操作 /
  ホイール / Alt+右ドラッグは補間を中断し、到達時は `setSelfCamera(target, true)` で完全一致保存する。
  web/src/store/camera.ts:54-56, web/src/features/viewer/CameraRig.tsx:96-125

- `DEFAULT_CAMERA` は `{ position: [3, 3, 3], target: [0, 0, 0] }`。shared/src/camera.ts:10
  この方向 `[1, 1, 1] / √3` は `matchViewPreset` のどの既定視点とも一致しないので、
  Fit 到達後は `rotationLocked` が false(回転できる)になる。web/src/features/viewer/view-presets.ts:64-91

- `MIN_PRESET_DISTANCE`(0.001)は既定視点で距離 0 のときに使う最小距離。web/src/features/viewer/view-presets.ts:41

- web のテストは jsdom 環境で `@testing-library` がない。React コンポーネントのレンダリングテストは書けない。
  ソースファイルを `readFileSync` で読んで文字列を検査する形式が `tests/light-gizmo.test.ts` にある。
  web/tests/light-gizmo.test.ts:1-4

- `tests/summary-coverage.test.ts` は `src/` の全ファイルが `viewer_Summary.md` のファイル一覧に、
  `tests/` の全テストがいずれかの Summary に載っていることを機械検証する。

## インターフェイス契約

### 新規 web/src/features/viewer/fit-camera.ts

```ts
import type { CameraState, Vec3 } from "@shared/types";

/**
 * 全体表示で使う、注視点からカメラへ向かう単位方向。
 * DEFAULT_CAMERA の position - target を正規化した値([1,1,1]/√3)。
 */
export const FIT_DIRECTION: Vec3;

/**
 * center を注視点にし、FIT_DIRECTION の向きに distance だけ離した視点を返す。
 * distance が有限でない、または MIN_PRESET_DISTANCE 未満なら MIN_PRESET_DISTANCE を使う。
 * 引数の center は変更せず、返り値の配列は center と同一参照ではない。
 */
export function fitCamera(center: Vec3, distance: number): CameraState;
```

### 変更 web/src/features/viewer/CameraRig.tsx

props は無い。シグネチャは変更しない。

```tsx
export function CameraRig(): ReactElement;
```

`fitSeq` の `useEffect` を次のとおり置き換える(`useFrame` の中身は変更しない)。

```tsx
useEffect(() => {
  if (fitSeq === lastFitSeq.current) {
    return;
  }
  lastFitSeq.current = fitSeq;
  const size = bounds.refresh(getModelTarget() ?? undefined).clip().getSize();
  useCameraStore.getState().requestCamera(
    fitCamera([size.center.x, size.center.y, size.center.z], size.distance),
  );
}, [bounds, fitSeq]);
```

## 振る舞い

### fitCamera / FIT_DIRECTION

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `FIT_DIRECTION` | 各成分が `1 / Math.sqrt(3)` と `1e-12` 以内で一致し、長さが 1 |
| `fitCamera([0, 0, 0], 10)` | `target: [0, 0, 0]`、`position` の各成分が `10 / √3` と `1e-9` 以内で一致 |
| `fitCamera([1, 2, 3], 6)` | `target: [1, 2, 3]`、`position` が `[1, 2, 3] + FIT_DIRECTION * 6` と `1e-9` 以内で一致 |
| 返り値の `position` と `target` の距離 | 渡した `distance` と `1e-9` 以内で一致 |
| `fitCamera([0, 0, 0], 0)` | 距離が `MIN_PRESET_DISTANCE` |
| `fitCamera([0, 0, 0], -5)` | 距離が `MIN_PRESET_DISTANCE` |
| `fitCamera([0, 0, 0], NaN)` / `Infinity` | 距離が `MIN_PRESET_DISTANCE` |
| `matchViewPreset(fitCamera([0, 0, 0], 10))` | `null`(Fit 後は回転ロックされない) |
| 呼び出しの前後で引数 `center` | 変化しない。返り値の `target` は `center` と同一参照ではない |

### ソース検査(web/tests/fit-camera.test.ts に追加)

| 検査 | 期待する結果 |
| --- | --- |
| `src/features/viewer/CameraRig.tsx` が `fitCamera(` を含むか | 含む |
| 同ファイルが `getModelTarget()` を含むか | 含む |
| 同ファイルが `.fit()` を含むか | 含まない |
| 同ファイルが `.reset()` を含むか | 含まない(`Bounds.reset()` を代わりに使わないこと) |
| 同ファイルが `.clip()` を含むか | 含む(near / far の設定は残す) |

### 結線後の全体像(CameraRig)

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| モデル読込直後(`ModelMesh` の `requestFit`) | モデル本体の中心を注視点に、斜め方向から全体が収まる距離へ `CameraRig` の補間で移る。`Bounds` 内部の 1 秒補間は使われない |
| 正面 / 右 / 背面 / 左 を押した直後に「全体」 | 必ず斜め方向へ戻り、到達後は回転ロックが外れる。既定視点の補間中に押しても、次のフレームで Fit の補間に置き換わり、最終位置は Fit の目標そのもの |
| 「全体」の直後に既定視点 | Fit の補間が既定視点の補間に置き換わり、既定視点の距離は Fit の目標距離になる(041 の「全体表示の距離を保ったまま正面へ回る」と同じ) |
| 他の参加者のカメラ表示 / ストローク / コメントピンが遠くにある状態で「全体」 | それらは箱に含めず、モデル本体だけが収まる距離になる |
| モデルがまだ無い(`getModelTarget()` が null)状態で「全体」 | 従来どおり `Bounds` 配下全体(空なら代替箱)から計算する |
| Follow 中に「全体」 | `pendingCamera` 消費時に `unfollow()` され、Fit の目標へ移る |
| Fit の補間中に Alt+左 / 中ドラッグ、ホイール、Alt+右ドラッグ | 既定視点と同じく補間を中断し、その場で止まる |
| Fit の補間中に Shift+右ドラッグ(ライト回転) | 補間は続く |
| Fit 到達後の視点が他の参加者へ配信されること | 従来どおり(`setSelfCamera(target, true)`) |
| Reset(`resetSeq`)、既定視点、視点再現、Follow の毎フレーム処理 | 変更しない |
| `enableRotate={!locked}` / `enableDamping={false}` / `onChange` / `onStart` | 変更しない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `FIT_DIRECTION` は `DEFAULT_CAMERA` から計算して定義する(`Math.SQRT1_2` のような手書き値でなく、
  `position - target` を `Math.hypot` で正規化する)。`DEFAULT_CAMERA` を変更しない
- `fitCamera` は `const safeDistance = Number.isFinite(distance) && distance >= MIN_PRESET_DISTANCE ? distance : MIN_PRESET_DISTANCE`
  で距離を決め、`position = [center[i] + FIT_DIRECTION[i] * safeDistance]`、`target = [...center]` を返す。
  `MIN_PRESET_DISTANCE` は `view-presets.ts` から import し、新しい定数を作らない
- `CameraRig` では `bounds.refresh(...)` → `.clip()` → `.getSize()` の順に呼ぶ(`clip()` は `refresh` 後の箱を使う)。
  `size.center` は `THREE.Vector3` なので `[x, y, z]` に展開してから渡す。`toArray()` は使わない(型が `number[]` になる)
- Fit の目標は `requestCamera` に積むだけにし、`animation.current` を `useEffect` から直接触らない。
  消費・`unfollow()`・補間開始は既存の `useFrame` の `pendingCamera` 分岐に任せる
- `Bounds` の `fit()` / `reset()` / `moveTo()` / `lookAt()` / `to()` を呼ばない。`ViewerCanvas` の `<Bounds fit={false} clip>` は変更しない
- ソース検査テストのパス解決は `tests/light-gizmo.test.ts` の書き方に合わせる(`import.meta.url` 基準)
- `viewer_Summary.md` は次を直す: ファイル一覧に `fit-camera.ts` を追加、`CameraRig.tsx` の説明に
  「Fit はモデル本体の箱から `fitCamera` で目標を作り `requestCamera` に積む(`Bounds` 内部補間は使わない)」を加える、
  「他フォルダとの関係」の Fit 説明を「斜めの初期方向・モデル本体のみ・既定視点と同じ補間」に改める、
  振る舞い表に `fitSeq` の行を追加、テスト一覧に `tests/fit-camera.test.ts` を追加。
  **補間時間の具体的な ms 数は新たに書き足さない**(056 で変更するため、「既定視点と同じ補間」と書く)

## やらないこと
- `Bounds` の `margin` / `maxDuration` / `interpolateFunc` を変えない。`ViewerCanvas.tsx` を変更しない
- `camera-animation.ts`(補間時間・easing)を変更しない。補間時間の変更は 056 で行う
- `view-presets.ts` / `model-target.ts` / `ModelMesh.tsx` / `CameraMenu.tsx` / `hud-labels.ts` を変更しない
- camera ストア(`web/src/store/camera.ts`)に state や action を足さない。`fitSeq` / `requestFit` の意味を変えない
- Fit の向きを「現在の向きを保つ」にする選択肢やモード切り替えを追加しない
- 「視点リセット」(`resetSeq` / `DEFAULT_CAMERA`)の挙動を変えない
- `shared/` と `server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の `fitCamera / FIT_DIRECTION` と「ソース検査」の全行に対応するテストが
      `web/tests/fit-camera.test.ts` にあり、通る
- [ ] `CameraRig.tsx` から `bounds...fit()` の呼び出しが消え、`getModelTarget()` と `fitCamera(` を使っている
- [ ] `viewer_Summary.md` のファイル一覧・他フォルダとの関係・振る舞い表・テスト一覧が実態に合っている
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
