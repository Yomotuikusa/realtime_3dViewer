# server

## 目的
環境設定、HTTP エラー応答、SQLite のスキーマ適用と projects / model_versions /
comments の永続化、ファイル保存、プロジェクト取得 API を提供する server の基盤。

## ファイル一覧と役割
- `src/config.ts`: 環境変数から `Config` を読み込む。
- `src/errors.ts`: `HttpError` と未知エラーを API エラー応答へ変換する。
- `src/db/connection.ts`: `node:sqlite` の接続、PRAGMA、スキーマ適用、トランザクション。
- `src/db/schema.sql`: projects、model_versions、comments とコメント検索用 index の DDL。
- `src/db/projects.ts`: projects / model_versions の登録と検索、および行の型変換。
- `src/db/comments.ts`: コメントの登録、project 単位の一覧・検索、status 更新。JSON 列と
  shared の `Comment` の相互変換を担う。
- `src/storage/files.ts`: `dataDir/uploads/<versionId>.glb` への一時ファイル経由の保存・削除。
- `src/routes/projects.ts`: multipart モデルアップロード、project JSON の取得と、モデル本体の
  配信。アップロード成功時はファイル保存と projects / model_versions 登録を同一処理で行い、
  拡張子に応じた Content-Type と immutable キャッシュヘッダを設定する。
- `src/routes/comments.ts`: project 配下のコメント一覧、投稿、status 更新を提供する。
  一覧は `status` 絞り込みと `created_at` 昇順に対応し、投稿・更新は保存後にそれぞれ
  `comment:created` / `comment:updated` を `publish` へ渡す。project、version、comment の
  不在は `NOT_FOUND`、不正な JSON / 入力は `VALIDATION` を返す。
- `src/routes/upload-validation.ts`: glTF/GLB の拡張子・マジックバイト/JSON 検査と、
  Content-Length のアップロード上限検査。
- `src/realtime/hub.ts`: `ws` 非依存のインメモリ RoomHub。接続・join 済み Presence、カメラ、
  線の状態を project 単位で保持し、接続ごとの配信先を `Outbound` で返す。
- `src/app.ts`: `createApp(deps)`。共通エラー処理、JSON 404、`/api/projects` と
  `/api/projects/:projectId/comments` のマウントを担う。
- `tests/helpers/tmp.ts`: `server/.vite/test-tmp` 配下の一時ディレクトリ管理。
- `tests/helpers/app.ts`: 固定時刻・インメモリ DB・一時ファイルストレージを使う `TestApp` と
  `makeTestApp` / `seedProject` / `seedComment`。
- `tests/config.test.ts`: 設定値と入力検証のテスト。
- `tests/errors.test.ts`: HTTP / Zod / 未知エラーの応答変換テスト。
- `tests/db-projects.test.ts`: SQLite 接続、スキーマ、トランザクション、projects 層のテスト。
- `tests/db-comments.test.ts`: comments 層の JSON 往復、FK、一覧順序・status 絞り込み、
  project スコープ、status トグルのテスト。
- `tests/storage-files.test.ts`: ファイル保存、上書き、tmp 残留防止、削除のテスト。
- `tests/app.test.ts`: createApp の依存値、JSON 404、未知エラーの 500 応答のテスト。
- `tests/routes-projects-read.test.ts`: project 取得、モデル配信、Content-Type、キャッシュ、
  project/version/file の NOT_FOUND のテスト。
- `tests/upload-validation.test.ts`: モデル拡張子、GLB/glTF の内容検査、アップロード上限検査の
  テスト。
- `tests/routes-projects-upload.test.ts`: multipart の POST、Project 応答、保存ファイル、入力検証、
  上限超過、DB 失敗時の後始末のテスト。
- `tests/routes-comments.test.ts`: コメント一覧の順序・絞り込み、投稿・status 更新、入力検証、
  project/version スコープ、publish 呼び出しのテスト。
- `tsconfig.json`: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)。
- `vitest.config.ts`: テスト設定(tests/**/*.test.ts、cacheDir は .vite)。

## 公開インターフェイス
- `loadConfig`: `PORT`、`DATA_DIR`、`MAX_UPLOAD_BYTES` から `Config` を作る。
- `HttpError` / `toErrorResponse`: API のエラーコード・HTTP ステータス・メッセージを統一する。
- `openDb` / `migrate` / `withTransaction`: SQLite 接続とトランザクションを管理する。
- `insertProject` / `insertModelVersion`: プロジェクトと版を登録する。
- `findProject` / `findModelVersion`: shared の `Project` / `ModelVersion` へ変換して検索する。
- `insertComment`: `NewComment` を status `open` として登録し、`Comment` を返す。
- `listComments` / `findComment`: project 単位でコメントを順序付き一覧または検索する。
- `updateCommentStatus`: project と comment を指定して status と更新時刻を変更する。
- `Storage` / `createFileStorage`: モデルファイルを atomic rename で保存し、保存先を返す。
- `AppDeps` / `createApp`: DB、Storage、Config、publish、時刻、ID 生成を注入して Hono を構築する。
- `projectRoutes`: `GET /api/projects/:projectId` と
  `GET /api/projects/:projectId/versions/:versionId/model`、`POST /api/projects` を提供する。
  POST は multipart の `name` と `file` を受け、201 で `Project` を返す。名前は trim して保存し、
  不正な入力は `VALIDATION`、非 glTF/GLB は `UNSUPPORTED_FORMAT`、上限超過は
  `PAYLOAD_TOO_LARGE`、保存後の DB 失敗など予期しないエラーは `INTERNAL` を返す。
- `commentRoutes`: `GET /api/projects/:projectId/comments` は `Comment[]` を返し、任意の
  `status=open|resolved` で絞り込む。POST は `CreateCommentInput` を検証し、対象 version が
  project に属することを確認して 201 の `Comment` と `comment:created` を返す。PATCH は
  `UpdateCommentStatusInput` を検証して 200 の `Comment` と `comment:updated` を返す。
  いずれも対象 project が無ければ `NOT_FOUND`、入力不正なら `VALIDATION` を返す。
- `RoomHub`: `connect` / `disconnect` / `handle` で接続とルーム状態を操作し、
  `connectionsIn` / `projectOf` / `usersIn` / `strokesIn` で結線側やテストから状態を参照する。
  `Outbound.target` は `self` (送信元のみ)、`others` (送信元以外)、`all` (ルーム全員) を表す。
  `PRESENCE_PALETTE` は8色で、ルーム内の未使用色をjoin順に割り当て、全色使用時はサイズの剰余で
  再利用する。線は1ルームあたり `MAX_ROOM_STROKES = 2000` 本まで保持する。

## 他機能との関係
`shared/src/api.ts` の `ErrorCode`、`ApiError`、`MAX_UPLOAD_BYTES_DEFAULT` と、
`shared/src/types.ts` の `Project`、`ModelVersion`、`Comment` 関連型を利用する。後続の
server ルートと WS 配信は、この接続・トランザクション・projects / comments 層を共有する。
