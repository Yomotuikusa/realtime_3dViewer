# comments

## 目的
コメントの投稿、一覧、解決状態の変更、3D ピン表示と選択コメントのカメラ・線の再現を提供する。

## ファイル一覧と役割
- CommentList.tsx: `CommentList({ projectId })` として REST でコメントを取得し、未解決フィルタ、時刻・状態・再生フレームバッジ付き一覧、選択領域、解決 / 再開操作、API エラーと空状態を提供。選択領域は native button、状態変更ボタンは兄弟要素として分離し、layout effect cleanup で無効化したアンマウントまたは projectId 世代変更後の非同期結果はストアへ反映しない
- comment-labels.ts: コメント見出し、状態/空状態/Composer/ピン/フレーム/吹き出し、空シーン投稿欄の日本語ラベル、Intl による時刻整形
- comments.css: コメント一覧を枠線・ドロップシャドウ付きカードとして表示し、Composer に同じ影を与えるトークン CSS。コメント領域を縦グリッド化し、カードを上から積み上げ、非選択カードの本文領域を 2 行分の高さに揃え、選択中のみ本文を全文展開する。Composer 不在時は親を単独の可変行へ切り替えて一覧が全高を使い、一覧だけをスクロールさせる。3D ビューの選択コメント吹き出しはピン横の固定幅カードとして表示し、長文本文だけをスクロールさせ、吹き出しの閉じるボタンは円形アウトライン付きにする
- compose.ts: クリック移動量の判定、自分の線の時系列順・最新 `MAX_COMMENT_STROKES` 本への制限、再生位置と再生対象 versionId の投稿値算出、コメント投稿入力の組み立てを提供する
- frame-switch.ts: フレーム自動記録スイッチの localStorage 読み書きと既定値を提供する
- CommentPickLayer.tsx: Comment モード中だけ Canvas の pointerdown / pointerup を購読し、Alt なしの5px 以下のクリックをモデルへレイキャストして投稿アンカーを設定する。ドラッグやモデル外の操作は無視し、Composer 表示中は既存アンカーを保護する
- CommentComposer.tsx: アンカー選択後に自動フォーカスする本文入力カードと REST コメント投稿を提供し、本文の入力上限は `MAX_COMMENT_BODY_LENGTH` から取得する。現在のカメラ・自分の線・スイッチで選択した再生位置を入力へ含める。フレーム記録設定は localStorage に保存し、クリップがある場合だけ本文下にスイッチを表示する。成功時にコメントを upsert・選択する。layout effect cleanup で無効化したアンマウントまたは projectId 世代変更後の非同期結果はストアへ反映しない。接続状態に関係なく投稿する
- CommentPins.tsx: 表示対象コメントを author/status 付きアンカー位置の drei `Html` native button ピンとして描画し、クリック選択、選択強調、resolved の薄表示を提供する。pointerdown/up の伝播停止を維持する
- CommentCallout.tsx: 選択中コメントの投稿者・時刻・状態・再生フレーム・全文をアンカー位置横の drei `Html` ダイアログとして描画し、閉じるボタンで選択を解除する。吹き出し上の pointerdown/up は Canvas へ伝播させない
- replay.ts: 選択コメントのカメラ要求・Follow 解除・再現線設定と、必要なら再生対象を切り替えた上で範囲内の再生位置の pause・クリップ選択・フレーム seek を各ストアへ反映する入口、再現線の透明度を提供
- useCommentReplay.ts: selectedId の変化を最新 send 関数付きの選択コメント再現へ接続し、アンマウント時に再現線を消すフック
- ReplayStrokes.tsx: annotation ストアの再現線だけを `StrokeLines` へ渡す Canvas 内レイヤー

