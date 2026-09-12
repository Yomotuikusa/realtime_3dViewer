# server

## 目的
環境設定、HTTP エラー応答、SQLite のスキーマ適用と projects / model_versions /
comments の永続化、ファイル保存、プロジェクト取得 API、web/dist の静的配信を提供する
server の基盤。本番は `npm run build && npm run start` で起動する。

## ファイル一覧と役割
- `src/config.ts`: 環境変数から `Config` を読み込む。`WEB_DIST_DIR` は web/dist のルートを
  指定し、既定値は `./web/dist` (相対パスは cwd 基準)。
- `src/errors.ts`: `HttpError` と未知エラーを API エラー応答へ変換する。
- `src/db/connection.ts`: `node:sqlite` の接続、PRAGMA、スキーマ適用、既存 DB への
  `playback_json` 列追加移行、トランザクション。`migrate` は schema.sql を適用した後に
  `addColumnIfMissing` で不足列だけを `ALTER TABLE` する。
- `src/db/schema.sql`: projects、model_versions、comments とコメント検索用 index の DDL。
  comments は `strokes_json` の後に nullable な `playback_json` を持つ。
- `src/db/projects.ts`: projects / model_versions の登録、全版の番号順一覧と検索、および行の型変換。
- `src/db/comments.ts`: コメントの登録、project 単位の一覧、status 更新。JSON 列と
  shared の `Comment` の相互変換を担い、playback は `playback_json` へ nullable JSON として
  保存して常に `playback` キーを返す。
- `src/storage/files.ts`: `dataDir/uploads/<versionId>.glb` への一時ファイル経由の非同期保存・削除。拡張子 `.glb` は内部名で、中身の形式とは無関係。
- `src/routes/projects.ts`: multipart モデルアップロード、既存 project への版追加、project JSON
  の取得とモデル本体の配信を提供する。複数ファイルの保存と projects / model_versions 登録を
  同一処理で行い、失敗時は保存済みファイルを削除する。版追加成功後は `object:added` を publish
  し、`MODEL_CONTENT_TYPES` 由来の Content-Type と immutable キャッシュヘッダを設定する。
- `src/routes/project-upload.ts`: multipart の file フィールド(単一または配列)を全件検証し、
  検証済みのファイル名・バイト列へ変換する。File 以外、形式不正、サイズ超過を API エラーへ変換する。
- `src/routes/comments.ts`: project 配下のコメント一覧、投稿、status 更新を提供する。
  一覧は `status` 絞り込みと `created_at` 昇順に対応し、投稿・更新は保存後にそれぞれ
  `comment:created` / `comment:updated` を `publish` へ渡す。project、version、comment の
  不在は `NOT_FOUND`、不正な JSON / 入力は `VALIDATION` を返す。
- `src/routes/upload-validation.ts`: glTF/GLB/FBX/OBJ の拡張子・マジックバイト/JSON/頂点行の検査。
- `src/routes/static.ts`: `WEB_DIST_DIR` 配下の GET / HEAD 静的ファイルを配信する。`/assets/`
  配下は immutable キャッシュ、それ以外は no-cache とし、拡張子なしの未知パスは
  `index.html` へ SPA フォールバックする。`/api/`、拡張子付きの不在ファイル、GET / HEAD
  以外は後段へ渡し、字句解決と realpath の両方で root 外への traversal / symlink 脱出を拒否する。
- `src/realtime/room-display.ts`: ルーム共有の表示状態はすべてここに置く(設計書 §13.5)。
  ライト、非表示の版、非表示の部位集合、メッシュ表示方法、メッシュ比較設定、ジョイント表示設定、モーション軌跡表示設定を更新し、
  welcome 用に必要な値だけ複製して復元する。部位集合は `hiddenParts` として挿入順を保ち、
  `hiddenPartsOf` が部位参照も複製した配列を返す。
