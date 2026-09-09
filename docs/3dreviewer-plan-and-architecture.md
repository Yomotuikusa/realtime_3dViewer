# リアルタイム3Dレビュー・ビュワー — 企画 & アーキテクチャ設計

本書は 2 部構成である。

- **第1部 企画(What)**: 何を作るか。企画仕様書を MVP に絞って再整理したもの
- **第2部 アーキテクチャ(How)**: どう作るか。技術選定・構成・データモデル・プロトコル・
  ディレクトリ構成・分解ガイド

後続の AI はこの文書だけを読んで `tasks/` にタスクを起票する。そのため第2部は
「タスクmd に転記できる粒度」(型・エンドポイント・メッセージを実コードで)まで書く。
本書と `config/orch.toml` が食い違う場合は `config/orch.toml` が正しい
(1ファイル 300 行、機能フォルダごとに `<名前>_Summary.md` 必須)。

---

# 第1部 企画

## 1. 一文で

> 複数人で同じ3Dモデルを見ながら、視点・書き込み・コメントを共有できる、
> 3D制作物専用のリアルタイムレビュー・ビュワー。

**Viewer, not Editor。** 3Dを「作る」機能は持たず、「見て・話して・フィードバックする」に限定する。

## 2. 解決する課題

3DCG のフィードバックは「どこを」「どの角度から」「どう見たときの指摘か」がテキストや
スクリーンショットでは失われる。3D空間そのものを共有し、視点と書き込みをそのまま
相手に渡せるようにする。

## 3. 中核体験(最重要)

1. ユーザーAがモデルのある場所を見て「ここ」と言う
2. ユーザーBがAの視点に入り(Follow)、同じものを見る
3. Aがその場で線を書き(Annotation)「こうしたい」と伝える
4. その状態(視点+線+文章)がコメントとして残る
5. 後から参加したユーザーCが、コメントをクリックして同じ状態を再現できる

## 4. 利用者

- **Creator**: モデルを制作・アップロードする(モデラー等)
- **Reviewer**: 確認してフィードバックする(ディレクター、クライアント等)。
  **3DCGソフトの知識がなくても使える**ことを最重視する

## 5. 基本ワークフロー

```
モデル制作 → アップロード → レビューURL発行 → URL共有 → 複数人で開く
→ 自由に閲覧 / 必要なら他人をFollow → Annotation・コメント → DCCで修正
→ 修正版アップロード → 再レビュー → Resolve
```

リアルタイム(同時参加)と非同期(一人で残したコメントを後から確認)の両方に対応する。

## 6. MVP スコープ

| # | 機能 | 内容 |
| --- | --- | --- |
| 1 | 3D Viewer | アップロードした glTF/GLB モデルを Orbit / Pan / Zoom / Reset / 全体表示 で閲覧 |
| 2 | Real-time Presence | 同じレビュー空間にいる人の一覧と、各人が「今どこから見ているか」の3D表示 |
| 3 | Follow Camera | 他ユーザーの視点に入る / 自分で操作すると解除 |
| 4 | Annotation | モデル表面にフリーハンドで線を書く。色変更、自分の線の取り消し・消去。リアルタイムに他者へ表示 |
| 5 | Viewpoint Comment | 3D上の位置 + カメラ + そのとき描いた Annotation + 本文 をセットで保存。クリックで再現 |
| 6 | Resolve | コメントを Open / Resolved で切り替え、Open のみ表示フィルタ |

**アップロード・URL発行** は上記の前提として MVP に含める(URLで開けなければ何も始まらない)。

## 7. MVP で決めた前提(企画書に明記がない点の判断)

| 論点 | 決定 | 理由 |
| --- | --- | --- |
| 対応フォーマット | **glTF 2.0 (.glb / .gltf) のみ** | Blender / Maya / C4D すべて標準で書き出せ、ブラウザ表示の事実上の標準。FBX/OBJ 変換は将来 |
| 認証・アカウント | **なし。URL を知っていれば参加できる** | MVP は仮説検証。入室時に表示名を入力(ブラウザに記憶)。空欄なら `Guest-<4桁>` を自動付与する(「誰の指摘か」「誰を Follow するか」が体験の中核なので無名にはしない) |
| レビュー空間の単位 | **1 プロジェクト = 1 URL = 1 ルーム** | 「URL を送るだけで開始」を最短で成立させる |
| バージョン管理 | **データモデルには持つ。UI は最新版のみ表示** | 再アップロードは MVP+1。DB移行なしで足せるよう最初から `model_versions` を置く |
| Annotation 図形 | **フリーハンド線のみ**(円・矢印は手で描く) | ツール種別を増やすより線1本の体験を磨く |
| 上限 | 1ファイル 100MB | 大きすぎるモデルのブラウザ表示は別問題として切り離す |
| 同時接続規模 | 1ルーム 10 人程度、単一サーバプロセス | 仮説検証には十分。分散は将来 |

