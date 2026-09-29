# projects

## 目的

自分が作成または URL から参加したプロジェクトの一覧を取得して表示し、新規作成とレビュー画面への導線を提供する。所有プロジェクトの名前変更・削除と、共有プロジェクトを一覧から外す操作も提供する。

## ファイル一覧と役割

- ProjectListPage.tsx: 一覧 API の読み込み中・失敗・空・一覧状態、操作エラーと管理ダイアログを表示する
- ProjectListItem.tsx: プロジェクト名、最終オープン時刻、オブジェクト数、共有バッジ、管理ボタンを表示する一覧の1行
- useProjectActions.ts: 名前変更・削除・一覧から外す操作の状態と API 呼び出しを管理する
- RenameProjectDialog.tsx: プロジェクト名変更フォームを表示するダイアログ
- DeleteProjectDialog.tsx: プロジェクト削除確認を表示するダイアログ
- projects-labels.ts: 一覧画面の文言、操作エラー、日時・メタ情報の表示 helper
- projects.css: 一覧画面、操作ボタン、固定ダイアログのレイアウトとスタイル

## 公開インターフェイス

- ProjectListPage: プロジェクト一覧画面
- ProjectListItem: `ProjectSummary` 1件の表示と管理操作 callback
- `useProjectActions`: 一覧操作の状態、ダイアログ、更新 callback
- RenameProjectDialog / DeleteProjectDialog: 名前変更・削除確認ダイアログ
- projects-labels.ts: 一覧・操作の文言、エラー、`formatOpenedAt`、`projectMeta`

## 他機能との関係

`api/client.ts` の project 一覧・名前変更・削除 API と `@shared/project-list` の検証済み一覧を利用し、`app/routes.ts` の SPA 遷移と `upload-labels.ts` のアプリ名を利用する。ダイアログは共通の `review.css` とコメント機能のキャンセル文言を利用する。

## テスト

- tests/project-list-page.test.ts: 読み込み、失敗と再試行、空、一覧順、共有バッジ、リンク遷移、アンマウント後の取得完了を検証
- tests/projects-labels.test.ts: 日時と一覧メタ情報の表示を検証
