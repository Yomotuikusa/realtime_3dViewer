# タスク分割台帳(起票担当の引き継ぎ用)

`docs/3dreviewer-plan-and-architecture.md`(以下「設計書」)を orch のタスクに分解した
台帳である。起票は 4 回に分けて行う。**後任の起票担当はこのファイルと設計書を読み、
自分の回の id だけを起票する**。既に起票済みの md(`tasks/`)を先に 1〜2 本読んで、
書式・粒度・「前提」の書き方を揃えること。

- 第1回(起票済み): 001〜007 … shared 全部 + server の DB/アップロードまで
- 第2回(起票済み): 008〜014 … server の comments/RoomHub/WS + web のビューアまで
- 第3回(起票済み): 015〜022 … web の Follow/Annotation/Comment + 静的配信 + 骨組み除去
- 第4回(起票済み): 023〜027 … web の UI 実装(スタイル基盤 → レビュー画面骨格 → HUD → サイドパネル → アップロード)。
  設計書には無い回で、根拠は §5 に書く

## 0. 骨組みの現状(人間側で整備済み、2026-09-09 時点)

設計書 §23 の骨組みは整備済み。起票時に確認した事実:

- root `workspace/package.json` のみ(npm workspaces なし)。scripts:
  `typecheck` / `test:shared` / `test:server` / `test:web` / `build` / `dev:server` / `dev:web` / `start`
- `start` は `tsx` で `server/src/index.ts` を直接起動する(server の tsc ビルドは無い)。
  設計書 §18 の `node server/dist/index.js` は使わない
- 主要バージョン: TypeScript 7.0.2 / zod **4.5.4** / React **19.2** / three 0.186 /
  @react-three/fiber 9.7 / @react-three/drei 10.7 / hono 4.13 / @hono/node-server 2.1 /
  ws 8.21 / zustand 5 / nanoid 6 / vite 8 / vitest 5 / jsdom 29
- `@shared/*` alias は tsconfig `paths` と各 vitest/vite config の `resolve.alias` で解決済み
- `shared/src/index.ts` `server/src/index.ts` `web/src/main.tsx` はプレースホルダ。
  `SHARED_SCAFFOLD` という export を server/web が import しているので、
  **022 まで `shared/src/index.ts` から `SHARED_SCAFFOLD` を消してはならない**
  (消すと server/web の typecheck が落ちる)
- `config/orch.toml`: `ro_binds = ["/opt/3dreviewer/deps/node_modules"]`, `ignore_dirs = ["node_modules","dist",".vite"]`
- `node:sqlite` は Node 24.12 で `DatabaseSync` が使える(ExperimentalWarning が出るが無害)
- typecheck は空の状態で通ることを確認済み

## 1. 分割方針

- 機能フォルダは `shared` / `server` / `web` の 3 つ。同じフォルダの Summary.md を複数タスクが
  owns に持つため、**同一フォルダ内は depends_on で直列の鎖**にする。フォルダ間は並列
  (鎖 3 本 = `max_parallel = 3`)
- 各タスクは端から端まで動く垂直スライスで、単独の verify を持つ
- verify: shared `npm run test:shared` / server `npm run typecheck && npm run test:server` /
  web `npm run typecheck && npm run test:web`(R3F の描画はテストしない。設計書 §19)
- 依存の追加・package.json の変更は全タスクで禁止(設計書 §23.3)

## 2. 全タスク一覧(id は予約済み。変更しない)

