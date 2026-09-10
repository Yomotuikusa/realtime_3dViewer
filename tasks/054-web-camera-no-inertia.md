---
id: 054
title: web カメラ操作(回転・パン・ホイール)の慣性を廃止し、不要になった慣性 flush を削除する
feature: web
depends_on: [053]
owns: [web/src/features/viewer/CameraRig.tsx, web/src/features/viewer/camera-animation.ts, web/tests/camera-animation.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/viewer-pointer.ts, web/src/features/viewer/follow.ts, web/tests/light-gizmo.test.ts, node_modules/@react-three/drei/core/OrbitControls.js, node_modules/three-stdlib/controls/OrbitControls.js]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
カメラの操作感を「手を離した瞬間に止まる」ものへ変える。現在は Alt+左ドラッグ(回転)・Alt+中ドラッグ(パン)・
ホイール(ズーム)に OrbitControls の減衰(慣性)が掛かっており、これを無くす。
減衰が無くなると 053 で入れた `flushControlsInertia` は常に何もしない関数になるため、あわせて削除する。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- drei の `OrbitControls` は props の `enableDamping` の既定値が **true** で、`<primitive>` にそのまま渡す。
  `CameraRig` はこの prop を指定していないため、現状は減衰が有効になっている。
  node_modules/@react-three/drei/core/OrbitControls.js:11, 75 / web/src/features/viewer/CameraRig.tsx:147-153

- three-stdlib の `OrbitControls.update()` は、`enableDamping === false` のとき `sphericalDelta` / `panOffset` の
  残りを一度に全部適用してから 0 にリセットする。つまり減衰が無効なら、操作を止めた次の `update()` で
  カメラは完全に止まり、「残り」は存在しない。node_modules/three-stdlib/controls/OrbitControls.js:190-196, 232-239

- `flushControlsInertia(controls)` は `enableDamping` を一時的に false にして `update()` を 1 回呼ぶだけの関数で、
  `CameraRig` の Reset 時と `pendingCamera` 消費時の 2 箇所から呼ばれている。
  web/src/features/viewer/camera-animation.ts:44-58 / web/src/features/viewer/CameraRig.tsx:13, 91, 106

- Alt+右ドラッグの dolly は `viewer-pointer.ts` の自前実装で、pointermove ごとに位置を直接書き換える。慣性は元から無い。
  web/src/features/viewer/viewer-pointer.ts:57-75

- 既定視点・視点再現の 300ms 補間(`startCameraAnimation` / `stepCameraAnimation`)と、Follow 中の毎フレーム lerp
  (`followStep`)は操作の慣性ではなく意図したアニメーションであり、**残す**ことが決まっている。

- web のテストは jsdom 環境で `@testing-library` がない。React コンポーネントのレンダリングテストは書けない。
  代わりに `tests/light-gizmo.test.ts` のようにソースファイルを `readFileSync` で読んで文字列を検査する形式が
  既に使われている。web/tests/light-gizmo.test.ts:1-4

- `tests/summary-coverage.test.ts` が `viewer_Summary.md` の記述と `src/` 配下のファイル一覧の整合を機械検証する。

## インターフェイス契約

### 変更 web/src/features/viewer/camera-animation.ts

`DampedControlsLike` と `flushControlsInertia` を**削除**する。残す公開インターフェイスは次のとおりで、シグネチャは変えない。

```ts
export const CAMERA_ANIMATION_DURATION_MS = 300;
export interface CameraAnimation { from: CameraState; to: CameraState; startedAt: number }
export function easeOutCubic(t: number): number;
export function startCameraAnimation(from: CameraState, to: CameraState, startedAt: number): CameraAnimation;
export function stepCameraAnimation(animation: CameraAnimation, now: number): { camera: CameraState; done: boolean };
```

### 変更 web/src/features/viewer/CameraRig.tsx

props は無い。シグネチャは変更しない。

```tsx
export function CameraRig(): ReactElement;
```

JSX の `<OrbitControls ...>` に `enableDamping={false}` を**属性としてそのまま書く**(変数や計算式を経由しない。
ソース文字列テストで `enableDamping={false}` を検査する)。

