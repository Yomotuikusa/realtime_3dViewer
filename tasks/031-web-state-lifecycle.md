---
id: 031
title: web プロジェクト切替時のストア初期化・エラー表示の解除・入力の事前検査
feature: web
depends_on: []
owns: [web/src/app/App.tsx, web/src/app/ReviewPage.tsx, web/src/app/review-stores.ts, web/src/app/useRealtime.ts, web/src/app/realtime-dispatch.ts, web/src/app/UploadPage.tsx, web/src/app/upload-labels.ts, web/src/app/JoinDialog.tsx, web/src/api/client.ts, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/comments/CommentList.tsx, web/src/features/comments/CommentComposer.tsx, web/src/styles/controls.css, web/tests/api-client.test.ts, web/tests/realtime-dispatch.test.ts, web/tests/review-stores.test.ts, web/tests/upload-labels.test.ts, web/tests/use-realtime.test.ts, web/web_Summary.md]
reads: [web/src/store/session.ts, web/src/store/comments.ts, web/src/store/presence.ts, web/src/store/annotation.ts, web/src/store/camera.ts, web/src/api/ws.ts, web/src/app/routes.ts, web/src/app/display-name.ts, shared/shared_Summary.md, shared/src/protocol.ts, shared/src/api.ts]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
レビューで確認した web 基盤の致命的バグを直す。(1) 全ストアの `reset()` が本番コードから一度も
呼ばれず、`ReviewPage` に `key` も無いため、同一タブでプロジェクトを跨ぐと前プロジェクトの
コメント・参加者・線・下書き線・カメラが残留する。(2) `setLastError(null)` を呼ぶ経路が無く、
一度出たエラーバナーが再接続・再取得に成功しても消えない。あわせて URL のエンコード、
アップロード前のサイズ検査、表示名の入力上限、未使用 CSS の削除を行う。

## 前提
- `App.tsx` は `<ReviewPage projectId={route.projectId} />` を `key` 無しで描画する。web/src/app/App.tsx:14
- 各ストアの `reset()` は web/src/store/{session,comments,presence,annotation,camera}.ts に既にあり、
  テストからのみ呼ばれている。**ストアファイルは変更しない**(reads)
- `session.setLastError` は realtime-dispatch.ts:44 の `error` 受信時のみ。`comments.setLastError` は
  CommentList.tsx:45,59 と CommentComposer.tsx:48,60 の失敗時のみ。成功時に `null` を渡す箇所は無い
- `useRealtime` の `onStatus` は `"open"` で `join` を送る。web/src/app/useRealtime.ts:23-28
- `AnnotationLayer` の effect cleanup は DOM リスナー解除のみで、`drafting` を消さない。
  web/src/features/annotation/AnnotationLayer.tsx:87-93。`endDraft()` は `drafting` を null にして点列を返す
- `client.ts` の URL は `projectId` / `versionId` / `commentId` を未エンコードで埋め込む。web/src/api/client.ts:67-112。
  `wsUrl` は `encodeURIComponent` 済み(web/src/api/ws.ts:151-154)
- `validationErrorMessage` は zod の内部メッセージをそのまま `ApiClientError.message` にし、画面に出る。client.ts:20-22
- `UploadPage.handleSubmit` は拡張子だけ検査し `file.size` を見ない。web/src/app/UploadPage.tsx:34-40。
  上限は `MAX_UPLOAD_BYTES_DEFAULT`(shared/src/api.ts:32)
- `JoinDialog` の input に `maxLength` が無い。web/src/app/JoinDialog.tsx:28-35。上限は `MAX_NAME_LENGTH`(shared/src/protocol.ts:13)
- `.btn--danger` と `.visually-hidden`(web/src/styles/controls.css)はどの tsx からも参照されない。**削除する**
- `realtime-dispatch.ts` の `switch` は `default: break` で網羅性検査が無い。realtime-dispatch.ts:46-47
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/app/review-stores.ts(新規)
/** レビュー画面が持つ 5 つのストア(session, presence, annotation, comments, camera)をすべて reset() する */
export function resetReviewStores(): void;
```

```tsx
// web/src/app/App.tsx
<ReviewPage key={route.projectId} projectId={route.projectId} />

