---
id: 137
title: web 入力欄の maxLength と投稿の添付本数を shared の定数から取る
feature: web
depends_on: [136]
owns: [web/src/app/UploadPage.tsx, web/src/features/comments/CommentComposer.tsx, web/src/features/comments/compose.ts, web/src/features/theme/ColorPicker.tsx, web/src/features/theme/viewer-colors.ts, web/tests/upload-page.test.ts, web/tests/compose.test.ts, web/tests/comments-styles.test.ts, web/tests/viewer-colors.test.ts, web/src/app/app_Summary.md, web/src/features/comments/comments_Summary.md, web/src/features/theme/theme_Summary.md]
reads: [shared/src/types.ts, shared/src/api.ts, shared/shared_Summary.md, web/src/app/JoinDialog.tsx, web/tests/summary-coverage.test.ts, web/web_Summary.md]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
サーバが検証に使う上限(`MAX_PROJECT_NAME_LENGTH` / `MAX_COMMENT_BODY_LENGTH` / `MAX_COMMENT_STROKES`)と
同じ数値が、web の入力欄と投稿組み立てに生の数値リテラルで書かれている。今は偶然一致しているだけで、
shared 側を変えても入力欄が追従しない。`JoinDialog` と同じく shared の定数を import する形に揃える。

## 前提
- `web/src/app/JoinDialog.tsx:2` が `@shared/protocol` から `MAX_NAME_LENGTH` を import し、`:32` で `maxLength={MAX_NAME_LENGTH}` としている。これが揃えるべき形
- `web/src/app/UploadPage.tsx:62-69` のプロジェクト名 `<input className="input" type="text" maxLength={100} …>`。
  import は `:1-19`(`:3` が `@shared/api` からの import)。サーバは `ProjectNameSchema`(`shared/src/api.ts:60`)で
  `MAX_PROJECT_NAME_LENGTH`(= 100、`shared/src/types.ts:131`)を検証に使う
- `web/src/features/comments/CommentComposer.tsx:105-114` の本文 `<textarea className="input" … maxLength={2000} rows={4} …>`。
  import は `:1-12`。`MAX_COMMENT_BODY_LENGTH` = 2000 は `shared/src/types.ts:133`
- `web/src/features/comments/compose.ts:23-35` `ownStrokesForComment(strokes, userId)` が `:34` で
  `ownStrokes.length <= 200 ? ownStrokes : ownStrokes.slice(-200)` と 200 を 2 回書いている。
  `:23` の doc コメントも「最新200本」。`MAX_COMMENT_STROKES` は 136 が `shared/src/types.ts` に追加する
- `web/tests/compose.test.ts:47-53` は 200 本の境界を数値で固定している(値は変わらないので通る)
- `web/src/features/theme/ColorPicker.tsx:54-62` の 16 進入力 `<input … maxLength={7} />`。
  `normalizeHex`(`web/src/features/theme/viewer-colors.ts:68-75`)は `#` 任意の 3 桁または 6 桁を受理するので、
  最長の入力は `#rrggbb` の 7 文字
- `web/tests/comments-styles.test.ts:17` は既に `CommentComposer.tsx` をソース文字列として読んでいる(ソース検査の形)
- `UploadPage` を読むテストは無い(`grep UploadPage web/tests` に一致なし)
- Summary: `web/src/app/app_Summary.md:15`(UploadPage.tsx)、`:54-67`(テスト)。
  `web/src/features/comments/comments_Summary.md:10, 21`(compose.ts)、`:13`(CommentComposer.tsx)、`:40-46`(テスト)。
  `web/src/features/theme/theme_Summary.md:16`(ColorPicker.tsx)、`:42-54`(テスト)。
  テストは対応するソースが載っている Summary の `## テスト` に載せる(`web/web_Summary.md:8-12`、`summary-coverage.test.ts`)

## インターフェイス契約

```ts
// web/src/features/theme/viewer-colors.ts(追加。既存 export はすべて残す)
/** 16 進入力欄の最大文字数。normalizeHex が受理する最長の形 "#rrggbb" */
export const HEX_INPUT_MAX_LENGTH = 7;
```

```tsx
// web/src/app/UploadPage.tsx
import { MAX_PROJECT_NAME_LENGTH } from "@shared/types";
//   プロジェクト名の <input> は maxLength={MAX_PROJECT_NAME_LENGTH}

// web/src/features/comments/CommentComposer.tsx
import { MAX_COMMENT_BODY_LENGTH } from "@shared/types";
//   本文の <textarea> は maxLength={MAX_COMMENT_BODY_LENGTH}(rows={4} は変えない)

// web/src/features/theme/ColorPicker.tsx
//   16 進入力の <input> は maxLength={HEX_INPUT_MAX_LENGTH}(viewer-colors.ts から import)
```

```ts
// web/src/features/comments/compose.ts(シグネチャ不変)
import { MAX_COMMENT_STROKES } from "@shared/types";
/** 自分の線を時系列順にし、コメントに含める最新 MAX_COMMENT_STROKES 本だけを返す。 */
export function ownStrokesForComment(strokes: Record<string, Stroke>, userId: string | null): Stroke[];
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `UploadPage.tsx` のソース(新規 `web/tests/upload-page.test.ts` でソース検査) | `maxLength={MAX_PROJECT_NAME_LENGTH}` を含み、`/maxLength=\{\d+\}/` に一致する箇所が無く、`MAX_PROJECT_NAME_LENGTH` を `"@shared/types"` から import している |
| `CommentComposer.tsx` のソース(`comments-styles.test.ts` に追加) | `maxLength={MAX_COMMENT_BODY_LENGTH}` を含み、`/maxLength=\{\d+\}/` に一致しない。`rows={4}` は残る |
| `ownStrokesForComment` に自分の線が `MAX_COMMENT_STROKES + 1` 本 | 返り値は `MAX_COMMENT_STROKES` 本で、最も古い 1 本が落ちる(定数を使って書く。既存の 200 本テストは残す) |
| `ownStrokesForComment` に `MAX_COMMENT_STROKES` 本 | 全部返る |
| `compose.ts` のソース | 数値リテラル `200` を含まない |
| `HEX_INPUT_MAX_LENGTH` | 7。`"#abcdef"` の長さと等しく、`normalizeHex("#abcdef")` は非 null |
| `ColorPicker.tsx` のソース(`viewer-colors.test.ts` か既存のソース検査に追加) | `maxLength={HEX_INPUT_MAX_LENGTH}` を含み、`maxLength={7}` を含まない |
| 既存テスト | すべて通る |

## やらないこと
- 上限の値を変えない
- ラベル文言・CSS・レイアウトを変えない
- `JoinDialog.tsx` は変更しない(既に正しい形)
- `ColorWheel` / `theme.css` の CSS と TS の重複は 138 の担当。ここでは触らない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] app_Summary.md の `## テスト` に upload-page.test.ts が載り、theme_Summary.md の公開インターフェイスに `HEX_INPUT_MAX_LENGTH` が載っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
