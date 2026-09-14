# app

## 目的
ブラウザ履歴による入口ルーティング、モデルのアップロード画面、WebSocket の接続状態と受信イベントをレビュー画面へ反映する。

## ファイル一覧と役割
- App.tsx: `ThemeEffect` を全ルートの外側に配置し、`routeContent` で現在のルートに応じた画面分岐を行う。NotFound はパスと `/` へ戻る履歴遷移を表示する
- routes.ts: `/` と `/p/<projectId>` のルート解析、遷移、popstate フック
- display-name.ts: localStorage による表示名の保存、Guest 名生成、入室名の解決
- JoinDialog.tsx: 保存済み表示名を初期値にした、入室前にビューアを覆うモーダルフォーム。表示名の解決・保存・入室コールバックは display-name と呼び出し側へ委譲する
- realtime-dispatch.ts: `ServerMessage` を session / presence / annotation / comments / lighting / objects / display ストアへ振り分ける入口。`welcome` の共有ライト・メッシュ表示方法・メッシュ比較設定・ジョイント表示設定・モーション軌跡表示設定・再生対象・非表示版・`hiddenObjectParts`、presence 更新（camera の焦点距離を含む）、light、stroke、`comment:created` / `comment:updated`、オブジェクト可視性・部位の `object:part-visibility`・追加、`mesh:display` / `mesh:compare` / `joint:display` / `trail:display` / `playback:source`、`error` を扱い、未知の型はコンパイル時に検出する
- useRealtime.ts: 名前決定後の `WsClient` 接続と、open ごとの `join` 送信。`onRealtimeStatus` は session の接続状態を更新し、open 時に lastError を解除する
- review-stores.ts: レビュー画面のアンマウント時に session / presence / annotation / comments / camera / lighting / objects / display / playback / selection の10ストアをまとめて初期化する reset 関数（shortcuts ストアは対象外）
- UploadPage.tsx: `.glb`/`.gltf`/`.fbx`/`.obj` のアップロード画面。`accept` は `ALLOWED_MODEL_EXTENSIONS` 由来で、OBJ が材質なし表示になる注記を常時出す
- upload-labels.ts: アップロード画面と NotFound の表示文言、OBJ 材質なし表示注記、ファイル検証・複数ファイル容量表示 helper の純粋関数
- upload.css: アップロード画面と NotFound の狭い幅のレイアウト CSS
- ReviewPage.tsx: プロジェクト取得、レビュー画面の骨格、ロード状態・エラーカード、`.review-stage` とビュー下部タイムラインを含むビューア／サイズ変更可能な左ドックとサイドパネルのレイアウトを担当する。左ドック `.review-outliner` に realtime の `send` を渡した `Outliner` を配置し、`outlinerWidth` を保存する。右パネル優先で幅を計算し、Canvas に RemoteCameras / RoomStrokes / ReplayStrokes / AnnotationLayer / CommentPickLayer / CommentPins / `SelectionRig` / `VisibilityRig` / `JointRig` を配置し、右ドックに PresenceList / ObjectList / `.review-panel__comments` を順に配置する。`.review-hud` を HUD 差し込み口、`.review-panel__comments` をコメント領域差し込み口として提供し、カメラとライトの変更、コメント再生を realtime の `send` へ結線し、入室後だけショートカットを有効にする。設定表示中は `SettingsDialog` を表示し、タイムラインへ realtime の `send` を渡す
- ReviewHeader.tsx: 接続状態バッジ、入室後の自分の表示名・色、レビュー URL のコピーと失敗時の手動コピー欄を表示し、入室後だけ設定ダイアログを開くボタンを表示する
- SettingsDialog.tsx: `ShortcutSettings` と `ThemeSettings` をキー操作／表示色タブで切り替える設定ダイアログの枠を担当する
- review-labels.ts: 接続状態・コピー状態・ロード/エラー文言、設定ダイアログとタブのラベル、サイドパネル幅ハンドルのラベルを定義する JSX 非依存の純粋関数と定数
- review.css: レビュー画面のヘッダ、3列 grid の左ドック／`.review-stage` を含むビューア／右パネル、HUD、モデル読み込み失敗用の `.review-stage__error` オーバーレイ、設定／入室 backdrop/dialog、境界ハンドル、ロード/エラー状態のプレーン CSS
- ErrorBoundary.tsx: React/three の描画例外を捕捉し、フォールバックを表示