| id | feature | ファイル名 | 内容 | depends_on | 回 |
|---|---|---|---|---|---|
| 001 | shared | 001-shared-types.md | ドメイン型 + ドメイン zod スキーマ(types.ts) | — | 1 |
| 002 | shared | 002-shared-api-protocol.md | api.ts(REST 入出力)/ protocol.ts(WS メッセージ)+ parse ヘルパ | 001 | 1 |
| 003 | shared | 003-shared-camera-stroke.md | camera.ts(lerpCamera, cameraEquals)/ stroke.ts(simplify) | 002 | 1 |
| 004 | server | 004-server-foundation.md | config / errors / db connection + schema / db/projects | 002 | 1 |
| 005 | server | 005-server-db-comments.md | db/comments | 004 | 1 |
| 006 | server | 006-server-app-projects-read.md | storage/files + createApp(deps) + GET project / GET model | 005 | 1 |
| 007 | server | 007-server-upload.md | POST /api/projects(multipart 検証, 413, temp→rename, DB 失敗時削除) | 006 | 1 |
| 008 | server | 008-server-comments-routes.md | GET/POST/PATCH comments。保存後 `deps.publish` を呼ぶ | 007 | 2 |
| 009 | server | 009-server-room-hub.md | RoomHub 純粋クラス(join/leave/handle → Outbound[]) | 008 | 2 |
| 010 | server | 010-server-ws.md | ws.ts(attachRealtime, ephemeral port 実接続テスト, 連続エラー 20 で close 1008)+ index.ts 起動 + publish を hub に結線 | 009 | 2 |
| 011 | web | 011-web-client-upload.md | api/client + App(自前ルーティング)+ UploadPage | 002 | 2 |
| 012 | web | 012-web-viewer.md | ReviewPage + ViewerCanvas / ModelMesh / CameraRig(Orbit/Reset/Fit)+ store/camera + ErrorBoundary + ロード失敗カード | 011, 003 | 2 |
| 013 | web | 013-web-join-session-ws.md | JoinDialog + store/session + api/ws.ts(WsClient 再接続)+ app/useRealtime.ts(受信振り分け) | 012 | 2 |
| 014 | web | 014-web-presence.md | store/presence + PresenceList + useCameraBroadcast + RemoteCameras | 013 | 2 |
| 015 | web | 015-web-follow.md | Follow Camera(CameraRig 補間、操作で解除、退室で解除) | 014 | 3 |
| 016 | web | 016-web-annotation-view.md | store/annotation + StrokeLines(受信した線の描画) | 015 | 3 |
| 017 | web | 017-web-annotation-draw.md | AnnotationLayer(レイキャスト, simplify, 送信)+ AnnotationToolbar(色/Undo/Clear) | 016 | 3 |
| 018 | web | 018-web-comments-list.md | store/comments + CommentList(Open フィルタ, Resolve)+ WS 受信反映 | 017 | 3 |
| 019 | web | 019-web-comment-compose.md | CommentComposer + CommentPins(アンカークリック→投稿) | 018 | 3 |
| 020 | web | 020-web-comment-replay.md | コメント再現(pendingCamera 補間 + replayStrokes レイヤ) | 019 | 3 |
| 021 | server | 021-server-static.md | web/dist 静的配信 + `npm run build` 統合 | 010, 020 | 3 |
| 022 | shared | 022-shared-remove-scaffold.md | `SHARED_SCAFFOLD` の除去(server/web が import しなくなった後) | 021 | 3 |
| 023 | web | 023-web-style-foundation.md | スタイル基盤: `styles/tokens.css` `base.css` `controls.css` + トークン規約テスト。既存の inline style は触らない | 022 | 4 |
| 024 | web | 024-web-review-shell.md | レビュー画面の骨格: ReviewHeader(接続状態・自分・URL コピー)/ 入室ダイアログのモーダル化 / パネル容器 / ロード・エラー表示 | 023 | 4 |
| 025 | web | 025-web-viewer-hud.md | ビューア HUD: モード切替(日本語)/ ペン道具 / Follow バッジ / 視点操作 / モードのヒント | 024 | 4 |
| 026 | web | 026-web-side-panel.md | サイドパネル: 参加者 / コメント一覧(状態バッジ・時刻・空状態)/ 投稿カード / 3D ピンとカメララベル | 025 | 4 |
| 027 | web | 027-web-upload-notfound.md | アップロード画面と NotFound の整え(仮説検証には不要。最後) | 026 | 4 |

owns の横断チェック: 各フォルダ内は直列なので、並列に走りうる組(shared 鎖 × server 鎖 × web 鎖)
の間でファイルは重ならない。021 は両鎖の末尾に依存する。第4回は web 鎖のみで、
`ReviewPage.tsx` と `web_Summary.md` を複数タスクが順に owns する(直列なので衝突しない)。

## 3. 設計書に無く、起票時に決めた事項(全タスク共通の前提)

後続の起票担当は、この表と矛盾する契約を書かないこと。

