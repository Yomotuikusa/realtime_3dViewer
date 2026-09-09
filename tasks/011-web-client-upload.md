---
id: 011
title: web API クライアント・ルーティング・アップロード画面
feature: web
depends_on: [002]
owns: [web/src/api/client.ts, web/src/app/routes.ts, web/src/app/App.tsx, web/src/app/UploadPage.tsx, web/src/app/ReviewPage.tsx, web/src/main.tsx, web/tests/api-client.test.ts, web/tests/routes.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, web/index.html, web/tsconfig.json, web/vite.config.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
web 側の入口を作る。§14 の REST と 1:1 の fetch ラッパ、`/` と `/p/:projectId` の自前ルーティング
(D3)、そしてモデルをアップロードしてレビュー URL へ遷移する画面(§5, §6 の前提)。

## 前提
- 002 の `@shared/api`(`ErrorCode` `ApiErrorSchema` `CreateCommentInput`
  `UpdateCommentStatusInput` `ALLOWED_MODEL_EXTENSIONS`)、001 の `@shared/types`
  (`Project` `Comment` `CommentStatus` と `ProjectSchema` `CommentSchema`)を import する。
  相対パス `../../shared/src` は書かない
- サーバは同一オリジン想定。開発時は vite が `/api` `/ws` を 3000 番へ proxy する
  (web/vite.config.ts。設定は変更しない)。したがって **base URL は空文字**で、
  パスは常に `/api/...` から始める
- テスト環境は jsdom。`web/tests/**/*.test.{ts,tsx}` が対象。
  **@testing-library は依存に無い**ため、コンポーネントの描画テストは書かない
  (App / UploadPage / ReviewPage は typecheck のみで担保する)
- `web/src/main.tsx` は現在 `SHARED_SCAFFOLD` を import している。**このタスクで
  `<App />` を描画する実装に書き換え、その import を外す**
  (D25。`shared/src/index.ts` 側の export は 022 まで残す)
- react 19.2 / react-dom 19.2。`createRoot` は既存のまま
- CSS ファイルは作らない。見た目は JSX の `style={{ ... }}` インラインで書く(D26)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/api/client.ts
import type { Comment, CommentStatus, Project } from "@shared/types";
import type { CreateCommentInput } from "@shared/api";

export class ApiClientError extends Error {
  constructor(readonly status: number, readonly code: string, message: string);
}

/** モデル本体の URL。fetch はしない(useGLTF に渡す) */
export function modelUrl(projectId: string, versionId: string): string;

export function createProject(name: string, file: File): Promise<Project>;
export function getProject(projectId: string): Promise<Project>;
export function listComments(projectId: string, status?: CommentStatus): Promise<Comment[]>;
export function createComment(projectId: string, input: CreateCommentInput): Promise<Comment>;
export function updateCommentStatus(
  projectId: string, commentId: string, status: CommentStatus,
): Promise<Comment>;
```

共通規則:

- 2xx 以外は本文を `ApiErrorSchema` で parse し、成功したら
  `ApiClientError(status, error.code, error.message)` を throw。parse できなければ
  `ApiClientError(status, "INTERNAL", <status を含む既定文言>)`
- `fetch` 自体が reject(ネットワーク断)したら `ApiClientError(0, "INTERNAL", <非空>)`
- 2xx の本文は zod(`ProjectSchema` / `CommentSchema` / `z.array(CommentSchema)`)で検証し、
  失敗したら `ApiClientError(status, "VALIDATION", <非空>)`
- `createProject` は `FormData` に `name` と `file` を append して POST(`Content-Type` は付けない)
- `listComments` の status 未指定時はクエリを付けない

```ts
// web/src/app/routes.ts
export type Route =
  | { name: "upload" }
  | { name: "review"; projectId: string }
  | { name: "notFound"; pathname: string };

/** "/" → upload、"/p/<id>"(id は ^[A-Za-z0-9_-]+$)→ review、それ以外 → notFound */
export function parseRoute(pathname: string): Route;
export function projectPath(projectId: string): string;          // `/p/${projectId}`
/** history.pushState した後 popstate を dispatch して購読側に伝える */
export function navigate(path: string): void;
/** popstate を購読して現在の Route を返す React フック */
export function useRoute(): Route;
```

```tsx
// web/src/app/App.tsx
export function App(): React.ReactElement;      // useRoute() で分岐。notFound は簡素なメッセージ

// web/src/app/UploadPage.tsx
export function UploadPage(): React.ReactElement;

// web/src/app/ReviewPage.tsx  ← このタスクではプレースホルダ。012 が本実装で置き換える
export function ReviewPage(props: { projectId: string }): React.ReactElement;
```

`UploadPage` の仕様:

- `name`(text)と `file`(`accept=".glb,.gltf"`)の 2 入力と送信ボタン
- 送信前チェック: name が空白のみ → 送らずエラー表示。file 未選択 → 同様。
  拡張子が `ALLOWED_MODEL_EXTENSIONS` 外 → 同様
- 送信中はボタンを disabled にし、二重送信を防ぐ
- 成功: `navigate(projectPath(project.id))`
- 失敗: `ApiClientError.message` を画面に表示し、ボタンを再び有効化する

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `modelUrl("p1","v1")` | `"/api/projects/p1/versions/v1/model"` |
| `getProject("p1")` に 200 + 妥当な Project JSON を返す fetch スタブ | 呼び出し URL が `/api/projects/p1`、method GET。返り値が入力と深い等価 |
| `getProject` が 404 + `{error:{code:"NOT_FOUND",message:"no"}}` | `ApiClientError` を throw(`status:404`, `code:"NOT_FOUND"`, `message:"no"`) |
| `getProject` が 500 + HTML 本文 | `ApiClientError`(`status:500`, `code:"INTERNAL"`, message 非空) |
| `getProject` が 200 + `{}`(スキーマ不一致) | `ApiClientError`(`code:"VALIDATION"`) |
| `fetch` が reject | `ApiClientError`(`status:0`, `code:"INTERNAL"`) |
| `createProject("Robot", file)` | POST `/api/projects`。body が `FormData` で `name`/`file` を含む。`Content-Type` ヘッダを自前で付けていない |
| `listComments("p1")` / `listComments("p1","open")` | GET `/api/projects/p1/comments` / 同 `?status=open` |
| `listComments` が 200 + `[]` | `[]` |
| `createComment("p1", input)` | POST `/api/projects/p1/comments`、`Content-Type: application/json`、body が入力の JSON |
| `updateCommentStatus("p1","c1","resolved")` | PATCH `/api/projects/p1/comments/c1`、body `{"status":"resolved"}` |
| `parseRoute("/")` | `{name:"upload"}` |
| `parseRoute("/p/abc-123_X")` | `{name:"review", projectId:"abc-123_X"}` |
| `parseRoute("/p/")` / `"/p/a/b"` / `"/x"` / `"/p/a b"` | すべて `notFound` |
| `projectPath("p1")` | `"/p/p1"` |
| `navigate("/p/p1")` 後の `location.pathname` | `"/p/p1"` |
| `navigate` 後に `popstate` リスナが呼ばれるか | 呼ばれる(`useRoute` が更新される根拠。テストは `window.addEventListener("popstate", ...)` で確認) |

## やらないこと
- ReviewPage の本実装・3D 表示・WebSocket(012 以降)。ここでは projectId を表示するだけ
- 再アップロード(版追加)UI(MVP+1)
- コンポーネントの描画テスト(@testing-library が無い)
- CSS ファイルの追加、`web/index.html` / vite・vitest 設定の変更
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `web/src/main.tsx` から `SHARED_SCAFFOLD` の import が消えている
- [ ] web_Summary.md が更新されている(api/client の関数一覧・エラー型・ルーティング規則)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