## 公開インターフェイス
- routes.ts: `Route`、`parseRoute`、`projectPath`、`navigate`、`useRoute`
- App.tsx: `App`。内部の `routeContent` がルート別の画面を返し、`App` は `ThemeEffect` を全ルートへ適用する
- UploadPage.tsx: `UploadPage`
- upload-labels.ts: `APP_NAME` など画面文言、`FILE_TOO_LARGE`、`NO_FILE_SELECTED`、`UNSUPPORTED_EXTENSION`、`OBJ_MATERIAL_NOTE`、`FileLike`、`fileHelp`、`fileSummary`、`validateModelFiles`、`filesSummary`
- ReviewPage.tsx: `ReviewPage({ projectId })`。`features/layout` の `ResizeHandle` と `useLayoutSize` を使い左ドックの `outlinerWidth` とサイドパネル幅を保存し、右パネル優先でレイアウト幅を計算する
- ReviewHeader.tsx: `ReviewHeader({ projectName, joined, onOpenSettings })`
- review-labels.ts: `connectionLabel`、`connectionTone`、`copyLabel`、`copyText`、`SETTINGS_OPEN_LABEL`、`CLOSE_LABEL`、`SETTINGS_DIALOG_TITLE`、`SETTINGS_TABS_LABEL`、`SettingsTab`、`SETTINGS_TAB_ORDER`、`PANEL_RESIZE_LABEL`、ロード/エラー文言定数
- display-name.ts: `loadStoredName`、`saveName`、`guestName`、`resolveDisplayName`
- JoinDialog.tsx: `JoinDialog({ onJoin })`
- SettingsDialog.tsx: `SettingsDialog({ onClose })`
- useRealtime.ts: `useRealtime(projectId, name)`、`onRealtimeStatus`、`Realtime`
- review-stores.ts: `resetReviewStores()`
- realtime-dispatch.ts: `dispatchServerMessage`
- ErrorBoundary.tsx: `ErrorBoundary`

## 他フォルダとの関係
ルーティングは `/` を upload、正規表現 `^/p/[A-Za-z0-9_-]+$` に一致するパスを review、それ以外を notFound とする。`navigate` は `pushState` 後に `popstate` を通知する。

`App` は projectId を `ReviewPage` の React key に使い、プロジェクト切替時のアンマウントで `resetReviewStores()` を実行して10ストアを初期化する。`ReviewPage` は ready/error に取得対象の `projectId` を保持し、現在の URL と一致しない間は
旧画面を表示せず loading として扱う。
入室後は `useRealtime` が同一オリジンの `/ws?projectId=...` へ接続し、`open` ごとに `lastError` を解除してから `join` を
送る。`WsClient` は失敗回数に応じて 1000ms から 10000ms まで指数バックオフし、成功接続で
失敗回数をリセットする。明示的な `close` 後は再接続しない。
`dispatchServerMessage` は `welcome` で session の self ID/色、presence の参加者一覧、annotation のライブ線、任意の共有ライト・メッシュ表示方法・メッシュ比較設定・ジョイント表示設定・モーション軌跡表示設定・再生対象、非表示オブジェクト一覧と `welcome.hiddenObjectParts` を確定し、
`user:joined` / `user:left` / `camera` を presence ストアへ、`stroke:add` / `stroke:remove` / `stroke:clear` を
annotation ストアへ、`light` を lighting ストアへ、`comment:created` / `comment:updated` を comments ストアへ、`object:visibility` / `object:part-visibility` / `object:added` を objects ストアへ、`mesh:display` / `mesh:compare` / `joint:display` / `trail:display` / `playback:source` を display ストアへ反映し、`error` を `CODE: message` として保存する。welcome に比較設定、ジョイント表示設定、軌跡表示設定、または再生対象がない場合は既定値または null へ戻す。

## テスト
- tests/display-name.test.ts: 表示名の trim、保存、Guest 名、localStorage 例外のテスト
- tests/realtime-dispatch.test.ts: welcome の session / presence / annotation / light / objects / display 反映、`welcome.hiddenObjectParts` と welcome の `jointDisplay` / `motionTrail`、焦点距離を含む presence/stroke/comment イベント、object 追加・可視性・`object:part-visibility`、mesh:display / mesh:compare / `joint:display` / `trail:display`、error、未対応イベント、reset のテスト
- tests/realtime-dispatch-playback.test.ts: `playback:source` の welcome/event 反映と、display ストアの再生対象初期値・null・同値更新抑止・reset のテスト
- tests/review-labels.test.ts: 接続状態・コピー状態・ロード/エラー文言のテスト
- tests/review-stores.test.ts: 10個のレビュー用ストアをまとめて初期化する reset の検証
- tests/review-styles.test.ts: モデル読み込み失敗オーバーレイのCSS配置・重なり順・操作性と、ErrorBoundary フォールバックのJSX配置をソース検査
- tests/routes.test.ts: ルート解析と履歴遷移テスト
- tests/upload-labels.test.ts: 4形式のアップロード/NotFound 文言、OBJ 材質注記、対応形式の accept とヘルプ、容量エラー定数、複数ファイル検証とファイル helper の単位・丸め結果を検証
- tests/use-realtime.test.ts: 接続状態、open 時のエラー解除と join、closed 時の非送信を検証
- tests/settings-dialog.test.ts: 設定ダイアログの枠、タブ切り替え、表示内容、閉じる操作を検証