| # | 論点 | 決定 |
|---|---|---|
| D1 | ドメイン zod スキーマの置き場 | `shared/src/types.ts` に interface と並べて置く。interface(設計書 §13.1)が正で、スキーマは `satisfies z.ZodType<T>` で型整合を強制。名前は `<型名>Schema` |
| D2 | アップロードの「本文を読み切らず 413」 | `Content-Length` ヘッダが上限超なら本文を読む前に 413。本文は Hono `c.req.parseBody()` でバッファし、`File.size` でも再検査。独自ストリーミング multipart は書かない |
| D3 | web のルーティング | react-router は依存に無い。`App.tsx` が `location.pathname` を `^/p/([A-Za-z0-9_-]+)$` で判定。遷移は `history.pushState` + `popstate` 購読 |
| D4 | カメラ状態のストア | `web/src/store/camera.ts` を追加。`selfCamera`(最後に送信した自分の CameraState)/ `pendingCamera`(再現要求)/ `resetSeq` `fitSeq`(Reset/Fit のトリガ用カウンタ)を持つ |
| D5 | コメント配信の結線 | `createApp(deps)` の `deps.publish(projectId, msg: ServerMessage)` を routes が呼ぶ。006/007/008 のテストでは記録用スタブ。010 で RoomHub に結線 |
| D6 | WS 受信 → ストア振り分け | `web/src/api/ws.ts` の WsClient は送受信・再接続のみ。`web/src/app/useRealtime.ts` が `ServerMessage.type` ごとに各ストアへ振り分ける。013 で作り、014/016/018 が自分の case を追加する |
| D7 | コメント再現の線 | annotation ストアの `replayStrokes: Stroke[]` に置き、ルームのライブな `strokes` と分離。WS には流さない |
| D8 | ツールバーのモード | `store/annotation` の `mode: "orbit" \| "pen" \| "comment"` で排他 |
| D9 | join の name が空 | protocol は空文字を受理(max 50)。RoomHub 側で trim して空なら `Guest-<4桁数字>` を割り当てる(クライアント JoinDialog も同じ規則で自動付与するので通常は空で届かない) |
| D10 | Project に版が 1 つも無い場合 | `Project.latestVersion` は必須なので DB 層の `findProject` は null を返す(REST では 404)。作成は必ず版と同一トランザクション |
| D11 | 保存ファイル名と Content-Type | ディスク上は常に `DATA_DIR/uploads/<versionId>.glb`。配信の Content-Type は `ModelVersion.fileName` の拡張子で決める(`.gltf` → `model/gltf+json`、それ以外 `model/gltf-binary`)。外部 .bin を参照する `.gltf` は MVP では表示できない(既知の制限) |
| D12 | テストの一時ディレクトリ | サンドボックスで `/tmp` が書けるか未確認のため、server のテストは `server/.vite/test-tmp/` 配下に `mkdtemp` する(`.vite` は gitignore かつ orch の ignore_dirs 済み)。`afterEach` で削除 |
| D13 | ID 生成 | `nanoid(12)`。`createApp(deps)` の `deps.newId` / `deps.now` で差し替え可能にし、テストは固定値を注入 |
| D14 | 起動スクリプト | 本番は `npm run start`(tsx 直起動)。server 側にビルド工程は作らない |
| D15 | stroke の点数 | `StrokeSchema.points` は 2 点以上 2000 点以下。`simplify` 後に 2 点未満なら送らない |
| D16 | エラーコード | `ErrorCode = VALIDATION \| NOT_FOUND \| UNSUPPORTED_FORMAT \| PAYLOAD_TOO_LARGE \| BAD_REQUEST \| INTERNAL`(`shared/src/api.ts`) |
| D17 | POST comment の versionId が当該 project の版でない | `findModelVersion` が null なら **404 NOT_FOUND**(400 ではない) |
| D18 | RoomHub の接続 ID | `hub.connect(projectId): connId` が発行し、connId = userId とする。`newId` は注入可。ws.ts は connId ↔ socket の Map だけ持つ |
| D19 | Outbound の宛先 | `{ target: "self" \| "others" \| "all", msg }`。REST からの配信(D5)は `hub.connectionsIn(projectId)` を ws.ts が解決する |
| D20 | stroke の詐称防止 | サーバは受信 stroke の `userId` を connId、`createdAt` を `now()` で上書きして配信。ルーム内 stroke 上限は `MAX_ROOM_STROKES = 2000`、超過は self へ `error`(BAD_REQUEST) |
| D21 | welcome の users | **自分を含む**(自分の割当色を知る必要がある)。自分の識別は `selfId` |
| D22 | 表示色の割当 | `PRESENCE_PALETTE`(8 色、`realtime/hub.ts`)のうちそのルームで未使用の先頭色。全部埋まっていたら `users.size % 8` |
| D23 | WS 受信の振り分け(D6 の具体化) | `app/useRealtime.ts` は WsClient の結線のみ。`app/realtime-dispatch.ts` の `dispatchServerMessage(msg)` が `useXxxStore.getState()` 経由で各ストアへ反映する(React 外なのでテスト可能)。013 が welcome / error、014 が user:* / camera、016 が stroke:*、018 が comment:* の case を足す |
| D24 | 再接続後の join 再送 | WsClient は表示名を持たない。`onStatus("open")` を受けた `useRealtime` が `join` を送る。バックオフは 1s→10s(倍々、open でリセット) |
| D25 | SHARED_SCAFFOLD の import | 010 が `server/src/index.ts` から、011 が `web/src/main.tsx` から import を外す。`shared/src/index.ts` の export 自体は 022 で消す |
| D26 | CSS ファイル | MVP では作らない。すべて JSX の `style={{ ... }}` インラインで書く(owns 衝突と 300 行圧迫を避けるため) |
| D27 | CameraRig の優先順位(015) | `resetSeq`(即座)> `pendingCamera`(補間 0.2)> Follow(補間 0.2)> 自由操作。**`pendingCamera` を consume した時点で `presence.unfollow()`**。OrbitControls の `start`(ユーザー操作)でも `unfollow()` |
| D28 | ストアは最初のタスクで全部定義する | annotation ストアは 016 が `strokes / mode / color / drafting / replayStrokes` と全 action を定義し、017 / 019 / 020 は消費のみ。comments ストアは 018 が `composerAnchor` まで含めて定義し、019 / 020 は消費のみ(同一ファイルを 2 度 owns しない) |
| D29 | モデル表面のピック | `web/src/features/viewer/model-target.ts`(zustand ではない単純モジュール。`ModelMesh` がロード完了時に登録)と `pick.ts`(`toNdc` / `pickModel`)を 017 が作る。019 のコメント配置も同じものを使う。ポインタイベントは `gl.domElement` に直接付ける(R3F のメッシュ単位イベントは使わない) |
| D30 | 線の描画の分離 | `StrokeLines(props:{strokes, opacity?})` は props を受ける純粋表示。ストア接続は `RoomStrokes`(016、ライブ線 + drafting プレビュー)と `ReplayStrokes`(020、`replayStrokes`)が別々に行う |
| D31 | ペン中の Orbit 無効化 | `CameraRig` が annotation ストアの `mode` を見て `<OrbitControls enabled={mode !== "pen"} />`(017)。Comment モードでは Orbit 有効のまま、クリックとドラッグを移動量 5px で区別する(019) |
| D32 | 静的配信 | `@hono/node-server/serve-static` は root が cwd 基準でテストしにくいため使わず、`server/src/routes/static.ts` を `node:fs` で自前実装(021)。`/api/` は素通し、`/assets/` は immutable、拡張子なしの未知パスは `index.html` へフォールバック、パストラバーサルは null。`Config.webDistDir`(`WEB_DIST_DIR`、既定 `./web/dist`)を追加。comments ストアの `selectedId` は `setAll / upsert / setFilter` 後に表示対象外なら null に正規化する(018) |
| D33 | コメント再現の入口 | `web/src/features/comments/replay.ts` の `applyCommentReplay(comment | null)` を `realtime-dispatch.ts` と同じ「React 外の純粋な入口」とし、`getState()` でテストする(020)。`useCommentReplay` は `selectedId` を購読してこれを呼ぶだけ |
| D34 | **D26 の解除**(023 以降) | D26 の理由は owns 衝突と 300 行圧迫という**工程都合**であり、製品判断ではなかった(設計書第1部は UI 品質をスコープ外に挙げていない)。023 がトークン層を単独 owns で置けばその前提は消えるので、**023 以降の web タスクは CSS ファイルを作ってよい**。設計書 §4「3DCG ソフトの知識がなくても使える」を最重視する以上、モード・Follow・接続の状態が画面から読めない現状は装飾の不足ではなく中核体験(§3)の欠落として扱う |
| D35 | スタイル方式 | **プレーン CSS**。CSS Modules / CSS-in-JS / Tailwind は使わない(依存追加禁止、かつコード読みだけのレビューで検証できることを優先)。置き場は `web/src/styles/`(全体共通: `tokens.css` `base.css` `controls.css`、`main.tsx` が import)と**各機能フォルダ直下の CSS**(原則 `<フォルダ名>.css`: `features/viewer/viewer.css` 等。`app/` だけは画面ごとに `review.css` / `upload.css`。使う側の `.tsx` が import)。クラス名は `<接頭辞>-<部品>[__要素][--変形]`(接頭辞はフォルダ名: `review-` `hud-` `annotation-` `presence-` `comments-` `upload-`)。**状態はクラスの付け替えではなく `aria-pressed` / `aria-current` / `disabled` / `data-*` の属性セレクタで表現する**(例 `.hud-mode[aria-pressed="true"]`)。データ由来の値(参加者色・ピン座標)だけは inline `style` に残し、色は `style={{ "--user-color": color }}` の CSS 変数で渡して CSS 側で `var(--user-color, フォールバック)` と読む。生の 16 進色・`rgb()`・`rgba()` は `tokens.css` 以外に書かない(023 のテストが `src/**/*.css` を走査して機械検証する) |
| D36 | 用語表(UI 文言はすべて日本語) | モード: `orbit`→**視点**、`pen`→**ペン**、`comment`→**コメント**。視点操作: Reset→**視点を戻す**、Fit→**全体を表示**。Follow→**視点に入る**、解除→**追従を解除**、追従中の表示→**「{名前} の視点を追従中」**。ペン: Undo→**1本戻す**、Clear→**自分の線を消す**。色名: `#ff0000` 赤 / `#ff8800` 橙 / `#00aa00` 緑 / `#0088ff` 青 / `#aa00ff` 紫 / `#ff00aa` 桃。コメント: `open`→**未解決**、`resolved`→**解決済み**、Resolve→**解決にする**、Reopen→**再開する**、フィルタ→**未解決のみ**、投稿→**投稿する**。接続: 未入室→**未入室**、`connecting`→**再接続中…**、`open`→**接続中**、`closed`→**切断**。文言は各タスクの `*-labels.ts` に定数・純粋関数として置き、そこをテストする(JSX に文言を直書きしない) |
| D37 | 対象環境 | デスクトップのみ。**幅 1024px 以上**を保証し、それ未満の崩れは許容する(設計書 §8 の仮説にモバイルは無い)。テーマは**ライト / ダーク / OS 追従**の 3 値(2026-09-13 変更。それまでは「ライトテーマのみ」だった)。ダークのパレットは `tokens.css` の `:root[data-theme="dark"]` に置き、生の 16 進色を `tokens.css` の外へ出さない D35 の制約はそのまま守る。Web フォントは読まない(`system-ui` 系スタック)。動きは opacity / 小さな translate のみ、`prefers-reduced-motion` で無効化。`docs/DESIGN_SKILL.md` §8(レスポンシブ)の要求はこの決定で意図的に外す |
| D38 | 目視確認の扱い | 見た目は verify で判定できない。UI タスクの md には「## 目視確認(マージ後に人間が行う)」節を置き、人間が `npm run dev:server` + `npm run dev:web` で 1280×800 と 1920×1080 を確認する。**不合格は同タスクの再実行ではなく修正タスクを新規起票する**(コード読みレビューの往復で振動させない。`improvements/008` の教訓)。実装役には `docs/DESIGN_SKILL.md` §16 の監査結果を最終メッセージに書かせる。同スキルは React 18 前提で書かれているが本プロジェクトは React 19。差異は無視してよい |
| D39 | **表示状態はルーム共有が原則**(設計書 §13.5) | 3D ビューの見え方を決める状態(版・部位の表示/非表示、メッシュ表示方法、比較、ライト、線)は必ず protocol → RoomHub → realtime-dispatch → welcome 復元の 4 点セットで共有する。ローカルに留めてよいのは選択・展開・ドック幅・自分のカメラ・コメント再現だけ。版内オブジェクトの共有鍵は `uuid` ではなく子インデックスのパス `ObjectPath`(`"0/2/1"`、重ね描きは数えない)。097〜103 で導入 |

