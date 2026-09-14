# store

## 目的
レビュー画面のカメラ、照明、再生、オブジェクト、メッシュ表示方法、セッション、presence、annotation、comments、ショートカットの状態を zustand ストアで保持する。

## ファイル一覧と役割
- camera.ts: `selfCamera`、`pendingCamera`、`resetSeq`、`fitSeq`、`modelSize`、`focalLength` と、カメラ更新・再現消費・Reset・Fit・サイズ更新・初期化の action を管理する zustand ストア。`setSelfCamera(camera, exact?)` は exact 指定時だけ完全一致で更新を判定する
- lighting.ts: 共有 `LightAngles` を `rotateLight` の規則で更新し、サーバ受信値を正規化して適用する `applyRemote`、更新元 `origin`、既定方向への reset を提供する zustand ストア
- objects.ts: project の全 `ModelVersion` を number 昇順で保持し、非表示 versionId / `hiddenParts`、welcome 置換、追加、版・部位の表示状態変更、版削除、primary/latest 版の選択を提供する zustand ストア
- display.ts: ルーム共有メッシュ表示方法、メッシュ比較設定、ジョイント表示設定、モーション軌跡表示設定、再生対象 versionId を保持し、同値更新を抑止する `useDisplayStore` を提供する
- playback.ts: 現在タイムラインへ登録した sourceId とロード中モデルのアニメーションクリップ要約、選択、再生／一時停止、秒の時刻シーク、fps とフレームシークを保持する zustand ストア
- session.ts: 自分の ID・色・表示名・接続状態・直近エラーを保持する zustand ストア
- presence.ts: 参加者一覧、各参加者のカメラと任意の焦点距離、Follow 対象を保持する zustand ストア
- annotation.ts: ルーム全員分のライブ線、annotation mode・色・描画中 draft・コメント再現用線・メッシュに埋もれた線の透過表示設定・ペンの描画基準を保持し、welcome/線操作・draft・表示設定・reset を提供する zustand ストア
- comments.ts: コメント一覧、Open フィルタ、選択中コメント、投稿アンカー、API エラーを保持し、`setAll` / `upsert` / `select` / `setFilter` / `setComposerAnchor` / `setLastError` / `removeByVersion` / `reset` を提供する zustand ストア
- shortcuts.ts: `useShortcutsStore` として永続化された `keymap` を保持し、`setBinding` / `resetKeymap` を提供する。`resetReviewStores()` の対象外
- theme.ts: `useThemeStore` として端末ローカルの UI テーマ、OS の配色状態、3D ビュー色の override を保持し、テーマ・色の変更と reset、実効値セレクタを提供する。`resetReviewStores()` の対象外

## 公開インターフェイス
- camera.ts: `useCameraStore`、`CameraStoreState`（`focalLength`、`setFocalLength` を含む）
- session.ts: `useSessionStore`、`SessionStoreState`、`ConnectionStatus`
- presence.ts: `usePresenceStore`、`PresenceStoreState`（`updateCamera(userId, camera, focalLength?)` を含む）
- annotation.ts: `useAnnotationStore`、`AnnotationStoreState`、`AnnotationMode`、`PenPlacement`、`STROKE_COLORS`、`DEFAULT_STROKE_COLOR`、`orderedStrokes`（`overlay` / `setOverlay` / `placement` / `setPlacement` を含む）
- comments.ts: `useCommentsStore`、`CommentsStoreState`（`items` / `showOnlyOpen` / `selectedId` / `composerAnchor` / `lastError` と全 action）、`selectVisible`
- shortcuts.ts: `useShortcutsStore`、`ShortcutsStoreState`
- lighting.ts: `useLightingStore`、`LightingStoreState`、`LightAnglesOrigin`
- playback.ts: `usePlaybackStore`、`PlaybackStoreState`
- objects.ts: `useObjectsStore`、`ObjectsStoreState`（`remove` を含む）、`isObjectVisible`、`isObjectPartVisible`、`hiddenObjectPaths`、`primaryObjectId`、`latestObjectId`
- display.ts: `useDisplayStore`、`DisplayStoreState`（`meshDisplay` / `meshCompare` / `jointDisplay` / `motionTrail` / `playbackSource` と各 setter、reset）
- theme.ts: `useThemeStore`、`ThemeStoreState`、`selectResolvedTheme`、`selectViewerColor`、`selectViewerColors`

## 他フォルダとの関係
カメラストアの `selfCamera` は `DEFAULT_CAMERA`、`focalLength` は 50mm を初期値とし、`setSelfCamera(camera, exact?)` は
既定では `cameraEquals` の epsilon 内の更新を無視する。`exact: true` の場合は epsilon 0 の完全一致でない限り複製して更新する。
`requestCamera`/`consumePendingCamera` は複製した
`CameraState` を受け渡し、`resetSeq`/`fitSeq` は操作トリガ、`modelSize` はモデルの最大辺長を保持する。
`setFocalLength` は 14〜300mm に丸め、同値なら state を更新しない。`requestReset` と `reset` は焦点距離も 50mm に戻す。