- `src/realtime/room-state.ts`: ルームの `Connection` / `Room` データ構造、接続・ルーム・ストローク上限、Presence 色、`Outbound` 型、
  空ルーム生成、色割り当て、camera / user / stroke の複製ヘルパを提供する。`Room.display` は `room-display.ts` の状態を保持する。
- `src/realtime/room-strokes.ts`: ルーム内ストロークの追加・所有者検証・上限検証・削除・clear を担当する。ストロークの保存値と
  `stroke:add` 配信用の値は別インスタンスにし、エラーは `BAD_REQUEST` の `Outbound` として返す。
- `src/realtime/hub.ts`: `ws` 非依存のインメモリ RoomHub。接続・join 済み Presence、カメラ、ルーム参照を project 単位で管理し、
  表示状態は `room-display.ts`、ストローク操作は `room-strokes.ts` に委譲する。camera メッセージの `focalLength` は参加者ごとに保持する。
  未指定の camera でも直前の値を保って中継し、`welcome` / `user:joined` / `usersIn` にも載せる。
  `hiddenObjectPartsIn` で非表示部位の挿入順複製を返し、`jointDisplayIn` / `motionTrailIn` で表示設定を返す。接続ごとの配信先を `Outbound` で返す。
- `src/realtime/ws.ts`: `GET /ws?projectId=<id>` を既存の Node HTTP Server に接続する WebSocket
  アダプタ。`RealtimeOptions.projectExists` で project の存在を確認してから Hub に接続し、
  接続時は projectId、Origin (指定時は Host 一致)、project 存在、接続上限の順に検証する。
  projectId 不在や不許可 Origin は `BAD_REQUEST`、project 不在は `NOT_FOUND` を送って close
  `1008`、接続上限は `BAD_REQUEST` を送って close `1013` する。`maxPayload` は
  `MAX_WS_PAYLOAD_BYTES = 256 KiB` とし、スキーマ違反は `VALIDATION` を返して同一接続で
  20回連続すると close `1008` する。
- `src/app.ts`: `createApp(deps)`。厳密な `Content-Length` 検証を含むリクエスト本体の
  bodyLimit、共通の `nosniff` ヘッダ、500 時の `request_failed` ログ、JSON 404、
  `/api/projects` と
  `/api/projects/:projectId/versions` と `/api/projects/:projectId/comments` のマウント、および
  最後の static route のマウントを担う。project 作成・版追加 multipart の本体上限も検査する。
- `src/index.ts`: `DATA_DIR` を作成して SQLite / ファイルストレージ / Hono HTTP / WebSocket を
  1プロセスで起動するエントリポイント。起動時に `server_started` の JSON 1行をログ出力する。
- `tests/helpers/tmp.ts`: `server/.vite/test-tmp` 配下の一時ディレクトリ管理。
- `tests/helpers/ws.ts`: ephemeral HTTP server と実 WebSocket を使う realtime テスト fixture。
- `tests/helpers/app.ts`: 固定時刻・インメモリ DB・一時ファイルストレージを使う `TestApp` と
  `makeTestApp` / `seedProject` / `seedComment`。`seedComment` は任意の `playback` をそのまま
  保存でき、省略時は null として扱う。
- `tests/config.test.ts`: 設定値と入力検証のテスト。
- `tests/routes-static.test.ts`: Content-Type、静的ファイル、キャッシュ、SPA フォールバック、
  HEAD、API 非横取り、パストラバーサル、未存在 root のテスト。
- `tests/errors.test.ts`: HTTP / Zod / 未知エラーの応答変換テスト。
- `tests/db-projects.test.ts`: SQLite 接続、スキーマ、トランザクション、projects 層の全版一覧・検索テスト。
- `tests/db-comments.test.ts`: comments 層の JSON 往復、FK、一覧順序・status 絞り込み、
  project スコープ、status トグル、playback の保存・null・status 更新維持のテスト。
