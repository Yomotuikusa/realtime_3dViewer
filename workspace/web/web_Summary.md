# web

## 目的
REST API の fetch クライアント、ブラウザ履歴による入口ルーティング、モデルのアップロード画面、
glTF/GLB の 3D レビュー画面を提供する。レビュー画面は表示名を決めて入室し、WebSocket の
接続状態と受信イベントを各機能ストアへ反映する。

## ファイル一覧と役割
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: Vitest の対象を `tests/**/*.test.{ts,tsx}` に限定する設定(cacheDir は .vite)
- src/api/client.ts: REST の URL（各パスセグメントを URI エンコード）、JSON/FormData リクエスト、レスポンス検証、`ApiClientError`
- src/api/ws.ts: `WsClient`、WebSocket URL、接続状態通知、指数バックオフによる再接続
- src/app/routes.ts: `/` と `/p/<projectId>` のルート解析、遷移、popstate フック
- src/app/App.tsx: 現在のルートに応じた画面分岐。NotFound はパスと `/` へ戻る履歴遷移を表示する
- src/app/display-name.ts: localStorage による表示名の保存、Guest 名生成、入室名の解決
- src/app/JoinDialog.tsx: 保存済み表示名を初期値にした入室フォーム
- src/app/realtime-dispatch.ts: `ServerMessage` を session / presence / annotation / comments ストアへ振り分ける入口。`welcome`、presence 更新、stroke、`comment:created` / `comment:updated`、`error` を扱い、未知の型はコンパイル時に検出する
- src/app/useRealtime.ts: 名前決定後の `WsClient` 接続と、open ごとの `join` 送信。`onRealtimeStatus` は session の接続状態を更新し、open 時に lastError を解除する
- src/app/review-stores.ts: レビュー画面のアンマウント時に session / presence / annotation / comments / camera の5ストアをまとめて初期化する reset 関数（shortcuts ストアは対象外）
- src/app/UploadPage.tsx: トークン CSS で構成したプロジェクト名・`.glb`/`.gltf` のアップロード画面。拡張子と容量を送信前に検査し、`FILE_TOO_LARGE` などのエラーを表示する
- src/app/upload-labels.ts: アップロード画面と NotFound の表示文言、`FILE_TOO_LARGE`、ファイル容量 helper の純粋関数
- src/app/upload.css: アップロード画面と NotFound の狭い幅のレイアウト CSS
- src/app/ReviewPage.tsx: プロジェクト取得、レビュー画面の骨格、ロード状態・エラーカード、ビューアとサイドパネルのレイアウトを担当する。Canvas に RemoteCameras / RoomStrokes / ReplayStrokes / AnnotationLayer / CommentPickLayer / CommentPins を配置し、`.review-hud` を 025 の HUD 差し込み口、`.review-panel__comments` を 026 のコメント領域差し込み口として提供し、入室後だけショートカットを有効にする。入室後は設定ダイアログの開閉状態も保持し、表示中はショートカットを無効にする
- src/app/ReviewHeader.tsx: 接続状態バッジ、入室後の自分の表示名・色、レビュー URL のコピーと失敗時の手動コピー欄を表示し、入室後だけショートカット設定を開くボタンを表示する
- src/app/JoinDialog.tsx: 保存済み表示名を初期値にした、入室前にビューアを覆うモーダルフォーム。表示名の解決・保存・入室コールバックは display-name と呼び出し側へ委譲する
- src/app/review-labels.ts: 接続状態・コピー状態・ロード/エラー文言を定義する JSX 非依存の純粋関数と定数
- src/app/review.css: レビュー画面のヘッダ、ビューア/HUD、入室 backdrop/dialog、サイドパネル、ロード/エラー状態のプレーン CSS
- src/app/ErrorBoundary.tsx: React/three の描画例外を捕捉し、フォールバックを表示
- src/store/camera.ts: `selfCamera`、`pendingCamera`、`resetSeq`、`fitSeq`、`modelSize` と、カメラ更新・再現消費・Reset・Fit・サイズ更新・初期化の action を管理する zustand ストア
- src/store/session.ts: 自分の ID・色・表示名・接続状態・直近エラーを保持する zustand ストア
- src/store/presence.ts: 参加者一覧、各参加者のカメラ、Follow 対象を保持する zustand ストア
- src/store/annotation.ts: ルーム全員分のライブ線、annotation mode・色・描画中 draft・コメント再現用線・メッシュに埋もれた線の透過表示設定・ペンの描画基準を保持し、welcome/線操作・draft・表示設定・reset を提供する zustand ストア
- src/store/comments.ts: コメント一覧、Open フィルタ、選択中コメント、投稿アンカー、API エラーを保持し、`setAll` / `upsert` / `select` / `setFilter` / `setComposerAnchor` / `setLastError` / `reset` を提供する zustand ストア
- src/store/shortcuts.ts: `useShortcutsStore` として永続化された `keymap` を保持し、`setBinding` / `resetKeymap` を提供する。`resetReviewStores()` の対象外
- src/features/presence/PresenceList.tsx: 参加者を自分先頭・名前順で表示し、色ドット、あなたバッジ、視点に入る / 追従を解除ボタンを提供
- src/features/presence/RemoteCameras.tsx: 他者のカメラ位置・向きに、その人の色の左線を持つ `presence-tag` 名札を重ねる
- src/features/presence/presence-labels.ts: 参加者見出し、本人/追従操作の日本語ラベルと件数見出し関数
- src/features/presence/presence.css: 参加者行、追従中の背景、色ドット、3D カメラ名札のトークン CSS
- src/features/comments/CommentList.tsx: `CommentList({ projectId })` として REST でコメントを取得し、未解決フィルタ、時刻・状態バッジ付き一覧、選択領域、解決 / 再開操作、API エラーと空状態を提供。選択領域は native button、状態変更ボタンは兄弟要素として分離し、layout effect cleanup で無効化したアンマウントまたは projectId 世代変更後の非同期結果はストアへ反映しない
- src/features/comments/comment-labels.ts: コメント見出し、状態/空状態/Composer/ピンの日本語ラベル、Intl による時刻整形
- src/features/comments/comments.css: コメント一覧・Composer・3D ピンのトークン CSS。コメント領域を縦グリッド化し、Composer 不在時は親を単独の可変行へ切り替えて一覧が全高を使い、一覧だけをスクロールさせる
- src/features/comments/compose.ts: クリック移動量の判定、自分の線の時系列順・最新200本への制限、コメント投稿入力の組み立てを提供する
- src/features/comments/CommentPickLayer.tsx: Comment モード中だけ Canvas の pointerdown / pointerup を購読し、Alt なしの5px 以下のクリックをモデルへレイキャストして投稿アンカーを設定する。ドラッグやモデル外の操作は無視し、Composer 表示中は既存アンカーを保護する
- src/features/comments/CommentComposer.tsx: アンカー選択後に自動フォーカスする本文入力カードと REST コメント投稿を提供し、現在のカメラ・自分の線を入力へ含め、成功時にコメントを upsert・選択する。layout effect cleanup で無効化したアンマウントまたは projectId 世代変更後の非同期結果はストアへ反映しない。接続状態に関係なく投稿する
- src/features/comments/CommentPins.tsx: 表示対象コメントを author/status 付きアンカー位置の drei `Html` native button ピンとして描画し、クリック選択、選択強調、resolved の薄表示を提供する。pointerdown/up の伝播停止を維持する
- src/features/comments/replay.ts: 選択コメントのカメラ要求・Follow 解除・再現線設定を各ストアへ反映する純粋な入口と再現線の透明度を提供
- src/features/comments/useCommentReplay.ts: selectedId の変化を選択コメントの再現へ接続し、アンマウント時に再現線を消すフック
- src/features/comments/ReplayStrokes.tsx: annotation ストアの再現線だけを `StrokeLines` へ渡す Canvas 内レイヤー
- src/features/presence/RemoteCameras.tsx: 他者のカメラ位置・向きと名前ラベルを Canvas 内に表示
- src/features/annotation/StrokeLines.tsx: annotation ストアの透過表示設定を購読し、受け取った `Stroke[]` を通常線と必要な深度テスト無効の細い透過線として drei `Line` で描画する表示コンポーネント
- src/features/annotation/stroke-overlay.ts: `Stroke` から通常線・透過線の描画 spec を組み立てる定数・型・純粋関数
- src/features/annotation/RoomStrokes.tsx: annotation ストアのライブ線を表示順で描画し、2点以上の draft を現在色のプレビュー線として追加する Canvas 内レイヤー
- src/features/annotation/stroke-build.ts: 法線オフセット、モデルサイズ依存の `simplify`、送信可能性判定、Undo 用の自分の最新線の選択
- src/features/annotation/draw-plane.ts: カメラ位置と注視点から視線垂直な描画平面を作り、レイとの交点を求める純粋関数
- src/features/annotation/AnnotationLayer.tsx: Pen モード時だけ Canvas の DOM ポインターイベントを購読し、Alt なしの左ドラッグで表面または注視点の描画平面へ点を積み、終了時に `stroke:add` を送信する Canvas 内レイヤー。空間モードの平面は pointerdown 時に固定する
- src/features/annotation/AnnotationToolbar.tsx: ペンモード中の色・表面/空間の描画基準選択、自分の線の 1本戻す / 自分の線を消す、メッシュに埋もれた線の透過表示切替を提供するペン道具
- src/features/annotation/annotation.css: ペン道具と色ボタンのプレーン CSS
- src/features/viewer/ViewerCanvas.tsx: Canvas、ライティング、Bounds、モデル、カメラを合成するビューア。`children` は RemoteCameras / StrokeLines / AnnotationLayer など後続機能の差し込み口
- src/features/viewer/ViewerHud.tsx: ペン／コメントの toggle ボタン、ペン道具、視点リセット・Fit、Follow 中バッジ、描画基準を含むビューア操作ヒントを表示し、各ストアと keymap を購読する
- src/features/viewer/hud-labels.ts: ツールモード・色・Follow・視点操作・透過表示・描画基準・ヒントの日本語文言と純粋な判定関数
- src/features/shortcuts/keymap.ts: `ShortcutAction` / `Binding` / `Keymap` / `DEFAULT_KEYMAP` / `ACTION_ORDER` とキーコードの正規化、割り当て、表示、入力対象判定
- src/features/shortcuts/keymap-storage.ts: `KEYMAP_STORAGE_KEY` による keymap の localStorage 読み書きと不正値の既定値補完
- src/features/shortcuts/useShortcuts.ts: 入室中だけ keydown を購読し、ショートカットを annotation / camera ストアの action へ接続するフック
- src/features/shortcuts/capture.ts: 設定ダイアログのキー待機における modifier / Escape / 対応可否の判定。`CaptureResult`、`CaptureRejection`、`captureBinding` を公開する
- src/features/shortcuts/shortcut-labels.ts: 設定ダイアログのアクション名・操作文言と拒否メッセージ。`ACTION_LABELS`、各ラベル定数、`rejectionMessage` を公開する
- src/features/shortcuts/ShortcutSettings.tsx: keymap の再割り当て・解除・既定値復元を行う設定ダイアログ。待機中は capture-phase のキー入力を処理し、変更を shortcuts ストア経由で即時保存する
- src/features/shortcuts/shortcuts.css: ショートカット設定ダイアログの幅、4列の行、キーキャップ、フッタ、狭い画面向け調整
- src/features/viewer/viewer.css: HUD のモード選択、視点操作、Follow バッジ、操作ヒントのプレーン CSS
- src/features/viewer/ModelMesh.tsx: 同一オリジン用の LoadingManager を指定して `useGLTF` でモデルをロードし、バウンディングボックスからモデルサイズを記録して初回 Fit を要求する。ロード中の `scene` を共通モデルターゲットへ登録し、アンマウント時に解除する。Draco 圧縮時のデコーダ取得（`https://www.gstatic.com/...`）は drei の別 manager による外部依存として残る
- src/features/viewer/model-loading.ts: glTF の `buffers` / `images` などが参照する data/blob URI と同一オリジン URL だけを許可する LoadingManager を作り、外部 URL を `about:blank` に置換する
- src/features/viewer/model-target.ts: React や Zustand に依存せず、現在のレイキャスト対象 `Object3D` を保持する `setModelTarget` / `getModelTarget`
- src/features/viewer/pick.ts: Canvas 座標を NDC に変換し、共通モデルターゲットへ最近傍レイキャストを行う。交点と、逆転置の法線行列で変換して正規化したワールド系法線を返す
- src/features/viewer/follow.ts: Follow 対象カメラの妥当性判定と、共有カメラ関数を使った 1 フレーム分の補間
- src/features/viewer/CameraRig.tsx: OrbitControls を常時有効にしてカメラストアと同期し、Reset・Fit・カメラ再現・Follow を処理する。controls.domElement に Alt 操作と右ドラッグ dolly の入力を接続する
- src/features/viewer/camera-input.ts: OrbitControls の Alt／非 Alt 時のマウス割り当てと、target からの距離を指数的に変える右ドラッグ dolly の純粋関数
- src/features/viewer/viewer-pointer.ts: controls.domElement へ Maya 式の pointer、contextmenu、マウス抑止イベントを接続し、右ドラッグ dolly と後始末を提供する
- src/features/viewer/camera-throttle.ts: 最新のカメラだけを保持し、送信成功時刻から 50ms ごとの先頭送信と窓明けトレーリング送信を行う。送信失敗は未送信としてタイマーまたは次の更新で再試行し、破棄時に保留送信をキャンセルする
- src/features/viewer/useCameraBroadcast.ts: `selfCamera` の変更を `camera-throttle` へ渡し、送信成功時に自分の presence カメラも更新する。`shouldSendCamera` は従来の判定インターフェイスとして公開する
- src/main.tsx: React アプリのエントリーポイント。tokens → base → controls の順で全体スタイルを読み込む
- src/styles/tokens.css: 色・文字・間隔・角丸・動き・レイアウトのセマンティックトークン。既存 inline 値を引き継ぎ、`:root` に定義する
- src/styles/base.css: 全画面共通のリセット、既定の本文、可視フォーカスリング、reduced-motion。クラスは定義しない
- src/styles/controls.css: `.btn` / `.field` / `.input` / `.alert` / `.badge` の共通コントロール。状態は属性セレクタで表現する
- tests/api-client.test.ts: API クライアントの URL、body、エラー、スキーマ検証テスト
- tests/display-name.test.ts: 表示名の trim、保存、Guest 名、localStorage 例外のテスト
- tests/ws-client.test.ts: JSON 送受信、入力破棄、再接続バックオフ、明示 close のテスト
- tests/realtime-dispatch.test.ts: welcome の session / presence / annotation 反映、presence/stroke/comment イベント、error、未対応イベント、reset のテスト
- tests/store-comments.test.ts: コメント一覧の順序、upsert、選択・Open フィルタ正規化、投稿アンカー、エラー、reset のテスト
- tests/store-annotation.test.ts: annotation ストアの初期値、線操作、mode/色、draft、再現線、透過表示・描画基準設定、順序、reset のテスト
- tests/stroke-overlay.test.ts: 通常線・深度テスト無効の透過線 spec の順序、props、透明度、非破壊性のテスト
- tests/hud-labels.test.ts: HUD のモード・操作・透過表示・描画基準・Follow 文言とヒントのテスト
- tests/keymap.test.ts: キーコード、binding、アクション解決、割り当て、表示、入力対象判定のテスト
- tests/keymap-storage.test.ts: keymap の localStorage 読み書き、不正値補完、例外耐性のテスト
- tests/store-shortcuts.test.ts: shortcuts ストアの割り当て・永続化・既定値復元とレビュー reset 非対象のテスト
- tests/capture.test.ts: 設定ダイアログのキーキャプチャにおける割り当て、待機継続、キャンセル、拒否のテスト
- tests/shortcut-labels.test.ts: 設定画面のアクション名、拒否メッセージ、各ラベル定数のテスト
- tests/draw-plane.test.ts: 視線垂直な描画平面の生成、レイとの交差、平行/後方/始点交差の除外、非破壊性のテスト
- tests/store-presence.test.ts: presence の全置換、upsert、削除、カメラ更新、Follow、reset のテスト
- tests/camera-broadcast.test.ts: カメラ送信 throttle の間隔・比較判定テスト
- tests/camera-throttle.test.ts: 先頭送信、最新値のトレーリング、重複抑止、送信失敗の再試行、破棄時キャンセルのテスト
- tests/follow.test.ts: Follow 対象カメラの判定、複製、補間、収束テスト
- tests/routes.test.ts: ルート解析と履歴遷移テスト
- tests/store-camera.test.ts: カメラストアの初期値、参照を保つ epsilon 判定、複製して保持・消費する再現要求、Reset・Fit・モデルサイズ・全 state 初期化の振る舞いを検証
- tests/styles-rules.test.ts: `src/**/*.css` を再帰走査し、トークンの `:root` 定義、tokens.css 以外の生色禁止、CSS 変数の宣言/フォールバック、`!important` / `@import` 規約、main.tsx の import 順を検証
- tests/review-stores.test.ts: 5つのレビュー用ストアをまとめて初期化する reset の検証
- tests/use-realtime.test.ts: 接続状態、open 時のエラー解除と join、closed 時の非送信を検証
- tests/upload-labels.test.ts: アップロード/NotFound 文言、容量エラー定数、ファイル helper の単位・丸め結果を検証
- tests/model-loading.test.ts: 埋め込み・同一オリジン URL の許可、外部 URL の遮断、LoadingManager の URL modifier のテスト
- tests/camera-input.test.ts: Alt／非 Alt のマウス割り当て、指数 dolly、最小距離、入力配列非破壊のテスト
- tests/viewer-pointer.test.ts: capture phase の割り当て、Alt+右ドラッグ dolly、pointer capture、継続・終了・ブラウザ既定動作抑止、cleanup のテスト