## 4. 第2回・第3回の起票担当へ

- 起票前に `git log --oneline` と `tasks/*.md` の status を見て、第1回(001〜007)がどこまで
  merge 済みか確認する。merge 済みタスクの実装を reads で指し、契約は各 `*_Summary.md` から
  取る(md に大量コピペしない)
- 第2回: 008〜014。server 鎖の続き(008→009→010)と web 鎖の先頭(011→012→013→014)。
  011 は shared 002 だけに依存するので、server 鎖と並列に走る
- 第3回: 015〜022。web 鎖の続きと、最後の統合(021)・骨組み除去(022)
- 各 web タスクの verify は `npm run typecheck && npm run test:web`。ストアとロジック
  (フック内の純粋関数)にテストを付けさせ、R3F コンポーネントは typecheck のみ
- 上の表 §3 の決定(D1〜D33)と設計書 §15(サーバ規則)§16(データフロー)§17(エラー)を
  そのタスクが担う行だけ振る舞い表に写す

## 5. 第4回(UI 実装)の根拠と進め方

### なぜ技術検証の段階でやるのか
設計書 §8 の仮説 C(Follow で画面共有なしに成立するか)と D(3D ソフトを持たない Reviewer が
フィードバックできるか)は、**状態が画面から読める UI が無いと測れない**。現状(001〜022)は
D26 により CSS ゼロ・inline style のみで、次が欠けている。