- `tests/db-migrate.test.ts`: playback_json 列の新規作成、旧 comments 定義からの nullable 列移行、
  旧行の null 読み出し、再移行の冪等性、汎用 `addColumnIfMissing` のテスト。
- `tests/storage-files.test.ts`: ファイル保存、上書き、rename 失敗時の tmp 残留防止、削除のテスト。
- `tests/app.test.ts`: JSON 404、未知エラーの 500 応答と `request_failed` ログ、
  期待される HTTP エラーのログ抑制のテスト。
- `tests/app-body-limit.test.ts`: project 作成・版追加 multipart とコメント JSON の Content-Length /
  chunked 本体上限、本体なしのコメント一覧のテスト。
- `tests/routes-projects-read.test.ts`: project 取得、glTF/GLB/FBX/OBJ と未知拡張子のモデル配信、Content-Type、キャッシュ、
  project/version/file の NOT_FOUND のテスト。
- `tests/upload-validation.test.ts`: モデル拡張子、GLB/glTF/FBX/OBJ の内容検査のテスト。
- `tests/routes-projects-upload.test.ts`: multipart の単一・複数 POST、Project 応答、保存ファイル、
  入力検証、上限超過、全件事前検証、DB 失敗時の後始末のテスト。
- `tests/routes-projects-formats.test.ts`: FBX / OBJ の作成・版追加、複数形式混在、内容不正の multipart テスト。
- `tests/routes-project-versions.test.ts`: 既存 project への版追加、2回追加後の全版取得と採番、publish、
  存在しない project、単一ファイル制約、形式不正、DB 失敗時の後始末のテスト。
- `tests/routes-comments.test.ts`: コメント一覧の順序・絞り込み、投稿・status 更新、入力検証、
  project/version スコープ、publish 呼び出しのテスト。
- `tests/routes-comments-playback.test.ts`: コメント投稿の playback 保存・応答・publish・一覧反映、
  省略/null の既定値、入力検証、seed fixture の playback テスト。
- `tests/realtime-ws.test.ts`: join、Presence、camera / stroke 配信、切断、入力検証、連続違反 close、
  REST publish 結線の実ソケットテスト。
- `tests/realtime-hub-focal.test.ts`: RoomHub の camera `focalLength` の保持・中継、Presence への
  反映、未指定時のキー省略、切断・再join、stroke との独立性を検証する。
- `tests/realtime-hub-light.test.ts`: RoomHub のライトの中継、後勝ち保持、welcome への反映、値の複製、ルーム分離・削除を検証する。
- `tests/realtime-hub-objects.test.ts`: RoomHub のオブジェクト可視性のルーム単位保持、Set の挿入順、welcome 反映と配列複製、ルーム分離・削除、未参加接続の無視、他状態との独立性を検証する。
- `tests/realtime-hub-parts.test.ts`: RoomHub の版内部位可視性のルーム単位保持、版・パス単位の挿入順、welcome と読み取り口の複製、版単位可視性との独立性、ルーム分離・削除、未参加接続の無視、他状態との独立性を検証する。
- `tests/realtime-hub-display.test.ts`: RoomHub のメッシュ表示方法の中継、後勝ち保持、welcome 反映、ルーム分離・削除、未参加接続の無視、他状態との独立性を検証する。
- `tests/realtime-hub-compare.test.ts`: RoomHub のメッシュ比較設定の複製・中継、後勝ち保持、welcome 反映、既定値、ルーム分離・削除、未参加接続の無視、他状態との独立性を検証する。
- `tests/realtime-hub-joint.test.ts`: RoomHub のジョイント表示設定の複製・中継、後勝ち保持、welcome 反映、ルーム分離・削除、未参加接続の無視、他状態との独立性を検証する。
- `tests/realtime-hub-trail.test.ts`: RoomHub のモーション軌跡表示設定の複製・中継、welcome 反映、未設定値の省略、未定義ルーム参照を検証する。
- `tests/room-display.test.ts`: ルーム共有表示状態の初期化、7種の更新・中継、値の複製、welcome 復元フィールドを検証する。
- `tests/realtime-guards.test.ts`: project / Origin / 接続数 / ルーム数 / payload の接続ガードと、
  stroke 所有者検証・上限内の大きな stroke のテスト。