スタイル規約(D35)はプレーン CSS とし、全体共通のトークン・ベース・コントロールを `src/styles/` に置く。色は `tokens.css` のセマンティック変数経由、状態はクラスの付け替えではなく `aria-*` / `disabled` / `data-*` で表現し、画面固有の CSS は各機能フォルダ側に置く。

## 公開インターフェイス
- api/client.ts: `ApiClientError`、`RESPONSE_INVALID_MESSAGE`、`modelUrl`、`createProject`、`getProject`、`listComments`、`createComment`、`updateCommentStatus`
- app/routes.ts: `Route`、`parseRoute`、`projectPath`、`navigate`、`useRoute`
- app/App.tsx: `App`
- app/UploadPage.tsx: `UploadPage`
- app/upload-labels.ts: `APP_NAME` など画面文言、`FILE_TOO_LARGE`、`fileHelp`、`fileSummary`
- app/ReviewPage.tsx: `ReviewPage({ projectId })`
- app/ReviewHeader.tsx: `ReviewHeader({ projectName, joined, onOpenSettings })`
- app/review-labels.ts: `connectionLabel`、`connectionTone`、`copyLabel`、`copyText`、ロード/エラー文言定数
- app/display-name.ts: `loadStoredName`、`saveName`、`guestName`、`resolveDisplayName`
- app/JoinDialog.tsx: `JoinDialog({ onJoin })`
- app/useRealtime.ts: `useRealtime(projectId, name)`、`onRealtimeStatus`、`Realtime`
- app/review-stores.ts: `resetReviewStores()`
- app/realtime-dispatch.ts: `dispatchServerMessage`
- api/ws.ts: `WsClient`、`wsUrl`、`SocketLike`、再接続定数
- app/ErrorBoundary.tsx: `ErrorBoundary`
- store/camera.ts: `useCameraStore`、`CameraStoreState`
- store/session.ts: `useSessionStore`、`SessionStoreState`、`ConnectionStatus`
- store/presence.ts: `usePresenceStore`、`PresenceStoreState`
- store/annotation.ts: `useAnnotationStore`、`AnnotationStoreState`、`AnnotationMode`、`PenPlacement`、`STROKE_COLORS`、`DEFAULT_STROKE_COLOR`、`orderedStrokes`（`overlay` / `setOverlay` / `placement` / `setPlacement` を含む）
- store/comments.ts: `useCommentsStore`、`CommentsStoreState`（`items` / `showOnlyOpen` / `selectedId` / `composerAnchor` / `lastError` と全 action）、`selectVisible`
- store/shortcuts.ts: `useShortcutsStore`、`ShortcutsStoreState`
- features/viewer/ViewerCanvas.tsx: `ViewerCanvas({ modelSrc, children? })`
- features/viewer/ViewerHud.tsx: `ViewerHud({ send })`
- features/viewer/hud-labels.ts: `ToolMode`、`MODE_LABELS`、`MODE_ORDER`、`PLACEMENT_LABELS`、`PLACEMENT_ORDER`、各種ラベル（`OVERLAY_LABEL` を含む）、`colorName`、`followingLabel`、`HintInput`（`placement` を含む）、`hint`、`withShortcut`
- features/shortcuts/keymap.ts: `ShortcutAction`、`Binding`、`Keymap`、`ACTION_ORDER`、`DEFAULT_KEYMAP`、`KeyChord`、`ShortcutEventLike`、`isModifierCode`、`isAssignableCode`、`bindingFromChord`、`isValidBinding`、`resolveAction`、`applyBinding`、`formatBinding`、`isTypingTarget`
- features/shortcuts/keymap-storage.ts: `KEYMAP_STORAGE_KEY`、`loadKeymap`、`saveKeymap`
- features/shortcuts/useShortcuts.ts: `useShortcuts(enabled)`
- features/shortcuts/capture.ts: `CaptureRejection`、`CaptureResult`、`captureBinding(chord)`
- features/shortcuts/shortcut-labels.ts: `ACTION_LABELS`、設定画面の各ラベル定数、`rejectionMessage(reason)`
- features/shortcuts/ShortcutSettings.tsx: `ShortcutSettings({ onClose })`
- features/viewer/ModelMesh.tsx: `ModelMesh({ src })`
- features/viewer/camera-throttle.ts: `CameraThrottleDeps`、`CameraThrottle`、`createCameraThrottle`
- features/viewer/model-loading.ts: `BLOCKED_RESOURCE_URL`、`resolveModelResourceUrl`、`createModelLoadingManager`
- features/viewer/model-target.ts: `setModelTarget(obj)`、`getModelTarget()`
- features/viewer/pick.ts: `toNdc(rect, clientX, clientY)`、`pickModel(raycaster, camera, ndc, target)`
- features/viewer/follow.ts: `FOLLOW_LERP_T`、`followTargetCamera`、`followStep`
- features/viewer/CameraRig.tsx: `CameraRig()`
- features/viewer/camera-input.ts: `ViewerMouseButtons`、`MOUSE_BUTTONS_ALT`、`MOUSE_BUTTONS_IDLE`、`mouseButtonsFor`、`DOLLY_SPEED`、`MIN_DOLLY_DISTANCE`、`dollyPosition`
- features/viewer/viewer-pointer.ts: `ViewerControlsLike`、`ViewerPointerDeps`、`attachViewerPointer(controls, deps)`
- features/viewer/useCameraBroadcast.ts: `shouldSendCamera`、`useCameraBroadcast(send)`
- features/presence/PresenceList.tsx: `PresenceList()`
- features/presence/RemoteCameras.tsx: `RemoteCameras()`
- features/presence/presence-labels.ts: `PRESENCE_HEADING`、`SELF_SUFFIX`、`FOLLOW_LABEL`、`UNFOLLOW_LABEL`、`presenceHeading(count)`
- features/annotation/StrokeLines.tsx: `StrokeLines({ strokes, opacity? })`（annotation ストアの `overlay` を購読）
- features/annotation/draw-plane.ts: `DrawPlane`、`DrawRay`、`PARALLEL_EPSILON`、`viewPlaneAt`、`intersectPlane`
- features/annotation/stroke-overlay.ts: `BASE_LINE_WIDTH`、`OVERLAY_LINE_WIDTH`、`OVERLAY_OPACITY_RATIO`、`StrokeLineSpec`、`strokeLineSpecs`
- features/annotation/RoomStrokes.tsx: `RoomStrokes()`
- features/annotation/stroke-build.ts: `offsetAlongNormal`、`buildStroke`、`latestOwnStrokeId`
- features/annotation/AnnotationLayer.tsx: `AnnotationLayer({ send })`
- features/annotation/AnnotationToolbar.tsx: `AnnotationToolbar({ send })`（色・表面/空間の描画基準選択・1本戻す・自分の線を消す・`overlay` 切替）
- features/comments/compose.ts: `CLICK_MOVE_THRESHOLD_PX`、`isClick`、`ownStrokesForComment`、`buildCommentInput`
- features/comments/comment-labels.ts: コメント表示定数、`commentsHeading`、`statusLabel`、`statusTone`、`toggleStatusLabel`、`pinLabel`、`formatCommentTime`
- features/comments/CommentPickLayer.tsx: `CommentPickLayer()`
- features/comments/CommentComposer.tsx: `CommentComposer({ projectId, versionId })`
- features/comments/CommentPins.tsx: `CommentPins()`
- features/comments/replay.ts: `applyCommentReplay(comment)`、`REPLAY_OPACITY`
- features/comments/useCommentReplay.ts: `useCommentReplay()`
- features/comments/ReplayStrokes.tsx: `ReplayStrokes()`

