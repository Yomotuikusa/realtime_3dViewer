# web

## 目的
REST API の fetch クライアント、ブラウザ履歴による入口ルーティング、モデルのアップロード画面、
glTF/GLB の 3D レビュー画面を提供する。レビュー画面は表示名を決めて入室し、WebSocket の
接続状態と受信イベントを各機能ストアへ反映する。

## 構成と Summary の置き場
ソースファイルは、そのファイルのディレクトリから `web/` へ向かって最も近い
`<フォルダ名>_Summary.md` に、その Summary のあるフォルダからの相対パスで載せる。
テストは、対応するソースが載っている Summary の `## テスト` 節にファイル名で載せる。
対応するソースがない共通テストはこの Summary の `## テスト` に載せる。

フォルダ Summary は `# <フォルダ名>` / `## 目的` / `## ファイル一覧と役割` /
`## 公開インターフェイス` / `## 他フォルダとの関係` / `## テスト` の節構成とする。

- `src/app/app_Summary.md`
- `src/store/store_Summary.md`
- `src/features/viewer/viewer_Summary.md`
- `src/features/compare/compare_Summary.md`
- `src/features/timeline/timeline_Summary.md`
- `src/features/annotation/annotation_Summary.md`
- `src/features/comments/comments_Summary.md`
- `src/features/presence/presence_Summary.md`
- `src/features/objects/objects_Summary.md`
- `src/features/outliner/outliner_Summary.md`
- `src/features/joint/joint_Summary.md`
- `src/features/trail/trail_Summary.md`
- `src/features/shortcuts/shortcuts_Summary.md`
- `src/features/layout/layout_Summary.md`
- `src/features/theme/theme_Summary.md`

ソースの追加時は、最も近い Summary の「ファイル一覧と役割」と「公開インターフェイス」を更新し、
対応するテストの追加時は同じ Summary の「テスト」を更新する。

## 共通ファイル
- src/api/client.ts: REST の URL（各パスセグメントを URI エンコード）、JSON/FormData リクエスト、プロジェクトの複数ファイル作成・版追加・版削除、レスポンス検証、`ApiClientError`
- src/api/ws.ts: `WsClient`、WebSocket URL、接続状態通知、指数バックオフによる再接続
- src/main.tsx: React アプリのエントリーポイント。tokens → base → controls の順で全体スタイルを読み込む
- src/styles/tokens.css: 色・文字・間隔・角丸・動き・レイアウトのセマンティックトークン。既存 inline 値を引き継ぎ、`:root` にライト値を定義し、`:root[data-theme="dark"]` にダーク値の上書きブロックを持つ
- src/styles/base.css: 全画面共通のリセット、既定の本文、可視フォーカスリング、reduced-motion。クラスは定義しない
- src/styles/controls.css: `.btn` / `.field` / `.input` / `.alert` / `.badge` の共通コントロール。状態は属性セレクタで表現する
- スタイル規約(D35)はプレーン CSS とし、全体共通のトークン・ベース・コントロールを `src/styles/` に置く。色は `tokens.css` のセマンティック変数経由、状態はクラスの付け替えではなく `aria-*` / `disabled` / `data-*` で表現し、画面固有の CSS は各機能フォルダ側に置く。
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: Vitest の対象を `tests/**/*.test.{ts,tsx}` に限定する設定(cacheDir は .vite)

### 公開インターフェイス
- src/api/client.ts: `ApiClientError`、`RESPONSE_INVALID_MESSAGE`、`modelUrl`、`createProject(name, files)`、`addModelVersion(projectId, file)`、`deleteModelVersion(projectId, versionId)`、`getProject`、`listComments`、`createComment`、`updateCommentStatus`
- src/api/ws.ts: `WsClient`、`wsUrl`、`SocketLike`、再接続定数

API クライアントは同一オリジンの `/api/...` を使い、URL の projectId / versionId / commentId を `encodeURIComponent` でエンコードする。`createProject` は FormData に name と files を順番どおり append し、`addModelVersion` は1ファイルを版追加エンドポイントへ送る。2xx 応答を共有 zod スキーマで検証し、成功本文の不一致は `ApiClientError(status, "VALIDATION", RESPONSE_INVALID_MESSAGE)` とする。API エラー本文を解析できる場合は `ApiClientError(status, code, message)`、ネットワーク断や解析不能なエラーは `INTERNAL` とする。

## 他機能フォルダとの関係
`@shared/api` の API エラー・入力型・アップロード拡張子と、`@shared/types` の Project/Comment スキーマを利用する。

## テスト
- tests/api-client.test.ts: API クライアントの URL、body、エラー、スキーマ検証テスト
- tests/api-delete-version.test.ts: 版削除 API の204成功、エンコード、構造化エラー、非JSONエラー、通信失敗のテスト
- tests/ws-client.test.ts: JSON 送受信、入力破棄、再接続バックオフ、明示 close のテスト
- tests/styles-rules.test.ts: `src/**/*.css` を再帰走査し、トークンの `:root` 定義、tokens.css 以外の生色禁止、CSS 変数の宣言/フォールバック、`!important` / `@import` 規約、main.tsx の import 順を検証
- tests/summary-coverage.test.ts: Summary の命名、ソース・テストの掲載、web_Summary.md からの索引を検証
