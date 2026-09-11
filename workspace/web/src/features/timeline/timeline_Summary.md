# timeline

## 目的

3D ビュー直下に、秒を真の値とするローカル再生をフレーム基準で操作するタイムラインを提供する。
ルーラー、キーボード／ポインターシーク、クリップ選択、再生操作、現在フレーム、fps 選択を含む。

## ファイル一覧と役割

- PlaybackTimeline.tsx: playback ストアを購読し、クリップがあるときだけビュー下部のタイムライン帯を描画する
- TimelineRuler.tsx: `useElementSize` で幅と高さに追従する SVG 目盛り、PlayHead、ドラッグ／キーシークを描画する
- timeline.ts: 目盛り間隔、座標変換、キー操作、fps 選択肢の純粋関数
- timeline-labels.ts: タイムライン操作・高さ変更の日本語ラベルとフレーム表示 helper
- transport-icons.tsx: 再生・停止・先頭・最終へを表す inline SVG アイコン
- timeline.css: タイムライン帯、ルーラー、操作欄のトークンベース CSS

## 公開インターフェイス

- PlaybackTimeline.tsx: `PlaybackTimeline()`。`useLayoutSize("timelineHeight")` と `ResizeHandle` でルーラー帯の高さを保存・変更する
- TimelineRuler.tsx: `RULER_HEIGHT_PX`、`TimelineRuler({ frame, lastFrame, onSeek })`
- timeline.ts: `TIMELINE_PAD_PX`、`MIN_LABEL_PX`、`MIN_TICK_PX`、`STEP_SERIES`、`FPS_OPTIONS`、
  `TimelineTicks`、`timelineTicks`、`tickFrames`、`frameToX`、`frameAtX`、`timelineKeyFrame`、`fpsOptions`
- timeline-labels.ts: タイムラインの各ラベル、`TIMELINE_RESIZE_LABEL`、`frameText`、`lastFrameText`
- transport-icons.tsx: `PlayIcon`、`PauseIcon`、`SkipStartIcon`、`SkipEndIcon`

## 他機能との関係

PlaybackTimeline は viewer/playback の `currentDuration` と viewer/playback-frames の秒／フレーム変換を使い、
`usePlaybackStore` の `time` を変更せずにフレーム単位の表示・入力を提供する。`features/layout` の `useLayoutSize`、
`clampSize`、`ResizeHandle`、`useElementSize` と `LAYOUT_SIZE_SPECS.timelineHeight` の仕様を利用し、
ルーラー帯の高さを localStorage に保存する。モデルにクリップがない場合は帯とハンドルを描画しない。

## テスト

- tests/timeline.test.ts: 目盛り間隔、tick、座標変換、キー操作、fps 選択肢のテスト
- tests/timeline-labels.test.ts: タイムラインのラベルと表示 helper のテスト
- tests/timeline-styles.test.ts: ビュー下部の配置、ステージ境界、Canvas 高さ、タイムライン CSS のソース検査
- tests/playback-frames.test.ts: キー時刻からの fps 判定と秒／フレーム変換のテスト
