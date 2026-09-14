---
id: 130
title: オブジェクト(モデル版)削除 API と空プロジェクトの許容
feature: server
depends_on: []
owns: [shared/src/types.ts, shared/src/protocol.ts, shared/tests/types.test.ts, shared/tests/protocol-object-removed.test.ts, shared/shared_Summary.md, server/src/db/projects.ts, server/src/routes/projects.ts, server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/src/index.ts, server/tests/db-projects.test.ts, server/tests/routes-project-delete.test.ts, server/tests/realtime-hub-forget.test.ts, server/tests/routes-project-versions.test.ts, server/tests/routes-projects-upload.test.ts, server/tests/routes-projects-formats.test.ts, server/tests/routes-projects-read.test.ts, server/server_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/ReviewPage.tsx, web/tests/api-client.test.ts, web/src/app/app_Summary.md]
reads: [server/src/db/connection.ts, server/src/db/comments.ts, server/src/db/schema.sql, server/src/storage/files.ts, server/src/app.ts, server/src/realtime/room-state.ts, server/tests/helpers/app.ts, server/tests/realtime-hub-objects.test.ts, shared/tests/protocol.test.ts]
verify: npm run typecheck && npm run test:shared && npm run test:server && npm run test:web
status: done
---

## 目的
アップロード済みのオブジェクト(モデル版)を削除できるようにする。全オブジェクトを削除した空のプロジェクト(空のシーン)も有効な状態として扱えるようにする。

## 前提
- 版は SQLite の `model_versions` に保存される。`comments.version_id` は `model_versions(id)` を参照し、`PRAGMA foreign_keys = ON` である。そのため、コメントが付いた版は、先にコメントを消さないと削除できない。server/src/db/schema.sql, server/src/db/connection.ts:9
- トランザクションには `withTransaction(db, fn)` を使う。server/src/db/connection.ts
- `findProject` は版が0件だと null を返す。GET・コメント API・WebSocket 接続可否(server/src/index.ts の `projectExists`)がすべてこれに依存している。server/src/db/projects.ts:84-86
- モデルファイルの削除には `deps.storage.deleteModelFile(versionId)` が既にある(存在しなくてもエラーにならない)。server/src/storage/files.ts
- REST からルームへの配信は `deps.publish(projectId, msg)` を使う。本番では server/src/index.ts で `realtime.publish` に結線されている。テストでは `makeTestApp().published` に記録される。server/tests/helpers/app.ts
- ルームの表示共有状態は `RoomDisplayState` にある(hiddenObjects / hiddenParts / meshCompare / playbackSource が versionId を参照しうる)。server/src/realtime/room-display.ts
- web / server の tests も `npm run typecheck` の対象である。`project.latestVersion.id` と書いている既存テストは、型変更後に `!` などで直す必要がある。
- `ServerMessage` の switch は web/src/app/realtime-dispatch.ts で `msg satisfies never` による網羅性検査になっている。

## インターフェイス契約

shared/src/types.ts
```ts
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  /** versions の末尾要素と同じもの。versions が空なら null */
  latestVersion: ModelVersion | null;
  /** project に属する全版。number 昇順。0件もありうる */
  versions: ModelVersion[];
}
// ProjectSchema: latestVersion は ModelVersionSchema.nullable()、versions は min 制約なし。
// refine: (versions の末尾の id ?? null) === (latestVersion?.id ?? null)
```

shared/src/protocol.ts(ServerMessage に追加。zod スキーマにも追加)
```ts
  /** REST でオブジェクトが削除された(ルーム全員へ配信) */
  | { type: "object:removed"; versionId: string }
```

server/src/db/projects.ts
```ts
/** 版が0件でもプロジェクトがあれば返す(latestVersion: null, versions: []) */
export function findProject(db: Db, projectId: string): Project | null;

/** 版に付いたコメントと版本体を1トランザクションで削除する。削除したら true、該当なしなら false */
export function deleteModelVersion(db: Db, projectId: string, versionId: string): boolean;
```

