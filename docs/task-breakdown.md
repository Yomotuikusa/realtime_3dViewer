# タスク分割台帳(起票担当の引き継ぎ用)

`docs/3dreviewer-plan-and-architecture.md`(以下「設計書」)を orch のタスクに分解した
台帳である。起票は 3 回に分けて行う。**後任の起票担当はこのファイルと設計書を読み、
自分の回の id だけを起票する**。既に起票済みの md(`tasks/`)を先に 1〜2 本読んで、
書式・粒度・「前提」の書き方を揃えること。

- 第1回(起票済み): 001〜007 … shared 全部 + server の DB/アップロードまで
- 第2回(起票済み): 008〜014 … server の comments/RoomHub/WS + web のビューアまで
- 第3回(起票済み): 015〜022 … web の Follow/Annotation/Comment + 静的配信 + 骨組み除去

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
- `config/orch.toml`: `ro_binds = [".deps/node_modules"]`, `ignore_dirs = ["node_modules","dist",".vite"]`
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

owns の横断チェック: 各フォルダ内は直列なので、並列に走りうる組(shared 鎖 × server 鎖 × web 鎖)
の間でファイルは重ならない。021 は両鎖の末尾に依存する。

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