- `tests/room-state.test.ts`: `createRoom` の独立性、色割り当て、定数、camera / user / stroke の複製ヘルパを検証する。
- `tests/room-strokes.test.ts`: ストローク追加の所有者・時刻・上限・複製、remove、clear の直接操作を検証する。
- `tsconfig.json`: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)。
- `vitest.config.ts`: テスト設定(tests/**/*.test.ts、cacheDir は .vite)。

## 公開インターフェイス
- `loadConfig`: `PORT`、`DATA_DIR`、`MAX_UPLOAD_BYTES`、`WEB_DIST_DIR` から `Config` を作る。
- `HttpError` / `toErrorResponse`: API のエラーコード・HTTP ステータス・メッセージを統一する。
- `openDb` / `migrate` / `withTransaction`: SQLite 接続とトランザクションを管理する。
- `addColumnIfMissing`: 指定テーブルの PRAGMA 列一覧を確認し、列が無い場合だけ指定定義で
  `ALTER TABLE ... ADD COLUMN` を実行する。`migrate` は schema.sql の後に comments の
  `playback_json TEXT` 移行を適用する。
- `insertProject` / `insertModelVersion`: プロジェクトと版を登録する。
- `listModelVersions` / `findProject` / `findModelVersion`: 全版を番号昇順で列挙し、shared の `Project` / `ModelVersion` へ変換して検索する。
- `insertComment`: `NewComment` を status `open` として登録し、playback を nullable JSON として
  保存した `Comment` を返す。未指定・null は `playback: null` になる。
- `listComments`: project 単位でコメントを順序付き一覧する。
- `updateCommentStatus`: project と comment を指定して status と更新時刻を変更する。
- `Storage` / `createFileStorage`: モデルファイルを atomic rename で保存し、保存先を返す。
- `AppDeps` / `createApp`: DB、Storage、Config、publish、時刻、ID 生成を注入して Hono を構築する。
  multipart とコメント JSON の本体上限を強制し、全レスポンスに `X-Content-Type-Options: nosniff`
  を付ける。未知の 500 は `request_failed` の JSON 1 行を記録する。
- `MAX_JSON_BODY_BYTES` / `MULTIPART_OVERHEAD_BYTES`: コメント JSON の 1 MiB 上限と、
  multipart 本体上限へ加える 64 KiB の余裕を公開する。
- `projectRoutes`: `GET /api/projects/:projectId` と
  `GET /api/projects/:projectId/versions/:versionId/model`、`POST /api/projects`、
  `POST /api/projects/:projectId/versions` を提供する。作成 POST は multipart の `name` と
  1件以上の `file` を送信順に受け、201 で全 `versions` を含む `Project` を返す。版追加 POST は
  1件の `file` を受け、採番済み `ModelVersion` を201で返し、DB反映後に `object:added` を publish
  する。名前は trim して保存し、不正な入力は `VALIDATION`、非 glTF/GLB/FBX/OBJ は
  拡張子不正は HTTP 415 の `UNSUPPORTED_FORMAT`、内容不正は HTTP 400 の
  `UNSUPPORTED_FORMAT`、上限超過は `PAYLOAD_TOO_LARGE`、保存後の DB 失敗など予期しないエラーは
  `INTERNAL` を返す。
- `readUploadedModels`: multipart の file フィールドを検証済み `UploadedModel[]` へ変換する。
- `commentRoutes`: `GET /api/projects/:projectId/comments` は `Comment[]` を返し、任意の
  `status=open|resolved` で絞り込む。POST は `CreateCommentInput` を検証し、対象 version が
  project に属することを確認して 201 の `Comment` と `comment:created` を返す。PATCH は
  `UpdateCommentStatusInput` を検証して 200 の `Comment` と `comment:updated` を返す。
  いずれも対象 project が無ければ `NOT_FOUND`、入力不正なら `VALIDATION` を返す。