- モード(視点 / ペン / コメント)の選択状態が `aria-pressed` のみで視覚表現が無い。
  ペン中は Orbit が止まる(D31)ので「回そうとしたら動かない」になる
- Follow 中であることがビューポートに出ない(参加者一覧のボタン文言だけ)
- 入室ダイアログ(z-index 2)とツールバー(z-index 1)が同じ座標に絶対配置され重なる
  (`ReviewPage.tsx:125,129`)
- 用語が Orbit / Pen / Comment / Follow(英語)と 全体表示 / 再読み込み(日本語)で混在

Reviewer がうまく使えなかったとき、仮説が外れたのか UI が壊れているのかを切り分けられない。
この回の UI は装飾ではなく**計測器の整備**である。

### やらないこと(MVP 判断として妥当なもの)
レスポンシブ / モバイル(D37)、アニメーションの作り込み、空状態のイラスト、
Web フォント、コンポーネントライブラリの導入、`ReviewPage` 以外の画面の作り込み(027 は最小)。

### 画面の設計方向(全タスク共通)
形容詞 3 つ: **静か・実務的・状態が常に見える**。主対象はコメント、次に参加者。
ビューアが画面の主役で、HUD はそれを邪魔しない。`docs/DESIGN_SKILL.md` §12 のアンチパターンを
そのまま禁止事項として使う。

