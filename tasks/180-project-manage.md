---
id: 180
title: プロジェクトの名前変更・削除・一覧から外す操作を API と一覧画面に追加する
feature: projects
depends_on: [179]
owns: [shared/src/api.ts, shared/shared_Summary.md, shared/tests/api.test.ts, shared/tests/rename-project-input.test.ts, server/src/db/projects.ts, server/src/db/project-members.ts, server/src/routes/project-manage.ts, server/src/app.ts, server/server_Summary.md, server/tests/db-project-manage.test.ts, server/tests/routes-project-manage.test.ts, web/src/api/client.ts, web/web_Summary.md, web/tests/api-project-manage.test.ts, web/src/features/projects/ProjectListPage.tsx, web/src/features/projects/ProjectListItem.tsx, web/src/features/projects/useProjectActions.ts, web/src/features/projects/RenameProjectDialog.tsx, web/src/features/projects/DeleteProjectDialog.tsx, web/src/features/projects/projects-labels.ts, web/src/features/projects/projects.css, web/src/features/projects/projects_Summary.md, web/tests/project-list-page.test.ts, web/tests/projects-labels.test.ts, web/tests/project-actions.test.ts]
reads: [server/src/identity/session.ts, server/src/routes/projects.ts, server/src/routes/comments.ts, server/src/storage/files.ts, server/src/db/schema.sql, server/src/db/connection.ts, server/tests/helpers/app.ts, server/tests/routes-project-list.test.ts, server/tests/app-body-limit.test.ts, shared/src/project-list.ts, shared/src/types.ts, web/src/features/objects/DeleteObjectDialog.tsx, web/src/app/review.css, web/src/app/routes.ts, web/src/app/upload-labels.ts, web/tests/api-delete-version.test.ts, web/tests/api-client.test.ts, web/tests/ui-layers.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
179 の一覧から、所有するプロジェクトの名前変更と削除、共有で載っただけのプロジェクトを一覧から外す操作を行えるようにする。
権限は「所有者、または所有者のいない(178 より前からある)プロジェクトなら誰でも」管理できる、とする。

## 前提
- `ensureUser(c, deps): string`(`server/src/identity/session.ts`)が Cookie からユーザーを解決・作成する。
  `withTransaction` の内側で呼んではならない
- `projects.owner_id` は作成者の user id。178 より前の project は NULL。
  `project_members` と(181 以降の)`project_room_state` は projects への `ON DELETE CASCADE` を持つ。
  **`model_versions` と `comments` は CASCADE を持たない**ので、project の行を消す前に自分で消す必要がある(`server/src/db/schema.sql`)
- 179 の `listProjectSummaries` は canManage を「owner_id が自分 または NULL」で計算している(`server/src/db/project-members.ts`)。
  本タスクでこの判定を `canManageProject` に一本化し、`listProjectSummaries` もそれを使うように書き換える
- JSON 本体の読み取りは `server/src/routes/comments.ts:18-25` の `parseJson` と同じ方式(不正な JSON は 400 `VALIDATION`)。
  comments.ts は変更せず、project-manage.ts 側に同等の関数を置く
- `app.ts` は `/api/projects`、`/api/projects/:projectId/versions`、`/api/projects/:projectId/comments(/*)` に
  `validateContentLength` と `bodyLimit` を掛けている。Hono の `app.use(path)` はワイルドカードなしなら
  そのパスにだけ一致するので、`/api/projects/:projectId` はいまはどれにも掛かっていない
- `storage.deleteModelFile(versionId)` はファイルが無くても成功する(`rm(..., { force: true })`)
- `shared/tests/api.test.ts:95` は `Object.values(ErrorCode)` の件数を 6 と検査している。本タスクで 7 に書き換える
- web の既存 API `deleteModelVersion` は 204 を本文なしで扱う独自実装(`web/src/api/client.ts:90-119`)。
  本タスクでこれを `requestNoContent` に切り出して共用してよいが、`web/tests/api-delete-version.test.ts` は変更せずに通ること
- 削除確認ダイアログは `DeleteObjectDialog`(`web/src/features/objects/DeleteObjectDialog.tsx`)と同じ構造
  (`.review-backdrop` + `.review-dialog`、`role="alertdialog"`、確定は `.btn--danger`、キャンセルに autoFocus)に倣う。
  `.review-backdrop` / `.review-dialog` は `web/src/app/review.css` にあり、一覧画面では読み込まれていないので、
  ダイアログのコンポーネントから `import "../../app/review.css";` する。`.review-backdrop` は `position: absolute` なので、
  projects.css に `.projects-dialog__backdrop { position: fixed; }` を置いて重ねる。**projects.css に数値の z-index を書かない**
  (重なり順は `--z-modal` を持つ `.review-backdrop` に任せる。`web/tests/ui-layers.test.ts` の方針)
- `CANCEL_LABEL` は `web/src/features/comments/comment-labels.ts` にある("キャンセル")
- 開いているレビュー画面への削除通知は行わない。削除後も接続中の参加者の画面はそのまま残る(今回は見送り、別途起票予定)

## インターフェイス契約

### `shared/src/api.ts`

```ts
export const ErrorCode = {
  // ...既存の 6 つ...
  FORBIDDEN: "FORBIDDEN",
} as const;

export const RenameProjectInput = z.object({ name: ProjectNameSchema });
export type RenameProjectInput = z.infer<typeof RenameProjectInput>;
```

### `server/src/db/projects.ts`(追加)

```ts
/** project が無ければ undefined、所有者なしは null、それ以外は owner の user id */
export function findProjectOwnerId(db: Db, projectId: string): string | null | undefined;

/** 名前を変える。project が無ければ false */
export function renameProject(db: Db, projectId: string, name: string): boolean;

/**
 * project と、その comments・model_versions を 1 トランザクションで消す
 * (project_members などは CASCADE で消える)。消した版の id を版番号順で返す。project が無ければ null。
 */
export function deleteProject(db: Db, projectId: string): string[] | null;
```

### `server/src/db/project-members.ts`(追加)

```ts
/** owner_id が userId、または owner_id が NULL なら true */
export function canManageProject(ownerId: string | null, userId: string): boolean;

/** userId の一覧から projectId を外す。行が無くても何もしない */
export function removeProjectMembership(db: Db, projectId: string, userId: string): void;
```

### `server/src/routes/project-manage.ts`(新規。`app.ts` で `app.route("/api/projects", projectManageRoutes(resolved))`)

```ts
export function projectManageRoutes(deps: Required<AppDeps>): Hono;
```

| メソッドとパス | 処理順 | 成功 |
| --- | --- | --- |
| `PATCH /:projectId` | ① `findProjectOwnerId` が undefined → 404 `NOT_FOUND` ② `ensureUser` ③ `canManageProject` が false → 403 `FORBIDDEN` ④ 本体を `RenameProjectInput` で検証(不正 JSON・不正な値は 400 `VALIDATION`)⑤ `renameProject` | 200、`findProject` の `Project` |
| `DELETE /:projectId` | ① 404 ② `ensureUser` ③ 403 ④ `deleteProject` ⑤ 返った版 id すべてに `deps.storage.deleteModelFile` | 204、本文なし |
| `DELETE /:projectId/membership` | ① project が無ければ 404 ② `ensureUser` ③ `removeProjectMembership` | 204、本文なし(載っていなくても 204) |

`deps.publish` は呼ばない。`app.ts` では `/api/projects/:projectId` に `validateContentLength` と
`bodyLimit({ maxSize: MAX_JSON_BODY_BYTES })` を掛ける。

### `web/src/api/client.ts`(追加)

```ts
/** PATCH /api/projects/:projectId に { name } を送り、ProjectSchema で検証して返す */
export function renameProject(projectId: string, name: string): Promise<Project>;
/** DELETE /api/projects/:projectId。成功時の本文は読まない */
export function deleteProject(projectId: string): Promise<void>;
/** DELETE /api/projects/:projectId/membership。成功時の本文は読まない */
export function leaveProject(projectId: string): Promise<void>;
```

エラーは既存と同じく `ApiClientError(status, code, message)`。

### `web/src/features/projects/`

```ts
// projects-labels.ts(追加)
export const RENAME_LABEL = "名前を変更";
export const DELETE_LABEL = "削除";
export const LEAVE_LABEL = "一覧から外す";
export const RENAME_DIALOG_TITLE = "プロジェクト名を変更";
export const RENAME_CONFIRM_LABEL = "変更する";
export const RENAMING_LABEL = "変更中…";
export const NAME_REQUIRED = "プロジェクト名を入力してください。";
export const DELETE_DIALOG_TITLE = "プロジェクトを削除";
export const DELETE_CONFIRM_LABEL = "削除する";
export const DELETING_LABEL = "削除中…";
export const FORBIDDEN_MESSAGE = "この操作はプロジェクトの作成者だけが行えます。";
export const RENAME_FAILED = "名前を変更できませんでした。";
export const DELETE_FAILED = "プロジェクトを削除できませんでした。";
export const LEAVE_FAILED = "一覧から外せませんでした。";
/** "「<name>」の名前を変更" などの aria-label */
export function actionAriaLabel(action: string, name: string): string;
/** "「<name>」を削除します。オブジェクト N 個とコメントもすべて削除され、元に戻せません。" */
export function deleteProjectMessage(project: Pick<ProjectSummary, "name" | "versionCount">): string;
/** ApiClientError の code が FORBIDDEN なら FORBIDDEN_MESSAGE、それ以外は fallback */
export function projectActionErrorMessage(error: unknown, fallback: string): string;
```

```tsx
// ProjectListItem.tsx(props を追加)
export function ProjectListItem({ project, onRename, onDelete, onLeave }: {
  project: ProjectSummary;
  onRename: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
  onLeave: (project: ProjectSummary) => void;
}): ReactElement;
```
- `canManage` のとき `RENAME_LABEL` と `DELETE_LABEL` のボタン、`role === "member"` のとき `LEAVE_LABEL` のボタンを出す
  (所有者のいない project では 3 つとも出る)。各ボタンの aria-label は `actionAriaLabel(ラベル, project.name)`

```ts
// useProjectActions.ts
export type ProjectDialog =
  | { kind: "rename"; project: ProjectSummary }
  | { kind: "delete"; project: ProjectSummary }
  | null;

export interface ProjectActions {
  dialog: ProjectDialog;
  /** API 呼び出し中 */
  busy: boolean;
  /** ダイアログ内に出すエラー */
  dialogError: string | null;
  /** 一覧の上に出すエラー(一覧から外す の失敗) */
  pageError: string | null;
  openRename(project: ProjectSummary): void;
  openDelete(project: ProjectSummary): void;
  closeDialog(): void;
  submitRename(name: string): Promise<void>;
  confirmDelete(): Promise<void>;
  leave(project: ProjectSummary): Promise<void>;
}

/** updateProjects は一覧 state の関数型更新(React の setState と同じ形) */
export function useProjectActions(
  updateProjects: (update: (projects: ProjectSummary[]) => ProjectSummary[]) => void,
): ProjectActions;
```

```tsx
// RenameProjectDialog.tsx
export function RenameProjectDialog({ project, busy, error, onSubmit, onCancel }: {
  project: ProjectSummary;
  busy: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}): ReactElement;

// DeleteProjectDialog.tsx
export function DeleteProjectDialog({ project, busy, error, onConfirm, onCancel }: {
  project: ProjectSummary;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement;
```
- RenameProjectDialog は `<form>` に `project.name` を初期値にした input(`maxLength={MAX_PROJECT_NAME_LENGTH}`、autoFocus)。
  `role="dialog"`、`aria-modal="true"`
- error は `.alert`(`role="alert"`)でダイアログ内に出す

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 所有者が `PATCH /api/projects/:id` `{ "name": "  New  " }` | 200。`name: "New"` の `Project`。DB の name も "New" |
| 所有者でないユーザーが PATCH | 403 `FORBIDDEN`。name は変わらない |
| owner_id NULL の project に、Cookie なしで PATCH | 200(所有者なしは誰でも管理できる) |
| 存在しない project に PATCH | 404 `NOT_FOUND`。users は増えない |
| 所有者が name `""`・101 文字・不正 JSON で PATCH | 400 `VALIDATION` |
| 所有者が本体 1MiB 超の PATCH | 413 `PAYLOAD_TOO_LARGE` |
| 所有者が版 2 つ・コメント 1 件・members 2 行の project を DELETE | 204。projects / model_versions / comments / project_members にその project の行が残らず、2 つのモデルファイルが消えている。他の project の行とファイルは残る |
| 所有者でないユーザーが DELETE | 403。何も消えない |
| 存在しない project に DELETE | 404 |
| 同じ project を 2 回 DELETE | 1 回目 204、2 回目 404 |
| DELETE 時に `deps.publish` | 呼ばれない |
| member が `DELETE /api/projects/:id/membership` | 204。その user の members 行だけ消え、project と他の user の行は残る。直後の `GET /api/projects` に出ない |
| 一覧に載っていない project の membership を DELETE | 204 |
| 存在しない project の membership を DELETE | 404 |
| 外した後に `GET /api/projects/:id` で開き直す | 再び一覧に載る |
| `canManageProject("u1", "u1")` / `("u1", "u2")` / `(null, "u2")` | true / false / true |
| `listProjectSummaries` の canManage | `canManageProject` と同じ結果(179 のテストがそのまま通る) |
| `Object.values(ErrorCode)` | 7 件で `FORBIDDEN` を含む |
| `RenameProjectInput.parse({ name: " a " })` | `{ name: "a" }`。`{ name: "  " }` は失敗 |
| `renameProject` / `deleteProject` / `leaveProject` の fetch | それぞれ PATCH(JSON 本体 `{"name":...}`、Content-Type application/json)/ DELETE / DELETE で、パスの projectId は URI エンコードされる |
| 403 応答(`{"error":{"code":"FORBIDDEN",...}}`) | `ApiClientError(403, "FORBIDDEN", message)` |
| canManage かつ role owner の行 | 「名前を変更」「削除」だけがある |
| canManage が false で role member の行 | 「一覧から外す」だけがある |
| canManage かつ role member の行(所有者なし) | 3 つともある |
| 「名前を変更」→ 新しい名前で送信して成功 | ダイアログが閉じ、その行の名前だけが変わる。行の順序は変わらない |
| 空白だけの名前で送信 | API を呼ばず、ダイアログ内に `NAME_REQUIRED` |
| 元と同じ名前で送信 | API を呼ばずにダイアログを閉じる |
| 名前変更が 403 | ダイアログは開いたまま、`FORBIDDEN_MESSAGE` を表示 |
| 名前変更が 500 | ダイアログは開いたまま、`RENAME_FAILED` を表示 |
| 「削除」→ 確認文 | `deleteProjectMessage` の文(例:`「Robot」を削除します。オブジェクト 2 個とコメントもすべて削除され、元に戻せません。`) |
| 削除を確定して成功 | ダイアログが閉じ、その行が一覧から消える |
| API 呼び出し中 | 確定ボタンは `RENAMING_LABEL` / `DELETING_LABEL` を表示して disabled、キャンセルも disabled |
| 名前変更・削除・一覧から外す が 404 | その行を一覧から除き、ダイアログを閉じる(他の人が先に削除した) |
| 「一覧から外す」成功 | 確認なしでその行が消える |
| 「一覧から外す」が 500 | 行は残り、一覧の上の `role="alert"` に `LEAVE_FAILED` |
| 最後の 1 件を削除・外した後 | 179 の空表示(`PROJECTS_EMPTY`)になる |

## やらないこと
- 開いているレビュー画面への削除通知(WS の `project:deleted` など)、RoomHub・`server/src/index.ts` の変更
- レビュー画面(ReviewHeader 等)からの名前変更・削除
- 所有者の譲渡、共有メンバーの管理、アクセス制限
- 論理削除・ゴミ箱・元に戻す
- `shared/src/types.ts`・`shared/src/protocol.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared / server / web(web_Summary.md の client.ts 部分と projects_Summary.md)の Summary を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