## 8. 検証したい仮説

- A: Viewpoint 付きコメントで「どこの話か」を説明する時間が減る
- B: Annotation で形状変更を文章で説明する必要が減る
- C: Follow Camera で画面共有なしにリアルタイムレビューが成立する
- D: 3Dソフトを持たない Reviewer でも正確なフィードバックができる

## 9. スコープ外

3Dモデリング / Sculpt / Rig / Animation / Texture / Material / Render 制作、共同3D編集、
DCC ツールの置き換え。将来候補(バージョン比較、スレッド、@Mention、通知、権限、
スクリーンショット書き出し等)はコア体験の検証後に判断する。

---

# 第2部 アーキテクチャ

## 10. 技術選定

すべて TypeScript。フロントとサーバで型とプロトコルを共有するため。

| 領域 | 選定 | 理由 |
| --- | --- | --- |
| 言語 | TypeScript (strict) | 型を shared パッケージで共有し、WS メッセージの食い違いをコンパイル時に潰す |
| フロント | React 18 + Vite | 標準的。3D 以外の UI(コメント一覧等)を素直に書ける |
| 3D | three.js + @react-three/fiber + @react-three/drei | R3F で three をコンポーネント化。drei の `OrbitControls` `useGLTF` `Line` `Html` `Bounds` で MVP の 3D 要件がほぼ揃う |
| 状態管理 | zustand | ストア 1 ファイル数十行で済む。R3F の毎フレーム更新と相性が良い(セレクタ購読) |
| サーバ | Node.js 24 + Hono (@hono/node-server) | 軽量。`app.request()` で HTTP をプロセス内テストできる(supertest 不要) |
| リアルタイム | `ws` (WebSocket) | Presence / Annotation 中継は単純な pub/sub。Socket.IO 等の抽象は不要 |
| 永続化 | SQLite via **`node:sqlite`** (Node 組込み) + ローカルファイルシステム | ネイティブ依存ゼロでビルド不要。単一サーバの MVP に十分。モデル本体は `DATA_DIR/uploads/` |
| バリデーション | zod | REST ボディ・WS メッセージ・multipart のスキーマを shared で 1 度書き、両側で使う |
| テスト | vitest(全パッケージ) | 単一ランナー。web は jsdom 環境でロジック層をテスト |
| パッケージ管理 | npm、**root 1 つの package.json**(npm workspaces は使わない) | pnpm はホスト未導入。workspaces が作る `node_modules/shared -> ../shared` の相対リンクは §23 の共有 node_modules 方式と両立しないため、`shared` は `@shared/*` の alias で相対解決する |

**採らないもの**: Next.js(SSR 不要)、Redis(単一プロセスのメモリで足りる)、ORM(テーブル 3 つ)、
S3(ローカル FS を関数 2 つで隠蔽し将来差し替え)、認証基盤。

## 11. 全体構成

```
   Browser (web)                              Server (server)
 ┌────────────────────────┐   HTTPS/REST    ┌──────────────────────────┐
 │ React + R3F            │ ──────────────▶ │ Hono                     │
 │  viewer / presence     │  upload, GET    │  routes/projects         │
 │  annotation / comments │  comments CRUD  │  routes/comments         │──▶ SQLite (node:sqlite)
 │                        │                 │                          │──▶ DATA_DIR/uploads/*.glb
 │ zustand store          │   WebSocket     │ realtime/                │
 │ ws client              │ ◀─────────────▶ │  RoomHub (in-memory)     │
 └────────────────────────┘ camera/strokes  └──────────────────────────┘
              ▲                 presence                 ▲
              └──────────── shared (types, zod schemas, camera math) ┘
```

- **永続データ(project / version / comment)は REST**、**揮発データ(presence / camera / 描画中の線)は WS**。
  この分離が本設計の唯一の重要なルールである。
- コメント作成・更新は REST で保存した後、サーバが同ルームへ WS で `comment:created` /
  `comment:updated` を配信し、他クライアントの一覧を更新する。
- 本番配信は `server` が `web/dist` を静的配信する(単一プロセス・単一ポート)。
  開発時は Vite dev server から `/api` `/ws` を proxy する。

