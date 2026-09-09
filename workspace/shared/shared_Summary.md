# shared

## 目的
フロントエンドとサーバが共有するドメイン型と、実行時検証用の zod スキーマを一箇所で提供する。
各スキーマは対応する interface/type と同じファイルに置き、`satisfies z.ZodType<T>` で型整合を検証する。

## ファイル一覧と役割
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: テスト設定(tests/**/*.test.ts、cacheDir は .vite)
- src/types.ts: Vec3、CameraState、Stroke、Comment、ModelVersion、Project、PresenceUser の型と zod スキーマ
- src/api.ts: REST のエラー、プロジェクト名、コメント入出力スキーマと upload 定数
- src/protocol.ts: WS の ClientMessage/ServerMessage 型、discriminated union スキーマ、JSON フレーム parse 関数
- src/camera.ts: three.js に依存しない CameraState/Vec3 の比較、補間、複製
- src/stroke.ts: 3D Ramer–Douglas–Peucker による点列間引きと送信可否判定
- src/index.ts: `SHARED_SCAFFOLD` と shared の全公開面を再エクスポート
- tests/types.test.ts: 各ドメインスキーマの safeParse の受理・拒否テスト
- tests/api.test.ts: REST スキーマ、定数、trim・境界値のテスト
- tests/protocol.test.ts: Client/Server の全メッセージ種別と parse 関数のテスト
- tests/camera.test.ts: カメラの比較、距離、補間、クランプ、複製のテスト
- tests/stroke.test.ts: 点列間引き、許容誤差、送信可能範囲のテスト

## 公開インターフェイス
- 型: `Vec3`, `CameraState`, `Stroke`, `CommentStatus`, `Comment`, `ModelVersion`, `Project`, `PresenceUser`
- スキーマ: `Vec3Schema`, `ColorSchema`, `CameraStateSchema`, `StrokeSchema`, `CommentStatusSchema`, `CommentSchema`, `ModelVersionSchema`, `ProjectSchema`, `PresenceUserSchema`
- api: `ErrorCode`, `ApiError`, `ApiErrorSchema`, `MAX_UPLOAD_BYTES_DEFAULT`, `ALLOWED_MODEL_EXTENSIONS`, `ProjectNameSchema`, `CreateCommentInput`, `UpdateCommentStatusInput`, `ListCommentsQuery`
- protocol: `ClientMessage`, `ServerMessage`, `ClientMessageSchema`, `ServerMessageSchema`, `ParseResult`, `parseClientMessage`, `parseServerMessage`, `MAX_NAME_LENGTH`, `CAMERA_SEND_INTERVAL_MS`
- camera: `DEFAULT_CAMERA`, `vec3Equals`, `vec3Distance`, `lerpVec3`, `cameraEquals`, `lerpCamera`, `cloneCamera`
- stroke: `simplifyTolerance`, `simplify`, `isSendableStroke`
- `shared/src/index.ts` は `SHARED_SCAFFOLD` を維持し、types.ts/api.ts/protocol.ts/camera.ts/stroke.ts の公開インターフェイスを再エクスポートする。

## 他機能との関係
server の DB・ルート、web の状態管理・表示が本モジュールの型とスキーマを import する。
api.ts は REST のサーバ受信入力とクライアント利用型を、protocol.ts は WS のサーバ受信・クライアント受信を同じ zod スキーマで検証する。
camera.ts は Follow Camera とコメント再現の補間・比較を、stroke.ts は Annotation 送信前の点列間引きを提供する。いずれも three.js に依存しない。
