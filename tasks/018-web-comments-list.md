---
id: 018
title: web コメントストアと一覧(Open フィルタ・Resolve・WS 受信反映)
feature: web
depends_on: [017]
owns: [web/src/store/comments.ts, web/src/features/comments/CommentList.tsx, web/src/app/realtime-dispatch.ts, web/src/app/ReviewPage.tsx, web/tests/store-comments.test.ts, web/tests/realtime-dispatch.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/api.ts, shared/src/protocol.ts, server/server_Summary.md, web/src/api/client.ts, web/src/store/session.ts, web/src/app/useRealtime.ts]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
MVP #5 / #6 の読む側。コメントを REST で取得して一覧表示し、Open のみフィルタと
Resolve / Reopen を行い、他者の投稿・更新を WS(`comment:*`)で反映する(§16.4)。
投稿(019)と再現(020)が使う state もここで全部定義する(D28)。

## 前提
- 011 の `listComments(projectId, status?)` `updateCommentStatus(projectId, commentId, status)`
  `ApiClientError` が実装済み(web/src/api/client.ts)
- 008 のサーバは `PATCH` 後に `comment:updated` を **自分を含む** ルーム全員へ配信する。
  自分は REST の応答で `upsert` し、さらに `comment:updated` でも同じ内容が来る(冪等なので問題ない)
- 013 の `dispatchServerMessage` に **`comment:created` / `comment:updated` の case を足す**
- `Comment` `CommentStatus` は `@shared/types`。一覧の順序は `createdAt` 昇順(§14)
- 決定事項 **D28 / D32**(docs/task-breakdown.md §3)
- @testing-library は無い。テスト対象は comments ストアと `dispatchServerMessage`。
  `CommentList` は typecheck のみ
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/store/comments.ts
import type { Comment, Vec3 } from "@shared/types";

export interface CommentsStoreState {
  items: Comment[];                 // 常に createdAt 昇順(同値は id 昇順)
  showOnlyOpen: boolean;            // 初期値 false
  selectedId: string | null;        // 再現対象(020 が購読)。初期値 null
  composerAnchor: Vec3 | null;      // 投稿位置(019 が使う)。初期値 null
  lastError: string | null;         // API 失敗の表示用(§17)。初期値 null

  /** 全置換(ソートして保持)。selectedId は正規化する(下記) */
  setAll(items: Comment[]): void;
  /** id 一致は置換、無ければ追加。ソート維持。selectedId は正規化する */
  upsert(comment: Comment): void;
  /** items に無い id は null 扱い。同じ id を再度 select しても null にはしない */
  select(id: string | null): void;
  /** フィルタ変更。selectedId は正規化する */
  setFilter(showOnlyOpen: boolean): void;
  setComposerAnchor(anchor: Vec3 | null): void;
  setLastError(message: string | null): void;
  reset(): void;
}
export const useCommentsStore: /* zustand の UseBoundStore<StoreApi<CommentsStoreState>> */;

/** 表示対象。showOnlyOpen なら status === "open" だけ。順序は items のまま。純粋関数 */
export function selectVisible(items: Comment[], showOnlyOpen: boolean): Comment[];
```

selectedId の正規化(D32): `setAll` / `upsert` / `setFilter` の後、`selectedId` が
`selectVisible(items, showOnlyOpen)` に含まれなければ `null` にする。

```tsx
// web/src/features/comments/CommentList.tsx
/** マウント時に listComments(projectId) → setAll。失敗は setLastError(ApiClientError.message)。
 *  「Open のみ」チェックボックス(setFilter)、行クリックで select(id)(選択中の行を再クリックで null)、
 *  各行に Resolve(open のとき)/ Reopen(resolved のとき)ボタン。
 *  ボタンは updateCommentStatus → 応答を upsert。失敗は setLastError。処理中は disabled。
 *  lastError があれば一覧の上に表示する */
export function CommentList(props: { projectId: string }): React.ReactElement;
```

行の表示内容: `authorName`、`body`(最大 2 行程度で省略してよい)、status、選択中は背景を強調。

`realtime-dispatch.ts` への追加:

| msg.type | 反映先 |
| --- | --- |
| `comment:created` | `comments.upsert(msg.comment)` |
| `comment:updated` | `comments.upsert(msg.comment)` |

`ReviewPage` への追加分: サイドパネルの `<PresenceList />` の下に `<CommentList projectId={projectId} />`。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| ストア初期値 | `items:[]`、`showOnlyOpen:false`、`selectedId:null`、`composerAnchor:null`、`lastError:null` |
| `setAll([c(createdAt 2), c(createdAt 1)])` | `items` が createdAt 昇順 |
| `setAll` で createdAt 同値 | id 昇順 |
| `upsert(c1')`(既存 id、body 違い) | 件数不変、body が更新される |
| `upsert(c3)`(新規、createdAt が中間) | 件数 +1、正しい位置に挿入される |
| `select("c1")`(存在) | `selectedId === "c1"` |
| `select("nope")` | `null` |
| `select("c1")` → `select("c1")` | `"c1"` のまま(トグルはコンポーネント側の責務) |
| `select("c1")` → `select(null)` | `null` |
| `setFilter(true)`(c1 が resolved、選択中) | `selectedId === null`、`showOnlyOpen === true` |
| `setFilter(true)`(c1 が open、選択中) | `selectedId === "c1"` のまま |
| フィルタ on で選択中の c1 を `upsert` で resolved に | `selectedId === null` |
| フィルタ off で同上 | `selectedId === "c1"` のまま |
| `setAll([])`(選択中) | `selectedId === null` |
| `selectVisible([open, resolved], true)` / `(…, false)` | `[open]` / 両方 |
| `setComposerAnchor([1,2,3])` → `setComposerAnchor(null)` | 反映 → null |
| `setLastError("x")` → `reset()` | 初期値に戻る |
| `dispatchServerMessage({type:"comment:created", comment})` | `items` に 1 件増える |
| `dispatchServerMessage({type:"comment:updated", comment})`(既存 id) | 置換され件数不変 |
| 013〜016 で通した dispatch のテスト | 引き続き通る |

## やらないこと
- 投稿(`CommentComposer` / `CommentPins` / 配置クリック)は 019。`composerAnchor` は state だけ置く
- 再現(カメラ移動・線の一時表示)は 020。行クリックは `select` を呼ぶだけ
- `web/src/api/client.ts` の変更
- R3F コンポーネント・描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(comments ストアの state / action、selectedId の正規化規則)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