API クライアントは同一オリジンの `/api/...` を使い、URL の projectId / versionId / commentId を `encodeURIComponent` でエンコードする。2xx 応答を共有 zod スキーマで検証し、成功本文の不一致は `ApiClientError(status, "VALIDATION", RESPONSE_INVALID_MESSAGE)` とする。API エラー本文を解析できる場合は `ApiClientError(status, code, message)`、ネットワーク断や解析不能なエラーは `INTERNAL` とする。
ルーティングは `/` を upload、正規表現 `^/p/[A-Za-z0-9_-]+$` に一致するパスを review、それ以外を notFound とする。`navigate` は `pushState` 後に `popstate` を通知する。

## 他機能との関係
`@shared/api` の API エラー・入力型・アップロード拡張子と、`@shared/types` の Project/Comment スキーマを利用する。
カメラストアの `selfCamera` は `DEFAULT_CAMERA` を初期値とし、`setSelfCamera` は `cameraEquals` の
既定 epsilon 内の更新を無視する。`requestCamera`/`consumePendingCamera` は複製した
`CameraState` を受け渡し、`resetSeq`/`fitSeq` は操作トリガ、`modelSize` はモデルの最大辺長を保持する。
`CameraRig` は Reset 発生時に未消費の `pendingCamera` も破棄し、Reset 後の古い再現要求が補間を開始しないようにする。
CameraRig の毎フレーム処理は D27 の優先順位に従う。

