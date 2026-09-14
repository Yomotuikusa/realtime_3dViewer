---
id: 131
title: web でオブジェクト削除をストア全体へ反映する
feature: web
depends_on: [130]
owns: [web/src/api/client.ts, web/src/store/objects.ts, web/src/store/comments.ts, web/src/app/object-removal.ts, web/src/app/realtime-dispatch.ts, web/tests/api-client-delete.test.ts, web/tests/store-objects-remove.test.ts, web/tests/object-removal.test.ts, web/src/store/store_Summary.md, web/src/app/app_Summary.md]
reads: [shared/src/protocol.ts, shared/src/types.ts, shared/src/compare.ts, web/src/store/display.ts, web/src/features/outliner/selection.ts, web/tests/api-client.test.ts, web/tests/store-objects.test.ts, web/tests/realtime-dispatch.test.ts, web/tests/summary-coverage.test.ts, server/server_Summary.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
オブジェクト削除 API(タスク 130)を web から呼べるようにする。自分または他ユーザーの削除を、オブジェクト一覧・非表示状態・コメント・選択・比較・再生対象へ一貫して反映する。

## 前提
- サーバの `DELETE /api/projects/:projectId/versions/:versionId` は、成功時に 204(body なし)を返す。失敗時は `ApiErrorSchema` 形式の JSON(404 NOT_FOUND など)を返す。削除時にはその版のコメントもサーバ側で消えている。server/server_Summary.md
- 削除はルーム全員(削除した本人を含む)へ `ServerMessage { type: "object:removed"; versionId: string }` として配信される。shared/src/protocol.ts
- タスク 130 で web/src/app/realtime-dispatch.ts に `case "object:removed": break;` の仮分岐が入っている。これを本実装に置き換える
- 既存の `requestJson` は 2xx でも JSON パースを要求するため、204 には使えない。web/src/api/client.ts
- 比較設定は `useDisplayStore.getState().meshCompare` / `setMeshCompare(compare)`、再生対象は `playbackSource` / `setPlaybackSource(id | null)`。web/src/store/display.ts
- 選択は `useSelectionStore.getState().selected: { versionId, objectId } | null` / `clear()`。web/src/features/outliner/selection.ts
- web/tests/realtime-dispatch.test.ts は248行と上限に近いので、テストは新規ファイルに書く

## インターフェイス契約

web/src/api/client.ts
```ts
/** DELETE /api/projects/:projectId/versions/:versionId。2xx なら resolve(body は読まない)。
 *  非 2xx は ApiErrorSchema を解釈できれば ApiClientError(status, code, message)、できなければ
 *  ApiClientError(status, "INTERNAL", `API request failed with status ${status}`)。
 *  fetch 自体の失敗は ApiClientError(0, "INTERNAL", message) */
export function deleteModelVersion(projectId: string, versionId: string): Promise<void>;
```

web/src/store/objects.ts(ObjectsStoreState に追加 + 関数追加)
```ts
  /** objects・hiddenIds・hiddenParts から versionId を除去する。どこにも無ければ state を更新しない */
  remove(versionId: string): void;

/** number が最大の版の id(コメント投稿の紐づけ先)。空なら null */
export function latestObjectId(objects: readonly ModelVersion[]): string | null;
```

web/src/store/comments.ts(CommentsStoreState に追加)
```ts
  /** versionId のコメントを items から除去する。selectedId が消えたら null にする。該当なしなら state を更新しない */
  removeByVersion(versionId: string): void;
```

web/src/app/object-removal.ts
```ts
/** オブジェクト削除を各ストアへ反映する。何度呼んでも安全(冪等)。
 *  1. useObjectsStore.remove(versionId)
 *  2. useCommentsStore.removeByVersion(versionId)
 *  3. selection.selected?.versionId が一致すれば clear()
 *  4. meshCompare.baseId / targetId が一致すればそれぞれ null にして setMeshCompare(thresholdPermille は維持)
 *  5. display.playbackSource が一致すれば setPlaybackSource(null)
 *  6. 削除後に objects が空なら comments.setComposerAnchor(null) */
export function applyObjectRemoved(versionId: string): void;
```

web/src/app/realtime-dispatch.ts
```ts
    case "object:removed":
      applyObjectRemoved(msg.versionId);
      break;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| deleteModelVersion: 204 | resolve。fetch は `DELETE /api/projects/p%2F1/versions/v1` のように encodeURIComponent 済みの URL で呼ばれる |
| deleteModelVersion: 404 + ApiError JSON | ApiClientError(404, "NOT_FOUND", message) で reject |
| deleteModelVersion: 500 で body が JSON でない | ApiClientError(500, "INTERNAL", "API request failed with status 500") |
| deleteModelVersion: fetch が throw | ApiClientError(0, "INTERNAL", ...) |
| objects.remove: 存在する id(hiddenIds・hiddenParts にも含まれる) | 3つすべてから除去。他の版は残り、number 昇順を維持 |
| objects.remove: objects に無いが hiddenIds にだけある id | hiddenIds から除去 |
| objects.remove: どこにも無い id | state の参照が変わらない |
| latestObjectId: [] / [v1(n=1), v3(n=3), v2(n=2)] | null / v3 の id |
| comments.removeByVersion: 該当2件・他版1件、選択中が該当コメント | 1件だけ残り、selectedId は null |
| comments.removeByVersion: 選択中が他版コメント | selectedId は維持 |
| comments.removeByVersion: 該当なし | state の参照が変わらない |
| applyObjectRemoved: 選択中の版 | selection が null |
| applyObjectRemoved: 別の版を選択中 | selection 維持 |
| applyObjectRemoved: meshCompare {base: v1, target: v2, 50} で v2 を削除 | {base: v1, target: null, 50} |
| applyObjectRemoved: playbackSource が v1 で v1 を削除 / v2 を削除 | null / v1 のまま |
| applyObjectRemoved: 最後の1件を削除、composerAnchor が設定済み | objects が [] で composerAnchor が null |
| applyObjectRemoved: 同じ id で2回 | 2回目も例外なし・状態は変わらない |
| dispatchServerMessage(object:removed) | applyObjectRemoved と同じ結果になる |

## やらないこと
- 削除ボタン・確認ダイアログ・コメント投稿欄の切替など UI(タスク 132)
- ReviewPage.tsx の変更
- サーバ・shared の変更
- 既存の realtime-dispatch.test.ts / store-objects.test.ts / api-client.test.ts への追記(新規テストファイルに書く)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] store_Summary.md / app_Summary.md が更新されている(公開する関数・アクションを列挙する。web/tests/summary-coverage.test.ts が検査する)
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