## 12. ディレクトリ構成

`workspace/` 直下の 3 フォルダが orch の「機能フォルダ」であり、それぞれ `<名前>_Summary.md` を持つ。
package.json は root に 1 つだけ。`shared` / `server` / `web` は package.json を持たず、
tsconfig と vitest 設定だけを持つ(理由は §23)。

```
workspace/
  package.json              # 全依存を pin。scripts: typecheck / test / test:shared / test:server / test:web / dev:server / dev:web / build / start
  package-lock.json
  node_modules -> /home/ojin/projects/3dreviewer/.deps/node_modules   # git 追跡のシンボリックリンク(§23)
  tsconfig.base.json        # strict, paths: { "@shared/*": ["./shared/src/*"] }(TypeScript 7 のため baseUrl は使わない)
  .gitignore                # dist, data/, .vite/ (node_modules は root の .gitignore に既にあるが、リンクは -f で追跡)
  shared/
    shared_Summary.md
    tsconfig.json  vitest.config.ts
    src/
      index.ts              # re-export
      types.ts              # ドメイン型(§13)
      protocol.ts           # WS メッセージ型 + zod スキーマ(§15)
      api.ts                # REST の入出力型 + zod スキーマ(§14)
      camera.ts             # CameraState 補間・比較などの純粋関数
      stroke.ts             # Stroke の簡略化(間引き)・検証の純粋関数
    tests/
  server/
    server_Summary.md
    tsconfig.json  vitest.config.ts
    src/
      index.ts              # 起動: 環境変数読込 → createApp → listen → attachRealtime
      app.ts                # createApp(deps): Hono に routes をマウント、静的配信、エラーハンドラ
      config.ts             # PORT, DATA_DIR, MAX_UPLOAD_BYTES
      errors.ts             # HttpError + toErrorResponse
      db/
        connection.ts       # openDb(path) / migrate()
        schema.sql          # CREATE TABLE 文(§13)
        projects.ts         # projects / model_versions の CRUD
        comments.ts         # comments の CRUD
      storage/
        files.ts            # saveModelFile(versionId, stream) / modelFilePath(versionId)
      routes/
        projects.ts         # §14 のプロジェクト系
        comments.ts         # §14 のコメント系
      realtime/
        hub.ts              # RoomHub: ルームごとの users / strokes を保持し配信(WS 非依存の純粋ロジック)
        ws.ts               # attachRealtime(server, hub): ws 接続 ↔ hub の橋渡し、メッセージ検証
    tests/
  web/
    web_Summary.md
    tsconfig.json  vite.config.ts  vitest.config.ts  index.html
    src/
      main.tsx
      app/
        App.tsx             # ルーティング: "/" (Upload) と "/p/:projectId" (Review)
        UploadPage.tsx
        ReviewPage.tsx      # レイアウト: 左=Canvas, 右=サイドパネル(参加者/コメント)
        JoinDialog.tsx      # 表示名入力(localStorage に保存、空欄なら Guest-<4桁>)
      api/
        client.ts           # fetch ラッパ(§14 の関数群)
        ws.ts               # WsClient: connect / send / onMessage / 自動再接続
      store/
        session.ts          # 自分の id/name/color、接続状態
        presence.ts         # users: Map<userId, PresenceUser>、followingUserId
        annotation.ts       # strokes(ルーム内の全員分)、現在の色、描画中の線
        comments.ts         # comments、filter(open/all)、selectedCommentId
      features/
        viewer/
          ViewerCanvas.tsx  # <Canvas> と子の合成。カメラ状態を store へ流す
          ModelMesh.tsx     # useGLTF でロード、Bounds でフィット
          CameraRig.tsx     # OrbitControls ラップ。Follow 中は補間、ユーザー操作で Follow 解除
          useCameraBroadcast.ts  # カメラ変化を throttle して WS 送信
        presence/
          PresenceList.tsx  # 参加者一覧 + Follow ボタン
          RemoteCameras.tsx # 他ユーザーのカメラを小さなフラスタム(錐体)+名前ラベルで描画
        annotation/
          AnnotationLayer.tsx # ポインタイベント→レイキャスト→Stroke 生成、WS 送信
          StrokeLines.tsx     # strokes を drei Line で描画
          AnnotationToolbar.tsx # ペン on/off、色、Undo、自分の線をクリア
        comments/
          CommentList.tsx   # 一覧、Open フィルタ、クリックで視点+線を再現
          CommentComposer.tsx # モデル上クリック位置に本文を入力して投稿
          CommentPins.tsx   # 3D 上のピン(drei Html)
    tests/
```

