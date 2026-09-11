---
id: 063
title: web アニメーション UI をビュー下部のフレーム基準タイムライン(先頭へ・再生/停止・最終へ・現在フレーム・fps)へ置き換える
feature: web
depends_on: []
owns: [web/src/features/timeline/PlaybackTimeline.tsx, web/src/features/timeline/TimelineRuler.tsx, web/src/features/timeline/transport-icons.tsx, web/src/features/timeline/timeline.ts, web/src/features/timeline/timeline-labels.ts, web/src/features/timeline/timeline.css, web/src/features/timeline/timeline_Summary.md, web/src/features/viewer/playback-frames.ts, web/src/features/viewer/PlaybackMenu.tsx, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/src/store/playback.ts, web/src/store/store_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/app/app_Summary.md, web/web_Summary.md, web/tests/playback-frames.test.ts, web/tests/timeline.test.ts, web/tests/timeline-labels.test.ts, web/tests/timeline-styles.test.ts, web/tests/store-playback.test.ts, web/tests/hud-menu.test.ts, web/tests/hud-labels.test.ts, web/tests/review-stores.test.ts]
reads: [web/src/features/viewer/playback.ts, web/src/features/viewer/playback-driver.ts, web/src/features/viewer/PlaybackRig.tsx, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/light-gizmo.ts, web/src/features/viewer/FocalLengthSlider.tsx, web/src/features/shortcuts/keymap.ts, web/src/features/shortcuts/useShortcuts.ts, web/src/app/review-stores.ts, web/src/styles/tokens.css, web/src/styles/controls.css, web/src/styles/base.css, web/tests/playback.test.ts, web/tests/playback-driver.test.ts, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
タスク 062 で右上メニューに入れた「時刻(秒)」基準の再生 UI を、Maya / Blender のような
**フレーム基準**のタイムラインに置き換える。タイムラインは 3D ビューの**直下**に、ビューの横幅
いっぱいの帯として置き、先頭へ・再生/停止・最終へ・現在フレーム・fps 選択をそこにドッキングする。
フレームレートは glTF のキーフレーム時刻から**ロード時に自動判定**し、ユーザーが変更できる。

このタスクも **自分の画面だけ** の再生である。ルーム共有は別タスク。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### 現在の再生機構(062 で実装済み。このタスクで変えない部分)
- ストアの真の値は **秒** の `time` である。`PlaybackRig` は毎フレーム `advanceTime` で `time` を進め、
  `driver.apply(clipIndex, time)` で `AnimationMixer.setTime` に渡す。web/src/features/viewer/PlaybackRig.tsx:21-28。
  フレームは表示と入力の単位であり、**ストアでは `time` から導出する**(`time` を置き換えない)
- `advanceTime` の戻り値は `[0, duration)` で、`seek` は `[0, duration]` に丸める。web/src/features/viewer/playback.ts:23-36
- `usePlaybackStore` の現在の形は web/src/store/playback.ts(63 行)。`setClips` は clips を複製し
  `clipIndex 0 / playing false / time 0` に戻す(:32-34)。`seek` は `clampTime(time, currentDuration(...))`(:55-58)
- `ModelMesh` は `useGLTF` の `animations`(`AnimationClip[]`)を `clipSummaries` で要約して
  `setClips` している。web/src/features/viewer/ModelMesh.tsx:28-31。`animations` の参照は再レンダーをまたいで安定
- `resetReviewStores()` は既に `usePlaybackStore.getState().reset()` を呼ぶ。web/src/app/review-stores.ts:17。
  **review-stores.ts は変更しない**(fps も `reset()` が戻せばよい)

### three の型と実測値
- 型は `@types/three`。`AnimationClip.tracks: Array<KeyframeTrack>`、`KeyframeTrack.times: Float32Array`
  (秒)。コンストラクタは `times: ArrayLike<number>` を受け取り Float32Array に変換する
- テストでクリップを作るときは `new AnimationClip("a", -1, [new NumberKeyframeTrack("root.opacity", times, values)])`
  で、`values.length === times.length`。`duration` に `-1` を渡すと tracks の最大時刻が duration になる
  (`AnimationClip.d.ts:97-98`)。`web/tests/playback-driver.test.ts` は `VectorKeyframeTrack` で同様に作っている
- float32 に丸めた `1/24`(0.041666667908…)に 24 を掛けると 1.00000003、`1/25` に 24 を掛けると 0.96 になる。
  後述の `FPS_TOLERANCE = 0.02` はこの差を見分けつつ、フレーム番号 10 万程度までの float32 誤差
  (0.01 フレーム未満)を許容する値として選んだ

### 画面のレイアウト
- レビュー画面は `.review-body` の 2 カラム(ビューア `minmax(0, 1fr)` とサイドパネル)で、
  ビューアは `section.review-viewer`(`position: relative; overflow: hidden`)。web/src/app/review.css:74-90
- HUD は `.review-hud`(`position: absolute; inset: 0; z-index: 1; pointer-events: none`)で、
  ボタン等だけ `pointer-events: auto` に戻している。web/src/app/review.css:92-105。
  操作ヒント `.hud-hint` は `bottom: var(--space-3)`、ライトギズモ `.light-gizmo` は右下 160px。
  web/src/features/viewer/viewer.css:205-225。Follow 中の枠 `.hud-follow-frame` は `inset: 0`(:168-173)。
  これらの絶対配置の基準は「最寄りの positioned 祖先」なので、**HUD と Canvas を包む positioned な
  箱(後述 `.review-stage`)を作れば、これらは 3D ビューの範囲に収まり、タイムラインの帯には重ならない**
- `JoinDialog` / `ShortcutSettings` は `.review-backdrop`(`position: absolute; inset: 0; z-index: 2`)で、
  `.review-viewer` 直下に置かれている。web/src/app/ReviewPage.tsx:140-141、review.css:107-114。
  これらはタイムラインも含めて覆ってよい(モーダル)
- `ViewerCanvas` の `<Canvas>` は inline style `{ width: "100%", height: "100%", minHeight: "36rem" }`。
  web/src/features/viewer/ViewerCanvas.tsx:15。`html, body, #root { height: 100% }`(base.css:7-11)と
  `.review-page { height: 100% }` により Canvas は親の高さで決まるので、`minHeight` は不要。
  **残すとウィンドウが低いとき下の帯が `overflow: hidden` で切れる**ため、このタスクで外す
- `.review-viewer` に `background: var(--color-surface-subtle)`、Canvas 背景は `#f5f7fa`(同じ色)

### HUD の現状(このタスクで取り除く部分)
- `HudMenuId = "playback" | "camera"`、`HUD_MENU_ORDER = ["playback", "camera"]`、
  `HUD_MENU_LABELS.playback = "アニメーション"`。web/src/features/viewer/hud-menu.ts:1-10。
  `web/tests/hud-menu.test.ts:10-13, 19-24` が `toEqual` 完全一致とトグル 4 ケースを検査している
- `ViewerHud` は `hasClips` を購読し `PlaybackMenu` を `HudMenu id="playback"` に入れている。
  web/src/features/viewer/ViewerHud.tsx:8, 13, 39, 62-71
- `hud-labels.ts` の `PLAY_LABEL` / `PAUSE_LABEL` / `CLIP_LABEL` / `PLAYBACK_TIME_LABEL`(:34-39)と
  `playbackTimeText`(:51-54)。`web/tests/hud-labels.test.ts:4, 17-20, 52-55, 74-78` が検査している
- `viewer.css` の `.hud-playback*` 5 ルール(:135-162)。`web/tests/viewer-styles.test.ts` は
  `.hud-playback` に触れていない(変更不要)。`.hud-hint` の `right: calc(160px + …)` は検査されている(:200-204)
- `web/tests/viewer-styles.test.ts:145-149` は `ViewerHud.tsx` のソーステキストに
  `useState<HudMenuId | null>(HUD_MENU_INITIAL)` があり `addEventListener` が無いことを検査する。維持する

### ショートカットとキー入力
- `useShortcuts` は `window` の keydown を拾うが、`isTypingTarget`(INPUT / TEXTAREA / SELECT /
  contenteditable)なら無視する。web/src/features/shortcuts/useShortcuts.ts:13-16、keymap.ts:137-145。
  タイムラインの `role="slider"` な div は無視されないが、既定 keymap に矢印キー・Home・End は無い
- `role="slider"` + `tabIndex={0}` + `aria-valuemin/max/now/valuetext` + `onKeyDown` の書き方は
  `LightGizmo.tsx:92-104` と `light-gizmo.ts:43-51`(`gizmoKeyDeltaX`)に倣う。
  inline SVG アイコンは `LightGizmo.tsx:122-125`(`viewBox="0 0 24 24" aria-hidden="true"`、`currentColor`)に倣う
- `ResizeObserver` はブラウザにはあるが jsdom には無い。コンポーネントはテストしないので、
  `typeof ResizeObserver === "undefined"` のガードだけ入れる

### ストア・スタイル・Summary の規約
- `tsconfig.base.json` は `noUncheckedIndexedAccess: true`
- `web/tests/styles-rules.test.ts` は `src/**/*.css` を全部走査する。tokens.css 以外の生色禁止、
  `var(--x)` は宣言かフォールバックが必要、`!important` / `@import` 禁止。**新しい CSS ファイルも対象**
- `web/tests/summary-coverage.test.ts`: src の全 .ts/.tsx/.css が最寄りの `_Summary.md` に相対パスで
  載っていること、`tests/*.test.ts` の全ファイル名がいずれかの Summary に載っていること、
  **各フォルダ Summary が `web/web_Summary.md` にパスで索引されていること**(:86-91)を検査する。
  新フォルダ `features/timeline/` を作るので `timeline_Summary.md` を書き、`web_Summary.md` の一覧(:17-23)に足す
- Summary の節構成は `web/web_Summary.md:13-15` のとおり
- 現在の行数: viewer.css 254、hud-labels.ts 104、ViewerHud.tsx 97、viewer_Summary.md 141、
  review.css 152、ReviewPage.tsx 153、store/playback.ts 63。**viewer.css には足さない**(`.hud-playback*` を消すだけ)。
  タイムラインの CSS は新規 `timeline.css` に書く

## インターフェイス契約

### 新規 web/src/features/viewer/playback-frames.ts(純粋関数。React / zustand に依存しない)

```ts
import type { AnimationClip } from "three";

/** 判定できないときのフレームレート。Maya / Blender の既定と同じ */
export const DEFAULT_FPS = 24;
export const MIN_FPS = 1;
export const MAX_FPS = 240;
/** 自動判定の候補。先に書いたものを優先する(12 は 24 に、15 は 30 に吸収される) */
export const FPS_CANDIDATES: readonly number[] = [24, 30, 25, 60, 50, 48, 120, 15, 12];
/** キー時刻 × fps が整数からこれ以下しかずれなければ、その fps に「乗っている」とみなす(単位: フレーム) */
export const FPS_TOLERANCE = 0.02;

/** 非有限なら DEFAULT_FPS。それ以外は [MIN_FPS, MAX_FPS] に丸める */
export function clampFps(fps: number): number;

/**
 * 全クリップの全トラックの times(有限値だけ)が、FPS_CANDIDATES の順に見て最初に
 * すべて整数フレームに乗る候補を返す。乗る候補が無ければ DEFAULT_FPS。
 * times が 1 つも無い(clips が []、tracks が []、全部非有限)なら DEFAULT_FPS(= 先頭候補が常に乗るため)
 */
export function detectFps(clips: readonly AnimationClip[]): number;

/** 秒 → フレーム番号。Math.round(time * fps)。time か fps が非有限なら 0 */
export function frameOfTime(time: number, fps: number): number;

/** フレーム番号 → 秒。frame / fps。frame が非有限、または fps が非有限か 0 以下なら 0 */
export function timeOfFrame(frame: number, fps: number): number;

/** クリップの最終フレーム番号。Math.max(0, Math.round(duration * fps))。非有限なら 0 */
export function lastFrameOf(duration: number, fps: number): number;
```

### 変更 web/src/store/playback.ts

```ts
export interface PlaybackStoreState {
  clips: PlaybackClip[];
  clipIndex: number;
  playing: boolean;
  /** 秒。真の値はこれ(変更なし) */
  time: number;
  /** 再生フレームレート。常に [MIN_FPS, MAX_FPS] の有限値。初期値 DEFAULT_FPS */
  fps: number;

  /** 従来どおり clips を複製して clipIndex 0・playing false・time 0 に戻し、fps を clampFps(fps ?? DEFAULT_FPS) にする */
  setClips(clips: readonly PlaybackClip[], fps?: number): void;
  selectClip(index: number): void;   // 変更なし
  play(): void;                       // 変更なし
  pause(): void;                      // 変更なし
  toggle(): void;                     // 変更なし
  seek(time: number): void;           // 変更なし
  /** seek(timeOfFrame(frame, fps))。frame が非有限なら何もしない */
  seekFrame(frame: number): void;
  /** 非有限なら何もしない。それ以外は clampFps(fps) を fps にする。time(秒)は変えない */
  setFps(fps: number): void;
  /** 全 state を初期値へ戻す(fps も DEFAULT_FPS) */
  reset(): void;
}
```

### 変更 web/src/features/viewer/ModelMesh.tsx

```tsx
// :28-31 の useEffect を次にする。他は変更しない
useEffect(() => {
  usePlaybackStore.getState().setClips(clipSummaries(animations), detectFps(animations));
  return () => usePlaybackStore.getState().setClips([]);
}, [animations]);
```

### 変更 web/src/features/viewer/ViewerCanvas.tsx

`style={{ width: "100%", height: "100%" }}` にする(`minHeight` を外す)。他は変更しない。

### 変更 web/src/features/viewer/hud-menu.ts / ViewerHud.tsx / hud-labels.ts / viewer.css / PlaybackMenu.tsx

```ts
export type HudMenuId = "camera";
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera"];
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = { camera: "カメラ" };
// HUD_MENU_INITIAL と toggleHudMenu は変更しない
```

- `ViewerHud.tsx`: `usePlaybackStore` / `PlaybackMenu` の import、`hasClips`、`HudMenu id="playback"` ブロック(:62-71)を削除。
  カメラメニュー・ギズモ・Follow・ヒントは変更しない
- `hud-labels.ts`: `PLAY_LABEL` / `PAUSE_LABEL` / `CLIP_LABEL` / `PLAYBACK_TIME_LABEL` / `playbackTimeText` を削除
  (`timeline-labels.ts` へ移す)。`web/tests/hud-labels.test.ts` から対応する import と期待値を消す
- `viewer.css`: `.hud-playback` / `.hud-playback__head` / `.hud-playback__clip, .hud-playback__range` /
  `.hud-playback__toggle` / `.hud-playback__time` の 5 ルールを削除。他のルールは変更しない
- `PlaybackMenu.tsx`: **ファイルごと削除**し、viewer_Summary.md から消す

### 新規 web/src/features/timeline/timeline-labels.ts

```ts
export const TIMELINE_LABEL = "タイムライン";
export const TRANSPORT_LABEL = "再生操作";
export const PLAY_LABEL = "再生";
export const PAUSE_LABEL = "一時停止";
export const GO_TO_START_LABEL = "先頭へ";
export const GO_TO_END_LABEL = "最終へ";
export const CLIP_LABEL = "クリップ";
export const FRAME_LABEL = "フレーム";
export const FPS_LABEL = "fps";

/** スライダーの aria-valuetext。例: "12 / 48" */
export function frameText(frame: number, lastFrame: number): string;
/** 現在フレーム入力の右に出す最終フレーム。例: "/ 48" */
export function lastFrameText(lastFrame: number): string;
```

### 新規 web/src/features/timeline/timeline.ts(純粋関数。React に依存しない)

```ts
/** 目盛り領域の左右の内側余白(px)。フレーム 0 と最終フレームはこの分だけ端から内側に置く */
export const TIMELINE_PAD_PX = 8;
/** フレーム番号ラベル同士の最小間隔(px) */
export const MIN_LABEL_PX = 48;
/** 目盛り線同士の最小間隔(px) */
export const MIN_TICK_PX = 5;
/** ラベル間隔の候補(フレーム)。先頭から順に MIN_LABEL_PX を満たす最初のものを使う */
export const STEP_SERIES: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
/** fps 選択肢。ストアの fps がこれに無いときは fpsOptions が加える */
export const FPS_OPTIONS: readonly number[] = [12, 15, 24, 25, 30, 48, 50, 60, 120];

export interface TimelineTicks {
  /** フレーム番号を書く間隔 */
  labelStep: number;
  /** 目盛り線の間隔。labelStep を割り切る */
  tickStep: number;
}

/**
 * pxPerFrame = (widthPx - 2 * TIMELINE_PAD_PX) / lastFrame。
 * lastFrame <= 0、または内側幅 <= 0 なら { labelStep: 1, tickStep: 1 }。
 * labelStep: STEP_SERIES で最初に step * pxPerFrame >= MIN_LABEL_PX を満たすもの。無ければ末尾(10000)。
 * tickStep: labelStep < 10 なら 1。それ以外は [labelStep / 10, labelStep / 5, labelStep] の順で
 *           最初に step * pxPerFrame >= MIN_TICK_PX を満たすもの(labelStep は必ず満たすとみなし、最後の受け皿)
 */
export function timelineTicks(lastFrame: number, widthPx: number): TimelineTicks;

/** 0, step, 2step, … のうち lastFrame 以下のもの。step <= 0 または lastFrame < 0 なら [0] */
export function tickFrames(lastFrame: number, step: number): number[];

/** フレーム → x(px)。TIMELINE_PAD_PX + frame / lastFrame * (widthPx - 2 * PAD)。lastFrame <= 0 なら PAD */
export function frameToX(frame: number, lastFrame: number, widthPx: number): number;

/** x(px) → フレーム。frameToX の逆を四捨五入し [0, lastFrame] に丸める。lastFrame <= 0 か内側幅 <= 0 なら 0 */
export function frameAtX(x: number, lastFrame: number, widthPx: number): number;

/**
 * キー操作後のフレーム。ArrowLeft / ArrowDown は -1、ArrowRight / ArrowUp は +1、Home は 0、End は lastFrame。
 * 結果は [0, lastFrame] に丸める。それ以外のキーは null
 */
export function timelineKeyFrame(key: string, frame: number, lastFrame: number): number | null;

/** FPS_OPTIONS に fps を加えて昇順・重複なしで返す(fps が既に含まれていれば FPS_OPTIONS と同じ内容の新しい配列) */
export function fpsOptions(fps: number): number[];
```

### 新規 web/src/features/timeline/transport-icons.tsx

4 つの 16×16 の inline SVG。すべて `viewBox="0 0 16 16" aria-hidden="true" focusable="false"`、
`fill="currentColor"`。文言は付けない(ボタン側の `aria-label` が担う)。

```tsx
export function PlayIcon(): ReactElement;       // <path d="M4 2.5v11l9-5.5z" />
export function PauseIcon(): ReactElement;      // <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />
export function SkipStartIcon(): ReactElement;  // <path d="M3 2.5h2v11H3zM13 2.5v11L6 8z" />
export function SkipEndIcon(): ReactElement;    // <path d="M11 2.5h2v11h-2zM3 2.5v11l7-5.5z" />
```

### 新規 web/src/features/timeline/TimelineRuler.tsx

```tsx
export const RULER_HEIGHT_PX = 32;

export interface TimelineRulerProps {
  frame: number;
  lastFrame: number;
  onSeek(frame: number): void;
}

/**
 * フレーム目盛り・フレーム番号・PlayHead を SVG で描き、ドラッグとキーでシークする。
 *
 * <div ref className="timeline__track" role="slider" tabIndex={0}
 *      aria-label={TIMELINE_LABEL} aria-valuemin={0} aria-valuemax={lastFrame}
 *      aria-valuenow={frame} aria-valuetext={frameText(frame, lastFrame)}
 *      onPointerDown onPointerMove onPointerUp onPointerCancel onKeyDown>
 *   {width > 0 && (
 *     <svg className="timeline__ruler" viewBox={`0 0 ${width} ${RULER_HEIGHT_PX}`} aria-hidden="true">
 *       目盛り: tickFrames(lastFrame, tickStep) の各 f に
 *         <line className="timeline__tick" x1=x x2=x y1={RULER_HEIGHT_PX - 6} y2={RULER_HEIGHT_PX} />
 *       ラベル: tickFrames(lastFrame, labelStep) の各 f に
 *         <line className="timeline__tick" x1=x x2=x y1={RULER_HEIGHT_PX - 12} y2={RULER_HEIGHT_PX} />
 *         <text className="timeline__label" x=x y={12}>{f}</text>
 *       PlayHead(最後に描いて最前面):
 *         <g className="timeline__playhead" transform={`translate(${frameToX(frame, lastFrame, width)} 0)`}>
 *           <path d="M-5 0h10l-5 6z" />
 *           <rect x={-1} y={0} width={2} height={RULER_HEIGHT_PX} />
 *         </g>
 *     </svg>
 *   )}
 * </div>
 *
 * - width は useState(0)。useLayoutEffect で ResizeObserver(あれば)を ref の要素に付け、
 *   contentRect.width を state に入れる。無ければ getBoundingClientRect().width を 1 回だけ入れる。cleanup で disconnect
 * - x は frameToX(f, lastFrame, width)。{ labelStep, tickStep } は timelineTicks(lastFrame, width)
 * - onPointerDown: event.button !== 0 なら無視。setPointerCapture(pointerId) し、
 *   onSeek(frameAtX(event.clientX - rect.left, lastFrame, width))(rect は currentTarget.getBoundingClientRect())
 * - onPointerMove: currentTarget.hasPointerCapture(pointerId) のときだけ同じ計算で onSeek
 * - onPointerUp / onPointerCancel: hasPointerCapture なら releasePointerCapture
 * - onKeyDown: timelineKeyFrame(event.key, frame, lastFrame) が非 null なら preventDefault して onSeek
 * - 再生中にドラッグしても playing は変えない(ストアの seek が playing を維持する)
 */
export function TimelineRuler(props: TimelineRulerProps): ReactElement;
```

### 新規 web/src/features/timeline/PlaybackTimeline.tsx

```tsx
/**
 * ビュー下部の帯。clips が [] なら null(帯ごと消える)。
 * ストアの購読はこのコンポーネント内だけで行う(time は再生中に毎フレーム変わる)。
 *
 * const duration = currentDuration(clips, clipIndex);
 * const lastFrame = lastFrameOf(duration, fps);
 * const frame = frameOfTime(time, fps);
 *
 * <div className="timeline" role="region" aria-label={TIMELINE_LABEL}>
 *   <TimelineRuler frame={frame} lastFrame={lastFrame} onSeek={seekFrame} />
 *   <div className="timeline__controls">
 *     <select className="input timeline__clip" aria-label={CLIP_LABEL} title={CLIP_LABEL}
 *             value={clipIndex} onChange={(e) => selectClip(Number(e.target.value))}>
 *       {clips.map((clip, index) => <option key={index} value={index}>{clip.name}</option>)}
 *     </select>
 *     <div className="timeline__transport" role="group" aria-label={TRANSPORT_LABEL}>
 *       <button className="btn timeline__btn" type="button" aria-label={GO_TO_START_LABEL} title={GO_TO_START_LABEL}
 *               onClick={() => seekFrame(0)}><SkipStartIcon /></button>
 *       <button className="btn timeline__btn" type="button"
 *               aria-label={playing ? PAUSE_LABEL : PLAY_LABEL} title={playing ? PAUSE_LABEL : PLAY_LABEL}
 *               onClick={toggle}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
 *       <button className="btn timeline__btn" type="button" aria-label={GO_TO_END_LABEL} title={GO_TO_END_LABEL}
 *               onClick={() => seekFrame(lastFrame)}><SkipEndIcon /></button>
 *     </div>
 *     <label className="timeline__field">
 *       <span>{FRAME_LABEL}</span>
 *       <input className="input timeline__frame" type="number" min={0} max={lastFrame} step={1}
 *              value={frame} onChange={(e) => seekFrame(Number(e.target.value))} />
 *       <output className="timeline__last">{lastFrameText(lastFrame)}</output>
 *     </label>
 *     <label className="timeline__field">
 *       <span>{FPS_LABEL}</span>
 *       <select className="input timeline__fps" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
 *         {fpsOptions(fps).map((value) => <option key={value} value={value}>{value}</option>)}
 *       </select>
 *     </label>
 *   </div>
 * </div>
 *
 * クリップ select はクリップが 1 つでも出す。再生ボタンは aria-pressed を付けない(文言が変わるため)。
 * import "./timeline.css" をこのファイルで行う
 */
export function PlaybackTimeline(): ReactElement | null;
```

### 新規 web/src/features/timeline/timeline.css

生色は使わず tokens.css の変数だけを使う。すべて `timeline` / `timeline__*` のクラス。

```css
.timeline {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3) var(--space-2);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: var(--text-sm);
}

.timeline__track {
  position: relative;
  width: 100%;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.timeline__track:focus-visible {
  outline: 2px solid var(--focus-ring-color);
  outline-offset: -2px;
}

.timeline__ruler {
  display: block;
  width: 100%;
  height: 100%;
}

.timeline__tick {
  stroke: var(--color-border-strong);
  stroke-width: 1;
}

.timeline__label {
  fill: var(--color-text-muted);
  font-size: var(--text-xs);
  text-anchor: middle;
}

.timeline__playhead {
  fill: var(--color-accent);
}

.timeline__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.timeline__transport {
  display: inline-flex;
  gap: var(--space-1);
  margin-inline: auto;
}

.timeline__btn {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  padding: 0;
  box-shadow: var(--shadow-control);
}

.timeline__btn svg {
  width: 16px;
  height: 16px;
}

.timeline__field {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.timeline__frame {
  width: 4.5rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.timeline__clip {
  max-width: 12rem;
}
```

`.timeline__track` の高さ 32px は `RULER_HEIGHT_PX` と同じ値。

### 変更 web/src/app/ReviewPage.tsx / review.css

```tsx
// :118-142 を次の構造にする。HUD と Canvas を .review-stage で包み、その下に帯を置く
<section className="review-viewer" aria-label="3D ビューア">
  <div className="review-stage">
    <div className="review-hud">
      <ViewerHud send={realtime.send} />
    </div>
    <ErrorBoundary key={src} fallback={/* 既存のまま */}>
      <ViewerCanvas modelSrc={src}>{/* 既存のまま */}</ViewerCanvas>
    </ErrorBoundary>
  </div>
  <PlaybackTimeline />
  {joinName === null && <JoinDialog onJoin={handleJoin} />}
  {settingsOpen && <ShortcutSettings onClose={() => setSettingsOpen(false)} />}
</section>
```

```css
/* .review-viewer(:84-90)を次にし、.review-stage を直後に足す。.review-hud 以下は変更しない */
.review-viewer {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--color-surface-subtle);
}

.review-stage {
  position: relative;
  min-height: 0;
  overflow: hidden;
}
```

### 新規 web/tests/timeline-styles.test.ts

`web/tests/viewer-styles.test.ts` の `ruleBody` と同じ読み方で、次をソーステキストとして検査する。

- review.css の `.review-viewer` に `display: grid` と `grid-template-rows: minmax(0, 1fr) auto` と `position: relative`
- review.css の `.review-stage` に `position: relative` と `overflow: hidden`
- ReviewPage.tsx に `className="review-stage"` があり、`<PlaybackTimeline />` の位置が `className="review-stage"` より後、`<JoinDialog` より前
- ReviewPage.tsx で `className="review-hud"` の位置が `className="review-stage"` より後
- ViewerCanvas.tsx に `minHeight` が無い
- ViewerHud.tsx に `PlaybackMenu` と `usePlaybackStore` が無い
- timeline.css の `.timeline__track` に `height: ${RULER_HEIGHT_PX}px`(`TimelineRuler.tsx` から import)と `touch-action: none`
- timeline.css の `.timeline__transport` に `margin-inline: auto`
- PlaybackTimeline.tsx に `import "./timeline.css"` がある
- viewer.css に `hud-playback` が無い

## 振る舞い

### playback-frames.ts(`clip(times)` は `NumberKeyframeTrack("root.opacity", times, times.map(() => 0))` 1 本の AnimationClip)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `clampFps(30)` | 30 |
| `clampFps(0)`, `clampFps(-5)` | 1(`MIN_FPS`) |
| `clampFps(1000)` | 240(`MAX_FPS`) |
| `clampFps(NaN)`, `clampFps(Infinity)` | 24(`DEFAULT_FPS`) |
| `detectFps([clip([0, 1/24, 2/24, 3/24])])` | 24 |
| `detectFps([clip([0, 1/30, 2/30])])` | 30 |
| `detectFps([clip([0, 1/25, 2/25])])` | 25 |
| `detectFps([clip([0, 1/60, 2/60])])` | 60 |
| `detectFps([clip([0, 1/50, 2/50])])` | 50 |
| `detectFps([clip([0, 1/48, 2/48])])` | 48 |
| `detectFps([clip([0, 1/120, 2/120])])` | 120 |
| `detectFps([clip([0, 1/12, 2/12])])` | 24(12 より 24 を優先) |
| `detectFps([clip([0, 1/15, 2/15])])` | 30(15 より 30 を優先) |
| `detectFps([clip([0, 0.5, 1])])`(どの候補にも乗る) | 24(先頭候補) |
| `detectFps([clip([0, 0.37])])`(どの候補にも乗らない) | 24(`DEFAULT_FPS`) |
| `detectFps([clip([0, 1/24]), clip([0, 1/30])])` | 120(1/24 = 5/120、1/30 = 4/120 なので両方に乗る最初の候補) |
| `detectFps([clip([0, 1/30]), clip([0, 2/30, 1])])` | 30 |
| `detectFps([])`, `detectFps([new AnimationClip("e", 1, [])])` | 24 |
| `detectFps([clip([0, 100/24])])`(float32 の 4.1666665) | 24(`FPS_TOLERANCE` 内) |
| `frameOfTime(1, 24)` | 24 |
| `frameOfTime(0.5, 30)` | 15 |
| `frameOfTime(1.99, 24)`(47.76) | 48 |
| `frameOfTime(NaN, 24)`, `frameOfTime(1, NaN)` | 0 |
| `timeOfFrame(12, 24)` | 0.5 |
| `timeOfFrame(0, 24)` | 0 |
| `timeOfFrame(NaN, 24)`, `timeOfFrame(12, 0)`, `timeOfFrame(12, NaN)` | 0 |
| `lastFrameOf(2, 24)` | 48 |
| `lastFrameOf(0.7, 24)`(16.8) | 17 |
| `lastFrameOf(0, 24)`, `lastFrameOf(NaN, 24)`, `lastFrameOf(2, NaN)` | 0 |

### store/playback.ts(既存テストは維持し、次を足す。`a = { name: "walk", duration: 2 }`)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期状態 | `fps` が 24 |
| `setClips([a])`(第 2 引数なし) | `fps` 24 |
| `setClips([a], 30)` | `fps` 30、`clipIndex 0`、`playing false`、`time 0` |
| `setClips([a], NaN)`, `setClips([a], 1000)` | `fps` 24 / 240 |
| `setFps(60); setClips([])` | `fps` 24(`setClips` は fps も既定に戻す) |
| `setClips([a], 24); seekFrame(12)` | `time` 0.5 |
| `seekFrame(100)`(duration 2、fps 24) | `time` 2(seek が丸める) |
| `seekFrame(-3)` | `time` 0 |
| `play(); seekFrame(6)` | `time` 0.25、`playing true` のまま |
| `seek(1); seekFrame(NaN)` | `time` 1 のまま |
| `setClips([a], 24); seek(1); setFps(30)` | `fps` 30、`time` 1 のまま |
| `setFps(0)`, `setFps(500)` | `fps` 1 / 240 |
| `setFps(NaN)`, `setFps(Infinity)` | `fps` を変更しない |
| `setClips([a], 60); play(); seek(1); reset()` | `clips []`、`playing false`、`time 0`、`fps 24` |
| `setClips([a], 30); play(); seek(1); resetReviewStores()`(既存 `web/tests/review-stores.test.ts` の `resetReviewStores` テストにある `usePlaybackStore` の期待値へ `fps: 24` を追加する) | `fps 24` を含む初期状態 |

### timeline.ts(`W = 816`(内側 800px))

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `timelineTicks(48, W)`(16.67px/フレーム) | `{ labelStep: 5, tickStep: 1 }` |
| `timelineTicks(240, W)`(3.33px) | `{ labelStep: 20, tickStep: 2 }` |
| `timelineTicks(1000, W)`(0.8px) | `{ labelStep: 100, tickStep: 10 }` |
| `timelineTicks(10000, W)`(0.08px) | `{ labelStep: 1000, tickStep: 100 }` |
| `timelineTicks(24, 216)`(8.33px) | `{ labelStep: 10, tickStep: 1 }` |
| `timelineTicks(10, W)`(80px) | `{ labelStep: 1, tickStep: 1 }` |
| `timelineTicks(1000000, W)`(0.0008px) | `{ labelStep: 10000, tickStep: 10000 }`(末尾の受け皿) |
| `timelineTicks(0, W)`, `timelineTicks(48, 10)`, `timelineTicks(48, 16)` | `{ labelStep: 1, tickStep: 1 }` |
| `tickFrames(48, 10)` | `[0, 10, 20, 30, 40]` |
| `tickFrames(50, 10)` | `[0, 10, 20, 30, 40, 50]` |
| `tickFrames(0, 10)`, `tickFrames(48, 0)`, `tickFrames(-1, 10)` | `[0]` |
| `frameToX(0, 48, W)` | 8 |
| `frameToX(24, 48, W)` | 408 |
| `frameToX(48, 48, W)` | 808 |
| `frameToX(5, 0, W)` | 8 |
| `frameAtX(408, 48, W)` | 24 |
| `frameAtX(8, 48, W)`, `frameAtX(0, 48, W)`, `frameAtX(-50, 48, W)` | 0 |
| `frameAtX(808, 48, W)`, `frameAtX(2000, 48, W)` | 48 |
| `frameAtX(417, 48, W)`(24.54 → 四捨五入) | 25 |
| `frameAtX(416, 48, W)`(24.48 → 四捨五入) | 24 |
| `frameAtX(100, 0, W)`, `frameAtX(100, 48, 16)` | 0 |
| `timelineKeyFrame("ArrowRight", 10, 48)` / `"ArrowUp"` | 11 |
| `timelineKeyFrame("ArrowLeft", 10, 48)` / `"ArrowDown"` | 9 |
| `timelineKeyFrame("ArrowLeft", 0, 48)` | 0 |
| `timelineKeyFrame("ArrowRight", 48, 48)` | 48 |
| `timelineKeyFrame("Home", 30, 48)` | 0 |
| `timelineKeyFrame("End", 30, 48)` | 48 |
| `timelineKeyFrame("Enter", 30, 48)`, `timelineKeyFrame(" ", 30, 48)` | null |
| `fpsOptions(24)` | `[12, 15, 24, 25, 30, 48, 50, 60, 120]`(`FPS_OPTIONS` と別の配列) |
| `fpsOptions(29.97)` | `[12, 15, 24, 25, 29.97, 30, 48, 50, 60, 120]` |
| `fpsOptions(240)` | 末尾が 240 |

### timeline-labels.ts / hud-menu.ts / hud-labels.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `frameText(12, 48)` | `"12 / 48"` |
| `frameText(0, 0)` | `"0 / 0"` |
| `lastFrameText(48)` | `"/ 48"` |
| 各ラベル定数 | `TIMELINE_LABEL "タイムライン"`、`TRANSPORT_LABEL "再生操作"`、`PLAY_LABEL "再生"`、`PAUSE_LABEL "一時停止"`、`GO_TO_START_LABEL "先頭へ"`、`GO_TO_END_LABEL "最終へ"`、`CLIP_LABEL "クリップ"`、`FRAME_LABEL "フレーム"`、`FPS_LABEL "fps"` |
| `HUD_MENU_ORDER` | `["camera"]` |
| `HUD_MENU_LABELS` | `{ camera: "カメラ" }` |
| `HUD_MENU_INITIAL` | `"camera"` |
| `toggleHudMenu(null, "camera")` / `toggleHudMenu("camera", "camera")` | `"camera"` / `null`(playback の 2 ケースは削除) |
| `hud-labels.ts` | `PLAY_LABEL` / `PAUSE_LABEL` / `CLIP_LABEL` / `PLAYBACK_TIME_LABEL` / `playbackTimeText` を export しない(テストの import と期待値を消す。typecheck が保証する) |

### 画面(手動確認。テストは書けない)

| 状況 | 期待する結果 |
| --- | --- |
| クリップを持たないモデル | 3D ビューの下に帯は無く、右上は「カメラ」だけ。表示は現状と変わらない |
| 24fps で書き出した glTF をロード | ビュー直下にビュー幅いっぱいの帯。fps 選択が 24、目盛りに 0, 5, 10 … などのフレーム番号、PlayHead が 0。右上に「アニメーション」メニューは無い |
| 30fps で書き出した glTF をロード | fps 選択が 30、最終フレームが duration × 30 |
| 再生ボタン | ボタンが一時停止アイコンに変わり、PlayHead と現在フレームが進み、最終フレームの手前で 0 に戻ってループする |
| 「先頭へ」/「最終へ」 | PlayHead と現在フレームが 0 / 最終フレームへ。再生中なら再生を続ける |
| 目盛り上をクリック・ドラッグ | その位置のフレームへシークし、モデルのポーズが追従する。帯の外へドラッグしても追従が続く |
| 目盛りにフォーカスして ← → Home End | 1 フレームずつ・先頭・最終へ移動する |
| 現在フレームの数値入力を書き換える | そのフレームへシーク |
| fps を 24 → 30 に変える | モデルの見た目(秒基準の時刻)は変わらず、現在フレーム・最終フレーム・目盛りが 30fps 換算になる |
| クリップを切り替える | フレーム 0 から。fps はそのまま |
| ウィンドウ幅を変える | 帯がビュー幅に追従し、ラベル間隔(5 / 10 / 20 …)が詰まりすぎないよう切り替わる |
| ウィンドウの高さを 36rem 未満にする | 帯が切れずに見える(Canvas が縮む) |
| Follow 中 | 参加者色の枠は 3D ビューの範囲だけを囲み、帯を囲まない。操作ヒントとライトギズモは帯の上に収まる |
| 入室ダイアログ・ショートカット設定 | 帯も含めて覆う |
| 別プロジェクトへ遷移 | 帯が消え、fps を含めてストアが初期化される |

## やらないこと
- 再生状態(クリップ・再生中・時刻・fps)を WebSocket でルームへ送受信すること。`shared/` と `server/` は触らない
- ショートカットキー(Space など)の追加。`features/shortcuts/` は触らない
- 再生速度・逆再生・ループ方式・再生範囲(スタート/エンドフレーム)の変更。LoopRepeat・1 倍速・全区間固定
- 「フレームごとに止めて進める」再生(Maya の Play every frame)。再生は 062 のまま連続時間で進める
- 秒表示の併記。フレームだけを表示する
- `time` をフレームに置き換えること。ストアの真の値は秒のまま
- `playback.ts` / `playback-driver.ts` / `PlaybackRig.tsx` / `review-stores.ts` の変更
- `tokens.css` へのトークン追加。既存トークンだけで組む
- `.hud-hint` / `.light-gizmo` / `.hud-follow*` の位置変更。`.review-stage` で包めば変えなくてよい
- 既存テストの削除。`hud-menu.test.ts` / `hud-labels.test.ts` は期待値の更新と playback 関連ケースの除去のみ
- 依存の追加。ResizeObserver はブラウザ組み込みを使う

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している(`PlaybackMenu.tsx` は削除)
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表(画面の表を除く)の全行に対応するテストがあり、通る
- [ ] `timeline_Summary.md` を新設し、`web_Summary.md` の Summary 一覧に `src/features/timeline/timeline_Summary.md` を足している
- [ ] viewer_Summary.md / store_Summary.md / app_Summary.md から PlaybackMenu・アニメーションメニュー・秒表示の記述が消え、fps・タイムライン・`.review-stage` の記述に置き換わっている
- [ ] viewer.css の行数が 254 より減っている(`.hud-playback*` の除去)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