## 振る舞い

### 操作感(CameraRig)

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| Alt+左ドラッグで回転して手を離す | その瞬間にカメラが止まる。以後のフレームで動かない |
| Alt+中ドラッグでパンして手を離す | 同上 |
| ホイールでズームする | ホイール 1 ノッチぶんが即座に反映され、その後滑らない |
| Alt+右ドラッグの dolly | 従来どおり(元から慣性なし) |
| 既定視点ボタン・視点再現 | 従来どおり 300ms の ease-out 補間で到達し、到達後ロックされる |
| Follow 中の追従 | 従来どおり `followStep` の lerp |
| Reset(`resetSeq` 増加) | 補間を破棄 → `applyCamera(DEFAULT_CAMERA)` → `setSelfCamera(DEFAULT_CAMERA, true)`。flush 呼び出しだけ消える |
| `pendingCamera` 消費 | `consumePendingCamera()` → `unfollow()` → `startCameraAnimation(readCamera(...), target, now)`。flush 呼び出しだけ消える |
| `enableRotate={!locked}` とその理由コメント、`onChange` / `onStart` / `makeDefault` / `target` | 052・053 のまま |

### ソース検査テスト(web/tests/camera-animation.test.ts に追加)

| 検査 | 期待する結果 |
| --- | --- |
| `src/features/viewer/CameraRig.tsx` を読み、`enableDamping={false}` を含むか | 含む |
| 同ファイルが `flushControlsInertia` を含むか | 含まない |
| `src/features/viewer/camera-animation.ts` が `flushControlsInertia` / `DampedControlsLike` を含むか | 含まない |

既存の `easeOutCubic` / `startCameraAnimation` / `stepCameraAnimation` のテストはそのまま残して通す。
`flushControlsInertia` のテスト(`flushes damping once ...`、`restores damping when update throws ...`)は削除する。

## 実装メモ
- `CameraRig.tsx` から `flushControlsInertia` の import と 2 箇所の呼び出しを消す。それ以外の `useFrame` の処理順
  (Reset → `pendingCamera` 消費 → 補間 → Follow)は変えない
- `camera-animation.ts` の末尾の `DampedControlsLike` / `flushControlsInertia` とその JSDoc を削除する
- ソース検査テストのパス解決は `tests/light-gizmo.test.ts` の書き方に合わせる(`import.meta.url` 基準)
- `viewer_Summary.md` は次を直す: ファイル一覧の camera-animation.ts(「慣性 flush を提供」を消す)と CameraRig.tsx
  (「Reset／既定視点開始時は慣性を打ち切り」を「OrbitControls の減衰を無効にし操作は即時反映」に改める)、
  公開インターフェイス一覧から `DampedControlsLike` / `flushControlsInertia` を消す、
  視点再現の説明(`viewer_Summary.md:69, 78` 付近)から「慣性を flush してから」を消す、
  テスト一覧の camera-animation.test.ts(「慣性 flush と例外復元」→「CameraRig の減衰無効化のソース検査」)

## やらないこと
- `dampingFactor` / `rotateSpeed` / `panSpeed` / `zoomSpeed` など、減衰以外の操作パラメータを触らない
- 既定視点・視点再現の 300ms 補間、easing、Follow の lerp 係数を変えない
- `view-presets.ts` / `viewer-pointer.ts` / `camera-input.ts` / `follow.ts` / `store/camera.ts` を変更しない
- `enablePan` / `enableZoom` / `enabled` を触らない
- `shared/` と `server/` を変更しない
- 慣性の有無を設定やショートカットで切り替えられるようにしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] `CameraRig.tsx` の `<OrbitControls>` に `enableDamping={false}` が属性として書かれている
- [ ] `flushControlsInertia` と `DampedControlsLike` がリポジトリの web 配下から消えている(テスト・Summary 含む)
- [ ] 振る舞い表「ソース検査テスト」の全行に対応するテストが `web/tests/camera-animation.test.ts` にあり、通る
- [ ] `viewer_Summary.md` のファイル一覧・公開インターフェイス・視点再現の説明・テスト一覧が実態に合っている
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
