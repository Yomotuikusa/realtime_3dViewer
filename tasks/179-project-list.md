---
id: 179
title: 自分が作成・参加したプロジェクトの一覧 API と一覧画面を作り、`/` を一覧、`/new` を新規作成にする
feature: projects
depends_on: [178]
owns: [shared/src/project-list.ts, shared/src/index.ts, shared/shared_Summary.md, shared/tests/project-list.test.ts, server/src/db/project-members.ts, server/src/routes/projects.ts, server/server_Summary.md, server/tests/routes-project-list.test.ts, server/tests/db-project-list.test.ts, web/src/api/client.ts, web/web_Summary.md, web/tests/api-projects.test.ts, web/src/app/routes.ts, web/src/app/App.tsx, web/src/app/UploadPage.tsx, web/src/app/upload-labels.ts, web/src/app/upload.css, web/src/app/ReviewHeader.tsx, web/src/app/review-labels.ts, web/src/app/app_Summary.md, web/tests/routes.test.ts, web/tests/upload-labels.test.ts, web/tests/review-header-projects-link.test.ts, web/tests/theme-effect.test.ts, web/src/features/projects/ProjectListPage.tsx, web/src/features/projects/ProjectListItem.tsx, web/src/features/projects/projects-labels.ts, web/src/features/projects/projects.css, web/src/features/projects/projects_Summary.md, web/tests/project-list-page.test.ts, web/tests/projects-labels.test.ts]
reads: [server/src/identity/session.ts, server/src/db/projects.ts, server/src/db/schema.sql, server/src/app.ts, server/tests/helpers/app.ts, server/tests/routes-project-identity.test.ts, shared/src/types.ts, shared/src/api.ts, shared/tests/index.test.ts, web/src/app/upload-labels.ts, web/src/app/upload.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/api-client.test.ts, web/tests/dock-toggle.test.ts, web/tests/settings-dialog.test.ts, web/tests/upload-page.test.ts, web/tests/objects-add.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
いまは `/` が常に新規アップロード画面で、URL をなくすとプロジェクトに戻れない(実質使い捨て)。
178 で記録した `project_members` をもとに「自分が作成したものと、URL から開いたもの」の一覧を返す API と、
それを表示する画面を作る。`/` を一覧、既存のアップロード画面を `/new` に移す。

## 前提
- 178 で `ensureUser(c, deps): string` が `server/src/identity/session.ts` にある。Cookie からユーザーを
  解決し、無ければ匿名ユーザーを作って Set-Cookie する。`withTransaction` の内側で呼んではならない
- `project_members(project_id, user_id, joined_at, last_opened_at)` は、作成時(POST)と `GET /api/projects/:id` の
  たびに `touchProjectMembership` で記録される(`server/src/db/project-members.ts`)。
  `projects.owner_id` は作成者の user id、178 より前からある project は NULL
- `server/src/routes/projects.ts` は `/api/projects` にマウントされている(`server/src/app.ts`)。
  `routes.get("/", ...)` は `GET /api/projects` に一致する
- shared の `TimestampSchema` は `shared/src/types.ts` の非公開 const。`IdSchema` と `MAX_PROJECT_NAME_LENGTH` は公開されている。
  **`shared/src/types.ts` は 285 行で上限に近いので変更しない**。新しい型は `shared/src/project-list.ts` に置く
- `shared/tests/index.test.ts` は公開名の存在だけを検査するので、index.ts に再エクスポートを足しても落ちない
- web の fetch は同一オリジンなので Cookie は既定で送られる(`web/src/api/client.ts` の `requestJson`)
- 既存テストのソース検査の罠:
  - `web/tests/dock-toggle.test.ts:164-174` は `header` の**最初の子要素が `h1.review-header__title`** であることを検査する。
    一覧へのリンクは h1 より前に置いてはならない
  - `web/tests/settings-dialog.test.ts:151` は ReviewHeader の import を
    `/SETTINGS_OPEN_LABEL,\s*type CopyState,\s*\} from "\.\/review-labels"/s` で検査する。
    `review-labels` から追加 import する名前は、この 2 つより**前**に並べる
  - `web/tests/upload-page.test.ts` と `web/tests/objects-add.test.ts:14-21` は UploadPage.tsx の
    `import { MAX_PROJECT_NAME_LENGTH } from "@shared/types";`、`maxLength={MAX_PROJECT_NAME_LENGTH}`、
    `accept={ALLOWED_MODEL_EXTENSIONS.join(",")}` の文字列を検査する。これらの行は変えない
  - `web/tests/routes.test.ts:13` と `web/tests/upload-labels.test.ts:37` は `/` → upload、
    `NOT_FOUND_HOME === "アップロード画面へ"` を期待している。本タスクで新しい期待値に書き換える
  - `web/tests/theme-effect.test.ts:136-157`(App theme placement)は App を `/` で描画して `.upload` があることを検査している。
    本タスクで `/` は `.projects`、`/new`(`window.history.replaceState({}, "", "/new")` してから描画)は `.upload` を
    期待するように書き換える。`<ThemeEffect />` が 1 回だけという検査と、`/unknown` の notFound の検査はそのまま残す。
    App を描画するテストはこのファイルと routes.test.ts だけである
  - `web/tests/api-client.test.ts` は 235 行で上限に近く、本タスクの owns に**無い**。`listProjects()` のテストは
    新規の `web/tests/api-projects.test.ts` に書く(fetch のスタブの作り方は api-client.test.ts を読んで倣う)
- web のコンポーネントテストは jsdom 上で `createRoot` + `act` で描画する(`web/tests/dock-toggle.test.ts:17-25` の `render`)
- UI の文言・色・余白は `web/src/styles/tokens.css` のトークンと `controls.css` の `.btn` / `.badge` / `.alert` を使う。
  画面の骨格は `web/src/app/upload.css` の `.upload` に倣う

## インターフェイス契約

### `shared/src/project-list.ts`(新規。`shared/src/index.ts` から `export *` する)

```ts
import { z } from "zod";
import { IdSchema, MAX_PROJECT_NAME_LENGTH } from "./types";

/** owner: 自分が所有者 / member: URL から開いて一覧に載っている */
export type ProjectRole = "owner" | "member";

/** 一覧の 1 行 */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  /** 自分が最後に開いた(または作成した)時刻 */
  lastOpenedAt: number;
  /** 版(オブジェクト)の数 */
  versionCount: number;
  /** owner_id が自分なら "owner"、それ以外(owner_id が NULL を含む)は "member" */
  role: ProjectRole;
  /** 名前変更・削除ができるか。owner_id が自分、または owner_id が NULL なら true */
  canManage: boolean;
}

export const ProjectRoleSchema = z.enum(["owner", "member"]) satisfies z.ZodType<ProjectRole>;

export const ProjectSummarySchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  createdAt: z.number().int().nonnegative(),
  lastOpenedAt: z.number().int().nonnegative(),
  versionCount: z.number().int().nonnegative(),
  role: ProjectRoleSchema,
  canManage: z.boolean(),
}) satisfies z.ZodType<ProjectSummary>;
```

### `server/src/db/project-members.ts`(追加)

```ts
/**
 * userId が members に載っている project の一覧。
 * 並びは last_opened_at 降順 → projects.created_at 降順 → projects.id 昇順。
 * versionCount はその project の model_versions の件数。
 */
export function listProjectSummaries(db: Db, userId: string): ProjectSummary[];
```

### `server/src/routes/projects.ts`(追加)

- `GET /`:`ensureUser` で user id を得て、`listProjectSummaries` の結果を 200 で返す。members に何も無ければ `[]`

### `web/src/api/client.ts`(追加)

```ts
/** GET /api/projects を z.array(ProjectSummarySchema) で検証して返す */
export function listProjects(): Promise<ProjectSummary[]>;
```

### `web/src/app/routes.ts`(変更)

```ts
export type Route =
  | { name: "projects" }
  | { name: "upload" }
  | { name: "review"; projectId: string }
  | { name: "notFound"; pathname: string };

/** 一覧画面のパス */
export const PROJECTS_PATH = "/";
/** 新規作成(アップロード)画面のパス */
export const NEW_PROJECT_PATH = "/new";

/** 修飾キーなしの左クリックなら true(このときだけ SPA 遷移し、それ以外はブラウザの既定動作に任せる) */
export function isPlainLeftClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean;
```

`parseRoute("/")` → `{ name: "projects" }`、`parseRoute("/new")` → `{ name: "upload" }`。`/p/:id` と notFound は従来どおり。

### `web/src/app/App.tsx`(変更)
`projects` → `<ProjectListPage />`、`upload` → 従来の `<UploadPage />`。NotFound のリンク先は従来どおり `/`。

### `web/src/features/projects/`(新規フォルダ)

```tsx
// ProjectListPage.tsx
/** マウント時に listProjects() を呼び、読み込み中 / 失敗 / 空 / 一覧 を出し分ける */
export function ProjectListPage(): ReactElement;

// ProjectListItem.tsx
/** 一覧の 1 行(<li>)。180 でこの行に操作ボタンを足す */
export function ProjectListItem({ project }: { project: ProjectSummary }): ReactElement;
```

```ts
// projects-labels.ts
export const PROJECTS_HEADING = "プロジェクト";
export const NEW_PROJECT_LABEL = "新規プロジェクト";
export const PROJECTS_LOADING = "読み込み中…";
export const PROJECTS_EMPTY = "まだプロジェクトがありません。";
export const PROJECTS_EMPTY_HINT = "モデルをアップロードして、最初のプロジェクトを作成しましょう。";
export const PROJECTS_LOAD_FAILED = "プロジェクト一覧を読み込めませんでした。";
export const PROJECTS_RETRY_LABEL = "再読み込み";
export const SHARED_BADGE_LABEL = "共有";

/** ローカル時刻の "YYYY/MM/DD HH:mm"(各要素 0 埋め) */
export function formatOpenedAt(ms: number): string;

/** "オブジェクト N 個 · 最終オープン YYYY/MM/DD HH:mm" */
export function projectMeta(project: Pick<ProjectSummary, "versionCount" | "lastOpenedAt">): string;
```

画面構成(ProjectListPage):
- `<main className="projects">` の先頭に見出し行。`h1` は `APP_NAME`(upload-labels)、その下の `h2` に `PROJECTS_HEADING`、
  右側に `NEW_PROJECT_LABEL` の `<a className="btn btn--primary" href={NEW_PROJECT_PATH}>`
- 読み込み中は `PROJECTS_LOADING` を `role="status"` で出す
- 失敗時は `.alert`(`role="alert"`)に `PROJECTS_LOAD_FAILED` を出し、`PROJECTS_RETRY_LABEL` のボタンで再取得する
- 空のときは `PROJECTS_EMPTY` と `PROJECTS_EMPTY_HINT` を出す(新規作成ボタンは見出し行にあるので重ねて出さない)
- 一覧は `<ul className="projects__list">` に、API が返した順のまま `ProjectListItem` を並べる

ProjectListItem:
- プロジェクト名は `<a href={projectPath(id)}>`。`projectMeta` の文を muted で添える
- `role === "member"` のときだけ `SHARED_BADGE_LABEL` の `.badge` を付ける
- アンマウント後に取得が完了しても state を更新しない(取得中に遷移しても警告を出さない)

アプリ内リンクの共通の振る舞い(一覧のプロジェクト名・新規作成・UploadPage の戻り・ReviewHeader の一覧リンク):
`onClick` で `isPlainLeftClick(event)` が true のときだけ `preventDefault()` して `navigate(href)` する。

### 既存画面への導線
- `upload-labels.ts`:`NOT_FOUND_HOME` を `"プロジェクト一覧へ"` に変える。`BACK_TO_PROJECTS_LABEL = "← プロジェクト一覧"` を足す
- `UploadPage.tsx`:`.upload__head` の先頭(h1 の前)に `BACK_TO_PROJECTS_LABEL` のリンク(`className="upload__back"`、href は `PROJECTS_PATH`)を置く。
  作成成功後は従来どおり `navigate(projectPath(project.id))`
- `review-labels.ts`:`PROJECTS_LINK_LABEL = "プロジェクト一覧"` を足す
- `ReviewHeader.tsx`:`.review-header__actions` の**先頭**に `<a className="btn btn--quiet" href={PROJECTS_PATH}>{PROJECTS_LINK_LABEL}</a>` を置く

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| Cookie なしで `GET /api/projects` | 200 `[]`。`Set-Cookie` あり |
| 同じ Cookie で `POST /api/projects`(ファイル 2 つ)した後に `GET /api/projects` | 1 件。`versionCount: 2`、`role: "owner"`、`canManage: true`、`lastOpenedAt` = 作成時刻 |
| ユーザー A が作成した project を、B の Cookie で `GET /api/projects/:id` した後の B の一覧 | その project が `role: "member"`、`canManage: false` で載る |
| A の一覧 | B が開いても A の行は変わらない(role owner のまま) |
| `seedProject`(owner_id NULL)を開いたユーザーの一覧 | `role: "member"`、`canManage: true` |
| 一度も開いていない project | 一覧に載らない |
| last_opened_at が 10 / 30 / 20 の 3 件(db 層で直接 members を作る) | 30 → 20 → 10 の順 |
| last_opened_at が同じ 2 件 | created_at の新しい方が先。それも同じなら id 昇順 |
| `ProjectSummarySchema` に role `"admin"`・負の versionCount・空の name | parse 失敗 |
| `listProjects()` が 200 で配列を受け取る | 検証済みの配列を返す。`fetch` は `"/api/projects"` を GET で呼ぶ |
| `listProjects()` の応答がスキーマ不一致 | `ApiClientError(status, "VALIDATION", RESPONSE_INVALID_MESSAGE)` |
| `parseRoute("/")` / `parseRoute("/new")` | `{ name: "projects" }` / `{ name: "upload" }` |
| `parseRoute("/new/x")` | notFound |
| `isPlainLeftClick` に button 0・修飾なし | true |
| button 1、または meta / ctrl / shift / alt のどれかが true | false |
| `formatOpenedAt(new Date(2026, 8, 29, 9, 5).getTime())` | `"2026/09/29 09:05"` |
| `projectMeta({ versionCount: 3, lastOpenedAt: new Date(2026, 0, 2, 13, 4).getTime() })` | `"オブジェクト 3 個 · 最終オープン 2026/01/02 13:04"` |
| ProjectListPage:fetch が解決する前 | `role="status"` に `PROJECTS_LOADING` |
| ProjectListPage:2 件を返す | `li` が 2 つ、API の順。各行にプロジェクト名のリンク(href `/p/<id>`)と `projectMeta` の文 |
| ProjectListPage:role member の行 | その行だけ `SHARED_BADGE_LABEL` のバッジがある |
| ProjectListPage:`[]` を返す | `PROJECTS_EMPTY` と `PROJECTS_EMPTY_HINT` が出て、`li` は 0 個 |
| ProjectListPage:500 を返し、再読み込みボタンを押すと 1 件返る | まず `role="alert"` に `PROJECTS_LOAD_FAILED`、押下後に 1 件表示され alert は消える |
| プロジェクト名リンクを修飾なしでクリック | `window.location.pathname` が `/p/<id>` になり popstate が 1 回発火する |
| 新規プロジェクトのリンクをクリック | `/new` へ遷移 |
| ReviewHeader | `.review-header__actions` の最初の要素が `PROJECTS_LINK_LABEL` のリンク(href `/`)。header の最初の子は従来どおり h1 |
| `NOT_FOUND_HOME` | `"プロジェクト一覧へ"` |

### テストの置き場
振る舞い表の各行は次のファイルに書く。owns に無いテストファイルを新規作成・変更しない。

| 振る舞い表の行 | ファイル |
| --- | --- |
| `GET /api/projects` の API 行(Cookie なし / 作成後 / B が開いた後 / A の一覧 / seedProject / 未訪問) | `server/tests/routes-project-list.test.ts` |
| last_opened_at の並び・同時刻の並び(db 層で直接 members を作る) | `server/tests/db-project-list.test.ts` |
| `ProjectSummarySchema` | `shared/tests/project-list.test.ts` |
| `listProjects()` | `web/tests/api-projects.test.ts` |
| `parseRoute` / `isPlainLeftClick` | `web/tests/routes.test.ts` |
| `formatOpenedAt` / `projectMeta` | `web/tests/projects-labels.test.ts` |
| ProjectListPage の各行・リンクのクリック | `web/tests/project-list-page.test.ts`(既存の web テストと同じく `.ts` で `createElement` を使う) |
| ReviewHeader | `web/tests/review-header-projects-link.test.ts` |
| `NOT_FOUND_HOME` | `web/tests/upload-labels.test.ts` |
| App の `/` → 一覧、`/new` → アップロード | `web/tests/theme-effect.test.ts`(前提の罠の項を参照) |

## やらないこと
- 名前変更・削除・一覧から外す操作(180)。`ProjectListItem` に操作ボタンやその置き場を先回りで作らない
- 一覧の検索・並べ替え UI・ページング・サムネイル
- ReviewPage.tsx(285 行)の変更
- `Project` 型、`GET /api/projects/:id` の応答の変更
- 識別方式(178)の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `features/projects/projects_Summary.md` を新規作成し、`web/web_Summary.md` の Summary 一覧と
      `src/api/client.ts` の公開インターフェイスに追記している。app / shared / server の Summary も更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