- `contentTypeFor` / `resolveStaticPath` / `staticRoutes`: 静的ファイルの Content-Type 判定、
  root 配下の安全なパス解決、`index.html` を使った SPA フォールバック付き配信を提供する。
- `RoomDisplayState` / `createRoomDisplayState` / `applyDisplayMessage` / `displayWelcomeFields` / `hiddenPartsOf`:
  ルーム共有の表示状態を更新・中継し、非表示部位の挿入順複製配列と welcome の復元フィールドを作る。
- `Room` / `Connection` / `createRoom` / `colorFor` / `copyCamera` / `copyUser` / `copyStroke`:
  `room-state.ts` でルーム構造と複製・色割り当てを提供する。`PRESENCE_PALETTE`、`MAX_CONNECTIONS`、`MAX_ROOMS`、
  `MAX_ROOM_STROKES`、`Outbound`、`OutboundTarget` は `hub.ts` からも後方互換に再エクスポートする。
- `addStroke` / `removeStroke` / `clearStrokes`:
  `room-strokes.ts` で所有者に基づくストローク操作と配信用 `Outbound` を提供する。
- `RoomHub`: `connect` / `disconnect` / `handle` で接続とルーム状態を操作し、
  `connectionsIn` / `projectOf` / `usersIn` / `strokesIn` / `hiddenObjectsIn` で結線側やテストから状態を参照する。
  camera の `focalLength` は参加者単位で最後に指定された値を保持し、未指定の camera 中継でも
  その値を維持する。未指定の参加者はキーを持たず、保持値は `welcome` / `user:joined` /
  `usersIn` の Presence に反映される。表示状態の更新・中継・welcome 復元は `room-display.ts` が担い、
  `hiddenObjectsIn` / `hiddenObjectPartsIn` / `meshDisplayIn` / `meshCompareIn` / `jointDisplayIn` / `motionTrailIn` は現在値を参照する。
  `motionTrailIn` は未設定または存在しないルームでは `null`、設定済みの場合はルーム内の実体を複製して返す。
  `Outbound.target` は `self` (送信元のみ)、`others` (送信元以外)、`all` (ルーム全員) を表す。
  `PRESENCE_PALETTE` は8色で、ルーム内の未使用色をjoin順に割り当て、全色使用時はサイズの剰余で
  再利用する。`MAX_ROOM_STROKES = 2000` 本まで保持し、同じIDの追加は所有者自身による場合だけ
  既存線を置換するため上限到達後も許可する。`MAX_ROOMS = 200` 到達後も既存ルームへの join は
  可能で、全員退室した空ルームは削除される。
- `attachRealtime` / `Realtime`: `GET /ws?projectId=<id>` の接続、送受信、切断通知、REST の
  `publish`、WebSocketServer の `close` を提供する。`RealtimeOptions` は project 存在判定を
  受け取り、`MAX_WS_PAYLOAD_BYTES = 256 * 1024` の受信上限を適用する。`npm run dev:server` または `npm start` で
  HTTP と WS を同時に起動し、`PORT` / `DATA_DIR` / `MAX_UPLOAD_BYTES` を環境変数で設定できる。

## 他機能との関係
`shared/src/api.ts` の `ErrorCode`、`ApiError`、`MAX_UPLOAD_BYTES_DEFAULT` と、
`shared/src/types.ts` の `Project`、`ModelVersion`、`Comment` 関連型を利用する。後続の
server ルートと WS 配信は、この接続・トランザクション・projects / comments 層を共有する。
`createApp` は API ルートを先に、`WEB_DIST_DIR` の static route を最後に登録するため、
API の 404 は SPA にフォールバックしない。
