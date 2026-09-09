---
id: 012
title: web 3D ビューア(モデル表示・Orbit / Reset / Fit・エラーカード)
feature: web
depends_on: [011, 003]
owns: [web/src/store/camera.ts, web/src/app/ReviewPage.tsx, web/src/app/ErrorBoundary.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/CameraRig.tsx, web/tests/store-camera.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/camera.ts, web/src/api/client.ts, web/src/app/routes.ts, web/src/app/App.tsx]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
MVP #1(3D Viewer)。`/p/:projectId` でプロジェクトを取得し、glTF/GLB を表示して
Orbit / Pan / Zoom / Reset / 全体表示ができるようにする。あわせて以降の全 web タスクが
使うカメラストア(D4)と、three 例外で画面が白くならないための ErrorBoundary(§17)を置く。

## 前提
- 011 の `getProject` `modelUrl` `ApiClientError`(web/src/api/client.ts)と
  `ReviewPage`(プレースホルダ)が存在する。**このタスクで ReviewPage を本実装に置き換える**
  (`export function ReviewPage(props: { projectId: string })` のシグネチャは変えない)
- 003 の `@shared/camera`(`DEFAULT_CAMERA` `cameraEquals` `lerpCamera` `cloneCamera`)を使う。
  カメラ補間の数学を web 側で再実装しない
- zustand 5: `import { create } from "zustand"`。React 外からは `useCameraStore.getState()` で触れる
- @react-three/fiber 9.7 / @react-three/drei 10.7 / three 0.186。
  `useGLTF` `OrbitControls` `Bounds` `useBounds` は drei から import する
- fov は 50 固定(§13.1 の注記)。`<Canvas camera={{ fov: 50, position: DEFAULT_CAMERA.position }}>`
- **R3F コンポーネントの描画テストは書かない**(§19)。テスト対象は `store/camera.ts` のみ。
  それ以外は typecheck で担保する
- CSS ファイルは作らない(D26)。インライン `style` を使う
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/store/camera.ts
import type { CameraState } from "@shared/types";

export interface CameraStoreState {
  /** 最後に確定した自分の視点。初期値は DEFAULT_CAMERA */
  selfCamera: CameraState;
  /** 再現要求(コメント再現・Follow 解除後の移動)。CameraRig が消費する */
  pendingCamera: CameraState | null;
  /** Reset(初期視点へ即座に戻す)のトリガ。初期値 0 */
  resetSeq: number;
  /** Fit(全体表示)のトリガ。初期値 0 */
  fitSeq: number;
  /** モデルのバウンディングボックスの最大辺長。初期値 1。017 の simplifyTolerance でも使う */
  modelSize: number;

  /** cameraEquals(既定 eps)で現在値と同じなら state を更新しない(不要な再描画を避ける) */
  setSelfCamera(camera: CameraState): void;
  /** pendingCamera に cloneCamera した値を積む */
  requestCamera(camera: CameraState): void;
  /** pendingCamera を返して null に戻す。無ければ null */
  consumePendingCamera(): CameraState | null;
  requestReset(): void;      // resetSeq を +1
  requestFit(): void;        // fitSeq を +1
  setModelSize(size: number): void;   // 0 以下は無視する
  /** テスト用。全 state を初期値へ戻す */
  reset(): void;
}

export const useCameraStore: import("zustand").UseBoundStore<
  import("zustand").StoreApi<CameraStoreState>
>;
```

```tsx
// web/src/app/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {}   // componentDidCatch でエラーを console に JSON 1 行で出す

// web/src/features/viewer/ViewerCanvas.tsx
/** children は 014 以降(RemoteCameras / StrokeLines / AnnotationLayer)の差し込み口 */
export function ViewerCanvas(props: { modelSrc: string; children?: React.ReactNode }): React.ReactElement;

// web/src/features/viewer/ModelMesh.tsx
/** useGLTF(src) でロードし <primitive> で描画。Box3 から最大辺長を求め setModelSize する */
export function ModelMesh(props: { src: string }): React.ReactElement;

// web/src/features/viewer/CameraRig.tsx
/** OrbitControls をラップし、カメラ状態をストアと同期する */
export function CameraRig(): React.ReactElement;
```

`CameraRig` の責務(このタスクの範囲):

| きっかけ | 動作 |
| --- | --- |
| OrbitControls の `change` | 現在の `camera.position` と `controls.target` を `setSelfCamera` |
| `pendingCamera` が非 null | `consumePendingCamera()` して目標に設定し、`useFrame` で `lerpCamera(現在, 目標, 0.2)` を適用。`cameraEquals` になったら目標をクリア(≒300ms で到達する) |
| `resetSeq` が増えた | 補間せず即座に `DEFAULT_CAMERA` へ設定する |
| `fitSeq` が増えた / モデル初回ロード完了 | `Bounds` / `useBounds()` の `refresh().clip().fit()` で全体表示にする |

`ReviewPage` の責務:

- マウント時に `getProject(projectId)`。状態は `loading` / `error` / `ready` の 3 つ
- `ready`: 左に `<ErrorBoundary fallback={<エラーカード/>}><ViewerCanvas modelSrc={modelUrl(...)}/></ErrorBoundary>`、
  右にサイドパネル領域(013 以降がここに参加者一覧・コメントを足す)。
  ビューア上部に **Reset** と **全体表示** のボタンを置き、`requestReset` / `requestFit` を呼ぶ
- `error`: Canvas の代わりにエラーカード(`ApiClientError.message` と再読み込みボタン)を出す(§17)
- モデル自体のロード失敗(404 / パース失敗)は `ErrorBoundary` の fallback がエラーカードを出す
- `modelSrc` は `modelUrl(projectId, project.latestVersion.id)`

## 振る舞い

(テスト対象は `store/camera.ts`。他は typecheck のみ)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期 state | `selfCamera` が `DEFAULT_CAMERA` と `cameraEquals`、`pendingCamera:null`、`resetSeq:0`、`fitSeq:0`、`modelSize:1` |
| `setSelfCamera(c)` | `selfCamera` が c と `cameraEquals`。`getState().selfCamera !== c`(複製して保持) |
| 同じ値で `setSelfCamera` を 2 回 | 2 回目で `getState().selfCamera` の**参照が変わらない** |
| 微小差(1e-6)で `setSelfCamera` | 参照が変わらない(`cameraEquals` の既定 eps 内) |
| 0.01 の差で `setSelfCamera` | 参照が変わり、値も更新される |
| `requestCamera(c)` → `consumePendingCamera()` | 1 回目は c と `cameraEquals` な値、2 回目は `null`。返り値は c と別参照 |
| `consumePendingCamera()`(pending 無し) | `null`。state は変わらない |
| `requestCamera` を 2 回連続 | `pendingCamera` は後勝ち |
| `requestReset()` を 3 回 | `resetSeq === 3` |
| `requestFit()` を 2 回 | `fitSeq === 2` |
| `setModelSize(12.5)` / `setModelSize(0)` / `setModelSize(-1)` | 12.5 に更新 / どちらも無視され直前の値のまま |
| `reset()` | すべて初期値に戻る |

## やらないこと
- JoinDialog・WebSocket・Presence(013 / 014)。ここではサイドパネルは空の枠でよい
- Follow(015)。`CameraRig` に Follow の分岐をまだ入れない
- Annotation / Comment の描画・入力(016 以降)
- R3F コンポーネントの描画テスト、E2E
- CSS ファイルの追加、`web/src/app/App.tsx` / `web/src/api/client.ts` の変更
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(camera ストアの state / action、ViewerCanvas の children 差し込み口)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
