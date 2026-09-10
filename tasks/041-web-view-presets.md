---
id: 041
title: web 既定カメラ(正面 / 背面 / 右 / 左)への切り替え
feature: web
depends_on: [040]
owns: [web/src/features/viewer/view-presets.ts, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-labels.ts, web/tests/view-presets.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [web/src/store/camera.ts, web/src/features/viewer/CameraRig.tsx, web/src/store/presence.ts, web/src/features/viewer/viewer.css, web/src/app/review.css, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
真横や真後ろから形を確認したいときに、Alt+左ドラッグで手作業に回すしかない。
HUD のボタン1つで **正面 / 背面 / 右 / 左** の決まった向きへ視点を移せるようにする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- camera ストアの `requestCamera(camera)` に視点を積むと、`CameraRig` の `useFrame` が
  それを消費して `lerpCamera(current, target, 0.2)` で毎フレーム補間しながら寄せる。
  到達したら `pendingCamera` は `null` に戻る。**視点を動かす正しい入口はこれである。**
  web/src/store/camera.ts:51-53, web/src/features/viewer/CameraRig.tsx:77-105
- `pendingCamera` を消費するとき `CameraRig` が `usePresenceStore.getState().unfollow()` を
  呼ぶ。**呼び出し側で追従解除を書く必要はない。**
  web/src/features/viewer/CameraRig.tsx:78-84
- `CameraState` は `{ position: Vec3; target: Vec3 }`。カメラの上方向(up)はどこにも保存されず、
  `OrbitControls` の既定である **+Y** のままである。shared/src/types.ts:5-9
- モデルの初期視点 `DEFAULT_CAMERA` は `{ position: [3, 3, 3], target: [0, 0, 0] }`。
  shared/src/camera.ts:4
- `ViewerHud` の視点グループは次の形。`.hud-view` は `viewer.css` で
  枠と影を持つボタン群として定義されている(040 で `.hud-light` と共用のセレクタになっている)。
  web/src/features/viewer/ViewerHud.tsx:50-53

  ```tsx
  <div className="hud-view" role="group" aria-label="視点">
    <button className="btn btn--quiet" type="button" onClick={requestReset}>{withShortcut(RESET_LABEL, keymap.viewReset)}</button>
    <button className="btn btn--quiet" type="button" onClick={requestFit}>{withShortcut(FIT_LABEL, keymap.viewFit)}</button>
  </div>
  ```

- 040 で視点グループの直後に `<div className="hud-light" role="group" aria-label="ライト">` が
  足されている。web/web_Summary.md
- `.review-hud` の直下要素は `pointer-events: none` で、`[role="group"]` などだけが
  `pointer-events: auto` に戻る。**新しいボタン群も `role="group"` を付けること。**
  web/src/app/review.css:92-105
- `hud-labels.ts` は表示文言と表示用の純粋関数だけを持つ。
  `MODE_LABELS` / `PLACEMENT_LABELS` は `Readonly<Record<...>>` で書かれている。
  web/src/features/viewer/hud-labels.ts:8-24
- web のテストは jsdom 環境で `@testing-library` がない。
  **React コンポーネントのレンダリングテストは書けない。** web/vitest.config.ts

## インターフェイス契約

### 新規 web/src/features/viewer/view-presets.ts

```ts
import type { CameraState, Vec3 } from "@shared/types";

/** 決まった向きから見る視点。 */
export type ViewPreset = "front" | "back" | "right" | "left";

/** HUD のボタンの並び順。 */
export const VIEW_PRESET_ORDER: readonly ViewPreset[] = ["front", "back", "right", "left"];

/**
 * 注視点から見たカメラ位置の単位方向。glTF の慣習に合わせて +Z を正面とする。
 * どれも水平方向なので、上方向(+Y)と平行にならない。
 */
export const VIEW_PRESET_DIRECTIONS: Readonly<Record<ViewPreset, Vec3>> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
};

/** 注視点とカメラが重なっているときに使う最小距離。 */
export const MIN_PRESET_DISTANCE = 0.001;

/**
 * 現在の注視点と注視点までの距離を保ったまま、preset の方向へカメラを置いた視点を返す。
 * 引数の current は変更しない。
 */
export function presetCamera(preset: ViewPreset, current: CameraState): CameraState;
```

### 変更 web/src/features/viewer/hud-labels.ts

既存の export はすべて残す。次を追加する。

```ts
import type { ViewPreset } from "./view-presets";

export const VIEW_PRESET_LABELS: Readonly<Record<ViewPreset, string>> = {
  front: "正面",
  back: "背面",
  right: "右",
  left: "左",
};
```

### 変更 web/src/features/viewer/ViewerHud.tsx

props のシグネチャは変更しない。

```tsx
export function ViewerHud({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

## 振る舞い

### presetCamera

`toBeCloseTo`(精度10)で比較する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `("front", { position: [0, 0, 5], target: [0, 0, 0] })` | `{ position: [0, 0, 5], target: [0, 0, 0] }` |
| `("back", { position: [0, 0, 5], target: [0, 0, 0] })` | `position` が `[0, 0, -5]` |
| `("right", { position: [0, 0, 5], target: [0, 0, 0] })` | `position` が `[5, 0, 0]` |
| `("left", { position: [0, 0, 5], target: [0, 0, 0] })` | `position` が `[-5, 0, 0]` |
| `("front", DEFAULT_CAMERA)`(距離 `Math.sqrt(27)`) | `position` が `[0, 0, Math.sqrt(27)]` |
| `("right", { position: [0, 0, 5], target: [1, 2, 3] })`(距離 3) | `position` が `[4, 2, 3]` |
| `("front", { position: [1, 2, 3], target: [1, 2, 3] })`(距離 0) | `position` が `[1, 2, 3 + MIN_PRESET_DISTANCE]` |
| どの preset でも `target` | `current.target` と等しい値 |
| どの preset でも `position` と `target` の距離 | 変換前と等しい(距離 0 の場合を除く) |
| 返り値 | `current` とも `current.position` / `current.target` とも別オブジェクト |
| 呼び出しの前後で引数の `current` | 変化しない |
| `VIEW_PRESET_ORDER` | `["front", "back", "right", "left"]` |
| `VIEW_PRESET_ORDER` の各要素 | `VIEW_PRESET_DIRECTIONS` にキーがあり、長さ 1 の単位ベクトルである |

### hud-labels

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `VIEW_PRESET_LABELS` | `{ front: "正面", back: "背面", right: "右", left: "左" }` |
| `VIEW_PRESET_ORDER` の各要素 | `VIEW_PRESET_LABELS` に空でない文言がある |
| 既存の `MODE_LABELS` / `RESET_LABEL` / `FIT_LABEL` / `LIGHT_RESET_LABEL` / `hint()` | 変わらない |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| HUD の「正面」を押す | モデルの +Z 側へ、今の距離を保ったままカメラが補間で回り込む |
| 「背面」「右」「左」を押す | それぞれ −Z / +X / −X 側へ回り込む |
| ボタンを押したとき注視点 | 変わらない。ズーム量(距離)も変わらない |
| 他の参加者を追従中にボタンを押す | 追従が解除される(`CameraRig` の `pendingCamera` 処理による) |
| 移動中にもう一度別のボタンを押す | 新しい向きへ切り替わる(`pendingCamera` が上書きされる) |
| 押したあとの自分の視点 | 他の参加者へ通常どおり配信される |
| ペンモード / コメントモード中に押す | モードは変わらない。線もピンも消えない |
| 「全体を表示」を押したあとに「正面」を押す | 全体表示の距離を保ったまま正面へ回る |
| ボタンの表示 | 左から「正面」「背面」「右」「左」 |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **正面は +Z 側**(カメラが `target + [0, 0, d]` に立つ)。glTF / three.js の慣習に合わせる
- `presetCamera` は
  `const distance = Math.max(Math.hypot(...), MIN_PRESET_DISTANCE)` で距離を求め、
  `position[i] = current.target[i] + VIEW_PRESET_DIRECTIONS[preset][i] * distance` を返す。
  `Math.max` にしているのは距離 0(カメラと注視点が重なった状態)でも
  `OrbitControls` が壊れないようにするため
- `presetCamera` は `modelSize` を見ない。**距離は現在の距離をそのまま使う**。
  全体に収めたいときはユーザーが「全体を表示」を押してから preset を押す
- 上方向(up)は触らない。`front` / `back` / `right` / `left` はすべて水平方向なので
  既定の +Y と平行にならず、`OrbitControls` の特異点を踏まない
- `ViewerHud` にはライトグループ(`.hud-light`)の**手前**、視点グループ(`.hud-view`)の
  **直後**に次を足す。

  ```tsx
  <div className="hud-view" role="group" aria-label="既定の視点">
    {VIEW_PRESET_ORDER.map((preset) => (
      <button
        key={preset}
        className="btn btn--quiet"
        type="button"
        onClick={() => requestCamera(presetCamera(preset, useCameraStore.getState().selfCamera))}
      >
        {VIEW_PRESET_LABELS[preset]}
      </button>
    ))}
  </div>
  ```

- `requestCamera` は `useCameraStore((state) => state.requestCamera)` で購読して取る。
  一方 `selfCamera` は**購読しない**。`useCameraStore.getState().selfCamera` を
  `onClick` の中で読む(視点が動くたびに HUD 全体が再レンダリングされるのを避けるため)
- `.hud-view` のクラスをそのまま使い回す。**`viewer.css` は変更しない**
- `aria-label` は既存の視点グループが `"視点"`、新しいグループが `"既定の視点"`。重複させない
- 追従解除を `onClick` に書かない。`CameraRig` が `pendingCamera` 消費時に行う
- `hud-labels.ts` は `view-presets.ts` から `ViewPreset` を **type import** する。
  逆向き(`view-presets.ts` から `hud-labels.ts`)の import を作らない
- ボタンにキーボードショートカットを併記しない(`withShortcut` を使わない)

## やらないこと
- **Top / Bottom(真上・真下)のプリセットを作らない。** 視線が上方向ベクトルと
  平行になり、カメラの横倒れをどう決めるかという別の設計判断が要るため
- 平行投影(`OrthographicCamera`)へ切り替えない。透視投影のままにする
- プリセットにキーボードショートカットを割り当てない
  (`ShortcutAction` と `features/shortcuts/` を変更しない)
- 「今どのプリセットにいるか」を状態として保持しない。`aria-pressed` も付けない
- プリセットの選択を WebSocket で他の参加者へ送らない。`shared/` と `server/` を変更しない
- `store/camera.ts` / `CameraRig.tsx` / `follow.ts` / `viewer.css` を変更しない
- ライティング(040)、透過表示(034)、空間描画(035)の挙動を変更しない
- 焦点距離(042 / 043)には手を付けない
- `hint()` の文言と既存のボタンのラベルを変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`view-presets.test.ts` に `presetCamera` / `VIEW_PRESET_ORDER` /
      `VIEW_PRESET_DIRECTIONS` の系列を新規に追加し、
      `hud-labels.test.ts` に `VIEW_PRESET_LABELS` の系列を足す)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`features/viewer/view-presets.ts` の追加、`ViewPreset` / `VIEW_PRESET_ORDER` /
      `VIEW_PRESET_DIRECTIONS` / `presetCamera` / `VIEW_PRESET_LABELS`、
      HUD が `requestCamera` 経由で視点を移すこと)
- [ ] すべてのファイルが300行以内(`web_Summary.md` を含む)
- [ ] `npm run typecheck && npm run test:web` が成功する