annotation ストアは `strokes` を id で上書き・削除し、`clearByUser` でユーザー単位に除去する。`mode` は none / pen / comment の排他値で初期値は none、変更時に draft を破棄する。
`color` は6桁16進色を小文字へ正規化し、`drafting` は描画中の点列、`replayStrokes` は WebSocket のライブ線と分離した
コメント再現用の点列を保持する。`overlay` は各参加者のローカル表示設定で、`setOverlay` で切り替え、
レビュー画面の reset で初期値の有効状態へ戻す。
presence の `applyWelcome` は一覧と Follow 対象を初期化して全置換し、削除されたユーザーを Follow 中なら解除する。
`updateCamera` は camera の複製を保存し、受信した焦点距離があるときだけその値も更新する。
`viewer_Summary.md` を参照。
playback ストアは `clips` を要素ごとに複製して保持し、現在の持ち主を `sourceId` として保存する。クリップ選択時に時刻を0へ戻す。fps は有限値を1〜240へ丸め、レビュー画面の reset では clips、sourceId、選択、再生状態、秒の時刻、fps を初期値へ戻す。primary は Fit・サイズ計測の基準であり、クリップ一覧の基準ではない。
objects ストアは版を要素ごとに複製し、number 昇順で保持する。`hiddenIds` は welcome で全置換し、`hiddenParts` は版内の非表示部位を追加順・重複なしで保持する。`setPartVisible` は部位単位で更新し、`remove` は版・非表示版・非表示部位の参照をまとめて除去する。`isObjectPartVisible` / `hiddenObjectPaths` は部位の表示判定・版別パス取得を提供する。レビュー画面の reset で objects、hiddenIds、hiddenParts ともに空へ戻す。`setObjects` は非表示状態を維持する。**3D ビューの見え方を決める状態はルーム共有が原則** (設計書 §13.5)。版・部位の非表示は welcome で全置換し、受信で更新する。number 最小の版を primary、最大の版を `latestObjectId` として返す。
display ストアは `MeshDisplayMode`、`MeshCompare`、`JointDisplay`、`MotionTrail`、`playbackSource` を保持し、初期値と reset はそれぞれの shared 既定値の複製または null、同値の set は state と購読通知を変えない。比較設定、ジョイント表示設定、軌跡表示設定、再生対象の setter、welcome 受信値は必要な参照まで複製して保持する。
comments ストアは `items`（常に `createdAt` 昇順、同値なら `id` 昇順）、`showOnlyOpen`、`selectedId`、`composerAnchor`、`lastError` を保持する。`removeByVersion` は指定版のコメントと、該当する選択だけを除去し、該当なしなら state を更新しない。
`setAll` / `upsert` / `setFilter` の後は、`selectedId` が `selectVisible(items, showOnlyOpen)` に含まれなければ `null` に正規化する。
`setAll` は一覧全置換、`upsert` は id 単位の追加・置換、`select` は選択変更、`setFilter` は Open フィルタ変更、
`setComposerAnchor` は投稿位置変更、`setLastError` は API エラー変更、`reset` は初期値復元を行う。

## テスト
- tests/store-comments.test.ts: コメント一覧の順序、upsert、選択・Open フィルタ正規化、投稿アンカー、エラー、reset のテスト
- tests/store-annotation.test.ts: annotation ストアの初期値、線操作、mode/色、draft、再現線、透過表示・描画基準設定、順序、reset のテスト
- tests/store-camera.test.ts: カメラストアの初期値、参照を保つ epsilon／exact 判定、複製して保持・消費する再現要求、Reset・Fit・モデルサイズ・全 state 初期化の振る舞いを検証
- tests/store-lighting.test.ts: lighting ストアの既定値、累積回転、値の複製、remote 正規化、origin、reset を検証
- tests/store-playback.test.ts: playback ストアのクリップ複製、sourceId、選択、再生制御、シーク、無効入力、reset を検証
- tests/store-presence.test.ts: presence の全置換、焦点距離を含む upsert・削除・カメラ更新、Follow、reset のテスト
- tests/store-shortcuts.test.ts: shortcuts ストアの割り当て・永続化・既定値復元とレビュー reset 非対象のテスト
- tests/store-objects.test.ts: 版のソート・複製・追加、可視性、welcome、primary ヘルパー、reset のテスト
- tests/store-display.test.ts: メッシュ表示方法、比較設定、ジョイント表示設定、モーション軌跡表示設定の初期値、切替、複製、同値更新抑止、購読通知、reset のテスト
- tests/realtime-dispatch-playback.test.ts: 再生対象の store 初期値、切替、同値更新抑止、null/reset と realtime welcome/event 反映のテスト
- tests/store-object-removal.test.ts: 版・非表示状態・latestObjectId と版別コメントの削除テスト
- tests/store-theme.test.ts: テーマストアの初期値、テーマ・色の永続化、同値更新抑止、色 reset、実効値セレクタ、`resetReviewStores()` 非対象のテスト
