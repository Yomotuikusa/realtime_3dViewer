# web

## 目的
REST API の fetch クライアント、ブラウザ履歴による入口ルーティング、モデルのアップロード画面、
glTF/GLB の 3D レビュー画面を提供する。

## ファイル一覧と役割
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: Vitest の対象を `tests/**/*.test.{ts,tsx}` に限定する設定(cacheDir は .vite)
- src/api/client.ts: REST の URL、JSON/FormData リクエスト、レスポンス検証、`ApiClientError`
- src/app/routes.ts: `/` と `/p/<projectId>` のルート解析、遷移、popstate フック
- src/app/App.tsx: 現在のルートに応じた画面分岐
- src/app/UploadPage.tsx: プロジェクト名・`.glb`/`.gltf` のアップロード画面
- src/app/ReviewPage.tsx: プロジェクト取得、ロード状態・エラーカード、ビューアとサイドパネルのレイアウト
- src/app/ErrorBoundary.tsx: React/three の描画例外を捕捉し、フォールバックを表示
- src/store/camera.ts: 自分のカメラ、再現・Reset・Fit のトリガ、モデルサイズを管理する zustand ストア
- src/features/viewer/ViewerCanvas.tsx: Canvas、ライティング、Bounds、モデル、カメラを合成するビューア。`children` は後続機能の差し込み口
- src/features/viewer/ModelMesh.tsx: `useGLTF` でモデルをロードし、バウンディングボックスからモデルサイズを記録して初回 Fit を要求
- src/features/viewer/CameraRig.tsx: OrbitControls をカメラストアと同期し、Reset・Fit・カメラ再現を処理
- src/main.tsx: React アプリのエントリーポイント
- tests/api-client.test.ts: API クライアントの URL、body、エラー、スキーマ検証テスト
- tests/routes.test.ts: ルート解析と履歴遷移テスト

## 公開インターフェイス
- api/client.ts: `ApiClientError`、`modelUrl`、`createProject`、`getProject`、`listComments`、`createComment`、`updateCommentStatus`
- app/routes.ts: `Route`、`parseRoute`、`projectPath`、`navigate`、`useRoute`
- app/App.tsx: `App`
- app/UploadPage.tsx: `UploadPage`
- app/ReviewPage.tsx: `ReviewPage({ projectId })`
- app/ErrorBoundary.tsx: `ErrorBoundary`
- store/camera.ts: `useCameraStore`、`CameraStoreState`
- features/viewer/ViewerCanvas.tsx: `ViewerCanvas({ modelSrc, children? })`
- features/viewer/ModelMesh.tsx: `ModelMesh({ src })`
- features/viewer/CameraRig.tsx: `CameraRig()`

API クライアントは同一オリジンの `/api/...` を使い、2xx 応答を共有 zod スキーマで検証する。API エラー本文を解析できる場合は `ApiClientError(status, code, message)`、ネットワーク断や解析不能なエラーは `INTERNAL`、成功本文の不一致は `VALIDATION` とする。
ルーティングは `/` を upload、正規表現 `^/p/[A-Za-z0-9_-]+$` に一致するパスを review、それ以外を notFound とする。`navigate` は `pushState` 後に `popstate` を通知する。

## 他機能との関係
`@shared/api` の API エラー・入力型・アップロード拡張子と、`@shared/types` の Project/Comment スキーマを利用する。
カメラストアの `selfCamera` は `DEFAULT_CAMERA` を初期値とし、`setSelfCamera` は `cameraEquals` の
既定 epsilon 内の更新を無視する。`requestCamera`/`consumePendingCamera` は複製した
`CameraState` を受け渡し、`resetSeq`/`fitSeq` は操作トリガ、`modelSize` はモデルの最大辺長を保持する。
後続の viewer 機能は `ViewerCanvas` の `children` 差し込み口にレイヤーを追加し、
コメント機能は `getProject`、`modelUrl`、カメラストアを利用する。
