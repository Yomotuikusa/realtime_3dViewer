---
id: 139
title: web オブジェクト追加のファイル選択で FBX / OBJ も選べるようにする
feature: web
depends_on: []
owns: [web/src/features/objects/ObjectList.tsx, web/src/features/objects/objects_Summary.md, web/tests/objects-add.test.ts]
reads: [shared/src/api.ts, web/src/app/UploadPage.tsx, web/src/app/upload-labels.ts, web/tests/objects-delete.test.ts, web/tests/objects-styles.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
レビュー画面の「ファイルを追加」は検証には `ALLOWED_MODEL_EXTENSIONS`(4 形式)を使っているのに、
ファイル選択ダイアログの `accept` だけが `.glb,.gltf` の直書きで、133〜135 で対応した FBX / OBJ を
ダイアログで選べない。アップロード画面と同じく定数から組み立てる。

## 前提
- `web/src/features/objects/ObjectList.tsx:3` が `@shared/api` から `ALLOWED_MODEL_EXTENSIONS` と `MAX_UPLOAD_BYTES_DEFAULT` を import し、
  `:65-92` の `handleFiles` が `:68-72` で `validateModelFiles(files, ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT)` を呼ぶ
- 同ファイル `:148-156` の `<input className="objects__file" type="file" multiple accept=".glb,.gltf" hidden disabled={busy} onChange=…>` が対象
- `web/src/app/UploadPage.tsx:75-82` は `accept={ALLOWED_MODEL_EXTENSIONS.join(",")}` としている。これが揃えるべき形
- `ALLOWED_MODEL_EXTENSIONS` は `[".glb", ".gltf", ".fbx", ".obj"] as const`(`shared/src/api.ts:38`)
- `accept=` を検査しているテストは無い(`grep "accept=" web/tests` に一致なし)。
  `web/tests/objects-delete.test.ts:23` と `objects-styles.test.ts:13` が `ObjectList.tsx` をソース文字列として読む形がある
- `objects_Summary.md:9` が ObjectList.tsx の説明、`:27-31` が `## テスト`

## インターフェイス契約

```tsx
// web/src/features/objects/ObjectList.tsx(その他は変更しない)
<input
  className="objects__file"
  type="file"
  multiple
  accept={ALLOWED_MODEL_EXTENSIONS.join(",")}
  hidden
  disabled={busy}
  onChange={(event) => void handleFiles(event)}
/>
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ObjectList.tsx` のソース(新規 `web/tests/objects-add.test.ts` でソース検査) | `accept={ALLOWED_MODEL_EXTENSIONS.join(",")}` を含み、`accept=".glb,.gltf"` を含まず、`/accept="[^"]*"/` に一致しない |
| `UploadPage.tsx` のソース(読むだけ) | 同じ式 `accept={ALLOWED_MODEL_EXTENSIONS.join(",")}` を含む(2 画面の一致を固定する) |
| `ALLOWED_MODEL_EXTENSIONS.join(",")` | `".glb,.gltf,.fbx,.obj"` |
| `handleFiles` の検証 | 従来どおり(変更しない) |
| 既存テスト | すべて通る |

## やらないこと
- `UploadPage.tsx` / `upload-labels.ts` / `objects-labels.ts` は変更しない
- 検証ロジック・エラー文言・CSS を変えない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりに実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] objects_Summary.md の ObjectList.tsx の説明に「`accept` は `ALLOWED_MODEL_EXTENSIONS` 由来」が入り、`## テスト` に objects-add.test.ts が載っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
