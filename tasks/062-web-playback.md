---
id: 062
title: web モデル内蔵アニメーションのローカル再生(再生・一時停止・クリップ選択・シーク)
feature: web
depends_on: []
owns: [web/src/store/playback.ts, web/src/features/viewer/playback.ts, web/src/features/viewer/playback-driver.ts, web/src/features/viewer/PlaybackRig.tsx, web/src/features/viewer/PlaybackMenu.tsx, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/src/store/store_Summary.md, web/src/app/review-stores.ts, web/src/app/app_Summary.md, web/tests/store-playback.test.ts, web/tests/playback.test.ts, web/tests/playback-driver.test.ts, web/tests/hud-menu.test.ts, web/tests/hud-labels.test.ts, web/tests/review-stores.test.ts]
reads: [web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/FocalLengthSlider.tsx, web/src/features/viewer/CameraRig.tsx, web/src/store/lighting.ts, web/src/styles/controls.css, web/web_Summary.md, web/tests/store-lighting.test.ts, web/tests/pick.test.ts, web/tests/summary-coverage.test.ts, web/tests/styles-rules.test.ts, web/tests/viewer-styles.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
glTF に内蔵されたアニメーション(`AnimationClip`)を、ビューア上で再生・一時停止・
クリップ選択・シークできるようにする。将来の FBX 対応(サーバ側で glTF へ変換し、
ビューアは glTF のまま)でも、この再生機構をそのまま使う。

このタスクは **自分の画面だけ** で再生する。再生状態のルーム共有(WebSocket)は別タスク。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### モデルのロードとキャンバス
- `ModelMesh` は drei の `useGLTF` でロードし、戻り値の `scene` だけを使っている。
  戻り値の型は `GLTF & ObjectMap` で、**`animations: AnimationClip[]` が既に含まれる**
  (three-stdlib の `GLTFLoader.d.ts:26`)。web/src/features/viewer/ModelMesh.tsx:9-11, 25
- `useGLTF` は同じ URL の結果をキャッシュするため、`scene` と `animations` の参照は
  再レンダーをまたいで安定している。`useEffect` の依存配列に入れてよい
- `ModelMesh` は `ViewerCanvas` の `<Suspense><Bounds fit={false} clip>` の中に置かれている。
  web/src/features/viewer/ViewerCanvas.tsx:20-25。`null` を返すコンポーネントを
  同じ場所に足しても Bounds の計算には影響しない(`FocalLengthRig` / `CameraRig` が既にそうしている)
- `@react-three/fiber` の `useFrame((state, delta) => ...)` の `delta` は**秒**である
  (`RenderCallback = (state: RootState, delta: number, frame?: XRFrame) => void`)。
  `CameraRig` が `useFrame` を使っている。web/src/features/viewer/CameraRig.tsx:82

### three の AnimationMixer を WebGL なしで動かせる(計画時に実測済み)
vitest(jsdom)で three をそのまま import できる(`web/tests/pick.test.ts:2` が `Mesh` / `Raycaster` を
使っている)。次のコードを node で実行し、**`mixer.setTime(t)` が絶対時刻 t のポーズを root に
適用し、クリップ長を超えた t は折り返す**ことを確認してある。

```ts
import { AnimationClip, AnimationMixer, LoopRepeat, Object3D, VectorKeyframeTrack } from "three";
const root = new Object3D();
root.name = "root";
const slide = new AnimationClip("slide", 2, [
  new VectorKeyframeTrack("root.position", [0, 2], [0, 0, 0, 10, 0, 0]),
]);
const mixer = new AnimationMixer(root);
const action = mixer.clipAction(slide);
action.setLoop(LoopRepeat, Infinity);
action.play();
mixer.setTime(0.5);   // root.position.x === 2.5
mixer.setTime(2);     // root.position.x === 0   (折り返し)
mixer.setTime(3.9);   // root.position.x === 9.5
action.stop();        // 別クリップへ切り替えるときは前の action を止めてから
const jump = new AnimationClip("jump", 1, [
  new VectorKeyframeTrack("root.position", [0, 1], [0, 0, 0, 0, 5, 0]),
]);
mixer.clipAction(jump).play();
mixer.setTime(0.5);   // root.position は [0, 2.5, 0](slide の寄与は消えている)
```

`mixer.setTime(t)` は「全 action の時刻を 0 に戻してから t 秒進める」実装なので、
毎フレーム呼んでも累積誤差が出ない。**drei の `useAnimations` は使わない**(テストできないため)。

### HUD
- 右上のメニューは `HudMenu({ id, open, onToggle, onClose, children })` で描き、
  `ViewerHud` が `openMenu: HudMenuId | null` のローカル state で**同時に 1 つだけ**開く。
  web/src/features/viewer/ViewerHud.tsx:38, 58-67。アニメーションメニューを開くとカメラメニューは閉じる。これは仕様として受け入れる
- `hud-menu.ts` は `HudMenuId = "camera"` だけを持ち、`web/tests/hud-menu.test.ts:10-13` が
  `HUD_MENU_ORDER` と `HUD_MENU_LABELS` を **`toEqual` で完全一致**検査している。
  id を足したらこのテストも更新する
- `.hud-menus` は `display: flex; margin-left: auto` で、子は左から順に並ぶ。
  web/src/features/viewer/viewer.css:33-37
- メニューの中身の書き方は `CameraMenu.tsx`(`.hud-menu__section` で区切る)と
  `FocalLengthSlider.tsx`(`label` + `output` の頭行と `input[type=range]`)に倣う
- `.btn` / `.input` は web/src/styles/controls.css の共通クラス。`.input` は `select` にも使える
  (padding / border / background だけを定義している。controls.css:56-61)
- ラベル文言はすべて `hud-labels.ts` に置く慣例。`web/tests/hud-labels.test.ts` は既存定数を
  個別に検査しているだけなので、定数を足しても既存テストは壊れない

### ストア
- ストアの書き方は `web/src/store/lighting.ts`(47行)に倣う。テストは
  `web/tests/store-lighting.test.ts` の形(`beforeEach` で `reset()`)
- `resetReviewStores()` は 6 ストアを列挙している。web/src/app/review-stores.ts:8-16。
  `web/tests/review-stores.test.ts` と `web/src/app/app_Summary.md` に「6」という数が書かれている
- `tsconfig.base.json` は `noUncheckedIndexedAccess: true`。`clips[clipIndex]` は
  `PlaybackClip | undefined` になる

### テストと検証の制約
- web のテストは jsdom で `@testing-library` がない。**React コンポーネント・フックはテストできない**。
  検証できるのは純粋関数・ストア・three のオブジェクト操作だけ
- `web/tests/summary-coverage.test.ts` が、src の全ファイル(.ts/.tsx/.css)が最寄りの `_Summary.md` に
  相対パスで載っていること、`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に
  載っていることを機械的に検査する。**新しいファイルを足したら Summary にも書くこと**
- `web/tests/styles-rules.test.ts` が、tokens.css 以外の生色禁止、参照する CSS 変数が `:root` で
  定義済みであること、`!important` / `@import` 禁止を検査する
- 現在の行数: viewer.css 225、hud-labels.ts 93、ViewerHud.tsx 84、hud-labels.test.ts 110、
  viewer_Summary.md 130。上限 300 に対して余裕はあるが、viewer.css には 40 行以上足さない

## インターフェイス契約

### 新規 web/src/features/viewer/playback.ts(純粋関数。React / zustand に依存しない)

```ts
import type { AnimationClip } from "three";

/** HUD とストアが扱うクリップの要約。AnimationClip 本体は持たない */
export interface PlaybackClip {
  name: string;
  /** 秒。有限で正でなければ 0 */
  duration: number;
}

/** AnimationClip の名前と長さだけを取り出す。名前が "" なら "Clip N"(N は 1 始まりの添字)。 */
export function clipSummaries(clips: readonly AnimationClip[]): PlaybackClip[];

/** 選択中クリップの長さ。添字が範囲外なら 0 */
export function currentDuration(clips: readonly PlaybackClip[], clipIndex: number): number;

/** time を [0, duration] に丸める。time が非有限・負なら 0。duration が非有限か 0 以下なら 0 */
export function clampTime(time: number, duration: number): number;

/**
 * 再生中の 1 フレーム分の前進。戻り値は [0, duration) に折り返す(duration ちょうどにはならない)。
 * deltaSeconds が非有限か負なら time をそのまま返す。duration が非有限か 0 以下なら 0
 */
export function advanceTime(time: number, deltaSeconds: number, duration: number): number;
```

### 変更 web/src/features/viewer/hud-labels.ts

`OVERLAY_LABEL`(:32)の後に定数を、`focalLengthText`(:41-43)の後に関数を足す。

```ts
export const PLAY_LABEL = "再生";
export const PAUSE_LABEL = "一時停止";
/** クリップ選択 select の label */
export const CLIP_LABEL = "クリップ";
/** シークバー(input[type=range])の label */
export const PLAYBACK_TIME_LABEL = "時刻";

/** シークバー横の現在値表示。小数 2 桁の秒。例: "1.25 / 3.00 s" */
export function playbackTimeText(time: number, duration: number): string;
```

### 変更 web/src/features/viewer/hud-menu.ts

```ts
export type HudMenuId = "playback" | "camera";
/** 右上に並べる順。playback はモデルにクリップがあるときだけ描かれ、camera は常に右端に来る */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["playback", "camera"];
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = {
  playback: "アニメーション",
  camera: "カメラ",
};
```

`HUD_MENU_INITIAL` は `"camera"` のまま。`toggleHudMenu` は変更しない。

### 新規 web/src/store/playback.ts

```ts
import { create } from "zustand";
import type { PlaybackClip } from "../features/viewer/playback";

export interface PlaybackStoreState {
  /** ロード中モデルのクリップ一覧。持たないモデルでは [] */
  clips: PlaybackClip[];
  /** 選択中クリップの添字。clips が [] のときは 0 */
  clipIndex: number;
  playing: boolean;
  /** 選択中クリップ内の現在時刻(秒)。常に [0, currentDuration] */
  time: number;

  /** clips を要素ごと複製して保持し、clipIndex 0・playing false・time 0 に戻す */
  setClips(clips: readonly PlaybackClip[]): void;
  /** 0 以上 clips.length 未満の整数だけ受け付け、time を 0 にする(同じ添字でも)。playing は維持 */
  selectClip(index: number): void;
  /** clips が [] なら何もしない */
  play(): void;
  pause(): void;
  /** playing を反転する。clips が [] なら false のまま */
  toggle(): void;
  /** clampTime(time, currentDuration(clips, clipIndex)) を time にする。playing は維持。Rig の毎フレーム更新もこれを使う */
  seek(time: number): void;
  /** 全 state を初期値へ戻す */
  reset(): void;
}

export const usePlaybackStore: /* zustand の create<PlaybackStoreState> の戻り値 */;
```

### 新規 web/src/features/viewer/playback-driver.ts(React に依存しない)

```ts
import type { AnimationClip, Object3D } from "three";

export interface PlaybackDriver {
  /**
   * clips[clipIndex] だけを再生対象にし、time 秒のポーズを root に適用する。
   * clipIndex が変わったら前の action を stop() してから新しい clipAction を LoopRepeat で play() する。
   * 適用は mixer.setTime(time)。clipIndex が範囲外、または dispose 済みなら何もしない
   */
  apply(clipIndex: number, time: number): void;
  /** mixer.stopAllAction() と mixer.uncacheRoot(root)。二重に呼んでも例外にしない */
  dispose(): void;
}

export function createPlaybackDriver(root: Object3D, clips: readonly AnimationClip[]): PlaybackDriver;
```

### 新規 web/src/features/viewer/PlaybackRig.tsx

```tsx
import type { AnimationClip, Object3D } from "three";

/**
 * 描画なし(null を返す)。
 * - useEffect([root, clips]): createPlaybackDriver を作り、cleanup で dispose()
 * - useFrame((_, delta)): usePlaybackStore.getState() を読み、
 *     playing なら seek(advanceTime(time, delta, currentDuration(clips, clipIndex)))
 *     その後(更新後の state で)driver.apply(clipIndex, time)
 *   毎フレーム apply する(一時停止中も)。useGLTF がキャッシュした scene のポーズを、ストアの時刻に常に一致させるため
 */
export function PlaybackRig({ root, clips }: { root: Object3D; clips: readonly AnimationClip[] }): null;
```

### 変更 web/src/features/viewer/ModelMesh.tsx

```tsx
const { scene, animations } = useGLTF(src, true, true, (loader) => { /* 既存のまま */ });

// 既存の useEffect([scene]) は変更しない。次の useEffect を足す
useEffect(() => {
  usePlaybackStore.getState().setClips(clipSummaries(animations));
  return () => usePlaybackStore.getState().setClips([]);
}, [animations]);

return (
  <>
    <primitive object={scene} />
    {animations.length > 0 && <PlaybackRig root={scene} clips={animations} />}
  </>
);
```

### 新規 web/src/features/viewer/PlaybackMenu.tsx

```tsx
/**
 * アニメーションメニューの中身。2 つの .hud-menu__section を上から
 * 1. クリップ選択
 *    <div className="hud-playback" role="group" aria-label={CLIP_LABEL}>
 *      <label htmlFor="hud-playback-clip">{CLIP_LABEL}</label>
 *      <select id="hud-playback-clip" className="input hud-playback__clip" value={clipIndex}
 *              onChange={(e) => selectClip(Number(e.target.value))}>
 *        {clips.map((clip, index) => <option key={index} value={index}>{clip.name}</option>)}
 *      </select>
 *    </div>
 *    クリップが 1 つでも表示する。
 * 2. 再生制御
 *    <div className="hud-playback" role="group" aria-label={PLAYBACK_TIME_LABEL}>
 *      <div className="hud-playback__head">
 *        <button className="btn hud-playback__toggle" type="button" onClick={toggle}>
 *          {playing ? PAUSE_LABEL : PLAY_LABEL}
 *        </button>
 *        <output className="hud-playback__time" htmlFor="hud-playback-time">
 *          {playbackTimeText(time, duration)}
 *        </output>
 *      </div>
 *      <input id="hud-playback-time" className="hud-playback__range" type="range"
 *             min={0} max={duration} step={0.01} value={time}
 *             aria-label={PLAYBACK_TIME_LABEL}
 *             onChange={(e) => seek(Number(e.target.value))} />
 *    </div>
 * duration は currentDuration(clips, clipIndex)。ボタンは aria-pressed を付けない(文言が変わるため)
 */
export function PlaybackMenu(): ReactElement;
```

`time` は再生中に毎フレーム更新される。ストアの購読は `PlaybackMenu` の中だけで行い、
`ViewerHud` には `time` を購読させない。

### 変更 web/src/features/viewer/ViewerHud.tsx

```tsx
const hasClips = usePlaybackStore((state) => state.clips.length > 0); // boolean セレクタ。time の更新で再描画しない

<div className="hud-menus">
  {hasClips && (
    <HudMenu
      id="playback"
      open={openMenu === "playback"}
      onToggle={() => setOpenMenu((open) => toggleHudMenu(open, "playback"))}
      onClose={() => setOpenMenu(null)}
    >
      <PlaybackMenu />
    </HudMenu>
  )}
  <HudMenu id="camera" /* 既存のまま */>
    <CameraMenu />
  </HudMenu>
</div>
```

### 変更 web/src/features/viewer/viewer.css

`.hud-views` / `.hud-view`(:123-133)の後に足す。生色は使わず、tokens.css の変数だけを使う。

```css
.hud-playback {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-1) 0;
  font-size: var(--text-sm);
}

