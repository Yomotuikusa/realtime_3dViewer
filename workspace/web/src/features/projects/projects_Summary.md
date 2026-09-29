# projects

## 目的

自分が作成または URL から参加したプロジェクトの一覧を取得して表示し、新規作成とレビュー画面への導線を提供する。

## ファイル一覧と役割

- ProjectListPage.tsx: 一覧 API の読み込み中・失敗・空・一覧状態を表示し、再読み込みと新規作成への遷移を担当する
- ProjectListItem.tsx: プロジェクト名、最終オープン時刻、オブジェクト数、共有バッジを表示する一覧の1行
- projects-labels.ts: 一覧画面の文言と日時・メタ情報の表示 helper
- projects.css: 一覧画面のレイアウトと一覧行のスタイル

## 公開インターフェイス

- ProjectListPage: プロジェクト一覧画面
- ProjectListItem: `ProjectSummary` 1件の表示
- projects-labels.ts: 一覧の文言、`formatOpenedAt`、`projectMeta`

## 他機能との関係

`api/client.ts` の `listProjects` から `@shared/project-list` の検証済み一覧を受け取り、`app/routes.ts` の SPA 遷移と `upload-labels.ts` のアプリ名を利用する。

## テスト

- tests/project-list-page.test.ts: 読み込み、失敗と再試行、空、一覧順、共有バッジ、リンク遷移、アンマウント後の取得完了を検証
- tests/projects-labels.test.ts: 日時と一覧メタ情報の表示を検証