- `shared` の import は常に `@shared/types` の形(tsconfig `paths` + vite/vitest `resolve.alias`)。
  相対パス `../../shared/src` は書かない
- 300 行制約のため、各 tsx は 1 コンポーネント 1 ファイルを原則とする
- vite / vitest の `cacheDir` は `web/.vite` `server/.vite` 等、各フォルダ配下に置く
  (node_modules が読み取り専用のため。§23)

## 13. データモデル

### 13.1 ドメイン型(`shared/src/types.ts`)

```ts
export type Vec3 = [number, number, number];

/** OrbitControls と 1:1 対応させる。fov は固定(50)なので持たない */
export interface CameraState {
  position: Vec3;
  target: Vec3;
}

export interface Stroke {
  id: string;            // クライアント生成 UUID
  userId: string;
  color: string;         // "#rrggbb"
  points: Vec3[];        // ワールド座標。モデル表面のヒット点列
  createdAt: number;     // epoch ms
}

export type CommentStatus = "open" | "resolved";

export interface Comment {
  id: string;
  projectId: string;
  versionId: string;
  authorName: string;
  body: string;
  anchor: Vec3;          // モデル表面上の指摘位置(ピン)
  camera: CameraState;   // 投稿時の視点
  strokes: Stroke[];     // 投稿時にキャンバス上にあった自分の線(スナップショット)
  status: CommentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ModelVersion {
  id: string;
  projectId: string;
  number: number;        // 1, 2, 3...
  fileName: string;      // 元のファイル名
  byteSize: number;
  createdAt: number;
}

export interface Project {
  id: string;            // URL に使う。nanoid 等 12 文字程度
  name: string;
  createdAt: number;
  latestVersion: ModelVersion;
}

export interface PresenceUser {
  id: string;            // 接続ごとにサーバ発行
  name: string;
  color: string;         // サーバがパレットから割当
  camera: CameraState | null;
}
```

### 13.2 テーブル(`server/src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS model_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  number INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, number)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT NOT NULL REFERENCES model_versions(id),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  anchor_json TEXT NOT NULL,    -- Vec3
  camera_json TEXT NOT NULL,    -- CameraState
  strokes_json TEXT NOT NULL,   -- Stroke[]
  status TEXT NOT NULL CHECK(status IN ('open','resolved')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id, created_at);
```

JSON 列を使うのは、anchor / camera / strokes を検索・集計しないため。
モデルファイルは `DATA_DIR/uploads/<versionId>.glb` に保存し DB には持たない。

### 13.3 揮発状態(サーバメモリ、`server/src/realtime/hub.ts`)

```ts
interface Room {
  projectId: string;
  users: Map<string, PresenceUser>;   // 接続中のみ
  strokes: Map<string, Stroke>;       // 現在キャンバス上にある線(全員分)。ルームが空になったら破棄
}
```

サーバ再起動でルーム状態は消える。コメントに添付済みの線は DB にあるので失われない。

### 13.4 クライアント状態(zustand、`web/src/store/`)

| ストア | 主な state | 主な action |
| --- | --- | --- |
| session | selfId, name, color, connection: "connecting"/"open"/"closed" | setName, setSelf, setConnection |
| presence | users: Record<userId, PresenceUser>, followingUserId: string \| null | applyWelcome, upsertUser, removeUser, updateCamera, follow(id), unfollow |
| annotation | strokes: Record<strokeId, Stroke>, penEnabled, color, drafting: Stroke \| null | addStroke, removeStroke, clearByUser, setColor, togglePen |
| comments | items: Comment[], showOnlyOpen, selectedId, composerAnchor: Vec3 \| null | setAll, upsert, select, setFilter, setComposerAnchor |

three.js のカメラ実体は R3F が持つ。ストアには「最後に送信した自分の CameraState」と
「再現要求(`pendingCamera`)」だけを置き、`CameraRig` が useFrame で消費する。

## 14. REST API(`shared/src/api.ts` で型定義、`server/src/routes/`)

すべて JSON。エラーは `{ error: { code: string, message: string } }`。

| メソッド / パス | 入力 | 出力 | 備考 |
| --- | --- | --- | --- |
| `POST /api/projects` | multipart: `name` (text), `file` (.glb/.gltf) | `201 Project` | 100MB 超は 413、拡張子不正は 400 `UNSUPPORTED_FORMAT` |
| `GET /api/projects/:projectId` | — | `Project` | 無ければ 404 |
| `GET /api/projects/:projectId/versions/:versionId/model` | — | `model/gltf-binary` 本体 | `Cache-Control: immutable`(versionId は不変) |
| `POST /api/projects/:projectId/versions` | multipart `file` | `201 ModelVersion` | MVP+1。number は最大+1 |
| `GET /api/projects/:projectId/comments` | `?status=open` 任意 | `Comment[]`(created_at 昇順) | |
| `POST /api/projects/:projectId/comments` | `CreateCommentInput` | `201 Comment` | 保存後 WS で `comment:created` 配信 |
| `PATCH /api/projects/:projectId/comments/:commentId` | `{ status }` | `Comment` | 保存後 WS で `comment:updated` 配信 |

```ts
export const CreateCommentInput = z.object({
  versionId: z.string(),
  authorName: z.string().min(1).max(50),
  body: z.string().min(1).max(2000),
  anchor: Vec3Schema,
  camera: CameraStateSchema,
  strokes: z.array(StrokeSchema).max(200),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;
```

クライアント側 `web/src/api/client.ts` はこの表と 1:1 の関数を持つ
(`createProject`, `getProject`, `modelUrl`, `listComments`, `createComment`, `updateCommentStatus`)。

## 15. WebSocket プロトコル(`shared/src/protocol.ts`)

エンドポイント: `GET /ws?projectId=<id>`。テキストフレーム、1 フレーム 1 JSON。
`type` で判別する discriminated union。zod スキーマをサーバ受信・クライアント受信の両方で使う。

```ts
// client → server
export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "camera"; camera: CameraState }          // 最大 20Hz に throttle
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }       // 自分の線のみ有効
  | { type: "stroke:clear" };                          // 自分の線を全消去

