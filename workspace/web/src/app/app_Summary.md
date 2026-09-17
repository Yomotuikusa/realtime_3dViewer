# app

## 目的
ブラウザ履歴による入口ルーティング、モデルのアップロード画面、WebSocket の接続状態と受信イベントをレビュー画面へ反映する。

## ファイル一覧と役割
- App.tsx: `ThemeEffect` を全ルートの外側に配置し、`routeContent` で現在のルートに応じた画面分岐を行う。NotFound はパスと `/` へ戻る履歴遷移を表示する
- routes.ts: `/` と `/p/<projectId>` のルート解析、遷移、popstate フック
- display-name.ts: localStorage による表示名の保存、Guest 名生成、入室名の解決
- JoinDialog.tsx: 保存済み表示名を初期値にした、入室前にビューアを覆うモーダルフォーム。表示名の解決・保存・入室コールバックは display-name と呼び出し側へ委譲する
- realtime-dispatch.ts: `ServerMessage` を session / presence / annotation / comments / lighting / objects / display ストアへ振り分ける入口。`welcome` の共有ライト（向き・明るさ）・メッシュ表示方法・メッシュ比較設定・ジョイント表示設定・モーション軌跡表示設定・再生対象・非表示版・`hiddenObjectParts`、presence 更新（camera の焦点距離を含む）、light、`light:brightness`、stroke、`comment:created` / `comment:updated`、オブジェクト可視性・部位の `object:part-visibility`・追加・削除、`mesh:display` / `mesh:compare` / `joint:display` / `trail:display` / `playback:source`、`error` を扱い、未知の型はコンパイル時に検出する
- object-removal.ts: 削除された versionId を objects / comments / selection / compare / playback の各ストアへ冪等に反映し、最後の版ならコメント投稿アンカーも解除する
- useRealtime.ts: 名前決定後の `WsClient` 接続と、open ごとの `join` 送信。`onRealtimeStatus` は session の接続状態を更新し、open 時に lastError を解除する
- review-stores.ts: レビュー画面のアンマウント時に session / presence / annotation / comments / camera / lighting / objects / display / playback / selection の10ストアをまとめて初期化する reset 関数（shortcuts ストアは対象外）
- UploadPage.tsx: `.glb`/`.gltf`/`.fbx`/`.obj` のアップロード画面。プロジェクト名の入力上限は `MAX_PROJECT_NAME_LENGTH` 由来で、`accept` は `ALLOWED_MODEL_EXTENSIONS` 由来。OBJ が材質なし表示になる注記を常時出す
- upload-labels.ts: アップロード画面と NotFound の表示文言、OBJ 材質なし表示注記、ファイル検証・複数ファイル容量表示 helper の純粋関数
- upload.css: アップロード画面と NotFound の狭い幅のレイアウト CSS
- ReviewPage.tsx: プロジェクト取得、レビュー画面の骨格、ロード状態・エラーカード、`.review-stage` とビュー下部タイムラインを含むビューア／サイズ変更可能な左ドックとサイドパネルのレイアウトを担当する。左右ドックは `DockColumn` で常時 DOM に置き、開閉状態を `useLayoutFlag` で保持・保存し、`useDockAnimation` でトグル直後だけ列幅を 200ms 補間しながら、閉じた列を `0px` と `inert` で畳む。左ドックには realtime の `send` を渡した `Outliner`、右ドックには上部バーと `.review-panel__body` 内の PresenceList / ObjectList / `.review-panel__comments` を順に配置する。幅の上限計算では閉じている側の予約幅を 0 にする。Canvas に RemoteCameras / RoomStrokes / ReplayStrokes / AnnotationLayer / CommentPickLayer / CommentPins / `SelectionRig` / `VisibilityRig` / `JointRig` を配置し、閉じたドックの `DockExpandButton` は `.review-hud` の左右に表示する。コメント欄はストアの最新オブジェクトに追随し、空シーンでは投稿案内を表示する。`.review-hud` を HUD 差し込み口、`.review-panel__comments` をコメント領域差し込み口として提供し、カメラとライトの向き・明るさの変更、コメント再生を realtime の `send` へ結線し、入室後だけショートカットを有効にする。設定表示中は `SettingsDialog` を表示し、タイムラインへ realtime の `send` を渡す
- ReviewHeader.tsx: 接続状態バッジ、入室後の自分の表示名・色、レビュー URL のコピーと失敗時の手動コピー欄を表示し、入室後だけ設定ダイアログを開くボタンを表示する。ドック開閉トグルは持たない
- ReviewDock.tsx: `DockColumn` でドックの `<aside>`、固定幅の内側、折りたたみバーと children を集約し、閉じた列を `inert` にする。`DockCollapseBar` と `DockExpandButton` は `DockSide` に応じた向きのシェブロンと aria 属性を設定する
- review-dock.css: 列幅 0 でも内側の開時幅を保つドック列、右ドックの grid、タイトル付き折りたたみバー、閉じ切ってから現れる HUD 再表示ボタン、シェブロンの CSS
- review-icons.tsx: ドックの折りたたみ／再表示ボタンに使うシェブロン SVG。viewBox・path 定数、`ChevronDirection`、`ChevronIcon` を公開する
- SettingsDialog.tsx: `ShortcutSettings`、`ThemeSettings`、`ViewSettings` をキー操作／表示色／表示と操作タブで切り替える設定ダイアログの枠を担当する
- review-labels.ts: 接続状態・コピー状態・ロード/エラー文言、設定ダイアログと 3 タブのラベル、ドック上部／HUD 再表示ボタンで共有する左右ドック開閉ラベル、サイドパネル幅ハンドルのラベルを定義する JSX 非依存の純粋関数と定数
- review.css: レビュー画面のヘッダ、3列 grid の左ドック／`.review-stage` を含むビューア／右パネル、3 列の `grid-column` 明示、開閉トグル時だけ列幅を補間する `.review-body`、`.review-panel__body`、HUD、モデル読み込み失敗用の `.review-stage__error` オーバーレイ、設定／入室 backdrop/dialog、境界ハンドル、ロード/エラー状態のプレーン CSS
- ErrorBoundary.tsx: React/three の描画例外を捕捉し、フォールバックを表示