.hud-playback__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}

.hud-playback__clip,
.hud-playback__range {
  width: 100%;
}

.hud-playback__toggle {
  box-shadow: var(--shadow-control);
}

.hud-playback__time {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
```

### 変更 web/src/app/review-stores.ts

`usePlaybackStore.getState().reset()` を末尾に足し、コメントとテスト・Summary の「6」を「7」にする。

## 振る舞い

### playback.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `clipSummaries([clip("walk", 2)])` | `[{ name: "walk", duration: 2 }]`。返す配列も要素も新しいオブジェクト |
| `clipSummaries([clip("", 1), clip("", 1)])` | 名前が `"Clip 1"`, `"Clip 2"` |
| `clipSummaries([clip("x", NaN)])`, `duration` が負 | `duration` は 0 |
| `clipSummaries([])` | `[]` |
| `currentDuration([{…, duration: 3}], 0)` | 3 |
| `currentDuration(clips, -1)` / 範囲外 / `[]` | 0 |
| `clampTime(1.5, 3)` | 1.5 |
| `clampTime(5, 3)` | 3 |
| `clampTime(-1, 3)`, `clampTime(NaN, 3)`, `clampTime(Infinity, 3)` | 0 |
| `clampTime(1, 0)`, `clampTime(1, NaN)` | 0 |
| `advanceTime(1, 0.5, 3)` | 1.5 |
| `advanceTime(2.8, 0.5, 3)` | 0.3(`toBeCloseTo`) |
| `advanceTime(2.5, 0.5, 3)` | 0(duration ちょうどにはならない) |
| `advanceTime(1, 7, 3)` | 2(delta がクリップ長を超えても剰余で折り返す) |
| `advanceTime(1, NaN, 3)`, `advanceTime(1, -1, 3)` | 1 |
| `advanceTime(1, 0.5, 0)` | 0 |

### hud-labels.ts / hud-menu.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `playbackTimeText(1.25, 3)` | `"1.25 / 3.00 s"` |
| `playbackTimeText(0, 0)` | `"0.00 / 0.00 s"` |
| `playbackTimeText(1.005, 2.5)` | `"1.00 / 2.50 s"`(`toFixed(2)`) |
| `PLAY_LABEL` / `PAUSE_LABEL` / `CLIP_LABEL` / `PLAYBACK_TIME_LABEL` | `"再生"` / `"一時停止"` / `"クリップ"` / `"時刻"` |
| `HUD_MENU_ORDER` | `["playback", "camera"]` |
| `HUD_MENU_LABELS` | `{ playback: "アニメーション", camera: "カメラ" }` |
| `HUD_MENU_INITIAL` | `"camera"` |
| `toggleHudMenu("camera", "playback")` | `"playback"` |
| `toggleHudMenu("playback", "playback")` | `null` |

### store/playback.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期状態 | `clips: []`, `clipIndex: 0`, `playing: false`, `time: 0` |
| `play(); seek(1); setClips([a, b])` | `clips` は `[a, b]` と `toEqual` だが `a` と同じ参照ではない。`clipIndex 0`, `playing false`, `time 0` |
| `setClips([])`(モデル解除) | 初期状態と同じ |
| `setClips([a, b]); play(); selectClip(1)` | `clipIndex 1`, `time 0`, `playing true` |
| `seek(1); selectClip(0)`(同じ添字) | `time 0` |
| `selectClip(2)`, `selectClip(-1)`, `selectClip(0.5)`, `selectClip(NaN)` | state を変更しない |
| `play()` (clips が `[]`) | `playing false` のまま |
| `setClips([a]); play()` | `playing true` |
| `pause()` | `playing false` |
| `toggle()` を 2 回(clips あり) | true → false |
| `toggle()`(clips が `[]`) | false のまま |
| `setClips([{ duration: 3 }]); play(); seek(1.5)` | `time 1.5`, `playing true` のまま |
| `seek(5)`(duration 3) | `time 3` |
| `seek(-1)`, `seek(NaN)` | `time 0` |
| `seek(1)`(clips が `[]`) | `time 0` |
| `reset()` | 初期状態 |

### playback-driver.ts(前提のコードと同じ `slide`(長さ 2)/ `jump`(長さ 1)クリップで検証する)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `apply(0, 0.5)` | `root.position.x` が 2.5 |
| `apply(0, 2)` | `root.position.x` が 0(折り返し) |
| `apply(0, 2.5)` | `root.position.x` が 2.5 |
| `apply(0, 0.5)` の後 `apply(1, 0.5)` | `root.position` が `[0, 2.5, 0]`(`slide` の寄与が消えている) |
| `apply(1, 0.5)` の後 `apply(0, 1)` | `root.position` が `[5, 0, 0]`(戻せる) |
| `apply(0, 0.5)` の後 `apply(2, 0.5)` / `apply(-1, 0.5)` | ポーズが変わらない(x は 2.5 のまま) |
| `dispose()` の後 `apply(0, 1)` | ポーズが変わらない |
| `dispose()` を 2 回 | 例外にならない |
| `createPlaybackDriver(root, [])` の `apply(0, 1)` | 何もしない、例外にならない |

### review-stores.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `usePlaybackStore` に `setClips([a]); play(); seek(1)` してから `resetReviewStores()` | playback ストアが初期状態(`clips: []`, `playing: false`, `time: 0`) |

### 画面(手動確認。テストは書けない)

| 状況 | 期待する結果 |
| --- | --- |
| クリップを持たないモデル | 右上に「カメラ」だけ。表示は現状と変わらない |
| クリップを持つモデルをロード | 「アニメーション」ボタンが「カメラ」の左に出る。モデルは時刻 0 のポーズで停止している |
| 「再生」を押す | モデルがループ再生され、ボタンが「一時停止」、時刻表示とシークバーが進む |
| シークバーをドラッグ | 再生中でも停止中でも、その時刻のポーズになる |
| クリップを切り替える | 時刻 0 から。再生中なら再生を続ける |
| 別プロジェクトへ遷移 | メニューが消え、ストアが初期化される |

## やらないこと
- 再生状態(クリップ・再生中・時刻)を WebSocket でルームへ送受信すること。`shared/` と `server/` は触らない
- ショートカットキー(Space など)の追加。`features/shortcuts/` は触らない
- 再生速度・逆再生・ループ方式の切り替え。LoopRepeat・1 倍速固定
- コメントのピンや表面ペンの線をアニメーションに追従させること。ピンは作成時のワールド座標に留まる(既知の制約として viewer_Summary.md に書く)
- Fit / モデルサイズの再計算。ロード時の箱のまま
- drei の `useAnimations` の利用
- `hud-menu.test.ts` の既存ケースの削除。`toEqual` の期待値を新しい値に更新し、playback のトグルケースを足す

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表(画面の表を除く)の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md / store_Summary.md / app_Summary.md に新規ファイル・新規テスト・「7 ストア」が反映されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