server/src/routes/projects.ts
```
DELETE /api/projects/:projectId/versions/:versionId
  204 (body なし) / 404 NOT_FOUND ("Project not found" | "Model version not found")
  成功時: DB 削除 → deps.storage.deleteModelFile(versionId) → deps.publish(projectId, { type: "object:removed", versionId })
```

server/src/realtime/room-display.ts
```ts
/** versionId を参照する表示状態を取り除く。
 *  hiddenObjects から除去、hiddenParts から該当版の部位を全除去、
 *  meshCompare.baseId / targetId が一致すれば null にする(thresholdPermille は維持)、
 *  playbackSource が一致すれば null にする */
export function forgetObjectInDisplay(state: RoomDisplayState, versionId: string): void;
```

server/src/realtime/hub.ts
```ts
/** ルームがあれば forgetObjectInDisplay を適用する。ルームが無ければ何もしない。配信はしない */
forgetObject(projectId: string, versionId: string): void;
```

server/src/index.ts の publish 結線
```ts
publish: (projectId, msg) => {
  if (msg.type === "object:removed") hub.forgetObject(projectId, msg.versionId);
  realtime?.publish(projectId, msg);
},
```

web 側の仮の最小対応(本実装はタスク 131・132)
```ts
// web/src/app/realtime-dispatch.ts
    case "object:removed":
      break; // 131 で本実装
// web/src/app/ReviewPage.tsx:228 付近
{state.project.latestVersion !== null && (
  <CommentComposer projectId={projectId} versionId={state.project.latestVersion.id} />
)}
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| ProjectSchema に versions: [], latestVersion: null | 成功 |
| ProjectSchema に versions: [], latestVersion: 版 | 失敗 |
| ProjectSchema に versions: [a,b], latestVersion: null | 失敗 |
| ProjectSchema に versions: [a,b], latestVersion: b | 成功(従来どおり) |
| parseServerMessage で `{type:"object:removed", versionId:"v1"}` | ok |
| parseServerMessage で versionId 欠落・空文字 | ok: false |
| findProject: 版0件のプロジェクト | `{..., latestVersion: null, versions: []}` |
| findProject: プロジェクト自体が無い | null |
| deleteModelVersion: コメント付きの版 | true。版とその版のコメントが消え、他の版のコメントは残る |
| deleteModelVersion: 他プロジェクトの版 id / 存在しない id | false。何も消えない |
| DELETE: 存在する版(コメント2件付き) | 204。GET project の versions から消え、コメント一覧からも該当2件が消える。モデルファイルも消える。published に `{projectId, msg:{type:"object:removed", versionId}}` が1件 |
| DELETE: 最後の1版 | 204。GET project は 200 で versions: [], latestVersion: null |
| 空プロジェクトに POST versions | 201。追加後は latestVersion がその版 |
| 空プロジェクトの GET comments | 200 で [] |
| DELETE: 存在しない版 | 404 NOT_FOUND。published は増えない |
| DELETE: 存在しないプロジェクト | 404 NOT_FOUND |
| 同じ版を2回 DELETE | 2回目は 404 |
| DELETE 済み版の GET model | 404 |
| forgetObjectInDisplay: hidden / 部位 / compare base / target / playbackSource が該当 | 該当分だけ除去・null 化。他の版の値は残る |
| forgetObject 後に join | welcome に削除版の id が含まれない |
| forgetObject: ルームが無い projectId | 例外なく何もしない |

## やらないこと
- web の store への削除反映・API クライアント・削除ボタン・確認ダイアログ(131・132)。web 側は上記の仮対応だけにする
- 版番号の採番方式の変更(MAX+1 のままでよい。最大番号の版を削除すると番号が再利用される)
- 論理削除・復元・権限チェック
- ClientMessage への variant 追加(削除は REST のみ)
- DB スキーマ(schema.sql)の変更(ON DELETE CASCADE にはせず、アプリ側で先にコメントを消す)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している(既存テストの修正は型変更への追随と、「空プロジェクトは null / 失敗」を期待していたケースの反転に限る)
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md / server_Summary.md / app_Summary.md が更新されている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
