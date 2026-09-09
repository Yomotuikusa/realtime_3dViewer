# web

## 目的
REST API の fetch クライアント、ブラウザ履歴による入口ルーティング、モデルのアップロード画面、
glTF/GLB の 3D レビュー画面を提供する。レビュー画面は表示名を決めて入室し、WebSocket の
接続状態と受信イベントを各機能ストアへ反映する。

## ファイル一覧と役割
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: Vitest の対象を `tests/**/*.test.{ts,tsx}` に限定する設定(cacheDir は .vite)
- src/api/client.ts: REST の URL、JSON/FormData リクエスト、レスポンス検証、`ApiClientError`
- src/api/ws.ts: `WsClient`、WebSocket URL、接続状態通知、指数バックオフによる再接続
- src/app/routes.ts: `/` と `/p/<projectId>` のルート解析、遷移、popstate フック
- src/app/App.tsx: 現在のルートに応じた画面分岐
- src/app/display-name.ts: localStorage による表示名の保存、Guest 名生成、入室名の解決
- src/app/JoinDialog.tsx: 保存済み表示名を初期値にした入室フォーム
- src/app/realtime-dispatch.ts: `ServerMessage` を session / presence / annotation ストアへ振り分ける入口。`welcome`、presence 更新、stroke、`error` を扱う
- src/app/useRealtime.ts: 名前決定後の `WsClient` 接続と、open ごとの `join` 送信
- src/app/UploadPage.tsx: プロジェクト名・`.glb`/`.gltf` のアップロード画面
- src/app/ReviewPage.tsx: プロジェクト取得、入室ダイアログ、接続状態、ロード状態・エラーカード、ビューアとサイドパネルのレイアウト。Canvas に RemoteCameras と RoomStrokes を配置する
- src/app/ErrorBoundary.tsx: React/three の描画例外を捕捉し、フォールバックを表示
- src/store/camera.ts: `selfCamera`、`pendingCamera`、`resetSeq`、`fitSeq`、`modelSize` と、カメラ更新・再現消費・Reset・Fit・サイズ更新・初期化の action を管理する zustand ストア
- src/store/session.ts: 自分の ID・色・表示名・接続状態・直近エラーを保持する zustand ストア
- src/store/presence.ts: 参加者一覧、各参加者のカメラ、Follow 対象を保持する zustand ストア
- src/store/annotation.ts: ルーム全員分のライブ線、annotation mode・色・描画中 draft・コメント再現用線を保持し、welcome/線操作・draft・reset を提供する zustand ストア
- src/features/presence/PresenceList.tsx: 参加者の色・名前と Follow / 解除ボタンを表示
- src/features/presence/RemoteCameras.tsx: 他者のカメラ位置・向きと名前ラベルを Canvas 内に表示
- src/features/annotation/StrokeLines.tsx: 受け取った `Stroke[]` を線ごとに drei `Line` で描画する純粋な表示コンポーネント
- src/features/annotation/RoomStrokes.tsx: annotation ストアのライブ線を表示順で描画し、2点以上の draft を現在色のプレビュー線として追加する Canvas 内レイヤー
- src/features/viewer/ViewerCanvas.tsx: Canvas、ライティング、Bounds、モデル、カメラを合成するビューア。`children` は RemoteCameras / StrokeLines / AnnotationLayer など後続機能の差し込み口
- src/features/viewer/ModelMesh.tsx: `useGLTF` でモデルをロードし、バウンディングボックスからモデルサイズを記録して初回 Fit を要求
- src/features/viewer/follow.ts: Follow 対象カメラの妥当性判定と、共有カメラ関数を使った 1 フレーム分の補間
- src/features/viewer/CameraRig.tsx: OrbitControls をカメラストアと同期し、Reset・Fit・カメラ再現・Follow を処理
- src/features/viewer/useCameraBroadcast.ts: `selfCamera` の変更を購読し、共有定数の 50ms 間隔と `cameraEquals` でカメラ送信を throttle
- src/main.tsx: React アプリのエントリーポイント
- tests/api-client.test.ts: API クライアントの URL、body、エラー、スキーマ検証テスト
- tests/display-name.test.ts: 表示名の trim、保存、Guest 名、localStorage 例外のテスト
- tests/ws-client.test.ts: JSON 送受信、入力破棄、再接続バックオフ、明示 close のテスト
- tests/realtime-dispatch.test.ts: welcome の session / presence / annotation 反映、presence/stroke イベント、error、未対応イベント、reset のテスト
- tests/store-annotation.test.ts: annotation ストアの初期値、線操作、mode/色、draft、再現線、順序、reset のテスト
- tests/store-presence.test.ts: presence の全置換、upsert、削除、カメラ更新、Follow、reset のテスト
- tests/camera-broadcast.test.ts: カメラ送信 throttle の間隔・比較判定テスト
- tests/follow.test.ts: Follow 対象カメラの判定、複製、補間、収束テスト
- tests/routes.test.ts: ルート解析と履歴遷移テスト
- tests/store-camera.test.ts: カメラストアの初期値、参照を保つ epsilon 判定、複製して保持・消費する再現要求、Reset・Fit・モデルサイズ・全 state 初期化の振る舞いを検証

