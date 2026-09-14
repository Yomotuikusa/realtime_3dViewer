---
id: 084
title: web コメント投稿時にタイムラインのフレームを自動記録(スイッチ可)し、選択時にそのフレームへ飛ぶ
feature: web
depends_on: [081, 082]
owns: [web/src/features/comments/frame-switch.ts, web/src/features/comments/compose.ts, web/src/features/comments/replay.ts, web/src/features/comments/comment-labels.ts, web/src/features/comments/CommentComposer.tsx, web/src/features/comments/CommentList.tsx, web/src/features/comments/comments.css, web/src/features/comments/comments_Summary.md, web/tests/compose.test.ts, web/tests/comment-replay.test.ts, web/tests/comment-labels.test.ts, web/tests/frame-switch.test.ts, web/tests/comments-styles.test.ts]
reads: [shared/src/types.ts, shared/src/api.ts, web/src/store/playback.ts, web/src/store/comments.ts, web/src/features/viewer/playback.ts, web/src/features/viewer/playback-frames.ts, web/src/features/timeline/PlaybackTimeline.tsx, web/src/app/display-name.ts, web/src/store/store_Summary.md, web/src/features/timeline/timeline_Summary.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
コメントを投稿したとき、その時点のタイムライン位置(クリップ添字と表示フレーム)を自動でコメントに
登録し、コメントを選択したらカメラ・線の再現に加えてそのフレームへ即座に飛べるようにする。
自動登録は Composer 内のスイッチで ON/OFF でき、設定はブラウザに保存する(既定 ON)。
一覧のカードにはフレームのバッジを出す。

## 前提
- `CommentPlayback = { clipIndex: number; frame: number }`、`Comment.playback?: CommentPlayback | null`、
  `CreateCommentInput.playback` は省略可の `CommentPlayback | null`(shared/src/types.ts、shared/src/api.ts。task 082)。
  **古いコメントは `playback` キー自体を持たないことがある**ので、読む側は `comment.playback ?? null` とする
- playback ストア(web/src/store/playback.ts)の状態は `clips: PlaybackClip[]`、`clipIndex`、`playing`、
  `time`(秒)、`fps`。操作は `selectClip(index)`(範囲外なら何もしない。範囲内なら time を 0 にする)、
  `pause()`、`seekFrame(frame)`(`timeOfFrame(frame, fps)` の秒へ clamp 付きで seek)。
  クリップの無いモデルでは `clips` が空配列
- 秒 → 表示フレームは `frameOfTime(time, fps)`(web/src/features/viewer/playback-frames.ts:37-40。
  `Math.round(time * fps)`)。タイムライン UI もこれで現在フレームを表示している
  (web/src/features/timeline/PlaybackTimeline.tsx:42)
- `buildCommentInput(args)` が投稿入力を組み立てる唯一の場所(web/src/features/comments/compose.ts:35-57)。
  Composer は submit 時に `useCameraStore` / `useSessionStore` / `useAnnotationStore` の
  `getState()` を読んで渡している(web/src/features/comments/CommentComposer.tsx:44-56)
- `applyCommentReplay(comment)` が選択時の再現の唯一の入口で、`useCommentReplay` から
  `selectedId` の変化ごとに呼ばれる(web/src/features/comments/replay.ts、useCommentReplay.ts)。
  `comment === null` の時は再現線を消すだけ
- localStorage の読み書きは web/src/app/display-name.ts の `loadStoredName` / `saveName` と同じ
  try/catch の作法に従う(利用不可でも例外を漏らさない)
- Composer は `composerAnchor` が null のときは描画されない(アンマウントされる)。
  よって Composer の `useState` 初期化は Composer が開くたびに実行される
- 一覧のメタ行は `.comments-row__meta` の中に `<strong>` `<time>` `<span class="badge">` が並ぶ
  flex 行(CommentList.tsx:122-129)。`.badge[data-tone="accent"]` は controls.css で定義済み
- `web/tests/summary-coverage.test.ts` により、新規ソース `frame-switch.ts` と新規テスト
  `frame-switch.test.ts` は comments_Summary.md に載せる必要がある

## インターフェイス契約

### web/src/features/comments/frame-switch.ts(新規)

```ts
export const RECORD_FRAME_STORAGE_KEY = "3dreviewer:comment-record-frame";

/** フレーム自動記録の設定を読む。未保存・読取不可なら true。保存値が "false" のときだけ false。 */
export function loadRecordFrame(): boolean;

/** "true" / "false" の文字列で保存する。localStorage が使えなければ黙って何もしない。 */
export function saveRecordFrame(value: boolean): void;
```

### web/src/features/comments/compose.ts

```ts
import type { CommentPlayback } from "@shared/types";
import type { PlaybackClip } from "../viewer/playback";

/** 投稿に載せる再生位置。スイッチ OFF またはクリップ無しなら null。 */
export function commentPlaybackOf(
  playback: { clips: readonly PlaybackClip[]; clipIndex: number; time: number; fps: number },
  recordFrame: boolean,
): CommentPlayback | null;
// { clipIndex: playback.clipIndex, frame: frameOfTime(playback.time, playback.fps) }

export function buildCommentInput(args: {
  versionId: string;
  authorName: string;
  body: string;
  anchor: Vec3;
  camera: CameraState;
  strokes: Record<string, Stroke>;
  userId: string | null;
  playback: CommentPlayback | null;   // 追加。そのまま戻り値の playback に入れる(null も明示的に入れる)
}): CreateCommentInput | null;
```

### web/src/features/comments/replay.ts

```ts
import type { Comment, CommentPlayback } from "@shared/types";

/**
 * 再生位置をタイムラインへ反映する。null / undefined、または clipIndex が現在の clips の範囲外なら
 * 何もせず false。範囲内なら pause() → selectClip(clipIndex) → seekFrame(frame) の順で反映し true。
 */
export function applyCommentPlayback(playback: CommentPlayback | null | undefined): boolean;

/** 既存。comment !== null のとき、末尾で applyCommentPlayback(comment.playback) を呼ぶ。null のときは playback に触れない */
export function applyCommentReplay(comment: Comment | null): void;
```

### web/src/features/comments/comment-labels.ts

```ts
export const RECORD_FRAME_LABEL = "フレームを記録";

/** Composer のチェックボックスの文言。例: "フレーム 120 を記録" */
export function recordFrameLabel(frame: number): string;

/** カードのバッジ文言。例: "F 120" */
export function playbackBadge(playback: CommentPlayback): string;

/** バッジの title / aria-label。例: "クリップ 2 / フレーム 120"(clipIndex は 1 始まりで表示) */
export function playbackTitle(playback: CommentPlayback): string;
```

### web/src/features/comments/CommentComposer.tsx
- `usePlaybackStore` から `clips` / `clipIndex` / `time` / `fps` を購読し、
  `const [recordFrame, setRecordFrame] = useState(loadRecordFrame)` を持つ
- `clips.length > 0` のときだけ、本文フィールドの直後・操作ボタンの前に次を描画する:

```tsx
<label className="comments-composer__frame">
  <input
    type="checkbox"
    checked={recordFrame}
    disabled={sending}
    onChange={(event) => { setRecordFrame(event.target.checked); saveRecordFrame(event.target.checked); }}
  />
  {recordFrameLabel(frameOfTime(time, fps))}
</label>
```

- submit 時に `playback: commentPlaybackOf(usePlaybackStore.getState(), recordFrame)` を
  `buildCommentInput` へ渡す

### web/src/features/comments/CommentList.tsx
メタ行の状態バッジ(`statusLabel`)の直後に、`comment.playback ?? null` が非 null のときだけ:

```tsx
<span className="badge comments-row__frame" data-tone="accent" title={playbackTitle(playback)}>
  {playbackBadge(playback)}
</span>
```

### web/src/features/comments/comments.css
`.comments-composer__title` の直後に追加(他は変更しない):

```css
.comments-composer__frame {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.comments-row__frame {
  white-space: nowrap;
}
```

## 振る舞い

### web/tests/frame-switch.test.ts(新規)
各テストの前に `localStorage.clear()`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 何も保存されていない | `loadRecordFrame()` が `true` |
| `saveRecordFrame(false)` の後 | `localStorage.getItem(RECORD_FRAME_STORAGE_KEY)` が `"false"`、`loadRecordFrame()` が `false` |
| `saveRecordFrame(true)` の後 | 保存値 `"true"`、`loadRecordFrame()` が `true` |
| 保存値が `"maybe"` などの不正な文字列 | `loadRecordFrame()` が `true` |
| `localStorage.getItem` が throw する(`vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw ... })`) | `loadRecordFrame()` が `true`、例外が漏れない |
| `localStorage.setItem` が throw する | `saveRecordFrame(false)` が例外を漏らさない |

### web/tests/compose.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `commentPlaybackOf({ clips: [{ name: "a", duration: 2 }], clipIndex: 0, time: 0.5, fps: 24 }, true)` | `{ clipIndex: 0, frame: 12 }` |
| 同じ入力で `recordFrame: false` | `null` |
| `clips: []` で `recordFrame: true` | `null` |
| `time: 1, fps: 30, clipIndex: 1`(clips 2 本) | `{ clipIndex: 1, frame: 30 }` |
| `time: 0.4999, fps: 24` | `frame: 12`(四捨五入。`frameOfTime` と同じ) |
| `buildCommentInput({ ..., playback: { clipIndex: 0, frame: 7 } })` | 戻り値の `playback` が `{ clipIndex: 0, frame: 7 }` で、`CreateCommentInput.safeParse` が success |
| `buildCommentInput({ ..., playback: null })` | 戻り値に `playback: null` が **キーとして存在** し、`safeParse` が success |
| 本文が空 | 従来どおり `null`(playback があっても投稿しない) |

### web/tests/comment-replay.test.ts(既存に追記)
`beforeEach` で `usePlaybackStore.getState().reset()` も行う。クリップは
`usePlaybackStore.getState().setClips([{ name: "a", duration: 2 }, { name: "b", duration: 4 }], 24)` で用意する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyCommentPlayback({ clipIndex: 1, frame: 48 })`(再生中 `play()` 済み) | `true`。`playing` が false、`clipIndex` が 1、`time` が `2`(48 / 24) |
| `applyCommentPlayback({ clipIndex: 0, frame: 96 })`(duration 2 秒を超えるフレーム) | `true`。`time` が `2`(clamp) |
| `applyCommentPlayback({ clipIndex: 5, frame: 0 })`(範囲外) | `false`。`clipIndex` / `time` / `playing` が呼ぶ前と同じ |
| `applyCommentPlayback(null)` / `applyCommentPlayback(undefined)` | `false`。ストアは変化しない |
| クリップが無い(`setClips([])`)状態で `{ clipIndex: 0, frame: 0 }` | `false` |
| `applyCommentReplay(playback 付きコメント)` | 従来のカメラ要求・Follow 解除・再現線に加え、`clipIndex` / `time` が反映され `playing` が false |
| `applyCommentReplay(playback を持たないコメント)` | カメラ・線は従来どおり。playback ストアは変化しない |
| `applyCommentReplay(null)` | 再現線が消える。playback ストアは変化しない(再生中なら再生のまま) |

### web/tests/comment-labels.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `recordFrameLabel(120)` | `"フレーム 120 を記録"` |
| `playbackBadge({ clipIndex: 0, frame: 120 })` | `"F 120"` |
| `playbackTitle({ clipIndex: 1, frame: 120 })` | `"クリップ 2 / フレーム 120"` |
| `RECORD_FRAME_LABEL` | `"フレームを記録"` |

### web/tests/comments-styles.test.ts(既存に追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `.comments-composer__frame` ブロック | `display: flex`、`font-size: var(--text-sm)` を含む |
| `.comments-row__frame` ブロック | `white-space: nowrap` を含む |
| CommentComposer.tsx のソース | `comments-composer__frame`、`loadRecordFrame`、`saveRecordFrame`、`commentPlaybackOf` を含む |
| CommentList.tsx のソース | `comments-row__frame` と `playbackBadge` を含む |

### 画面上の見た目(直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| アニメーション付きモデルでコメントモードのクリック → Composer が開く | 本文の下に「☑ フレーム 120 を記録」が出る(数字は現在フレームに追従) |
| チェックを外して投稿 | カードにフレームバッジが出ない。次に Composer を開いてもチェックは外れたまま |
| チェックのまま投稿 | カードのメタ行に「F 120」の青いバッジが出る |
| アニメーションの無いモデル | チェックボックスは出ず、バッジも出ない |
| 再生中に「F 120」のあるコメントをカードまたはピンから選択 | 再生が止まり、タイムラインが 120 フレームへ移動し、カメラと線も再現される |
| 別のクリップで記録されたコメントを選択 | クリップ選択が切り替わってからそのフレームへ移動する |
| 別版に差し替えてクリップ数が減った状態で範囲外のコメントを選択 | タイムラインは動かない。カメラと線は再現される |

## やらないこと
- 3D ビュー上へのコメント本文表示(task 085)
- タイムラインのルーラー上にコメント位置のマーカーを描くこと
- フレームバッジのクリックで個別にジャンプする操作(選択で自動的に飛ぶ)
- フレーム記録スイッチの comments ストアへの追加、ルーム共有、`resetReviewStores` への組み込み
- `CommentPins.tsx` / `useCommentReplay.ts` / `store/playback.ts` / `store/comments.ts` の変更
- `playback` の編集・削除 API

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] comments_Summary.md に frame-switch.ts の役割、compose.ts / replay.ts / comment-labels.ts の
      追加インターフェイス、Composer のスイッチと一覧のバッジ、テスト一覧(frame-switch.test.ts)を反映している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