## 公開インターフェイス
- routes.ts: `Route`、`parseRoute`、`projectPath`、`navigate`、`useRoute`
- App.tsx: `App`。内部の `routeContent` がルート別の画面を返し、`App` は `ThemeEffect` を全ルートへ適用する
- UploadPage.tsx: `UploadPage`
- upload-labels.ts: `APP_NAME` など画面文言、`FILE_TOO_LARGE`、`NO_FILE_SELECTED`、`UNSUPPORTED_EXTENSION`、`OBJ_MATERIAL_NOTE`、`FileLike`、`fileHelp`、`fileSummary`、`validateModelFiles`、`filesSummary`
- ReviewPage.tsx: `ReviewPage({ projectId })`。`features/layout` の `ResizeHandle`、`useLayoutSize`、`useLayoutFlag`、`useDockAnimation` を使い左ドック／サイドパネルの寸法と開閉を保存し、トグル時だけ列幅を補間しながら右パネル優先でレイアウト幅を計算する
- ReviewHeader.tsx: `ReviewHeader({ projectName, joined, onOpenSettings })`
- ReviewDock.tsx: `DockSide`、`DockColumn`、`DockCollapseBar`、`DockExpandButton`
- review-icons.tsx: `CHEVRON_ICON_VIEW_BOX`、`CHEVRON_LEFT_PATH`、`CHEVRON_RIGHT_PATH`、`ChevronDirection`、`ChevronIcon`
- review-labels.ts: `connectionLabel`、`connectionTone`、`copyLabel`、`copyText`、ドックタイトルと開閉用の `OUTLINER_TOGGLE_LABEL` / `PANEL_TOGGLE_LABEL` / `PANEL_DOCK_TITLE` / `dockRegionLabel`、`SETTINGS_OPEN_LABEL`、`CLOSE_LABEL`、`SETTINGS_DIALOG_TITLE`、`SETTINGS_TABS_LABEL`、`SettingsTab`、`SETTINGS_TAB_ORDER`、`PANEL_RESIZE_LABEL`、ロード/エラー文言定数
- display-name.ts: `loadStoredName`、`saveName`、`guestName`、`resolveDisplayName`
- JoinDialog.tsx: `JoinDialog({ onJoin })`
- SettingsDialog.tsx: `SettingsDialog({ onClose })`
- useRealtime.ts: `useRealtime(projectId, name)`、`onRealtimeStatus`、`Realtime`
- review-stores.ts: `resetReviewStores()`
- realtime-dispatch.ts: `dispatchServerMessage`
- object-removal.ts: `applyObjectRemoved`
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
  annotation ストアへ、`light` を lighting ストアへ、`comment:created` / `comment:updated` を comments ストアへ、`object:visibility` / `object:part-visibility` / `object:added` を objects ストアへ、`object:removed` は `applyObjectRemoved` へ委譲して全ストアの参照を掃除し、`mesh:display` / `mesh:compare` / `joint:display` / `trail:display` / `playback:source` を display ストアへ反映し、`error` を `CODE: message` として保存する。welcome に比較設定、ジョイント表示設定、軌跡表示設定、または再生対象がない場合は既定値または null へ戻す。空 project ではオブジェクトストアが空になるためコメント投稿欄の代わりに案内を表示する。