| 状況 | 動作 |
| --- | --- |
| `resetSeq` が増えた | `DEFAULT_CAMERA` へ即座に戻し、追従中なら `presence.unfollow()`。 |
| `pendingCamera` が非 null | 消費時に `presence.unfollow()` し、既存どおり目標へ補間する。 |
| 補間目標が残っている | `lerpCamera` で現在から目標へ進み、到達時に目標をクリアする。 |
| `followTargetCamera(...)` が非 null | `followStep` の結果をカメラと `controls.target` に適用し、到達後も追従を継続する。 |
| それ以外 | カメラを変更しない。 |

OrbitControls の `start` はユーザー操作として `presence.unfollow()` を呼び、追従によるプログラム更新では解除しない。
`App` は projectId を `ReviewPage` の React key に使い、プロジェクト切替時のアンマウントで `resetReviewStores()` を実行して5ストアを初期化する。`ReviewPage` は ready/error に取得対象の `projectId` を保持し、現在の URL と一致しない間は
旧画面を表示せず loading として扱う。
入室後は `useRealtime` が同一オリジンの `/ws?projectId=...` へ接続し、`open` ごとに `lastError` を解除してから `join` を
送る。`WsClient` は失敗回数に応じて 1000ms から 10000ms まで指数バックオフし、成功接続で
失敗回数をリセットする。明示的な `close` 後は再接続しない。
`dispatchServerMessage` は `welcome` で session の self ID/色、presence の参加者一覧、annotation のライブ線を確定し、
`user:joined` / `user:left` / `camera` を presence ストアへ、`stroke:add` / `stroke:remove` / `stroke:clear` を
annotation ストアへ、`comment:created` / `comment:updated` を comments ストアへ、`error` を `CODE: message` として保存する。annotation ストアは `strokes` を id で上書き・削除し、
`clearByUser` でユーザー単位に除去する。`mode` は none / pen / comment の排他値で初期値は none、変更時に draft を破棄する。
`color` は6桁16進色を小文字へ正規化し、`drafting` は描画中の点列、`replayStrokes` は WebSocket のライブ線と分離した
コメント再現用の点列を保持する。`overlay` は各参加者のローカル表示設定で、`setOverlay` で切り替え、
レビュー画面の reset で初期値の有効状態へ戻す。`RoomStrokes` はライブ線を `orderedStrokes` の createdAt/id 順で
`StrokeLines` に渡し、draft が2点以上ならプレビュー線を1本追加する。`StrokeLines` はライブ線とコメント再現線の
双方で同じ `overlay` 設定を購読し、通常線に加えて必要な場合だけ深度テスト無効の細い透過線を重ねる。
presence の `applyWelcome` は一覧と Follow 対象を初期化して全置換し、削除されたユーザーを Follow 中なら解除する。
`useCameraBroadcast` は selfCamera の変更を `createCameraThrottle` へ渡し、前回送信から
`CAMERA_SEND_INTERVAL_MS` 以上かつ `cameraEquals` で異なる場合だけ送信する。窓内の最新値は
タイマーで送信し、送信成功値を `cloneCamera` で保持する。送信成功時は自分の presence カメラも更新し、
Follow 中も送信を継続する。
後続の viewer 機能は `ViewerCanvas` の `children` 差し込み口に RemoteCameras / StrokeLines /
AnnotationLayer などのレイヤーを追加する。`ModelMesh` が登録する `model-target` を `pickModel` に渡すと、
Canvas のクライアント座標を NDC 化して再帰的にモデルをレイキャストでき、交点法線はヒットした
オブジェクトの `matrixWorld` の逆転置法線行列でワールド系へ変換して正規化される。`AnnotationLayer` は Pen モード中だけ
`gl.domElement` の pointerdown / pointermove / pointerup / pointercancel を購読し、表面モードでは
ヒット点を `offsetAlongNormal` でモデル表面から少し浮かせて draft に追加する。空間モードでは実カメラ位置と
`selfCamera.target` から作った、注視点を通る視線垂直平面へレイを投影し、pointerdown 時の平面を
ストローク中固定するためモデルの外でも線が続き、法線オフセットは適用しない。終了時に `buildStroke` で
間引き、接続が open かつ selfId がある場合だけ `stroke:add` を送信する。draft は終了時に消し、
送信した線はサーバー配信を待つためローカルへ追加しない。
ショートカットは入室後の `ReviewPage` で有効になり、HUD のモード／視点ボタンにも現在の keymap を表示する。キー設定は `resetReviewStores()` の5ストア初期化から独立して localStorage に保持する。
カメラ操作は `CameraRig` が `useThree().controls` の `OrbitControls` に `attachViewerPointer` を接続する。
常時有効な OrbitControls の割り当ては、Alt なしでは全ボタンを無効、Alt 押下中は左回転・中パン・右無効とし、
ホイールは常に OrbitControls の dolly を使う。右ドラッグだけは `dollyPosition` でカメラ位置を変更し、
左／中ドラッグは OrbitControls に任せる。入力開始時は Follow を解除し、カメラ更新は既存の epsilon 判定付きストアへ渡す。
コメント機能は `getProject`、`modelUrl`、カメラストアを利用する。Comment モードのモデルクリックは
Composer の既存 `composerAnchor` が非 null の間は無視し、入力中のアンカーを置き換えない。
comments ストアは `items`（常に `createdAt` 昇順、同値なら `id` 昇順）、`showOnlyOpen`、`selectedId`、`composerAnchor`、`lastError` を保持する。
`setAll` / `upsert` / `setFilter` の後は、`selectedId` が `selectVisible(items, showOnlyOpen)` に含まれなければ `null` に正規化する。
`setAll` は一覧全置換、`upsert` は id 単位の追加・置換、`select` は選択変更、`setFilter` は Open フィルタ変更、
`setComposerAnchor` は投稿位置変更、`setLastError` は API エラー変更、`reset` は初期値復元を行う。
`CommentList` はマウント時に全コメントを取得し、成功時に lastError を解除する。選択領域のクリックまたはキーボード操作で選択を切り替え、Open のコメントを Resolve、resolved のコメントを Reopen する。状態変更中のコメント ID は集合で管理し、並行する別行の操作も disabled 状態を保つ。状態変更成功時も lastError を解除する。`CommentComposer` は投稿成功時に lastError を解除する。
Comment の投稿は Comment モードでモデルをクリックしてアンカーを決め、移動距離が5px以下の pointerdown/pointerup だけを配置クリックとして扱う。Composer は本文を trim し、selfCamera と selfId に紐づく線（createdAt/id 昇順、最新200本）を含めて REST 投稿する。成功時は REST 応答を comments ストアへ upsert してアンカーを閉じ、投稿コメントを選択する。Comment モードは維持するため連続投稿でき、WebSocket 接続が閉じていても REST 投稿は許可する。CommentPins は表示対象のコメントを anchor 上の Html ピンにし、クリックで選択する。
コメント選択時は `useCommentReplay` が該当 Comment の camera を `requestCamera` に積み、Follow を即時解除し、その Comment の strokes を annotation ストアの `replayStrokes` に設定する。`CameraRig` は要求を次フレームに消費して補間移動し、選択解除・別コメント選択・フックのアンマウント時は再現線だけを消去する。`ReplayStrokes` は `replayStrokes` を透明度 0.6 の `StrokeLines` として描画し、ルームのライブ線を保持する `strokes` / `RoomStrokes` とは別レイヤーかつ WebSocket 非送信である。
モデルの LoadingManager は glTF 内の data/blob URI と同一オリジンのリソースだけを通し、外部 URI は
`about:blank` へ置換する。Draco デコーダは drei が別 manager で gstatic から取得する外部依存であり、
この遮断の対象外である。