// server → client
export type ServerMessage =
  | { type: "welcome"; selfId: string; users: PresenceUser[]; strokes: Stroke[] }
  | { type: "user:joined"; user: PresenceUser }
  | { type: "user:left"; userId: string }
  | { type: "camera"; userId: string; camera: CameraState }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear"; userId: string }
  | { type: "comment:created"; comment: Comment }
  | { type: "comment:updated"; comment: Comment }
  | { type: "error"; code: string; message: string };
```

サーバ側の規則:

- `join` を受けるまで他メッセージは無視する。`join` で userId・color を発行し `welcome` を返し、
  他者へ `user:joined` を配信する
- `camera` は送信者以外へ中継する(送信者へは返さない)
- `stroke:*` は検証後ルーム状態を更新し、**送信者を含む全員**へ配信する(送信者もサーバ応答で確定させ、
  ローカルの draft と置き換える)
- `stroke:remove` は stroke.userId が送信者でなければ無視する
- 切断時は `user:left` を配信し、その人の線は**残す**(コメント化前の線が消えると困る。
  ルームが空になった時点で破棄)
- 不正 JSON / スキーマ違反は `error` を返して接続は維持する

`RoomHub` は `ws` に依存しない純粋クラス(`join / leave / handle(userId, msg): Outbound[]`)として書き、
配信先の決定までをユニットテストする。`ws.ts` はソケットとの結線だけを持つ。

## 16. データフロー

### 16.1 モデルを開く

```
/p/:projectId → getProject → JoinDialog(名前) → ws connect → join → welcome
→ useGLTF(modelUrl(versionId)) → Bounds.fit → listComments
```

### 16.2 Presence / Follow

- 自分のカメラ: `OrbitControls` の `change` イベント → `useCameraBroadcast` が 50ms throttle で
  `camera` を送信(前回と同一なら送らない。`camera.ts` の `cameraEquals(a,b,eps)`)
- 他人のカメラ: `camera` 受信 → presence ストア更新 → `RemoteCameras` が錐体+名前を描画
- Follow: `follow(userId)` → `CameraRig` が useFrame で自カメラを対象の `camera` へ補間
  (`camera.ts` の `lerpCamera(from,to,t)`、t≈0.2)。OrbitControls の `start` イベント(ユーザー操作)で
  `unfollow()`。対象が退室したら `unfollow()`
- Follow 中も自分の camera は送信する(他者から見て「Bも同じ所を見ている」と分かる)

### 16.3 Annotation

- ペン ON の間、`AnnotationLayer` が Canvas の `pointerdown/move/up` を受け、`OrbitControls` を無効化
- 各ポインタ位置でモデルメッシュにレイキャスト。ヒットした点を法線方向に少しオフセット
  (Z-fighting 回避、モデルサイズの 0.2% 程度)して `points` に積む。ヒットしない点は捨てる
- `pointerup` で `stroke.ts` の `simplify(points, tolerance)` で間引き、`stroke:add` 送信。
  点数 2 未満なら送らない
- 描画は `StrokeLines` が drei `Line`(`lineWidth` はピクセル固定、`depthTest` は true)で行う
- Undo = 自分の最新 stroke に `stroke:remove`。Clear = `stroke:clear`

### 16.4 Viewpoint Comment

- コメントモード中にモデルをクリック → ヒット点を `composerAnchor` に → `CommentComposer` 表示
- 投稿: 現在の自カメラ + `strokes` のうち自分の線 + anchor + 本文 で `createComment`
- 一覧クリック: `pendingCamera = comment.camera` をセット(CameraRig が 300ms で補間移動、
  Follow 中なら解除)。同時に `comment.strokes` を「再現中の線」として一時表示し、
  他コメント選択・選択解除で消す(ルームの生きた線とは別レイヤで、WS には流さない)
- Resolve: `updateCommentStatus` → 自分は応答で更新、他者は `comment:updated` で更新

## 17. エラー処理

### サーバ

- `errors.ts` の `HttpError(status, code, message)` を routes が throw。`app.onError` で
  `{ error: { code, message } }` に変換。想定外は 500 `INTERNAL` とし、詳細はログのみ
- zod 失敗は 400 `VALIDATION`。存在しない project/comment は 404 `NOT_FOUND`
- アップロードは拡張子 + マジックバイト(`glTF` の 4 バイト、`.gltf` は JSON として parse 可)を検査。
  サイズ超過は本文を読み切らず 413 で切る
- 一時ファイルへ書いてから rename し、DB 挿入失敗時は削除する
- WS: 不正メッセージは `error` 返送のみ。同一接続で 20 回連続なら close(1008)
- ログは `console` に JSON 1 行(ライブラリ不要)

### クライアント

- API 失敗はサイドパネル上部のトースト(単一の `ui/Toast` ではなく各ストアの `lastError` を表示する軽量実装)
- WS 切断は指数バックオフ(1s→最大 10s)で再接続。再接続後は `join` をやり直し `welcome` で全置換。
  切断中は Presence 領域に「再接続中」を表示し、線の投稿はブロック
- モデルロード失敗(404 / パース失敗)は Canvas の代わりにエラーカードを表示
- `ErrorBoundary` を Canvas 外側に置き、three 例外で画面全体が白くなるのを防ぐ

## 18. 設定・運用

- 環境変数: `PORT`(既定 3000)、`DATA_DIR`(既定 `./data`)、`MAX_UPLOAD_BYTES`(既定 100MB)
- 起動時に `DATA_DIR/uploads` を作成し `schema.sql` を適用(`IF NOT EXISTS` で冪等)
- 本番: `npm run build`(web → `web/dist`)後 `npm start`(= `tsx --tsconfig server/tsconfig.json server/src/index.ts`)が
  `web/dist` を配信。サーバは tsc で dist を作らず tsx で直接実行する(`@shared/*` の paths を tsx が解決するため)。
  TLS はリバースプロキシ(Caddy 等)に任せる
- 開発: `npm run dev:server` と `npm run dev:web` を別ターミナルで起動(vite が `/api` `/ws` を 3000 番へ proxy)
- `.gitignore`(workspace/): `dist`, `data/`, `.vite/`。テストは `DATA_DIR` に一時ディレクトリを渡し、`./data` には書かない
- **依存の追加・更新は人間だけが行う**(§23)。codex のタスクmd には「依存追加禁止。必要なら申し送り」を必ず書く

## 19. テスト方針(verify に使う)

| パッケージ | 対象 | 手段 |
| --- | --- | --- |
| shared | zod スキーマの受理/拒否、`lerpCamera` `cameraEquals` `simplify` | vitest |
| server | db 層(一時ファイル DB)、routes(`app.request()` + multipart)、`RoomHub`(純粋ロジック)、`ws.ts`(ephemeral port に実接続) | vitest |
| web | ストアの reducer、`WsClient` の再接続(fake timers + mock WebSocket)、`api/client` | vitest + jsdom |
| 全体 | 型整合 | `npm run typecheck`(3 フォルダの `tsc --noEmit -p <dir>` を順に実行) |

R3F コンポーネントの描画はヘッドレスで検証しない。3D 系タスクの verify は
「typecheck + そのフィーチャの純粋ロジック(ストア・数学)のテスト」とする。
目視確認は人間が `npm run dev` で行う。

## 20. 将来拡張との対応

| 将来機能 | 本設計での受け皿 |
| --- | --- |
| バージョン管理 / Before-After | `model_versions` が既にある。`Comment.versionId` で紐付け済み。UI に版セレクタと `versionId` 切替を足す |
| アクセス権限 | `projects` に `visibility` / トークン列を追加し、Hono middleware で検査。WS は `/ws` 接続時に同じ検査 |
| コメントスレッド | `comments.parent_id` 追加 |
| 分散・スケール | `RoomHub` を Redis pub/sub 実装に差し替える(インターフェイスは §15 の純粋クラスのまま) |
| S3 保存 | `storage/files.ts` の 2 関数を差し替える |
| FBX/OBJ 対応 | アップロード時にサーバ側変換ジョブを追加。ビューアは glTF のまま |

## 21. 起票のための分解ガイド

### 21.1 機能フォルダと並列の制約

- 機能フォルダは `shared` / `server` / `web` の 3 つ。`<名前>_Summary.md` は各タスクが更新するため、
  **同じフォルダを feature に持つタスクは並列に流せない**(Summary が owns で衝突する)。
  同一フォルダ内のタスクは `depends_on` で直列に鎖にする。異なるフォルダ同士(server と web)は並列可
- `shared` は最初に 1 タスクで完成させ、server / web の全タスクが `reads: [shared/shared_Summary.md, shared/src/*.ts]` で参照する

### 21.2 推奨スライス(垂直・各々単独で verify 可能)

| 順 | feature | 内容 | depends_on |
| --- | --- | --- | --- |
| 001 | shared | `shared` の型・zod・camera/stroke 純粋関数とテスト(骨組みは §23 で人間が整備済みの前提) | — |
| 002 | server | config / errors / db(schema, projects, comments) / storage / `createApp` / projects routes(アップロード〜モデル配信)とテスト | 001 |
| 003 | server | comments routes とテスト | 002 |
| 004 | server | `RoomHub` + `ws.ts` + `index.ts` 起動、comment 配信の結線、テスト | 003 |
| 005 | web | App ルーティング、UploadPage、`api/client`、ReviewPage 内で ModelMesh + CameraRig(Orbit/Reset/Fit)まで | 001 |
| 006 | web | JoinDialog、session/presence ストア、`WsClient`、PresenceList、RemoteCameras、Follow | 005 |
| 007 | web | annotation ストア、AnnotationLayer、StrokeLines、Toolbar | 006 |
| 008 | web | comments ストア、CommentPins、Composer、List(Open フィルタ、視点+線の再現、Resolve) | 007 |
| 009 | server | 静的配信(web/dist)と本番起動手順、`npm run build` | 004, 008 |

verify は workspace 直下で実行される前提で、shared 系は `npm run test:shared`、server 系は
`npm run test:server`、web 系は `npm run typecheck && npm run test:web` を基本とする。
002〜004 と 005〜008 は互いに独立して並列に走れる(同時実行上限 3)。

### 21.3 各タスクmd に必ず書くこと

- インターフェイス契約は本書 §13〜§15 から**該当部分だけ**をコードで転記する(全文コピーはしない)
- 振る舞い表には §15 のサーバ規則、§17 のエラー規則のうちそのタスクが担う行を移す
- 「やらないこと」に、次スライスの機能(例: 005 なら presence / annotation)と「依存の追加・package.json の変更」を明記する
- owns に挙げる各ファイルが 300 行に収まる見込みを確認する。R3F コンポーネントは 1 ファイル 1 コンポーネント

## 22. 確定事項(旧・未決事項への回答)

| 論点 | 決定 |
| --- | --- |
| verify サンドボックスでの依存解決 | §23 の共有 node_modules 方式。骨組み(package.json / lockfile / tsconfig / vitest / リンク / orch 設定)は codex ではなく人間側で整備してから起票する |
| PORT / DATA_DIR | 既定値のまま(`3000` / `./data` / 100MB)。`data/` は gitignore、テストは一時ディレクトリ |
| 匿名参加 | 表示名は必須のまま。空欄なら `Guest-<4桁>` を自動付与 |

## 23. 開発環境と orch サンドボックスの制約(確定)

### 23.1 事実(orch の `sandbox.rs` で確認済み)

- verify は bwrap `--unshare-all` で走る。**ネットワークは完全に遮断**され、`npm install` は使えない。
  codex の実装フェーズも網から切られている前提で扱う
- 書き込めるのは `.worktrees/<id>/workspace` だけ。ワークツリー直下は読み取り専用、
  メインリポジトリ本体はサンドボックスから見えない
- `~/.nvm` `~/.npm` はツールチェーンとして読み取り専用で持ち込まれる(node / npm は動く)
- `[sandbox] ro_binds` で `$HOME` 自身と上位を除く任意の絶対パスを読み取り専用で持ち込める

### 23.2 方式: 共有 node_modules をシンボリックリンクで見せる

```
/home/ojin/projects/3dreviewer/
  .deps/                      # gitignore。人間が config/sync-deps.sh で更新する
    package.json              # workspace/package.json のコピー
    package-lock.json         # workspace/package-lock.json のコピー
    node_modules/             # 実体(npm ci の結果)
  workspace/
    node_modules -> /home/ojin/projects/3dreviewer/.deps/node_modules   # 絶対パスのシンボリックリンク。git add -f で追跡
```

- ワークツリーは main から作られるため、追跡済みリンクは全ワークツリーに自動で現れる
- `config/orch.toml`:
  `[sandbox] ro_binds = ["/home/ojin/projects/3dreviewer/.deps/node_modules"]`、
  `[validate] ignore_dirs = ["node_modules", "dist", ".vite"]`
- `config/sync-deps.sh`(人間が実行):
  `workspace/package.json` と lockfile を `.deps/` にコピーして `npm ci`
- `config/preflight.sh`: 中身が読み込まれて `sh -c` でサンドボックスへ渡される(ファイルとしては実行
  されないので `$0` からスクリプト位置は取れない)。cwd は `workspace/` で、見えるのは `workspace/` と
  ro_binds の `.deps/node_modules` だけ(リポジトリのルートも `.deps/` 自身も見えない)。よって
  リポジトリ内は cwd 相対で参照する。リンク先が存在すること、`workspace/package-lock.json` と
  `.deps/node_modules/.synced-package-lock.json`(sync-deps.sh が写す照合用コピー。サンドボックスからは
  `.deps/node_modules` しか見えないため中に置く)が一致することを検査し、不一致なら `sync-deps.sh` を案内して exit 1
- lockfile の生成は `cd workspace && npm install --package-lock-only`(node_modules を作らない)

### 23.3 この方式から導かれる規則

1. **依存の追加・更新は人間だけ**。MVP に必要な依存は骨組み整備時に全部入れる。codex は
   package.json を変更しない(タスクmd の「やらないこと」に明記)
2. **npm workspaces は使わない**。root 1 つの package.json。`shared` は `@shared/*` alias
3. **node_modules は読み取り専用**として扱う。vite / vitest の `cacheDir` は各フォルダ配下に置き、
   vite / vitest の起動には必ず `--configLoader runner` を付ける(既定の bundle モードは設定ファイルの
   バンドル結果を `node_modules/.vite-temp` に書こうとして EROFS で落ちる。package.json の scripts に付与済み)
4. リンクは絶対パスなので**このマシン専用**。別マシンでは `sync-deps.sh` を流し、リンクを張り直す
5. 骨組み(§23.2 のファイル群、root package.json、tsconfig.base.json、各フォルダの tsconfig /
   vitest 設定、`web/vite.config.ts`、`web/index.html`、各 `<名前>_Summary.md` の雛形)は
   **整備済み(2026-09-09)**。orch と同じ bwrap 構成のサンドボックス内で preflight / typecheck /
   test:* / build が通ることを確認した。`shared/src/index.ts` `server/src/index.ts` `web/src/main.tsx` は
   プレースホルダであり、各タスクが上書きする
6. tsx で server を動かすときは `--tsconfig server/tsconfig.json` を必ず渡す(workspace 直下に
   tsconfig.json が無く、渡さないと `@shared/*` を解決できない)

### 23.4 MVP の依存(骨組み整備時に pin する)

| 種別 | パッケージ(pin 済みの版) |
| --- | --- |
| runtime | react 19.2, react-dom 19.2, three 0.186, @react-three/fiber 9.7, @react-three/drei 10.7, zustand 5.0, hono 4.13, @hono/node-server 2.1, ws 8.21, zod 4.5, nanoid 6.0 |
| dev | typescript 7.0, vite 8.2, @vitejs/plugin-react 6.1, vitest 5.0, jsdom 29, tsx 4.23, @types/react, @types/react-dom, @types/three 0.185, @types/ws, @types/node 24 |

注意: zod は v4(`z.object` 等の API は v3 と同じだが、エラー整形は `z.treeifyError` / `z.prettifyError`)。
TypeScript 7 は `baseUrl` を受け付けない。正確な版は `workspace/package.json` が正である。
