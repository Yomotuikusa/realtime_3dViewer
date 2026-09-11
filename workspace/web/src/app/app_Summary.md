# app

## 目的
ブラウザ履歴による入口ルーティング、モデルのアップロード画面、WebSocket の接続状態と受信イベントをレビュー画面へ反映する。

## ファイル一覧と役割
- App.tsx: 現在のルートに応じた画面分岐。NotFound はパスと `/` へ戻る履歴遷移を表示する
- routes.ts: `/` と `/p/<projectId>` のルート解析、遷移、popstate フック
- display-name.ts: localStorage による表示名の保存、Guest 名生成、入室名の解決
- JoinDialog.tsx: 保存済み表示名を初期値にした入室フォーム
- JoinDialog.tsx: 保存済み表示名を初期値にした、入室前にビューアを覆うモーダルフォーム。表示名の解決・保存・入室コールバックは display-name と呼び出し側へ委譲する
- realtime-dispatch.ts: `ServerMessage` を session / presence / annotation / comments / lighting ストアへ振り分ける入口。`welcome` の共有ライト、presence 更新（camera の焦点距離を含む）、light、stroke、`comment:created` / `comment:updated`、`error` を扱い、未知の型はコンパイル時に検出する
- useRealtime.ts: 名前決定後の `WsClient` 接続と、open ごとの `join` 送信。`onRealtimeStatus` は session の接続状態を更新し、open 時に lastError を解除する
- review-stores.ts: レビュー画面のアンマウント時に session / presence / annotation / comments / camera / lighting の6ストアをまとめて初期化する reset 関数（shortcuts ストアは対象外）
- UploadPage.tsx: トークン CSS で構成したプロジェクト名・`.glb`/`.gltf` のアップロード画面。拡張子と容量を送信前に検査し、`FILE_TOO_LARGE` などのエラーを表示する
- upload-labels.ts: アップロード画面と NotFound の表示文言、`FILE_TOO_LARGE`、ファイル容量 helper の純粋関数
- upload.css: アップロード画面と NotFound の狭い幅のレイアウト CSS
- ReviewPage.tsx: プロジェクト取得、レビュー画面の骨格、ロード状態・エラーカード、ビューアとサイドパネルのレイアウトを担当する。Canvas に RemoteCameras / RoomStrokes / ReplayStrokes / AnnotationLayer / CommentPickLayer / CommentPins を配置し、`.review-hud` を 025 の HUD 差し込み口、`.review-panel__comments` を 026 のコメント領域差し込み口として提供し、入室後だけショートカットを有効にする。入室後は設定ダイアログの開閉状態も保持し、表示中はショートカットを無効にする
- ReviewHeader.tsx: 接続状態バッジ、入室後の自分の表示名・色、レビュー URL のコピーと失敗時の手動コピー欄を表示し、入室後だけショートカット設定を開くボタンを表示する
- review-labels.ts: 接続状態・コピー状態・ロード/エラー文言を定義する JSX 非依存の純粋関数と定数
- review.css: レビュー画面のヘッダ、ビューア/HUD、入室 backdrop/dialog、サイドパネル、ロード/エラー状態のプレーン CSS
- ErrorBoundary.tsx: React/three の描画例外を捕捉し、フォールバックを表示

## 公開インターフェイス
- routes.ts: `Route`、`parseRoute`、`projectPath`、`navigate`、`useRoute`
- App.tsx: `App`
- UploadPage.tsx: `UploadPage`
- upload-labels.ts: `APP_NAME` など画面文言、`FILE_TOO_LARGE`、`fileHelp`、`fileSummary`
- ReviewPage.tsx: `ReviewPage({ projectId })`
- ReviewHeader.tsx: `ReviewHeader({ projectName, joined, onOpenSettings })`
- review-labels.ts: `connectionLabel`、`connectionTone`、`copyLabel`、`copyText`、ロード/エラー文言定数
- display-name.ts: `loadStoredName`、`saveName`、`guestName`、`resolveDisplayName`
- JoinDialog.tsx: `JoinDialog({ onJoin })`
- useRealtime.ts: `useRealtime(projectId, name)`、`onRealtimeStatus`、`Realtime`
- review-stores.ts: `resetReviewStores()`
- realtime-dispatch.ts: `dispatchServerMessage`
- ErrorBoundary.tsx: `ErrorBoundary`

## 他フォルダとの関係
ルーティングは `/` を upload、正規表現 `^/p/[A-Za-z0-9_-]+$` に一致するパスを review、それ以外を notFound とする。`navigate` は `pushState` 後に `popstate` を通知する。

`App` は projectId を `ReviewPage` の React key に使い、プロジェクト切替時のアンマウントで `resetReviewStores()` を実行して6ストアを初期化する。`ReviewPage` は ready/error に取得対象の `projectId` を保持し、現在の URL と一致しない間は
旧画面を表示せず loading として扱う。
入室後は `useRealtime` が同一オリジンの `/ws?projectId=...` へ接続し、`open` ごとに `lastError` を解除してから `join` を
送る。`WsClient` は失敗回数に応じて 1000ms から 10000ms まで指数バックオフし、成功接続で
失敗回数をリセットする。明示的な `close` 後は再接続しない。
`dispatchServerMessage` は `welcome` で session の self ID/色、presence の参加者一覧、annotation のライブ線、任意の共有ライトを確定し、
`user:joined` / `user:left` / `camera` を presence ストアへ、`stroke:add` / `stroke:remove` / `stroke:clear` を
annotation ストアへ、`light` を lighting ストアへ、`comment:created` / `comment:updated` を comments ストアへ、`error` を `CODE: message` として保存する。

## テスト
- tests/display-name.test.ts: 表示名の trim、保存、Guest 名、localStorage 例外のテスト
- tests/realtime-dispatch.test.ts: welcome の session / presence / annotation / light 反映、焦点距離を含む presence/stroke/comment イベント、error、未対応イベント、reset のテスト
- tests/review-labels.test.ts: 接続状態・コピー状態・ロード/エラー文言のテスト
- tests/review-stores.test.ts: 6つのレビュー用ストアをまとめて初期化する reset の検証
- tests/routes.test.ts: ルート解析と履歴遷移テスト
- tests/upload-labels.test.ts: アップロード/NotFound 文言、容量エラー定数、ファイル helper の単位・丸め結果を検証
- tests/use-realtime.test.ts: 接続状態、open 時のエラー解除と join、closed 時の非送信を検証
