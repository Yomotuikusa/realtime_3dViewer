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
- src/index.ts: `SHARED_SCAFFOLD` と types/api/protocol の公開面を再エクスポート
- tests/types.test.ts: 各ドメインスキーマの safeParse の受理・拒否テスト
- tests/api.test.ts: REST スキーマ、定数、trim・境界値のテスト
- tests/protocol.test.ts: Client/Server の全メッセージ種別と parse 関数のテスト

## 公開インターフェイス
- 型: `Vec3`, `CameraState`, `Stroke`, `CommentStatus`, `Comment`, `ModelVersion`, `Project`, `PresenceUser`
- スキーマ: `Vec3Schema`, `ColorSchema`, `CameraStateSchema`, `StrokeSchema`, `CommentStatusSchema`, `CommentSchema`, `ModelVersionSchema`, `ProjectSchema`, `PresenceUserSchema`
- api: `ErrorCode`, `ApiError`, `ApiErrorSchema`, `MAX_UPLOAD_BYTES_DEFAULT`, `ALLOWED_MODEL_EXTENSIONS`, `ProjectNameSchema`, `CreateCommentInput`, `UpdateCommentStatusInput`, `ListCommentsQuery`
- protocol: `ClientMessage`, `ServerMessage`, `ClientMessageSchema`, `ServerMessageSchema`, `ParseResult`, `parseClientMessage`, `parseServerMessage`, `MAX_NAME_LENGTH`, `CAMERA_SEND_INTERVAL_MS`
- `shared/src/index.ts` は `SHARED_SCAFFOLD` を維持し、types.ts/api.ts/protocol.ts の公開インターフェイスを再エクスポートする。

## 他機能との関係
server の DB・ルート、web の状態管理・表示が本モジュールの型とスキーマを import する。
api.ts は REST のサーバ受信入力とクライアント利用型を、protocol.ts は WS のサーバ受信・クライアント受信を同じ zod スキーマで検証する。
カメラ・ストロークの純粋関数は後続タスクで追加する。
