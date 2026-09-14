---
id: 124
title: 再生対象オブジェクトを解決してタイムラインへ登録し、対象外のアニメーションを静止させる
feature: viewer
depends_on: [123]
owns: [web/src/features/viewer/playback-source.ts, web/src/features/viewer/playback-source-sync.ts, web/src/features/viewer/usePlaybackSource.ts, web/src/features/viewer/PlaybackSourceSync.tsx, web/src/features/viewer/PlaybackRig.tsx, web/src/features/viewer/playback-driver.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/useModelScene.ts, web/src/features/viewer/viewer_Summary.md, web/src/store/playback.ts, web/src/store/objects.ts, web/src/store/store_Summary.md, web/tests/playback-source.test.ts, web/tests/playback-source-sync.test.ts, web/tests/playback-driver.test.ts, web/tests/store-playback.test.ts, web/tests/pick.test.ts, web/tests/model-scene.test.ts]
reads: [web/src/features/trail/model-clips.ts, web/src/features/viewer/playback.ts, web/src/features/viewer/playback-frames.ts, web/src/features/viewer/PlaybackClock.tsx, web/src/store/display.ts, web/src/features/timeline/PlaybackTimeline.tsx, shared/src/protocol.ts, shared/src/types.ts, web/tests/trail-rig.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
現状、タイムラインのクリップは primary(number 最小)のモデルからしか登録されない(useModelScene.ts:42-46)。
そのためアニメーションの無い OBJ を先に読み込むと、後から「ファイルを追加」したアニメーション付きモデルが
再生できない。再生対象を「ルームで選ばれた版、無ければアニメーションを持つ number 最小の版」に変え、
対象以外のアニメーション付きモデルは初期ポーズで静止させる。

## 前提
- 全モデルの AnimationClip 配列は `useModelClipsStore` に versionId ごとに登録済み(アニメーション無しは空配列で登録)。
  web/src/features/trail/model-clips.ts
- `useObjectsStore` の `objects` は number 昇順(store_Summary.md:47)。`ModelVersion` は `id` / `number` / `fileName` を持つ
- 123 で `useDisplayStore` に `playbackSource: string | null` と `setPlaybackSource` が、
  `ClientMessage` に `{ type: "playback:source"; versionId: string }` が追加済み
- `usePlaybackStore.setClips(clips, fps)` は clipIndex / time を 0、playing を false に戻す(store/playback.ts:41-49)
- `PlaybackRig` は各モデルの `ModelScene` 内で `animations.length > 0` のときだけ描かれる(ModelMesh.tsx:41)。
  ModelScene は `versionId` を options として受け取っている
- three 0.186 の `AnimationMixer.stopAllAction()` は、参照が 0 になったバインディングの `restoreOriginalState()` を呼ぶ。
  つまり停止すると元の姿勢に戻る
- primary は Fit / モデルサイズの基準として今後も使う(useModelScene の 1 つ目の effect はそのまま)
- 既存のソース検査で本タスクにより壊れるもの(本タスクで直す):
  - `tests/model-scene.test.ts:66-89`: useModelScene に `"setClips"` が含まれること、`useEffect(` が 6 個であること
  - `tests/pick.test.ts:140-152`: primary ガード付き effect が 2 個で、うち 1 つが setClips を含むこと
- PlaybackTimeline は `clips.length === 0` のとき非表示(変更不要)

## インターフェイス契約

```ts
// web/src/features/viewer/playback-source.ts (純粋関数。ストアを参照しない)
import type { AnimationClip } from "three";
import type { ModelVersion } from "@shared/types";

type ClipRegistry = Readonly<Record<string, readonly AnimationClip[]>>;

/** objects のうち、clips に 1 つ以上のクリップが登録されている版を number 昇順で返す(同 number は入力順) */
export function animatedObjects(objects: readonly ModelVersion[], clips: ClipRegistry): ModelVersion[];

/**
 * preferredId が animatedObjects に含まれればそれを返す。
 * 含まれなければ animatedObjects の先頭の id、空なら null。
 */
export function resolvePlaybackSource(
  objects: readonly ModelVersion[],
  clips: ClipRegistry,
  preferredId: string | null,
): string | null;
```

```ts
// web/src/store/playback.ts
export interface PlaybackStoreState {
  ...
  /** 現在タイムラインに登録しているクリップの持ち主 versionId。未登録は null */
  sourceId: string | null;
  /** 既存の動作に加え sourceId を保存する。第3引数省略時は null */
  setClips(clips: readonly PlaybackClip[], fps?: number, sourceId?: string | null): void;
}
// 初期値・reset() の sourceId は null
```

```ts
// web/src/features/viewer/playback-source-sync.ts
import type { AnimationClip } from "three";
import type { ClientMessage } from "@shared/protocol";

/**
 * playback ストアを sourceId / clips に合わせる。
 * ストアの sourceId が同じで、clips の要約(clipSummaries)が name・duration とも一致するなら何もしない
 * (clipIndex / time を保つ)。それ以外は setClips(clipSummaries(clips), detectFps(clips), sourceId)。
 */
export function syncPlaybackClips(sourceId: string | null, clips: readonly AnimationClip[]): void;

/**
 * 利用者操作で再生対象を切り替える(125 のドロップダウンと 126 のコメント再現が呼ぶ)。
 * - versionId がアニメーション付きの版(objects ストア + model-clips ストアで animatedObjects に含まれる)でなければ何もせず false
 * - playback ストアの sourceId が既に versionId なら何もせず true(送信しない)
 * - それ以外: display.setPlaybackSource(versionId) → syncPlaybackClips(versionId, そのクリップ) → send({ type: "playback:source", versionId }) → true
 * ストア更新は同期で完了させる(呼び出し直後に selectClip / seekFrame してよい)
 */
export function switchPlaybackSource(versionId: string, send: (msg: ClientMessage) => boolean): boolean;
```

```ts
// web/src/features/viewer/usePlaybackSource.ts
/** objects / model-clips / display.playbackSource を購読し、useMemo で解決結果を返す */
export function usePlaybackSource(): {
  sourceId: string | null;
  /** sourceId のクリップ。null のときはモジュール定数の不変の空配列 */
  sourceClips: readonly AnimationClip[];
  /** animatedObjects の結果 */
  animated: readonly ModelVersion[];
};

// web/src/features/viewer/PlaybackSourceSync.tsx
/** Canvas に 1 つだけ置く描画なしの部品。useEffect([sourceId, sourceClips]) で syncPlaybackClips を呼ぶ */
export function PlaybackSourceSync(): null;
```

```ts
// web/src/features/viewer/playback-driver.ts
export interface PlaybackDriver {
  apply(clipIndex: number, time: number): void;
  /** 再生中の action を止めて元の姿勢へ戻す。既に止まっていれば何もしない。後から apply すれば再開できる */
  stop(): void;
  dispose(): void;
}

// web/src/features/viewer/PlaybackRig.tsx
export function PlaybackRig({ root, clips, versionId }: {
  root: Object3D; clips: readonly AnimationClip[]; versionId: string;
}): null;
// useFrame 内: playback ストアの sourceId === versionId なら apply(clipIndex, time)、そうでなければ stop()
```

- `ModelMesh.tsx`: `<PlaybackRig root={scene} clips={animations} versionId={options.versionId} />` のように versionId を渡す
- `ViewerCanvas.tsx`: `<PlaybackClock />` の直後に `<PlaybackSourceSync />` を 1 つ置く
- `useModelScene.ts`: `setClips` の effect と、それだけが使う import(usePlaybackStore / clipSummaries / detectFps)を削除する。
  `primary` の分割代入と Fit の effect は残す(useEffect は 5 個になる)
- `store/objects.ts:129` の `primaryObjectId` の doc コメントから「再生」を外す(「Fit、サイズ計測の基準」)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| animatedObjects: v1(clips 空), v2(1 clip), v3(未登録) | `[v2]` |
| animatedObjects: 入力が number 降順 [v3, v1] で両方 clip あり | `[v1, v3]` |
| resolve: v1 空, v2 clip, preferred null | "v2" |
| resolve: v1 clip, v2 clip, preferred "v2" | "v2" |
| resolve: v1 clip, v2 clip, preferred "v9"(存在しない) | "v1" |
| resolve: v1 clip, v2 空, preferred "v2"(クリップ無し) | "v1" |
| resolve: アニメーション付きが無い | null |
| syncPlaybackClips: ストア sourceId null → ("v2", [walk 3s]) | clips `[{walk,3}]`, sourceId "v2", clipIndex 0, time 0 |
| syncPlaybackClips: 同じ sourceId・同じ要約で、事前に selectClip / seek 済み | clipIndex / time が保たれる |
| syncPlaybackClips: 同じ sourceId だが要約が違う | setClips され time 0 |
| syncPlaybackClips(null, []) | clips 空, sourceId null |
| switchPlaybackSource("v2") で v2 がアニメーション付き・現 sourceId "v1" | true。display.playbackSource "v2"、playback sourceId "v2"、send が `{ type: "playback:source", versionId: "v2" }` で 1 回 |
| switchPlaybackSource("v1") で現 sourceId が "v1" | true。send されない。time 保持 |
| switchPlaybackSource("v3") で v3 がクリップ無し / 未登録 | false。ストアも send も変化なし |
| PlaybackSourceSync を実マウント: v1(空) 登録済み、後から v2(clip) を登録 | playback clips が v2 の要約になり sourceId "v2"(元の不具合の再現ケース) |
| PlaybackSourceSync: v1, v2 ともに clip あり、再生中に display.setPlaybackSource("v2") | sourceId "v2"、time 0 |
| PlaybackSourceSync: 基準の v2 を unregister、v3(clip) が残る | sourceId "v3" |
| PlaybackSourceSync: 全て unregister | clips 空、sourceId null |
| driver: apply(0, 0.5) 後に stop() | root.position が元の [0,0,0] |
| driver: stop() を 2 回 / apply 前に stop() | 例外なし |
| driver: stop() 後に apply(0, 1) | x ≈ 5(再開できる) |
| store: setClips(clips) (第3引数省略) | sourceId null。reset() でも null |
| model-scene.test / pick.test のソース検査 | useModelScene に `setClips` を含まない、useEffect 5 個、primary ガード付き effect は 1 個(setModelSize と requestFit() を含む)に更新 |
| ソース検査: ViewerCanvas | `<PlaybackSourceSync />` が 1 回、`<PlaybackClock />` より後 |

- PlaybackSourceSync の実マウントテストは `react-dom/client` の `createRoot` と `act` で行う(tests/model-scene.test.ts:91-111 と同じ方法)。
  Canvas は不要(ストアだけを使う部品)
- PlaybackRig の useFrame 分岐は Canvas 無しでは動かせないため、ソース検査で `stop()` と `sourceId` を参照していることだけ確認する

## やらないこと
- タイムラインのドロップダウン UI(125)
- コメントへの versionId 記録と再現時の切替(126)。`switchPlaybackSource` は定義とテストまで
- TrailRig の変更(軌跡対象が再生対象外でも今のまま)
- 表示・非表示(hiddenIds)を再生対象の判定に使うこと
- Fit / モデルサイズの基準(primary)の変更
- playback-driver の apply / dispose の既存挙動の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md / store_Summary.md が更新されている(primary がクリップ一覧の基準という記述を直す)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
