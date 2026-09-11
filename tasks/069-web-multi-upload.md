---
id: 069
title: web API クライアントに複数ファイルの project 作成と版追加を実装し、アップロード画面で複数ファイルを選べるようにする
feature: web
depends_on: [066]
owns: [web/src/api/client.ts, web/src/app/UploadPage.tsx, web/src/app/upload-labels.ts, web/tests/api-client.test.ts, web/tests/upload-labels.test.ts, web/src/app/app_Summary.md, web/web_Summary.md]
reads: [shared/src/types.ts, shared/src/api.ts, web/src/app/upload.css, web/src/app/routes.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
アップロード画面で複数の glTF/GLB を一度に選んで1つのシーンを作れるようにし、
レビュー画面(071)から既存シーンへファイルを追加するための API 関数を用意する。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 066 で `Project.versions: ModelVersion[]` が必須になった。`ProjectSchema` は
  `versions` が無い応答を拒否する。`web/tests/api-client.test.ts` の `project` fixture には
  066 で既に `versions: [latestVersion]` が入っている
- 067 のサーバは `POST /api/projects` で multipart `file` を複数受け(送信順に number 1..N)、
  `POST /api/projects/:projectId/versions` で `file` 1件を受けて 201 `ModelVersion` を返す。
  エラーコードは既存と同じ(`VALIDATION` / `UNSUPPORTED_FORMAT` / `PAYLOAD_TOO_LARGE` / `NOT_FOUND`)
- サーバの本体上限はリクエスト全体に掛かるため、複数ファイルは**合計**が
  `MAX_UPLOAD_BYTES_DEFAULT` 以下でなければ 413 になる。事前検証も合計で判定する
- `requestJson(path, init, schema)` が fetch・エラー変換・zod 検証を担う。web/src/api/client.ts:21-59
- `createProject(name, file)` は `FormData` に `name` と `file` を append する。web/src/api/client.ts:67-72
- `UploadPage` は送信前に拡張子とサイズを検査し、文言をインラインで持っている。web/src/app/UploadPage.tsx:36-47
- `upload-labels.ts` は JSX 非依存の純粋関数と文言定数の置き場である。web/src/app/upload-labels.ts
- `tests/upload-labels.test.ts` は既存文言の値を固定している。既存定数の値は変えない
- `client.ts` は `web_Summary.md` の「共通ファイル」「公開インターフェイス」に載っている。
  `UploadPage` / `upload-labels` は `app_Summary.md` に載っている。両方を更新する

## インターフェイス契約

```ts
// web/src/api/client.ts
/** FormData に name と、files の順で file を複数 append して POST /api/projects */
export function createProject(name: string, files: readonly File[]): Promise<Project>;

/** POST /api/projects/:projectId/versions に file 1件を送り、ModelVersionSchema で検証して返す */
export function addModelVersion(projectId: string, file: File): Promise<ModelVersion>;

// modelUrl / getProject / listComments / createComment / updateCommentStatus は変更しない
```

```ts
// web/src/app/upload-labels.ts
export const MODEL_FILE_LABEL = "モデルファイル";          // 既存。値を変えない
export const MODEL_FILES_HELP_SUFFIX = "複数選択できます";  // 追加
export const NO_FILE_SELECTED = "モデルファイルを選択してください。";
export const UNSUPPORTED_EXTENSION = "対応しているモデル形式は .glb と .gltf です。";
export const FILE_TOO_LARGE = "ファイルサイズが上限を超えています。";  // 既存。合計超過にも使う

export interface FileLike { name: string; size: number }

/**
 * 送信前検証。問題なければ null、あればユーザーへ出す文言を返す。
 * 判定順: 0件 → 拡張子(1つでも不正) → 合計サイズ > maxBytes
 */
export function validateModelFiles(
  files: readonly FileLike[],
  extensions: readonly string[],
  maxBytes: number,
): string | null;

/** 1件なら fileSummary と同じ。2件以上なら「N ファイル(合計 X MB)」 */
export function filesSummary(files: readonly FileLike[]): string;

// fileHelp / fileSummary は変更しない
```

`UploadPage`:
- `<input type="file" multiple accept=".glb,.gltf">`。state は `files: File[]`
- 送信時 `validateModelFiles(files, ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT)` が
  非 null ならそれを `setError` して送信しない
- 成功時は従来どおり `navigate(projectPath(project.id))`
- help 表示: 0件なら `fileHelp(...) + "。" + MODEL_FILES_HELP_SUFFIX`、1件以上なら `filesSummary(files)`

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createProject("Robot", [a, b])` | fetch の body が FormData で、`getAll("file")` が `[a, b]` の順、`get("name")` が `"Robot"` |
| `createProject` の応答が `versions` を含む Project | resolve |
| 応答に `versions` が無い | `ApiClientError(status, "VALIDATION", RESPONSE_INVALID_MESSAGE)` |
| `addModelVersion("p 1", file)` | `POST /api/projects/p%201/versions`、body の `get("file")` が file |
| `addModelVersion` の 201 応答が `ModelVersion` | resolve して `ModelVersion` を返す |
| `addModelVersion` の 404 `NOT_FOUND` 応答 | `ApiClientError(404, "NOT_FOUND", message)` |
| `validateModelFiles([], ...)` | `NO_FILE_SELECTED` |
| `[a.glb, b.txt]` | `UNSUPPORTED_EXTENSION` |
| `[A.GLB]`(大文字) | 拡張子は小文字化して判定し、サイズ内なら `null` |
| `[a.glb (60MB), b.gltf (60MB)]`、maxBytes 100MB | `FILE_TOO_LARGE`(合計判定) |
| `[a.glb (60MB)]`、maxBytes 100MB | `null` |
| 拡張子不正かつ合計超過 | `UNSUPPORTED_EXTENSION`(拡張子が先) |
| `filesSummary([{ name: "a.glb", size: 1536 }])` | `fileSummary("a.glb", 1536)` と同じ文字列 |
| `filesSummary([a (1 MiB), b (2 MiB)])` | `"2 ファイル(合計 3.0 MB)"` |
| `filesSummary([a (512 B), b (512 B)])` | `"2 ファイル(合計 1.0 KB)"`(合計が 1 MiB 未満なら KB) |

## やらないこと
- レビュー画面のオブジェクト一覧・追加ボタン(071)
- ビューアの複数モデル描画(070)
- 既存の `fileHelp` / `fileSummary` の変更、既存文言の値の変更
- ドラッグ&ドロップ対応
- `UploadPage` のテスト(React コンポーネントのテストは本プロジェクトでは行っていない。
  検証は `validateModelFiles` / `filesSummary` / client の単体テストで行う)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] app_Summary.md と web_Summary.md(client.ts の公開インターフェイス)を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
