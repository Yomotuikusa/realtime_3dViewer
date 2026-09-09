---
id: 001
title: shared ドメイン型と zod スキーマ
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/index.ts, shared/tests/types.test.ts, shared/shared_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, tsconfig.base.json, shared/tsconfig.json, shared/vitest.config.ts]
verify: npm run test:shared
status: done
---

## 目的
フロントとサーバが共有するドメイン型(§13.1)と、その実行時検証(zod)を 1 箇所に置く。
以降の全タスクがここを import する。

## 前提
- 骨組みは整備済み。`npm run test:shared` は `vitest run --config shared/vitest.config.ts` を
  workspace 直下で実行する(package.json:scripts)。テストは `shared/tests/**/*.test.ts`
- zod は **4.5.4**。`import { z } from "zod"`。zod 4 では `z.number()` が NaN / Infinity を
  拒否するが、テストで明示的に確認すること
- `shared/src/index.ts` は現在 `export const SHARED_SCAFFOLD = true;` だけを持つ。
  server / web がこれを import しているため**この export は残す**(docs/task-breakdown.md §0)
- 依存の追加・package.json の変更は禁止(ネットワーク遮断)
- 決定事項 D1 / D15(docs/task-breakdown.md §3): スキーマは interface と同じファイルに置き、
  `satisfies z.ZodType<T>` で型整合を強制する

## インターフェイス契約

```ts
// shared/src/types.ts
import { z } from "zod";

export type Vec3 = [number, number, number];

/** OrbitControls と 1:1。fov は固定(50)なので持たない */
export interface CameraState { position: Vec3; target: Vec3 }

export interface Stroke {
  id: string;          // クライアント生成 UUID
  userId: string;
  color: string;       // "#rrggbb"
  points: Vec3[];      // ワールド座標。モデル表面のヒット点列
  createdAt: number;   // epoch ms
}

export type CommentStatus = "open" | "resolved";

export interface Comment {
  id: string;
  projectId: string;
  versionId: string;
  authorName: string;
  body: string;
  anchor: Vec3;        // ピン位置
  camera: CameraState; // 投稿時の視点
  strokes: Stroke[];   // 投稿時の自分の線のスナップショット
  status: CommentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ModelVersion {
  id: string; projectId: string; number: number; fileName: string; byteSize: number; createdAt: number;
}

export interface Project { id: string; name: string; createdAt: number; latestVersion: ModelVersion }

export interface PresenceUser { id: string; name: string; color: string; camera: CameraState | null }

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]) satisfies z.ZodType<Vec3>;
export const CameraStateSchema = /* ... */ satisfies z.ZodType<CameraState>;
export const StrokeSchema = /* ... */ satisfies z.ZodType<Stroke>;
export const CommentStatusSchema = z.enum(["open", "resolved"]) satisfies z.ZodType<CommentStatus>;
export const CommentSchema = /* ... */ satisfies z.ZodType<Comment>;
export const ModelVersionSchema = /* ... */ satisfies z.ZodType<ModelVersion>;
export const ProjectSchema = /* ... */ satisfies z.ZodType<Project>;
export const PresenceUserSchema = /* ... */ satisfies z.ZodType<PresenceUser>;

/** "#rrggbb"(小文字・大文字どちらも可) */
export const ColorSchema: z.ZodType<string>;
```

```ts
// shared/src/index.ts
export const SHARED_SCAFFOLD = true;   // 022 まで残す
export * from "./types";
```

## 振る舞い
`safeParse` の受理 / 拒否をテストする。「拒否」は `success === false`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `Vec3Schema` に `[0, 1.5, -2]` | 受理 |
| `Vec3Schema` に長さ 2 / 4 の配列、`["1",2,3]` | 拒否 |
| `Vec3Schema` に `[NaN,0,0]` `[Infinity,0,0]` | 拒否 |
| `ColorSchema` に `"#ff8800"` `"#FF8800"` | 受理 |
| `ColorSchema` に `"ff8800"` `"#fff"` `"#ff88000"` `"red"` | 拒否 |
| `CameraStateSchema` に position/target 両方 Vec3 | 受理。余分なキーがあっても受理(strip) |
| `StrokeSchema` に points が 2 点 | 受理 |
| `StrokeSchema` に points が 1 点 / 0 点 | 拒否 |
| `StrokeSchema` に points が 2001 点 | 拒否(上限 2000) |
| `StrokeSchema` の id / userId が空文字 | 拒否(`min(1)`) |
| `StrokeSchema` の createdAt が負 / 小数 | 拒否(`int().nonnegative()`) |
| `CommentStatusSchema` に `"open"` `"resolved"` | 受理。`"closed"` は拒否 |
| `CommentSchema` に strokes が `[]` | 受理(スナップショット無しのコメントは正当) |
| `CommentSchema` に status 欠落 | 拒否 |
| `ModelVersionSchema` の number が 0 / 小数 | 拒否(`int().positive()`)。byteSize は `int().nonnegative()` |
| `ProjectSchema` に latestVersion 欠落 | 拒否 |
| `PresenceUserSchema` に camera: null | 受理 |
| `PresenceUserSchema` に camera 欠落 | 拒否(`nullable()` であって `optional()` ではない) |
| 各スキーマの文字列 id 系 | すべて `z.string().min(1)`。name / authorName / body / fileName も `min(1)`(上限は api.ts 側で課すのでここでは課さない) |

## やらないこと
- REST 入出力型(`CreateCommentInput` 等)・WS メッセージ型は 002。ここでは書かない
- camera / stroke の純粋関数は 003
- `SHARED_SCAFFOLD` の削除(022)
- 依存の追加・package.json / tsconfig / vitest 設定の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている(`satisfies z.ZodType<T>` が全スキーマに付いている)
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md が更新されている(目的 / ファイル一覧と役割 / 公開インターフェイス / 他機能との関係)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run test:shared` が成功する
