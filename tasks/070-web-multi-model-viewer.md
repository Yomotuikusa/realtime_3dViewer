---
id: 070
title: web オブジェクト(版)ストアを作り、ビューアが全オブジェクトを描画して表示・非表示と受信イベントを反映する
feature: web
depends_on: [066, 069]
owns: [web/src/store/objects.ts, web/tests/store-objects.test.ts, web/src/app/review-stores.ts, web/tests/review-stores.test.ts, web/src/app/realtime-dispatch.ts, web/tests/realtime-dispatch.test.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/PlaybackRig.tsx, web/src/features/viewer/PlaybackClock.tsx, web/src/features/viewer/pick.ts, web/tests/pick.test.ts, web/src/app/ReviewPage.tsx, web/src/store/store_Summary.md, web/src/features/viewer/viewer_Summary.md, web/src/app/app_Summary.md]
reads: [shared/src/types.ts, shared/src/protocol.ts, web/src/api/client.ts, web/src/store/lighting.ts, web/src/store/playback.ts, web/src/features/viewer/model-target.ts, web/src/features/viewer/playback-driver.ts, web/src/features/viewer/playback.ts, web/src/features/viewer/CameraRig.tsx, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/comments/CommentPickLayer.tsx, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
project の全版を「オブジェクト」として 3D ビューに同時に描画し、表示・非表示をストアで持つ。
WS の welcome / `object:visibility` / `object:added` をストアへ反映して、参加者間で
オブジェクト一覧と可視性が揃うようにする。一覧 UI は 071 で載せる。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 066 で `Project.versions: ModelVersion[]`(number 昇順)、`welcome.hiddenObjectIds?: string[]`、
  `ServerMessage` の `object:visibility { userId, versionId, visible }` と
  `object:added { version }` が定義済み。shared/src/types.ts, shared/src/protocol.ts
- 069 で `web/tests/api-client.test.ts` の fixture が `versions` を持つようになっている
- `ReviewPage` は `getProject` の結果を `state.project` に持ち、
  `modelUrl(projectId, latestVersion.id)` を `ViewerCanvas({ modelSrc })` へ渡している。
  `ErrorBoundary` の `key` は `src`。web/src/app/ReviewPage.tsx:129, :152-170
- `ViewerCanvas` は `Bounds` の中に `CameraRig`、`ModelMesh`、`children` を置く。web/src/features/viewer/ViewerCanvas.tsx
- `ModelMesh` は `useGLTF` でロードし、`setModelTarget(scene)`、箱から `setModelSize`、
  `requestFit()`、`setClips(...)`(cleanup で `setClips([])`)、`PlaybackRig` 配置を全部1体で行う。
  web/src/features/viewer/ModelMesh.tsx
- `PlaybackRig` は `useFrame` で **時刻を進める処理と mixer への適用の両方**を行う。
  モデルごとに置くと N 倍速になる。web/src/features/viewer/PlaybackRig.tsx:22-29
- `createPlaybackDriver(root, clips).apply(clipIndex, time)` は index が範囲外なら何もしない。
  web/src/features/viewer/playback-driver.ts:18-27
- `getModelTarget()` は `CameraRig` の Fit(`bounds.refresh(target)`)、`AnnotationLayer` と
  `CommentPickLayer` の `pickModel` が使う。単一の `Object3D` を期待する
- `pickModel` は three の `Raycaster.intersectObject(target, true)` を直接使う。
  three の Raycaster は `visible === false` のオブジェクトも交差対象にするため、
  非表示オブジェクトを除外するには交点をフィルタする必要がある。web/src/features/viewer/pick.ts:26-51
- lighting ストアは `origin: "local" | "remote"` でエコー防止をしているが、可視性は
  クリック単位の離散操作なので throttle もエコー防止も不要。送信は 071 の UI が直接 `send` する
- `resetReviewStores` は7ストアを初期化し、テストが各ストアの初期値を固定している。
  web/src/app/review-stores.ts, web/tests/review-stores.test.ts
- `realtime-dispatch.ts` は `default: msg satisfies never` で未処理の型をコンパイル時に検出する。
  066 で `case "object:visibility": case "object:added": break;` の **no-op** が入っており、
  `welcome.hiddenObjectIds` は読んでいない。本タスクでこれを実処理へ置き換える。
  `web/tests/realtime-dispatch.test.ts` の「新メッセージで何も変わらない」テストも本タスクの振る舞いへ書き換える
- 削除機能は無いので、number 最小の版(最初のアップロード)は常に存在し、後から変わらない
- `useGLTF(src, true, true, extend)` は src 単位でキャッシュされる。同じ src の再マウントは再取得しない

## インターフェイス契約

```ts
// web/src/store/objects.ts
import type { ModelVersion } from "@shared/types";

export interface ObjectsStoreState {
  /** シーンのオブジェクト。number 昇順。要素は複製して保持 */
  objects: ModelVersion[];
  /** 非表示の versionId。追加順。objects に無い id も保持してよい */
  hiddenIds: string[];
  /** 全置換。number 昇順に並べ替えて複製。hiddenIds は維持する */
  setObjects(versions: readonly ModelVersion[]): void;
  /** 追加。同じ id が既にあれば何もしない。挿入後も number 昇順 */
  append(version: ModelVersion): void;
  /** visible=false なら hiddenIds に追加(既にあれば変化なし)、true なら除去(無ければ変化なし) */
  setVisible(versionId: string, visible: boolean): void;
  /** welcome の hiddenObjectIds で hiddenIds を全置換(重複除去、順序維持) */
  applyWelcome(hiddenIds: readonly string[]): void;
  reset(): void;
}

export const useObjectsStore: UseBoundStore<StoreApi<ObjectsStoreState>>;

/** hiddenIds に含まれなければ true */
export function isObjectVisible(hiddenIds: readonly string[], versionId: string): boolean;

/** number 最小のオブジェクトの id。空なら null。Fit・モデルサイズ・再生クリップの基準になる */
export function primaryObjectId(objects: readonly ModelVersion[]): string | null;
```

```tsx
// web/src/features/viewer/ViewerCanvas.tsx
/** objects ストアを購読し、全オブジェクトを1つの group に描画する。group を setModelTarget に登録する */
export function ViewerCanvas({ children }: { children?: ReactNode }): ReactElement;
// 内部構造:
//   <Bounds fit={false} clip>
//     <CameraRig />
//     <group ref={registerModelTarget}>
//       {objects.map((v) => (
//         <Suspense key={v.id} fallback={null}>
//           <ModelMesh src={modelUrl(v.projectId, v.id)} visible={isObjectVisible(hiddenIds, v.id)} primary={v.id === primaryId} />
//         </Suspense>
//       ))}
//     </group>
//     <PlaybackClock />
//     {children}
//   </Bounds>

// web/src/features/viewer/ModelMesh.tsx
/**
 * useGLTF でロードして <primitive object={scene} visible={visible} /> を描画する。
 * setModelTarget は呼ばない(group が担う)。
 * primary のときだけ: 箱から setModelSize、requestFit、setClips(cleanup で setClips([]))。
 * animations があれば primary でなくても PlaybackRig を置く(ストアの clipIndex/time を自分の mixer に適用)。
 */
export function ModelMesh({ src, visible, primary }: { src: string; visible: boolean; primary: boolean }): ReactElement;

// web/src/features/viewer/PlaybackClock.tsx
/** 毎フレーム、playing なら seek(advanceTime(time, delta, currentDuration(clips, clipIndex))) を1回だけ行う描画なしの部品。Canvas に1つだけ置く */
export function PlaybackClock(): null;

// web/src/features/viewer/PlaybackRig.tsx
/** ストアの clipIndex と time を driver.apply へ渡すだけ。時刻は進めない */
export function PlaybackRig({ root, clips }: { root: Object3D; clips: readonly AnimationClip[] }): null;
```

```ts
// web/src/features/viewer/pick.ts
/** object とその祖先すべての visible が true なら true */
export function isVisibleInScene(object: Object3D): boolean;

/** 交点のうち isVisibleInScene を満たす最初のものを使う。無ければ null。シグネチャは変えない */
export function pickModel(raycaster: Raycaster, camera: Camera, ndc: Ndc, target: Object3D | null): PickHit | null;
```

`realtime-dispatch.ts`:
- `welcome`: 既存処理に加えて `objects.applyWelcome(msg.hiddenObjectIds ?? [])`
- `object:visibility`: `objects.setVisible(msg.versionId, msg.visible)`
- `object:added`: `objects.append(msg.version)`

`review-stores.ts`: `useObjectsStore.getState().reset()` を追加(8ストア)。

`ReviewPage.tsx`:
- `getProject` 成功時、`setState` の前に `useObjectsStore.getState().setObjects(project.versions)`
- `ViewerCanvas` に `modelSrc` を渡さない。`const src = modelUrl(...)` を削除
- `ErrorBoundary` の `key` は `projectId`
- `CommentComposer` の `versionId={state.project.latestVersion.id}` は**そのまま**

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `setObjects([v2, v1])`(number 2, 1) | `objects` が `[v1, v2]`。引数の配列と要素は複製されている |
| `setObjects` の前に `hiddenIds: ["v2"]` | `setObjects` 後も `hiddenIds` は `["v2"]` |
| `append(v3)`(number 3) | 末尾に追加 |
| `append(v1)` で同 id が存在 | state 変更なし(参照が同じ) |
| `append(v2)` で objects が `[v1, v3]` | `[v1, v2, v3]` |
| `setVisible("v1", false)` | `hiddenIds` が `["v1"]` |
| 再度 `setVisible("v1", false)` | state 変更なし |
| `setVisible("v1", true)` | `hiddenIds` が `[]` |
| `setVisible("nope", true)` | state 変更なし |
| `applyWelcome(["v2", "v1", "v2"])` | `hiddenIds` が `["v2", "v1"]` |
| `reset()` | `objects: []`, `hiddenIds: []` |
| `isObjectVisible(["v1"], "v1")` / `("v2")` | `false` / `true` |
| `primaryObjectId([v3, v1, v2])` / `([])` | `"v1"` / `null` |
| dispatch `welcome` に `hiddenObjectIds: ["v1"]` | objects ストアの `hiddenIds` が `["v1"]`。既存の session/presence/annotation/light の反映は変わらない |
| dispatch `welcome` に `hiddenObjectIds` なし | `hiddenIds` が `[]`(再接続で以前の非表示が残らない) |
| dispatch `object:visibility { versionId: "v1", visible: false }` | `hiddenIds` に `"v1"` |
| dispatch `object:added { version }` | `objects` に追加。同 id が既にあれば変化なし |
| `resetReviewStores()` | objects ストアも初期化される(テストで `setObjects` と `setVisible` 後に確認) |
| `pickModel` で手前の交点が `visible=false` のメッシュ、奥が可視メッシュ | 奥の交点を返す |
| 手前のメッシュ自体は visible でも親 group が `visible=false` | その交点は無視する |
| 可視な交点が1つもない | `null` |
| `isVisibleInScene` で祖先すべて visible | `true` |
| `ModelMesh` が `primary=false` | `setModelSize` / `requestFit` / `setClips` を呼ばない(ソース検査または driver 単位のテストで確認) |
| Canvas 内に `PlaybackClock` が1つ、`PlaybackRig` に時刻前進が無い | `PlaybackRig.tsx` のソースに `seek(` と `advanceTime(` が無く、`PlaybackClock.tsx` にある(ソース検査テスト) |
| `ViewerCanvas` | `modelSrc` prop を受け取らない。`ReviewPage.tsx` に `modelSrc=` が無い(ソース検査テスト) |

## やらないこと
- オブジェクト一覧 UI、表示切替ボタン、追加ボタン、`object:visibility` の送信(071)
- 可視性の localStorage 保存(ルーム共有値なので保存しない)
- Fit の範囲計算から非表示オブジェクトを除くこと(drei `Bounds.refresh` は `Box3.setFromObject` で
  非表示も含める。今回は許容する)
- 非 primary オブジェクトのクリップをタイムラインへ載せること(クリップ一覧は primary のものだけ)
- コメントの対象オブジェクト選択(引き続き `latestVersion` に紐づける)
- `model-target.ts` / `CameraRig.tsx` / `AnnotationLayer.tsx` / `CommentPickLayer.tsx` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] store_Summary.md(objects ストア、8ストア reset)、viewer_Summary.md(ViewerCanvas / ModelMesh / PlaybackClock / PlaybackRig / pick)、app_Summary.md(dispatch、review-stores、ReviewPage)を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
