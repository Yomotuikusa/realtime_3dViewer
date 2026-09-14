---
id: 112
title: web にクリップのレジストリと軌跡サンプリングを作る
feature: trail
depends_on: []
owns: [web/src/features/trail/model-clips.ts, web/src/features/trail/trail-target.ts, web/src/features/trail/trail-sample.ts, web/src/features/trail/trail_Summary.md, web/web_Summary.md, web/src/features/viewer/useModelScene.ts, web/src/features/viewer/viewer_Summary.md, web/tests/model-clips.test.ts, web/tests/trail-target.test.ts, web/tests/trail-sample.test.ts, web/tests/model-scene.test.ts]
reads: [web/src/features/compare/model-scenes.ts, web/src/features/outliner/outliner-tree.ts, web/src/features/viewer/playback.ts, web/src/features/viewer/playback-frames.ts, web/src/features/viewer/playback-driver.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/mesh-display.ts, web/src/store/playback.ts, web/tests/compare-model-scenes.test.ts, web/tests/playback-driver.test.ts, shared/src/object-part.ts, shared/src/types.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
選択したボーンの軌跡を描くには、アニメーションの全フレームでのボーン位置が要る。
そのために必要な材料(クリップの取得口・共有鍵と Object3D の相互変換・サンプリング)を
純粋な部品として作る。描画は 113、UI は 114。

## 前提
- **`AnimationClip` 本体はどのストアにも無い。** `web/src/features/viewer/ModelMesh.tsx` が
  ローダから受け取り、`PlaybackRig` へ props で渡して閉じている。
  `web/src/store/playback.ts` が持つのは `clipSummaries` が作った `{ name, duration }` だけで、
  トラックを持たないためサンプリングには使えない。よってレジストリを新設する
- scene の取得口は既に `web/src/features/compare/model-scenes.ts` にあり、
  `useModelScenesStore` が `versionId → Object3D` を保持する。本タスクのクリップ用
  ストアはこれと同じ流儀(参照をそのまま持つ / 同じ参照の再登録では state を更新しない /
  同じ参照のときだけ unregister)で作る
- `useModelScene`(`web/src/features/viewer/useModelScene.ts`)は形式によらず共通の副作用を
  まとめる hook で、既に `useModelScenesStore.getState().register(versionId, scene)` を
  `useEffect` で行っている。クリップの登録もここへ足す
- **`web/tests/model-scene.test.ts` は `expect(sceneSource.match(/useEffect\(/g)).toHaveLength(5)` を
  検査している。** `useEffect` を 1 つ足すので、この数を 6 に直す。他の検査は残す
- 版内オブジェクトの共有鍵 `ObjectPath` は「版の scene ルートからの子インデックスを "/" で
  繋いだもの。ビューアが後付けした重ね描きは数えない。ルート自身は表せない」(設計書 §13.5)。
  `plainChildren` / `childPath` / `objectAtPath` が
  `web/src/features/outliner/outliner-tree.ts` にあり、重ね描き除外込みで実装済み。
  **path から Object3D を引く向きは既にあるが、Object3D から path を作る向きは無い**ので新設する
- 秒とフレームの変換 `timeOfFrame(frame, fps)` / `lastFrameOf(duration, fps)` は
  `web/src/features/viewer/playback-frames.ts` にある
- 再生は `web/src/features/viewer/playback-driver.ts` の `AnimationMixer` が
  `mixer.setTime(time)` で行っており、ミキサーはボーンの transform を直接書き換える。
  同じ root に別のミキサーを一時的に作って進めても、最後に元の時刻へ戻せば
  ポーズは復元される(`uncacheRoot` はミキサーごとに独立している)

## インターフェイス契約

### 新規 `web/src/features/trail/model-clips.ts`

```ts
import type { AnimationClip } from "three";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ModelClipsState {
  /** versionId → マウント中のモデルが持つ AnimationClip。参照をそのまま保持する(複製しない) */
  clips: Readonly<Record<string, readonly AnimationClip[]>>;
  /** 登録。同じ versionId に同じ配列参照が既にあれば state を更新しない */
  register(versionId: string, clips: readonly AnimationClip[]): void;
  /** 登録中の配列と同じ参照のときだけ削除する(別の配列が登録済みなら触らない) */
  unregister(versionId: string, clips: readonly AnimationClip[]): void;
  reset(): void;
}

export const useModelClipsStore: UseBoundStore<StoreApi<ModelClipsState>>;

/** versionId が null または未登録なら null。空配列は空配列のまま返す */
export function selectModelClips(
  clips: Readonly<Record<string, readonly AnimationClip[]>>,
  versionId: string | null,
): readonly AnimationClip[] | null;
```

### 新規 `web/src/features/trail/trail-target.ts`

```ts
import type { Object3D } from "three";
import type { ObjectPartRef } from "@shared/types";

export interface ResolvedTrailTarget {
  versionId: string;
  /** scenes に登録されている版の scene ルート */
  root: Object3D;
  /** target.objectPath が指すオブジェクト */
  object: Object3D;
}

/**
 * object から親をたどって scenes に登録された root を探し、
 * root からの子インデックス(重ね描きを数えない)を繋いだ ObjectPartRef を返す。
 * root に届かない、object が root 自身(path が空になる)、
 * 途中の段が親の plainChildren に見つからない場合は null。
 */
export function objectPartRefOf(
  scenes: Readonly<Record<string, Object3D>>,
  object: Object3D,
): ObjectPartRef | null;

/** target が null、版が未登録、path が解決できないときは null */
export function resolveTrailTarget(
  scenes: Readonly<Record<string, Object3D>>,
  target: ObjectPartRef | null,
): ResolvedTrailTarget | null;
```

### 新規 `web/src/features/trail/trail-sample.ts`

```ts
import type { AnimationClip, Object3D } from "three";

/** 1 本の軌跡としてサンプリングする最大フレーム数 */
export const MAX_TRAIL_FRAMES = 2000;

export interface TrailSample {
  /** フレーム i の root ローカル座標が [i*3, i*3+1, i*3+2]。長さは frameCount * 3 */
  positions: Float32Array;
  /** サンプリングしたフレーム数。1 以上 MAX_TRAIL_FRAMES 以下 */
  frameCount: number;
}

/**
 * clip を 0 フレームから最終フレームまで fps 刻みで進めながら、
 * object のワールド位置を root ローカルへ直して集める。
 *
 * frameCount は lastFrameOf(clip.duration, fps) + 1 を 1〜MAX_TRAIL_FRAMES へ丸めた値。
 * clip.duration が 0 以下、fps が 0 以下または非有限なら frameCount は 1。
 *
 * 専用の AnimationMixer を root に作って進め、最後に currentTime のポーズへ戻してから
 * stopAllAction と uncacheRoot で破棄する。呼び出しの前後で root のポーズは変わらない。
 */
export function sampleTrail(
  root: Object3D,
  object: Object3D,
  clip: AnimationClip,
  fps: number,
  currentTime: number,
): TrailSample;
```

各フレームで `mixer.setTime(timeOfFrame(frame, fps))` の後に
`root.updateMatrixWorld(true)` を呼び、`object.matrixWorld` の平行移動成分を
`root.matrixWorld` の逆行列で root ローカルへ変換する。

### `web/src/features/viewer/useModelScene.ts`(既存へ `useEffect` を 1 つ追加)

```ts
useEffect(() => {
  useModelClipsStore.getState().register(versionId, animations);
  return () => useModelClipsStore.getState().unregister(versionId, animations);
}, [animations, versionId]);
```

`primary` に関係なく全版のクリップを登録する(軌跡の対象は primary の版とは限らない)。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `register("v1", clips)` | `clips["v1"]` が同じ配列参照になる |
| 同じ versionId へ同じ配列参照を再 `register` | state が更新されず購読者へ通知されない |
| 同じ versionId へ別の配列を `register` | 後から登録した配列に置き換わる |
| `unregister("v1", clips)` 登録中と同じ参照 | 鍵が消える |
| `unregister("v1", other)` 別の参照 | 何も起きない(登録は残る) |
| `unregister` 未登録の versionId | 何も起きない |
| `reset()` | `clips` が `{}` になる |
| `selectModelClips(clips, null)` | null |
| `selectModelClips(clips, "未登録")` | null |
| `selectModelClips(clips, "v1")` 空配列を登録済み | 空配列(null ではない) |
| `objectPartRefOf`: root 直下の 2 番目の子 | `{ versionId, objectPath: "1" }` |
| `objectPartRefOf`: 孫・ひ孫 | `"0/2/1"` のように連結される |
| `objectPartRefOf`: root 自身 | null |
| `objectPartRefOf`: scenes に無い木のオブジェクト | null |
| `objectPartRefOf`: 途中にビューア重ね描きの兄弟がある | 重ね描きを数えない添字になる |
| `objectPartRefOf`: 対象自身が重ね描き | null |
| `resolveTrailTarget(scenes, null)` | null |
| `resolveTrailTarget`: 版が未登録 | null |
| `resolveTrailTarget`: path が範囲外 | null |
| `resolveTrailTarget`: 正常 | `{ versionId, root, object }` で object が `objectAtPath` と同じ参照 |
| `objectPartRefOf` → `resolveTrailTarget` の往復 | 同じ Object3D に戻る |
| `sampleTrail`: duration 1 秒・fps 24 | `frameCount === 25`、`positions.length === 75` |
| `sampleTrail`: duration 0 | `frameCount === 1` |
| `sampleTrail`: fps 0 / NaN | `frameCount === 1` |
| `sampleTrail`: 打ち切りに掛かる長さ | `frameCount === MAX_TRAIL_FRAMES` |
| `sampleTrail`: x が 0→1 へ動くトラック | フレーム 0 が x=0、最終フレームが x=1、中間が単調に増える |
| `sampleTrail`: root が移動・回転している | 位置が root ローカルへ変換されている |
| `sampleTrail` の呼び出し前後 | object の `matrixWorld` が `currentTime` のポーズと一致する(元へ戻る) |
| `sampleTrail` を同じ root へ 2 回 | 2 回目も同じ結果(ミキサーが残っていない) |
| `useModelScene` をマウント | クリップが登録され、アンマウントで外れる |
| `useModelScene` の `useEffect` の数 | 6 |

## やらないこと
- `web/src/features/viewer/ModelMesh.tsx` の変更。`model-scene.test.ts` は
  ModelMesh がストアを知らないことを検査しており、登録は `useModelScene` 側に置く
- `web/src/store/playback.ts` の変更。`PlaybackClip` の要約はそのまま使う
- `web/src/features/viewer/playback-driver.ts` と `PlaybackRig.tsx` の変更。
  サンプリングは専用のミキサーを作り、再生用ミキサーには触らない
- `web/src/features/outliner/outliner-tree.ts` の変更。`plainChildren` / `childPath` /
  `objectAtPath` は import して使うだけにする
- `web/src/app/review-stores.ts` への追加。`model-clips` は `model-scenes` と同じく
  コンポーネントのアンマウントで解除されるため、reset 対象に入れない
- 軌跡の three オブジェクト、Rig、HUD(113 / 114)
- `MotionTrail` 型への依存。本タスクは `ObjectPartRef` だけを使い、110 に依存しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] trail_Summary.md を新規作成し、web_Summary.md の索引と viewer_Summary.md を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