// web/src/app/ReviewPage.tsx(追加)
useEffect(() => () => resetReviewStores(), []);   // アンマウント時のみ。マウント時には呼ばない
```

```ts
// web/src/app/useRealtime.ts(追加。onStatus からこれを呼ぶ)
/** 接続状態を session に反映し、open なら lastError を消してから join を送る */
export function onRealtimeStatus(
  status: ConnectionStatus,
  name: string,
  send: (msg: ClientMessage) => boolean,
): void;
```

```ts
// web/src/features/comments/CommentList.tsx / CommentComposer.tsx
// listComments 成功時・updateCommentStatus 成功時・createComment 成功時に
// useCommentsStore.getState().setLastError(null) を呼ぶ
```

```ts
// web/src/features/annotation/AnnotationLayer.tsx  effect cleanup(追加)
if (useAnnotationStore.getState().drafting !== null) useAnnotationStore.getState().endDraft();
```

```ts
// web/src/api/client.ts
export const RESPONSE_INVALID_MESSAGE = "サーバーの応答を解釈できませんでした。";
// 応答の zod 検証失敗時は ApiClientError(status, "VALIDATION", RESPONSE_INVALID_MESSAGE)。zod の message は使わない
// すべての URL セグメント(projectId, versionId, commentId)を encodeURIComponent で埋め込む
export function modelUrl(projectId: string, versionId: string): string;   // シグネチャ変更なし
```

```ts
// web/src/app/upload-labels.ts(追加)
export const FILE_TOO_LARGE = "ファイルサイズが上限を超えています。";
// UploadPage.handleSubmit: 拡張子検査の直後に file.size > MAX_UPLOAD_BYTES_DEFAULT なら setError(FILE_TOO_LARGE) して return
```

```tsx
// web/src/app/JoinDialog.tsx
<input ... maxLength={MAX_NAME_LENGTH} />
```

```ts
// web/src/app/realtime-dispatch.ts  default 節
default:
  msg satisfies never;
  break;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `resetReviewStores()` を、5 ストアに値を入れた状態で呼ぶ | 5 ストアすべてが初期値に戻る(各ストアの `reset` が 1 回ずつ呼ばれる、または状態で確認) |
| `session.lastError` が入った状態で `onRealtimeStatus("open", "Alice", send)` | `session.connection` が `"open"`、`lastError` が null、`send` が `{type:"join",name:"Alice"}` で 1 回呼ばれる |
| `onRealtimeStatus("closed", "Alice", send)` | `connection` が `"closed"`、`send` は呼ばれない、`lastError` は変更されない |
| `listComments` が失敗して lastError が入った後、再取得が成功する | `comments.lastError` が null(コンポーネント内。テスト不要、下記注記) |
| `updateCommentStatus` / `createComment` が成功する | `comments.lastError` が null(コンポーネント内。テスト不要) |
| `AnnotationLayer` が `drafting !== null` のままアンマウントされる | `drafting` が null になる(コンポーネント内。テスト不要) |
| `modelUrl("p 1", "v/1")` | `/api/projects/p%201/versions/v%2F1/model` |
| `updateCommentStatus("p1", "c/1", ...)` の fetch URL | `commentId` がエンコードされている(既存の fetch モックで確認) |
| `getProject` の応答が `ProjectSchema` に合わない | `ApiClientError.code === "VALIDATION"`、`message === RESPONSE_INVALID_MESSAGE` |
| `UploadPage` で `file.size > MAX_UPLOAD_BYTES_DEFAULT` のファイルを送信 | `FILE_TOO_LARGE` が表示され `createProject` は呼ばれない(upload-labels.test.ts で定数の文言のみ検証。UploadPage 側はテスト不要) |
| `JoinDialog` の input | `maxLength` が `MAX_NAME_LENGTH`(typecheck と目視。テストは任意) |
| `ServerMessage` に新しい type を足したと仮定 | `msg satisfies never` が型エラーになる(typecheck で担保、テスト不要) |
| controls.css | `.btn--danger` と `.visually-hidden` のルールが存在しない(styles-rules.test.ts は変更しない) |
| 既存の web テスト | すべて通る |

注記: このリポジトリには React コンポーネントを描画するテスト基盤(testing-library 等)が無く、追加もできない。
「テスト不要」と書いた行は実装のみ行い、typecheck と既存テストの通過で完了とする。テストが必須なのは
`resetReviewStores`、`onRealtimeStatus`、`client.ts`、`upload-labels.ts`、`realtime-dispatch.ts` の行である。

## やらないこと
- ストアファイル(`web/src/store/*`)は変更しない
- `web/src/api/ws.ts` の再接続ロジックは変更しない(テストのモック利用のみ)
- viewer 配下(`features/viewer/*`、`CommentPickLayer.tsx`)の修正は 032 で行う
- `AnnotationToolbar` の `send()` 戻り値の扱いは変更しない
- fetch の AbortController 導入はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(review-stores.ts、lastError の解除経路、URL エンコード、FILE_TOO_LARGE を反映)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う。api-client.test.ts は 162 行)
- [ ] verify: に書いたコマンドが成功する