```
┌ header: [プロジェクト名] レビュー           [● 接続中] [● あなたの名前] [URL をコピー] ┐
├────────────────────────────────────────────────────┬────────────────────────────┤
│ viewer(残り全部)                                    │ aside(22rem, 縦スクロール)  │
│  HUD 左上: [視点|ペン|コメント] │ ●●●●●● 1本戻す 消す │ 視点を戻す 全体を表示 │  参加者 (n)                │
│  HUD 上中央(追従中のみ): 「A の視点を追従中」[追従を解除]                       │   ● A  [視点に入る]        │
│  HUD 左下: モードのヒント(1 行)                                              │   ● B (あなた)             │
│                                                                              │  ────────────────         │
│  入室前: viewer の上に backdrop + 中央モーダル(HUD より上)                     │  コメント (n) [□未解決のみ] │
│                                                                              │   投稿カード(アンカー時)    │
│                                                                              │   行 / 行 / 行 …           │
└────────────────────────────────────────────────────┴────────────────────────────┘
```

### 進め方
- 直列 023→024→025→026→027。023 は見た目を変えない基盤(004 と同じ位置づけ)
- `ReviewPage.tsx` は 171 行で、スタイルを足すと 300 行に当たる。024 で `ReviewHeader` を、
  025 で `ViewerHud` を切り出す。分割は責務(ヘッダ / HUD)で行い、行数合わせではない
- 各タスクの reads に `../docs/DESIGN_SKILL.md` を入れ、実装役に §2 の手順(Inspect →
  方向 → 階層 → トークン → 実装 → 状態確認 → 監査)を踏ませる
- 不合格の目視確認は修正タスクを新規起票する(D38)。id は 028 以降を使う
