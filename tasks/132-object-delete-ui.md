---
id: 132
title: オブジェクト一覧の削除ボタン・確認ダイアログと空シーンの投稿欄
feature: web
depends_on: [131]
owns: [web/src/features/objects/ObjectList.tsx, web/src/features/objects/DeleteObjectDialog.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects.css, web/src/features/objects/objects_Summary.md, web/src/features/comments/comment-labels.ts, web/src/features/comments/comments_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/tests/objects-delete.test.ts]
reads: [web/src/api/client.ts, web/src/app/object-removal.ts, web/src/store/objects.ts, web/src/store/comments.ts, web/src/app/SettingsDialog.tsx, web/src/app/review.css, web/src/styles/controls.css, web/src/features/comments/CommentComposer.tsx, web/tests/objects-styles.test.ts, web/tests/objects-labels.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右パネルのオブジェクト一覧から、確認ダイアログを経てオブジェクトを削除できるようにする。オブジェクトが0個の空シーンでは、コメント投稿欄を無効化して案内文を出す。

## 前提
- 削除 API とストアへの反映はタスク 131 で実装済みである:
  - `deleteModelVersion(projectId, versionId): Promise<void>`(失敗時は `ApiClientError`)。web/src/api/client.ts
  - `applyObjectRemoved(versionId): void`(冪等。objects・hidden・コメント・選択・比較・再生対象・composerAnchor を片付ける)。web/src/app/object-removal.ts
  - `latestObjectId(objects): string | null`(number 最大の版の id。空なら null)。web/src/store/objects.ts
- サーバは削除成功時に全員へ `object:removed` を配信する。削除した本人にも届くが、`applyObjectRemoved` は冪等なので、API 成功直後にローカルでも呼んでよい
- コメントは `useCommentsStore` の `items: Comment[]` にあり、各 `Comment.versionId` を持つ。web/src/store/comments.ts
- 既存ダイアログの見た目は `review-backdrop` / `review-dialog` クラス(web/src/app/review.css:134-156)である。ただし `.review-backdrop` は `position: absolute` で、3D ビュー領域基準で配置される。右パネル内から出すダイアログは、objects.css で自前クラスに `position: fixed` を与えて画面全体を覆う
- 危険操作のボタンスタイル `.btn--danger` が既にある。web/src/styles/controls.css:65-68
- このリポジトリには React 描画テスト用ライブラリが無い。UI の検証は、ラベル関数の単体テストと、ソース文字列を読む契約テスト(web/tests/objects-styles.test.ts と同じ方式)で行う
- タスク 130 の時点では ReviewPage.tsx は `state.project.latestVersion !== null && <CommentComposer ... versionId={state.project.latestVersion.id} />` になっている。`state.project` は読み込み時のスナップショットで、削除・追加に追随しない

## インターフェイス契約

web/src/features/objects/objects-labels.ts(追加)
```ts
export const DELETE_LABEL = "削除";
export const DELETING_LABEL = "削除中…";
export const DELETE_DIALOG_TITLE = "オブジェクトを削除";
export const DELETE_CONFIRM_LABEL = "削除する";
export const DELETE_FAILED = "オブジェクトの削除に失敗しました。";
/** "<fileName> を削除" */
export function deleteAriaLabel(version: { fileName: string }): string;
/** commentCount=0: "<fileName> を削除します。元に戻せません。"
 *  commentCount>0: "<fileName> を削除します。付いているコメント <N> 件も削除されます。元に戻せません。" */
export function deleteConfirmMessage(fileName: string, commentCount: number): string;
/** versionId に紐づくコメント件数 */
export function countCommentsForVersion(comments: readonly { versionId: string }[], versionId: string): number;
```

web/src/features/objects/DeleteObjectDialog.tsx
```tsx
export function DeleteObjectDialog(props: {
  version: ModelVersion;
  commentCount: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement;
// <div className="review-backdrop objects-delete__backdrop">
//   <div className="review-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
//     h2 DELETE_DIALOG_TITLE / p deleteConfirmMessage(...)
//     button.btn.btn--danger (DELETE_CONFIRM_LABEL、busy 中は DELETING_LABEL・disabled)
//     button.btn.btn--quiet CANCEL_LABEL(comment-labels.ts の既存定数 "キャンセル" を import。busy 中 disabled、autoFocus)
```

web/src/features/comments/comment-labels.ts(追加)
```ts
export const COMPOSER_NO_OBJECTS_MESSAGE = "オブジェクトを追加するとコメントできます。";
```

ObjectList.tsx の変更
- 各行の表示切替ボタンの後ろに `button.btn.btn--quiet.objects__delete`(`aria-label={deleteAriaLabel(version)}`、文言 DELETE_LABEL)を置く
- 押すと `pendingDelete: ModelVersion` を state に入れ、`DeleteObjectDialog` を表示する。commentCount は `countCommentsForVersion(useCommentsStore の items, id)` で求める
- 確認時の処理: busy=true → `await deleteModelVersion(projectId, id)` → 成功なら `applyObjectRemoved(id)`、ダイアログを閉じ、error を null にする → 失敗なら `ApiClientError` / `Error` の message(空なら DELETE_FAILED)を既存の `role="alert"` に出し、ダイアログを閉じる → finally で busy=false
- 削除中は、全行の削除ボタンとファイル追加を disabled にする

ReviewPage.tsx の変更
```tsx
const composerVersionId = useObjectsStore((s) => latestObjectId(s.objects));
...
{composerVersionId === null
  ? <p className="comments__empty" role="status">{COMPOSER_NO_OBJECTS_MESSAGE}</p>
  : <CommentComposer projectId={projectId} versionId={composerVersionId} />}
```
(スタイルは既存の `.comments__empty`(web/src/features/comments/comments.css:47)を流用し、新規 CSS は足さない)

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| deleteAriaLabel({fileName:"a.glb"}) | "a.glb を削除" |
| deleteConfirmMessage("a.glb", 0) | "a.glb を削除します。元に戻せません。" |
| deleteConfirmMessage("a.glb", 3) | "a.glb を削除します。付いているコメント 3 件も削除されます。元に戻せません。" |
| countCommentsForVersion([v1,v2,v1], "v1") / ([], "v1") | 2 / 0 |
| 契約: ObjectList.tsx | `objects__delete`、`deleteModelVersion(`、`applyObjectRemoved(`、`<DeleteObjectDialog` を含む。`window.confirm` を含まない |
| 契約: DeleteObjectDialog.tsx | `role="alertdialog"`、`aria-modal="true"`、`btn--danger`、`objects-delete__backdrop` を含む |
| 契約: objects.css | `.objects-delete__backdrop` に `position: fixed` がある。`.objects__delete` のスタイルがある。16進カラー直書きなし |
| 契約: ReviewPage.tsx | `latestObjectId(` と `COMPOSER_NO_OBJECTS_MESSAGE` を含み、`latestVersion` を含まない |
| 契約: 既存 web/tests/objects-styles.test.ts | 変更せずに通る(比較コントロールはファイル追加の後・alert の前、ObjectList は参加者とコメントの間) |

## やらないこと
- 左アウトライナーへの削除ボタン、キーボードショートカット(Delete キー)による削除
- 取り消し(Undo)、複数選択での一括削除
- CommentComposer.tsx 本体・ストア・API クライアント・realtime-dispatch の変更(131 の成果物を呼ぶだけ)
- review.css の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストが web/tests/objects-delete.test.ts にあり、通る
- [ ] objects_Summary.md / comments_Summary.md / app_Summary.md が更新されている(公開する定数・関数・コンポーネントを列挙する)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
