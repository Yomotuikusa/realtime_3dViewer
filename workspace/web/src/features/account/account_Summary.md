# account

## 目的

一覧画面のアカウントメニューから、匿名利用者の登録・ログイン、ログイン中のログアウト、登録直後のリカバリーコード保存を提供する。

## ファイル一覧と役割

- AccountMenu.tsx: アカウント取得、匿名・ログイン中のメニュー表示、ログイン・登録・ログアウト後の状態変更を管理する
- LoginDialog.tsx: ログイン入力、入力必須チェック、ログイン API の busy・エラー表示を管理する
- RegisterDialog.tsx: 登録入力、登録フォーム検証、登録 API の busy・エラー表示を管理する
- RecoveryCodeDialog.tsx: リカバリーコードのコピーと保存確認を表示する
- account-labels.ts: アカウント機能の文言、API エラー変換、登録フォーム検証を提供する
- account.css: アカウントメニューと固定ダイアログのレイアウトを定義する

## 公開インターフェイス

- AccountMenu: アカウント状態に応じたメニューと各ダイアログを表示する
- LoginDialog: `onSuccess(account)` / `onCancel` を受け取るログインダイアログ
- RegisterDialog: `onSuccess(result)` / `onCancel` を受け取る登録ダイアログ
- RecoveryCodeDialog: `code` と `onClose` を受け取るリカバリーコードダイアログ
- account-labels.ts: アカウント文言、`accountErrorMessage`、`accountDisplayLabel`、`validateRegisterForm`

## 他機能との関係

`api/account.ts` のアカウント API と `@shared/account` / `@shared/protocol` のスキーマ・制約を利用する。ログイン成功時の表示名は `app/display-name.ts` に保存し、一覧画面の `ProjectListPage` からアカウント変更時の再読み込み callback を受け取る。ダイアログは共通の `app/review.css` とコメント機能のキャンセル文言を利用する。

## テスト

- tests/account-labels.test.ts: アカウント文言、表示名、登録入力の検証
- tests/account-menu.test.ts: メニューの取得、匿名・ログイン中・ログアウト状態
- tests/account-dialogs.test.ts: ログイン・登録・リカバリーコードの入力と API 状態
