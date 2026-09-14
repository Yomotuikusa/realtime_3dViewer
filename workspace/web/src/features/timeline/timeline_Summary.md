# timeline

## 目的

3D ビュー直下に、秒を真の値とするローカル再生をフレーム基準で操作するタイムラインを提供する。
ルーラー、キーボード／ポインターシーク、アニメーション選択、再生操作、現在フレーム、fps 選択を含む。
操作欄はスライダーの上に置き、再生対象とアニメーションのドロップダウンには画面上で見えるラベルを付ける。

## ファイル一覧と役割

- PlaybackTimeline.tsx: playback ストアを購読し、クリップがあるときだけビュー下部のタイムライン帯を描画する。スライダーの上に操作欄を置き、再生対象切替 UI をアニメーション選択の前に配置する
- PlaybackSourceSelect.tsx: アニメーション付き版が複数あるとき、見えるラベル付きでルーム共有の再生対象を切り替える select を描画する
- TimelineRuler.tsx: `useElementSize` で幅と高さに追従する SVG 目盛り、PlayHead、ドラッグ／キーシークを描画する。目盛り線は帯の高さに比例して伸縮し、ラベル／アクセント／通常の3段階の長さを持つ
- timeline.ts: 目盛り間隔・分類・高さ比例と種類別最小長 (label 6px / accent 4px / minor 3px) の長さ、座標変換、キー操作、fps 選択肢の純粋関数
- timeline-labels.ts: タイムライン操作・高さ変更・再生対象・アニメーションの日本語ラベルとフレーム表示 helper
- transport-icons.tsx: 再生・停止・先頭・最終へを表す inline SVG アイコン
- timeline.css: タイムライン帯、ルーラー、操作欄のトークンベース CSS

## 公開インターフェイス

- PlaybackTimeline.tsx: `PlaybackTimeline({ send })`。`useLayoutSize("timelineHeight")` と `ResizeHandle` でルーラー帯の高さを保存・変更し、操作欄をルーラーの上に描画して `PlaybackSourceSelect` に realtime 送信関数を渡す
- PlaybackSourceSelect.tsx: `PlaybackSourceSelect({ send })`。アニメーション付き版が2件未満なら `null`、それ以外は `SOURCE_LABEL` の見えるラベル付き select を描画し、`switchPlaybackSource` へ変更を委譲する
- TimelineRuler.tsx: `RULER_HEIGHT_PX`、`TimelineRuler({ frame, lastFrame, onSeek })`
- timeline.ts: `TIMELINE_PAD_PX`、`MIN_LABEL_PX`、`MIN_TICK_PX`、`STEP_SERIES`、`FPS_OPTIONS`、
  `TICK_LABEL_BAND_PX`、`ACCENT_TICK_MULTIPLE`、`TICK_LENGTH_RATIO` (label 0.3 / accent 0.18 / minor 0.105)、
  `TICK_MIN_LENGTH_PX` (label 6px / accent 4px / minor 3px)、`TimelineTicks`、`TickKind`、
  `RulerTick`、`timelineTicks`、`tickFrames`、`rulerTicks`、`tickLength`、`frameToX`、`frameAtX`、
  `timelineKeyFrame`、`fpsOptions`
- timeline-labels.ts: タイムラインの各ラベル、`SOURCE_LABEL`、`TIMELINE_RESIZE_LABEL`、`frameText`、`lastFrameText`
- transport-icons.tsx: `PlayIcon`、`PauseIcon`、`SkipStartIcon`、`SkipEndIcon`

## 他機能との関係

PlaybackTimeline は viewer/playback の `currentDuration` と viewer/playback-frames の秒／フレーム変換を使い、
`usePlaybackStore` の `time` を変更せずにフレーム単位の表示・入力を提供する。`features/layout` の `useLayoutSize`、
`clampSize`、`ResizeHandle`、`useElementSize` と `LAYOUT_SIZE_SPECS.timelineHeight` の仕様を利用し、
ルーラー帯の高さを localStorage に保存する。`PlaybackSourceSelect` は viewer の `usePlaybackSource` が返す
アニメーション付き版を表示し、`switchPlaybackSource` によって display / playback ストアと realtime を同期する。
モデルにクリップがない場合は帯とハンドルを描画しない。

## テスト

- tests/timeline.test.ts: 目盛り間隔、tick、座標変換、キー操作、fps 選択肢のテスト
- tests/timeline-labels.test.ts: タイムラインのラベルと表示 helper のテスト
- tests/playback-source-select.test.ts: 再生対象 select の表示、切替、外部同期、登録解除を検証
- tests/timeline-styles.test.ts: ビュー下部の配置、ステージ境界、Canvas 高さ、タイムライン CSS のソース検査
- tests/playback-frames.test.ts: キー時刻からの fps 判定と秒／フレーム変換のテスト
