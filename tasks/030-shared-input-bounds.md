---
id: 030
title: shared 識別子・自由文字列の長さと文字種の上限
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/api.ts, shared/src/camera.ts, shared/tests/types.test.ts, shared/tests/types-bounds.test.ts, shared/tests/api.test.ts, shared/tests/camera.test.ts, shared/shared_Summary.md]
reads: [shared/src/protocol.ts, shared/src/index.ts, server/server_Summary.md, server/src/routes/projects.ts, web/web_Summary.md]
verify: npm run typecheck && npm test
status: done
---

## 目的
セキュリティレビューで確認した「zod スキーマに上限がない」箇所を塞ぐ。`Stroke.id` / `userId`、
`Comment` の各 id、`ModelVersion.fileName` は `z.string().min(1)` だけで長さ・文字種の制約がなく、
数 MB の文字列を DB の JSON 列や WS ルームに滞留させられる。`CommentSchema.authorName` / `body` も
入力側(`CreateCommentInput`)の上限と食い違っている。あわせて `lerpCamera` の NaN と未使用関数を片付ける。

## 前提
- `RequiredIdSchema = z.string().min(1)` は shared/src/types.ts:58 で定義され、id・authorName・body・
  fileName・name のすべてに流用されている(types.ts:72-116)
- サーバが生成する id はすべて `nanoid(12)`(文字種 `A-Za-z0-9_-`)。server/src/app.ts:27、
  server/src/realtime/hub.ts:69。web の stroke id も `nanoid(12)`。既存テストの id は `p1` `v1` `id-1` 等
- `fileName` はブラウザの `File.name`(basename のみ)がそのまま保存される。server/src/routes/projects.ts:67。
  パス組み立てには使われない
- `CreateCommentInput` は `authorName` max 50、`body` max 2000、`versionId` は `min(1)` のみ。shared/src/api.ts:37-43。
  `ProjectNameSchema` は max 100。api.ts:34。`protocol.ts` の `MAX_NAME_LENGTH = 50` は**変更しない**(reads)
- `lerpCamera(from, to, NaN)` は `Math.min(1, NaN)` が NaN になり全座標が NaN になる。shared/src/camera.ts:32-38
- `vec3Distance`(camera.ts:16-18)は shared/tests/camera.test.ts からしか参照されない。**削除する**
- api.ts は types.ts を import している(逆方向は不可)。定数は types.ts に置く
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// shared/src/types.ts(追加分)
export const MAX_ID_LENGTH = 64;
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_AUTHOR_NAME_LENGTH = 50;
export const MAX_COMMENT_BODY_LENGTH = 2000;

/** サーバ・クライアントが生成する識別子。nanoid の文字種に限定する */
export const IdSchema = z.string().min(1).max(MAX_ID_LENGTH).regex(/^[A-Za-z0-9_-]+$/);
/** アップロード元のファイル名。パス区切り(/ \)・制御文字(U+0000–U+001F, U+007F)を含まない */
export const FileNameSchema = z.string().min(1).max(MAX_FILE_NAME_LENGTH)
  .refine((s) => !/[\\/\x00-\x1f\x7f]/.test(s));

// 既存スキーマの差し替え(型 interface は変更しない)
// StrokeSchema.id / userId            → IdSchema
// CommentSchema.id / projectId / versionId → IdSchema
// CommentSchema.authorName            → z.string().min(1).max(MAX_AUTHOR_NAME_LENGTH)
// CommentSchema.body                  → z.string().min(1).max(MAX_COMMENT_BODY_LENGTH)
// ModelVersionSchema.id / projectId   → IdSchema、fileName → FileNameSchema
// ProjectSchema.id                    → IdSchema、name → z.string().min(1).max(MAX_PROJECT_NAME_LENGTH)
// PresenceUserSchema.id               → IdSchema(name は変更しない)
// RequiredIdSchema は残る用途が無ければ削除する
```

```ts
// shared/src/api.ts(変更分。定数は types.ts から import する)
export const ProjectNameSchema = z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH);
export const CreateCommentInput = z.object({
  versionId: IdSchema,
  authorName: z.string().trim().min(1).max(MAX_AUTHOR_NAME_LENGTH),
  body: z.string().trim().min(1).max(MAX_COMMENT_BODY_LENGTH),
  anchor: Vec3Schema,
  camera: CameraStateSchema,
  strokes: z.array(StrokeSchema).max(200),
});
```

```ts
// shared/src/camera.ts
/** t が有限でなければ 0 として扱う(from をそのまま返す) */
export function lerpCamera(from: CameraState, to: CameraState, t: number): CameraState;
// vec3Distance は削除
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `IdSchema.safeParse("abcDEF012_-")` | 受理 |
| `IdSchema` に 64 文字 | 受理。65 文字は拒否 |
| `IdSchema` に `"a b"`、`"a/b"`、`"../x"`、`""` | 拒否 |
| `StrokeSchema` の `id` が 65 文字 | 拒否 |
| `CommentSchema` の `authorName` が 51 文字 / `body` が 2001 文字 | 拒否(50 / 2000 は受理) |
| `ModelVersionSchema.fileName` が `"model.glb"`、`"日本語 モデル.gltf"` | 受理 |
| `fileName` が `"a/b.glb"`、`"a\\b.glb"`、`"a\t.glb"`、`"a\n.glb"`、256 文字 | 拒否 |
| `ProjectSchema.name` が 101 文字 | 拒否 |
| `CreateCommentInput.versionId` が `"v 1"` | 拒否 |
| `lerpCamera(a, b, NaN)` | `a` と等しい(NaN を含まない) |
| `lerpCamera(a, b, Infinity)` | `b` と等しい |
| 既存の camera / stroke / protocol テスト | 変更なしで通る(vec3Distance のテストのみ削除) |
| `npm test`(shared / server / web 全体) | 全通過。特に server の upload・comments テストと web の api-client テストが id 制約で落ちない |

## やらないこと
- `protocol.ts` / `stroke.ts` / `index.ts` は変更しない(`index.ts` は `export *` なので新定数は自動で公開される)
- `PresenceUserSchema.name` に上限は付けない(`protocol.ts` の `MAX_NAME_LENGTH` との二重管理を避けるため、別途判断する)
- server / web 側のコード変更はしない。verify で全テストが通ることだけを確認する

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る(新しい上限のテストは types-bounds.test.ts に書く。types.test.ts は 183 行)
- [ ] shared_Summary.md が更新されている(新定数・IdSchema・FileNameSchema・vec3Distance 削除を反映)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
