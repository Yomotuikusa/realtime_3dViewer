---
id: 022
title: shared 骨組み用 export(SHARED_SCAFFOLD)の除去
feature: shared
depends_on: [021]
owns: [shared/src/index.ts, shared/tests/index.test.ts, shared/shared_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/src/types.ts, shared/src/api.ts, shared/src/protocol.ts, shared/src/camera.ts, shared/src/stroke.ts, server/src/index.ts, web/src/main.tsx]
verify: npm run typecheck && npm run test:shared
status: done
---

## 目的
骨組み整備時のプレースホルダ `SHARED_SCAFFOLD` を `shared/src/index.ts` から取り除き、
`shared` の公開面を本来の re-export だけにする(D25 の最終段)。

## 前提
- 010 で `server/src/index.ts`、011 で `web/src/main.tsx` から `SHARED_SCAFFOLD` の import は
  外れている(D25)。**このタスクの最初に `grep -rn SHARED_SCAFFOLD server/src web/src` で
  参照が残っていないことを確認する**。残っていたら実装せず、申し送りに書いて終了する
  (他フォルダのファイルはこのタスクの owns ではない)
- `shared/src/index.ts` は現在 `SHARED_SCAFFOLD` と `export * from "./types" | "./api" | "./protocol" | "./camera" | "./stroke"` を持つ
- `SHARED_SCAFFOLD` を参照している既存テストがあれば削除対象だが、
  **`shared/tests/index.test.ts` 以外のテストファイルは変更しない**(参照があれば申し送り)
- `npm run typecheck` は shared / server / web の 3 つを順に実行するので、server / web に
  参照が残っていれば verify が落ちる(それが目的)
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// shared/src/index.ts(最終形。これ以外の export を持たない)
export * from "./types";
export * from "./api";
export * from "./protocol";
export * from "./camera";
export * from "./stroke";
```

```ts
// shared/tests/index.test.ts
// `import * as shared from "../src"` して、下記の名前が存在すること・SHARED_SCAFFOLD が無いことを検証する
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `import * as shared from "../src"` | `"SHARED_SCAFFOLD" in shared` が `false` |
| 同上 | `CameraStateSchema` `StrokeSchema` `CommentSchema` `ProjectSchema` `PresenceUserSchema`(types)、`ErrorCode` `CreateCommentInput` `ApiErrorSchema`(api)、`ClientMessageSchema` `ServerMessageSchema` `parseClientMessage` `parseServerMessage` `CAMERA_SEND_INTERVAL_MS`(protocol)、`DEFAULT_CAMERA` `lerpCamera` `cameraEquals` `cloneCamera`(camera)、`simplify` `simplifyTolerance` `isSendableStroke`(stroke)がすべて `undefined` でない |
| `grep -rn SHARED_SCAFFOLD shared/ server/src web/src` | 0 件 |
| `npm run typecheck` | 3 フォルダとも通る |

## やらないこと
- `server/` `web/` 配下のファイルの変更(参照が残っていたら申し送り)
- `shared/src/index.ts` 以外の shared ソースの変更
- `shared/tests/index.test.ts` 以外のテストファイルの変更
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] `shared/src/index.ts` が上記の最終形と一致している
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md が更新されている(`SHARED_SCAFFOLD` の記述を削除)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:shared` が成功する