## テスト
- tests/api-delete-version.test.ts: 版削除 API の204成功、エンコード、構造化エラー、非JSONエラー、通信失敗のテスト
- tests/display-name.test.ts: 表示名の trim、保存、Guest 名、localStorage 例外のテスト
- tests/realtime-dispatch.test.ts: welcome の session / presence / annotation / light（向き・明るさ）/ objects / display 反映、`light:brightness`、`welcome.hiddenObjectParts` と welcome の `jointDisplay` / `motionTrail`、焦点距離を含む presence/stroke/comment イベント、object 追加・可視性・`object:part-visibility`、mesh:display / mesh:compare / `joint:display` / `trail:display`、error、未対応イベント、reset のテスト
- tests/realtime-dispatch-playback.test.ts: `playback:source` の welcome/event 反映と、display ストアの再生対象初期値・null・同値更新抑止・reset のテスト
- tests/realtime-dispatch-object-removal.test.ts: `object:removed` の受信を全ストア削除反映へ結線するテスト
- tests/object-removal.test.ts: 選択・比較・再生対象・投稿アンカーを含む削除反映の冪等性テスト
- tests/review-labels.test.ts: 接続状態・コピー状態・ロード/エラー文言のテスト
- tests/review-stores.test.ts: 10個のレビュー用ストアをまとめて初期化する reset の検証
- tests/review-styles.test.ts: モデル読み込み失敗オーバーレイのCSS配置・重なり順・操作性と、ErrorBoundary フォールバックのJSX配置をソース検査
- tests/routes.test.ts: ルート解析と履歴遷移テスト
- tests/upload-labels.test.ts: 4形式のアップロード/NotFound 文言、OBJ 材質注記、対応形式の accept とヘルプ、容量エラー定数、複数ファイル検証とファイル helper の単位・丸め結果を検証
- tests/upload-page.test.ts: UploadPage のプロジェクト名入力が共有の `MAX_PROJECT_NAME_LENGTH` を使うことをソース検査
- tests/use-realtime.test.ts: 接続状態、open 時のエラー解除と join、closed 時の非送信を検証
- tests/settings-dialog.test.ts: 設定ダイアログの枠、3 タブ切り替え、表示内容、ショートカット捕捉抑止、閉じる操作を検証
- tests/dock-toggle.test.ts: ドック上部のタイトル付き折りたたみバー、HUD 再表示ボタン、シェブロン、ヘッダからのトグル削除、開閉状態 hook の保存を検証
- tests/dock-structure.test.ts: `DockColumn` の常時描画・`inert`・タイトル／aria、ReviewPage の集約構造、ドック CSS の配置を検証
