# shared

## 目的
フロントエンドとサーバが共有するドメイン型と、実行時検証用の zod スキーマを一箇所で提供する。
各スキーマは対応する interface/type と同じファイルに置き、`satisfies z.ZodType<T>` で型整合を検証する。

## ファイル一覧と役割
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: テスト設定(tests/**/*.test.ts、cacheDir は .vite)
- src/types.ts: Vec3、CameraState、Stroke、Comment、ModelVersion、Project、PresenceUser の型と zod スキーマ
- src/index.ts: `SHARED_SCAFFOLD` と types.ts の公開面を再エクスポート
- tests/types.test.ts: 各ドメインスキーマの safeParse の受理・拒否テスト

## 公開インターフェイス
- 型: `Vec3`, `CameraState`, `Stroke`, `CommentStatus`, `Comment`, `ModelVersion`, `Project`, `PresenceUser`
- スキーマ: `Vec3Schema`, `ColorSchema`, `CameraStateSchema`, `StrokeSchema`, `CommentStatusSchema`, `CommentSchema`, `ModelVersionSchema`, `ProjectSchema`, `PresenceUserSchema`
- `shared/src/index.ts` は `SHARED_SCAFFOLD` を 022 まで維持し、types.ts の公開インターフェイスを再エクスポートする。

## 他機能との関係
002 以降の shared API/WS 型、server の DB・ルート、web の状態管理・表示が本モジュールの型を import する。
REST/WS 入出力スキーマとカメラ・ストロークの純粋関数は後続タスクで追加する。
