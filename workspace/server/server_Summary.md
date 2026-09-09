# server

## 目的
環境設定、HTTP エラー応答、SQLite のスキーマ適用と projects / model_versions の
永続化を提供する server の基盤。

## ファイル一覧と役割
- `src/config.ts`: 環境変数から `Config` を読み込む。
- `src/errors.ts`: `HttpError` と未知エラーを API エラー応答へ変換する。
- `src/db/connection.ts`: `node:sqlite` の接続、PRAGMA、スキーマ適用、トランザクション。
- `src/db/schema.sql`: projects、model_versions、comments とコメント検索用 index の DDL。
- `src/db/projects.ts`: projects / model_versions の登録と検索、および行の型変換。
- `tests/helpers/tmp.ts`: `server/.vite/test-tmp` 配下の一時ディレクトリ管理。
- `tests/config.test.ts`: 設定値と入力検証のテスト。
- `tests/errors.test.ts`: HTTP / Zod / 未知エラーの応答変換テスト。
- `tests/db-projects.test.ts`: SQLite 接続、スキーマ、トランザクション、projects 層のテスト。
- `tsconfig.json`: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)。
- `vitest.config.ts`: テスト設定(tests/**/*.test.ts、cacheDir は .vite)。

## 公開インターフェイス
- `loadConfig`: `PORT`、`DATA_DIR`、`MAX_UPLOAD_BYTES` から `Config` を作る。
- `HttpError` / `toErrorResponse`: API のエラーコード・HTTP ステータス・メッセージを統一する。
- `openDb` / `migrate` / `withTransaction`: SQLite 接続とトランザクションを管理する。
- `insertProject` / `insertModelVersion`: プロジェクトと版を登録する。
- `findProject` / `findModelVersion`: shared の `Project` / `ModelVersion` へ変換して検索する。

## 他機能との関係
`shared/src/api.ts` の `ErrorCode`、`ApiError`、`MAX_UPLOAD_BYTES_DEFAULT` と、
`shared/src/types.ts` の `Project`、`ModelVersion` を利用する。後続の server ルートと
comments 層は、この接続・トランザクション・projects 層を共有する。
