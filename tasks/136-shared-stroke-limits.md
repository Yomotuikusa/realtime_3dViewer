---
id: 136
title: shared ストローク点数・コメント添付本数・簡略化比を定数化し、スキーマと送信判定で共有する
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/api.ts, shared/src/stroke.ts, shared/tests/types.test.ts, shared/tests/api.test.ts, shared/tests/stroke.test.ts, shared/shared_Summary.md]
reads: [shared/src/index.ts, web/src/features/comments/compose.ts, docs/task-breakdown.md]
verify: npm run typecheck && npm run test:shared
status: todo
---

## 目的
ストロークの点数 2〜2000 とコメント添付本数 200 が、zod スキーマ・送信判定・web の投稿組み立ての 3〜4 箇所に
別々の数値リテラルとして書かれている。片方を変えても他が追従しないので、`shared/src/types.ts` の定数に一本化する。

## 前提
- `shared/src/types.ts:129-133` に `MAX_ID_LENGTH` 〜 `MAX_COMMENT_BODY_LENGTH` の定数群(コメントなし)、
  `:135-140` に `MIN_FOCAL_LENGTH_MM` 〜 `DEFAULT_FOCAL_LENGTH_MM`(1 行 `/** */` コメント付き)がある
- `StrokeSchema` は `shared/src/types.ts:183-189`。`points: z.array(Vec3Schema).min(2).max(2000)` が `:187`
- `shared/src/api.ts:2-12` が `./types` から `MAX_AUTHOR_NAME_LENGTH` 等を import している。
  `CreateCommentInput.strokes` は `z.array(StrokeSchema).max(200)`(`:68`)
- `shared/src/stroke.ts:3-6` `simplifyTolerance(modelSize)` は `modelSize * 0.001` を返す。
  `:74-77` `isSendableStroke(points)` は `points.length >= 2 && points.length <= 2000`
- `shared/src/index.ts` は `export * from "./types"` / `"./api"` / `"./stroke"` なので、追加した定数は自動的に公開される
- 値を固定している既存テスト: `shared/tests/stroke.test.ts:39`(許容誤差)、`:45-51`(2000 / 2001 の境界)、
  `shared/tests/types.test.ts:78-86`(2 点受理、2001 点拒否)、`shared/tests/api.test.ts:42-45`(201 本拒否)。
  これらは数値のまま残してよい(値は変えないので通る)
- 決定 D15(docs/task-breakdown.md §3): 点数は 2 以上 2000 以下、`simplify` 後に 2 点未満なら送らない
- `web/src/features/comments/compose.ts:34` の `200` は 137 が置き換える。ここでは触らない
- `shared/shared_Summary.md` に `## テスト` 節は無い。`src/types.ts` の説明は `:10`、`src/api.ts` は `:11`、`src/stroke.ts` は `:14`

## インターフェイス契約

```ts
// shared/src/types.ts(追加。既存 export はすべて残す。129-133 の定数群の直後に置く)
/** ストロークの点数の下限(D15)。simplify 後にこれ未満なら送らない */
export const MIN_STROKE_POINTS = 2;
/** ストロークの点数の上限(D15) */
export const MAX_STROKE_POINTS = 2000;
/** 1 件のコメントに添付できるストロークの本数の上限 */
export const MAX_COMMENT_STROKES = 200;

// StrokeSchema.points は z.array(Vec3Schema).min(MIN_STROKE_POINTS).max(MAX_STROKE_POINTS) にする
```

```ts
// shared/src/api.ts
// CreateCommentInput.strokes は z.array(StrokeSchema).max(MAX_COMMENT_STROKES) にする
// (MAX_COMMENT_STROKES は 2-12 行の既存 import 文に足す)
```

```ts
// shared/src/stroke.ts
/** simplify の許容誤差 = モデルの最大辺長 * この比 */
export const SIMPLIFY_TOLERANCE_RATIO = 0.001;

/** モデルの最大辺長から simplify の許容誤差を決める(modelSize * SIMPLIFY_TOLERANCE_RATIO) */
export function simplifyTolerance(modelSize: number): number;

/** 送信可能か: MIN_STROKE_POINTS 点以上 MAX_STROKE_POINTS 点以下 */
export function isSendableStroke(points: Vec3[]): boolean;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MIN_STROKE_POINTS` / `MAX_STROKE_POINTS` / `MAX_COMMENT_STROKES` / `SIMPLIFY_TOLERANCE_RATIO` の値 | 2 / 2000 / 200 / 0.001。`@shared/types`(前 3 つ)と `@shared/stroke` から import できる |
| `StrokeSchema` に `MAX_STROKE_POINTS` 点の `points` | 受理 |
| `StrokeSchema` に `MAX_STROKE_POINTS + 1` 点 | 拒否 |
| `StrokeSchema` に `MIN_STROKE_POINTS - 1` 点 | 拒否 |
| `CreateCommentInput.strokes` が `MAX_COMMENT_STROKES` 本 | 受理 |
| `CreateCommentInput.strokes` が `MAX_COMMENT_STROKES + 1` 本 | 拒否 |
| `isSendableStroke` に `MIN_STROKE_POINTS` 点 / `MAX_STROKE_POINTS` 点 | true |
| `isSendableStroke` に `MIN_STROKE_POINTS - 1` 点 / `MAX_STROKE_POINTS + 1` 点 | false |
| `simplifyTolerance(10)` | `10 * SIMPLIFY_TOLERANCE_RATIO` と等しい |
| 既存テスト(数値リテラルで境界を書いているもの) | そのまま通る。上の行は定数を使う形で**追加**する |

## やらないこと
- 値を変えない(2 / 2000 / 200 / 0.001 のまま)
- `shared/src/protocol.ts` の `MAX_NAME_LENGTH` と `types.ts` の `MAX_AUTHOR_NAME_LENGTH` の統合はしない
- web / server は変更しない(`compose.ts` の置き換えは 137)
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存テストもすべて通る
- [ ] shared_Summary.md の `src/types.ts` / `src/api.ts` / `src/stroke.ts` の説明に新しい定数が載っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