## 公開インターフェイス
- api/client.ts: `ApiClientError`、`modelUrl`、`createProject`、`getProject`、`listComments`、`createComment`、`updateCommentStatus`
- app/routes.ts: `Route`、`parseRoute`、`projectPath`、`navigate`、`useRoute`
- app/App.tsx: `App`
- app/UploadPage.tsx: `UploadPage`
- app/ReviewPage.tsx: `ReviewPage({ projectId })`
- app/display-name.ts: `loadStoredName`、`saveName`、`guestName`、`resolveDisplayName`
- app/JoinDialog.tsx: `JoinDialog({ onJoin })`
- app/useRealtime.ts: `useRealtime(projectId, name)`、`Realtime`
- app/realtime-dispatch.ts: `dispatchServerMessage`
- api/ws.ts: `WsClient`、`wsUrl`、`SocketLike`、再接続定数
- app/ErrorBoundary.tsx: `ErrorBoundary`
- store/camera.ts: `useCameraStore`、`CameraStoreState`
- store/session.ts: `useSessionStore`、`SessionStoreState`、`ConnectionStatus`
- store/presence.ts: `usePresenceStore`、`PresenceStoreState`
- store/annotation.ts: `useAnnotationStore`、`AnnotationStoreState`、`AnnotationMode`、`STROKE_COLORS`、`DEFAULT_STROKE_COLOR`、`orderedStrokes`
- features/viewer/ViewerCanvas.tsx: `ViewerCanvas({ modelSrc, children? })`
- features/viewer/ModelMesh.tsx: `ModelMesh({ src })`
- features/viewer/follow.ts: `FOLLOW_LERP_T`、`followTargetCamera`、`followStep`
- features/viewer/CameraRig.tsx: `CameraRig()`
- features/viewer/useCameraBroadcast.ts: `shouldSendCamera`、`useCameraBroadcast(send)`
- features/presence/PresenceList.tsx: `PresenceList()`
- features/presence/RemoteCameras.tsx: `RemoteCameras()`
- features/annotation/StrokeLines.tsx: `StrokeLines({ strokes, opacity? })`
- features/annotation/RoomStrokes.tsx: `RoomStrokes()`

API クライアントは同一オリジンの `/api/...` を使い、2xx 応答を共有 zod スキーマで検証する。API エラー本文を解析できる場合は `ApiClientError(status, code, message)`、ネットワーク断や解析不能なエラーは `INTERNAL`、成功本文の不一致は `VALIDATION` とする。
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
`ReviewPage` は ready/error に取得対象の `projectId` を保持し、現在の URL と一致しない間は
旧画面を表示せず loading として扱う。
入室後は `useRealtime` が同一オリジンの `/ws?projectId=...` へ接続し、`open` ごとに `join` を
送る。`WsClient` は失敗回数に応じて 1000ms から 10000ms まで指数バックオフし、成功接続で
失敗回数をリセットする。明示的な `close` 後は再接続しない。
`dispatchServerMessage` は `welcome` で session の self ID/色、presence の参加者一覧、annotation のライブ線を確定し、
`user:joined` / `user:left` / `camera` を presence ストアへ、`stroke:add` / `stroke:remove` / `stroke:clear` を
annotation ストアへ、`error` を `CODE: message` として保存する。annotation ストアは `strokes` を id で上書き・削除し、
`clearByUser` でユーザー単位に除去する。`mode` は orbit / pen / comment の排他値で、変更時に draft を破棄する。
`color` は6桁16進色を小文字へ正規化し、`drafting` は描画中の点列、`replayStrokes` は WebSocket のライブ線と分離した
コメント再現用の点列を保持する。`RoomStrokes` はライブ線を `orderedStrokes` の createdAt/id 順で `StrokeLines` に渡し、
draft が2点以上ならプレビュー線を1本追加する。
presence の `applyWelcome` は一覧と Follow 対象を初期化して全置換し、削除されたユーザーを Follow 中なら解除する。
`useCameraBroadcast` は selfCamera の変更を購読し、前回送信から `CAMERA_SEND_INTERVAL_MS` 以上かつ
`cameraEquals` で異なる場合だけ送信する。送信成功値を `cloneCamera` で保持し、Follow 中も送信を継続する。
後続の viewer 機能は `ViewerCanvas` の `children` 差し込み口に RemoteCameras / StrokeLines /
AnnotationLayer などのレイヤーを追加し、
コメント機能は `getProject`、`modelUrl`、カメラストアを利用する。
