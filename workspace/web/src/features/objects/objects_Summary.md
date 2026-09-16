# objects

## 目的

レビュー右ドックにシーンのオブジェクト一覧を表示し、各版の 3D ビュー表示・非表示をルームへ共有する。ファイル追加ではモデル版を順番に REST へ送信し、成功した版を一覧とシーンへ追加する。

## ファイル一覧と役割

- ObjectList.tsx: `useObjectsStore` の版一覧と可視性を表示し、表示切替の WebSocket 共有、検証済みモデルファイルの順次版追加、削除確認からの版削除を提供する。ファイル選択の `accept` は `ALLOWED_MODEL_EXTENSIONS` 由来とし、末尾に比較コントロールを配置する
- CompareControls.tsx: 基準・対象の版と比較しきい値を表示・更新し、`mesh:compare` を WebSocket 共有する
- DeleteObjectDialog.tsx: オブジェクト削除の確認文、危険操作ボタン、キャンセルを含む alertdialog を表示する
- objects-labels.ts: オブジェクト見出し、可視性、ファイル追加、削除、比較の文言と表示用 helper
- objects.css: オブジェクト一覧、可視性状態、ファイル追加、削除確認ダイアログ、比較コントロールのトークン CSS

## 公開インターフェイス

- ObjectList.tsx: `ObjectList({ projectId, send })`
- CompareControls.tsx: `CompareControls({ send })`
- DeleteObjectDialog.tsx: `DeleteObjectDialog({ version, commentCount, busy, onConfirm, onCancel })`
- objects-labels.ts: `OBJECTS_HEADING`、可視性・追加ラベル群、`DELETE_LABEL`、`DELETING_LABEL`、`DELETE_DIALOG_TITLE`、`DELETE_CONFIRM_LABEL`、`DELETE_FAILED`、比較ラベル群、`objectsHeading`、`versionTag`、`toggleAriaLabel`、`deleteAriaLabel`、`deleteConfirmMessage`、`countCommentsForVersion`、比較表示 helper

## 他機能との関係

`useObjectsStore` を一覧の状態と可視性更新、比較版の選択肢に使う。`useDisplayStore` の `meshCompare` を比較コントロールの表示値として読み、更新時にローカルへ反映して `ClientMessage` の `mesh:compare` を送る。`addModelVersion` と `validateModelFiles` でファイル追加を行い、`ClientMessage` の `object:visibility` を `ReviewPage` から渡された realtime の `send` へ送る。`ReviewPage` の右ドックでは `PresenceList` とコメント領域の間に配置される。
`ObjectList` はコメントストアから削除対象版のコメント件数を数え、`deleteModelVersion` 成功時に `applyObjectRemoved` を呼ぶ。削除中は削除ボタンとファイル追加を無効化し、失敗メッセージを alert に表示する。`DeleteObjectDialog` は `review-dialog` を使い、専用 backdrop で画面全体を覆う。

## テスト

- tests/objects-labels.test.ts: オブジェクト表示文言、比較文言、見出し・版タグ・可視性 aria ラベル、比較表示 helper のテスト
- tests/objects-delete.test.ts: 削除ラベル、確認文、コメント件数、削除 API 結線、ダイアログと CSS、空シーン投稿欄の契約テスト
- tests/objects-add.test.ts: オブジェクト追加のファイル選択 `accept`、許可拡張子、ファイル検証呼び出しの契約テスト
- tests/objects-styles.test.ts: オブジェクト CSS、比較コントロール、右ドックの行構成、Summary 索引の契約テスト
