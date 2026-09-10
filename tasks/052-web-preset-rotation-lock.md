---
id: 052
title: web 既定視点(正面 / 背面 / 右 / 左)の表示中はカメラを回転できなくする
feature: web
depends_on: [041]
owns: [web/src/features/viewer/view-presets.ts, web/src/features/viewer/CameraRig.tsx, web/tests/view-presets.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/store/camera.ts, web/src/store/presence.ts, web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/camera-input.ts, web/src/features/viewer/viewer-pointer.ts, shared/src/camera.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
正面 / 背面 / 右 / 左の既定視点で形を確認している最中に、Alt+左ドラッグが少しでも入ると
向きがずれて真正面ではなくなる。既定視点ちょうどの向きで見ている間は回転操作を無効にし、
ずれないようにする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `presetCamera(preset, current)` は注視点と距離を保ったまま、
  `VIEW_PRESET_DIRECTIONS[preset]` の方向へカメラを置いた `CameraState` を返す。
  `VIEW_PRESET_DIRECTIONS` は `front: [0,0,1]` / `back: [0,0,-1]` / `right: [1,0,0]` /
  `left: [-1,0,0]` の水平な単位ベクトルである。
  web/src/features/viewer/view-presets.ts:30-43

- `CameraMenu` の既定視点ボタンは `requestCamera(presetCamera(...))` を呼ぶだけで、
  「今どのプリセットにいるか」という状態はどこにも保存していない。
  web/src/features/viewer/CameraMenu.tsx:47

- `CameraRig` の `useFrame` が `pendingCamera` を消費して `lerpCamera(current, target, 0.2)` で
  補間し、`cameraEquals`(既定 epsilon 1e-4)で到達したら `applyCamera(camera, controls, target)` と
  `cameraStore.setSelfCamera(target)` を行う。**到達後の `selfCamera` は `presetCamera` の
  返り値そのものである。** web/src/features/viewer/CameraRig.tsx:98-108, shared/src/camera.ts:12

- `OrbitControls` の回転は Alt+左ドラッグ(`MOUSE_BUTTONS_ALT.LEFT = MOUSE.ROTATE`)と
  タッチ1本指だけである。パン(Alt+中ドラッグ)、ホイールの dolly、
  Alt+右ドラッグの自前 dolly(`dollyPosition`)は**どれも注視点からの方向を変えない**。
  web/src/features/viewer/camera-input.ts:11-27, web/src/features/viewer/viewer-pointer.ts:60-79

- three-stdlib の `OrbitControls` は `enableRotate === false` のとき、
  マウスの ROTATE 分岐でもタッチ1本指の分岐でも `return` して `state` を `STATE.NONE` のままにする。
  **その結果 `start` イベントが発火せず、`CameraRig` の `onStart`(`handleStart` の
  `presence.unfollow()`)も呼ばれない。** node_modules/three-stdlib/controls/OrbitControls.js:678-682, 709, 745

- drei の `OrbitControls` は既知の props 以外を `<primitive object={controls} {...restProps} />` へ
  そのまま渡す。**`enableRotate` は props で制御できる。**
  node_modules/@react-three/drei/core/OrbitControls.js:6-16, 72-76

- `usePresenceStore` の `followingUserId` は追従中だけ非 `null` になる。
  web/src/store/presence.ts:71-79

- web のテストは jsdom 環境で `@testing-library` がない。
  **React コンポーネントのレンダリングテストは書けない。** web/vitest.config.ts

## インターフェイス契約

### 変更 web/src/features/viewer/view-presets.ts

既存の export はすべて残し、シグネチャも変えない。次を追加する。

```ts
/**
 * 現在の向きを既定視点と同じとみなす許容誤差。
 * 正規化した方向ベクトルの各成分をこの値で比較する。
 */
export const PRESET_MATCH_EPSILON = 1e-6;

/**
 * 注視点からカメラへ向かう単位方向が、どの既定視点の方向と一致するかを返す。
 * 一致しない場合と、注視点とカメラが重なって方向が定まらない場合は null を返す。
 * 判定は VIEW_PRESET_ORDER の順に行い、最初に一致したものを返す。
 * 引数の camera は変更しない。
 */
export function matchViewPreset(camera: CameraState): ViewPreset | null;

/**
 * カメラの回転操作を禁止すべきかどうかを返す。
 * 既定視点ちょうどの向きで、かつ他の参加者を追従していないときだけ true。
 */
export function rotationLocked(camera: CameraState, following: boolean): boolean;
```

### 変更 web/src/features/viewer/CameraRig.tsx

`CameraRig()` の props は無い。シグネチャは変更しない。

```tsx
export function CameraRig(): ReactElement;
```

## 振る舞い

### matchViewPreset

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ position: [0, 0, 5], target: [0, 0, 0] }` | `"front"` |
| `{ position: [0, 0, -5], target: [0, 0, 0] }` | `"back"` |
| `{ position: [5, 0, 0], target: [0, 0, 0] }` | `"right"` |
| `{ position: [-5, 0, 0], target: [0, 0, 0] }` | `"left"` |
| `{ position: [4, 2, 3], target: [1, 2, 3] }`(注視点が原点でない `right`) | `"right"` |
| `DEFAULT_CAMERA`(`position: [3,3,3]`) | `null` |
| `{ position: [0, 5, 0], target: [0, 0, 0] }`(真上) | `null` |
| `{ position: [0, 0, -5], target: [0, 0, 0] }` から y を 0.01 ずらした視点 | `null` |
| `{ position: [1, 2, 3], target: [1, 2, 3] }`(距離 0) | `null` |
| `VIEW_PRESET_ORDER` の各 preset について `matchViewPreset(presetCamera(preset, c))`(`c` は距離が 0 でない任意の視点) | その preset 自身 |
| 呼び出しの前後で引数の `camera` | 変化しない |
| 方向の各成分が `PRESET_MATCH_EPSILON` の 1/10 だけずれた `front` の視点 | `"front"` |

### rotationLocked

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `({ position: [0, 0, 5], target: [0, 0, 0] }, false)` | `true` |
| `({ position: [0, 0, 5], target: [0, 0, 0] }, true)`(追従中) | `false` |
| `(DEFAULT_CAMERA, false)` | `false` |
| `(DEFAULT_CAMERA, true)` | `false` |
| `({ position: [1, 2, 3], target: [1, 2, 3] }, false)`(距離 0) | `false` |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| 「正面」を押して補間が終わったあと Alt+左ドラッグ | カメラが回らない。向きも注視点も変わらない |
| 同じ状態でタッチ1本指のドラッグ | カメラが回らない |
| 同じ状態で Alt+中ドラッグ(パン) | 従来どおりパンできる。パンしても向きは変わらないのでロックは続く |
| 同じ状態でホイール / Alt+右ドラッグ(dolly) | 従来どおり寄り引きできる。ロックは続く |
| 同じ状態でペン / コメントの左ドラッグ(Alt なし) | 従来どおり線とピンが置ける |
| 同じ状態で Shift+右ドラッグ | 従来どおりライトだけが回る |
| ロック中に「背面」「右」「左」を押す | その向きへ補間で移り、移った先でもロックされる |
| ロック中に「視点リセット」を押す | `DEFAULT_CAMERA` へ戻り、ロックが外れて回転できる |
| ロック中に「全体を表示」を押す | Bounds が寄せた向きで判定し直す。向きが既定視点のままならロックは続き、変わればロックは外れる |
| ロック中に他の参加者の追従を始める | ロックが外れる。追従中は相手が正面を向いていても回転できる |
| ロック中にコメントの視点を再現する | 再現先の向きで判定し直す |
| ロック中に自分の視点が他の参加者へ配信されること | 従来どおり変わらない |
| ロック中の HUD の見た目 | 変わらない。ボタンの見た目も文言も従来どおり |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `matchViewPreset` は
  `const dx = camera.position[0] - camera.target[0]`(y, z も同様)から
  `const distance = Math.hypot(dx, dy, dz)` を求め、
  `distance < PRESET_MATCH_EPSILON` なら `null` を返す。
  そのあと `[dx / distance, dy / distance, dz / distance]` を
  `VIEW_PRESET_ORDER` の順に `VIEW_PRESET_DIRECTIONS[preset]` と成分ごとに比べ、
  3成分すべての差の絶対値が `PRESET_MATCH_EPSILON` 以下なら その preset を返す。
  最後まで一致しなければ `null`
- `MIN_PRESET_DISTANCE`(1e-3)ではなく `PRESET_MATCH_EPSILON`(1e-6)を距離 0 の判定に使う。
  `presetCamera` が距離 0 のときに作る視点(距離 1e-3)は方向が定まるので
  `matchViewPreset` で一致すること
- `rotationLocked(camera, following)` は `!following && matchViewPreset(camera) !== null` を返す。
  ここに他の条件を足さない
- `CameraRig` は次のように**派生した boolean だけを購読する**。
  `selfCamera` をそのまま購読すると視点が動くたびに再レンダリングが起きるため、必ず selector の中で
  `rotationLocked` まで計算すること。

  ```tsx
  const following = usePresenceStore((state) => state.followingUserId !== null);
  const locked = useCameraStore((state) => rotationLocked(state.selfCamera, following));
  ```

  `following` は selector の外側で先に取り、`locked` の selector から参照する
- `OrbitControls` へ `enableRotate={!locked}` を渡す。**props で渡すこと。**
  `controlsRef.current.enableRotate = ...` のように `useFrame` や `useEffect` の中で
  直接代入しない(drei が props から再適用するタイミングと競合するため)
- 追従中にロックしないのは、`enableRotate === false` だと `OrbitControls` の `start` が
  発火せず `handleStart` の `presence.unfollow()` が呼ばれなくなり、
  Alt+左ドラッグで追従を抜けられなくなるためである。この理由をコメントとして残すこと
- `useFrame` の中身、`applyCamera` / `readCamera`、`attachViewerPointer` の呼び出しは変更しない。
  プログラムからのカメラ更新(`applyCamera`)は `enableRotate` の影響を受けない
- 補間中(`pendingTarget.current` が残っている間)を特別扱いしない。
  `selfCamera` だけで判定する

## やらないこと
- **camera ストアや presence ストアに新しい state を足さない。**
  「今どのプリセットにいるか」を保存しない(`web/src/store/` を変更しない)
- 既定視点ボタンに `aria-pressed` やロック中の見た目を足さない。
  `CameraMenu.tsx` / `ViewerHud.tsx` / `hud-labels.ts` / `viewer.css` を変更しない
- ロック中であることを知らせるヒント文言やトーストを追加しない(別タスクで扱う)
- パン、ホイール dolly、Alt+右ドラッグ dolly、ペン、コメント、ライト回転を制限しない。
  `enablePan` / `enableZoom` に触らない
- `camera-input.ts` の `MOUSE_BUTTONS_ALT` / `MOUSE_BUTTONS_IDLE` を変更して回転を止めない。
  この経路を変えるとタッチ操作が漏れる
- `viewer-pointer.ts` を変更しない
- ロックを解除するためのキーボードショートカットを追加しない
  (`ShortcutAction` と `features/shortcuts/` を変更しない)
- 上下(真上・真下)のプリセットを追加しない。`VIEW_PRESET_ORDER` の中身を変えない
- 平行投影へ切り替えない。焦点距離(042 / 043)、ライティング(040 / 046)、
  Follow フレーム(050)の挙動を変更しない
- `shared/` と `server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の `matchViewPreset` / `rotationLocked` の全行に対応するテストが
      `web/tests/view-presets.test.ts` に追加され、通る
- [ ] 既存の `view-presets.test.ts` のテストがすべて通ったままである
- [ ] `viewer_Summary.md` のファイル一覧・公開インターフェイス・他フォルダとの関係が実態に合っている
      (`view-presets.ts` に `PRESET_MATCH_EPSILON` / `matchViewPreset` / `rotationLocked` が
      増えたこと、`CameraRig` が既定視点ちょうどの向きで追従していないときに
      `enableRotate` を false にすること、追従中はロックしない理由)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