## 公開インターフェイス
- compose.ts: `CLICK_MOVE_THRESHOLD_PX`、`isClick`、`ownStrokesForComment`、`commentPlaybackOf`、`buildCommentInput`
- frame-switch.ts: `RECORD_FRAME_STORAGE_KEY`、`loadRecordFrame`、`saveRecordFrame`
- comment-labels.ts: コメント表示定数、`COMPOSER_NO_OBJECTS_MESSAGE`、`RECORD_FRAME_LABEL`、`CLOSE_CALLOUT_LABEL`、`commentsHeading`、`statusLabel`、`statusTone`、`toggleStatusLabel`、`pinLabel`、`recordFrameLabel`、`playbackBadge`、`playbackTitle`、`formatCommentTime`
- CommentPickLayer.tsx: `CommentPickLayer()`
- CommentComposer.tsx: `CommentComposer({ projectId, versionId })`
- CommentPins.tsx: `CommentPins()`。表示対象から `selectedId` のコメントを探し、ピン群の後に `CommentCallout` を描画
- CommentCallout.tsx: `CommentCallout({ comment })`
- replay.ts: `applyCommentPlayback(playback, send)`、`applyCommentReplay(comment, send)`、`REPLAY_OPACITY`
- useCommentReplay.ts: `useCommentReplay(send)`
- ReplayStrokes.tsx: `ReplayStrokes()`

## 他フォルダとの関係
コメント機能は `getProject`、`modelUrl`、カメラストアを利用する。Comment モードのモデルクリックは
Composer の既存 `composerAnchor` が非 null の間は無視し、入力中のアンカーを置き換えない。
`CommentList` はマウント時に全コメントを取得し、成功時に lastError を解除する。選択領域のクリックまたはキーボード操作で選択を切り替え、Open のコメントを Resolve、resolved のコメントを Reopen する。状態変更中のコメント ID は集合で管理し、並行する別行の操作も disabled 状態を保つ。状態変更成功時も lastError を解除する。`CommentComposer` は投稿成功時に lastError を解除する。
Comment の投稿は Comment モードでモデルをクリックしてアンカーを決め、移動距離が5px以下の pointerdown/pointerup だけを配置クリックとして扱う。Composer は本文を trim し、selfCamera と selfId に紐づく線（createdAt/id 昇順、最新200本）を含めて REST 投稿する。クリップがある場合は本文下の「フレームを記録」スイッチ（既定 ON、設定は localStorage 保存）が現在の表示フレームを投稿値へ含める。成功時は REST 応答を comments ストアへ upsert してアンカーを閉じ、投稿コメントを選択する。Comment モードは維持するため連続投稿でき、WebSocket 接続が閉じていても REST 投稿は許可する。CommentPins は表示対象のコメントを anchor 上の Html ピンにし、クリックで選択する。
コメント選択時は `useCommentReplay` が該当 Comment の camera を `requestCamera` に積み、Follow を即時解除し、その Comment の strokes を annotation ストアの `replayStrokes` に設定する。`CommentPins` は同じ `selectedId` に対応する表示対象コメントをピンの後ろに `CommentCallout` として重ねる。吹き出しはピン横で選択コメントのメタデータと全文を表示し、閉じるボタンで選択を解除する。playback に versionId があればアニメーション付きの再生対象へ切り替えてから、再生を止めて記録クリップを選択し、範囲内のときだけ記録フレームへ seek する。古いコメントの playback/versionId 欠落では従来どおり現在の再生対象を使い、未読み込み対象では再生対象もタイムラインも変更しない。切替後に clipIndex が範囲外の場合はクリップ選択・フレーム seek を行わないが、成功した再生対象の切替は維持する。`CameraRig` は要求を次フレームに消費して補間移動し、選択解除・別コメント選択・フックのアンマウント時は再現線だけを消去する。`ReplayStrokes` は `replayStrokes` を透明度 0.6 の `StrokeLines` として描画し、ルームのライブ線を保持する `strokes` / `RoomStrokes` とは別レイヤーかつ WebSocket 非送信である。
store_Summary.md と viewer_Summary.md を参照。

## テスト
- tests/comment-labels.test.ts: コメント表示定数、見出し、状態ラベル、ピンラベル、時刻整形のテスト
- tests/comment-replay.test.ts: コメント選択時のカメラ要求、Follow 解除、再現線、再生対象切替を含む再生位置、透明度のテスト
- tests/compose.test.ts: クリック判定、自分の線の順序・上限、再生位置・対象 versionId、投稿入力の組み立てテスト
- tests/frame-switch.test.ts: フレーム自動記録スイッチの既定値、保存値、不正値、localStorage 例外のテスト
- tests/comments-styles.test.ts: コメント一覧カード、Composer の共有本文長上限・影とフレームスイッチ、右パネル背景を含む CSS 契約のテスト
- tests/comment-callout.test.ts: CommentCallout の Html/DOM/メタデータ/閉じる操作と CommentPins の選択吹き出し配置をソース検査するテスト
