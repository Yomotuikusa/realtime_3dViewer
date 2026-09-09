---
id: 016
title: web Annotation ストアと受信した線の描画
feature: web
depends_on: [015]
owns: [web/src/store/annotation.ts, web/src/features/annotation/StrokeLines.tsx, web/src/features/annotation/RoomStrokes.tsx, web/src/app/realtime-dispatch.ts, web/src/app/ReviewPage.tsx, web/tests/store-annotation.test.ts, web/tests/realtime-dispatch.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/protocol.ts, server/server_Summary.md, web/src/store/session.ts, web/src/app/useRealtime.ts, web/src/features/viewer/ViewerCanvas.tsx]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
MVP #4(Annotation)の受信側。ルーム内の線(全員分)を保持するストアを作り、
`welcome` / `stroke:*` を反映して drei `Line` で描画する(§16.3)。
描く側(017)とコメント再現(020)が使う state もここで全部定義する(D28)。

## 前提
- 013 の `dispatchServerMessage`(D23)に **`welcome.strokes` と `stroke:add` / `stroke:remove` /
  `stroke:clear` の case を足す**。既存 case(welcome の session / presence 反映、error、user:*、camera)
  の意味は変えない
- サーバ規則(§15, D20): `stroke:*` は**送信者を含む全員**に配信される。したがって自分が送った線も
  サーバ応答で `addStroke` され、ローカルの draft と置き換わる。ここでは受信だけを扱う
- `Stroke` `Vec3` は `@shared/types`。drei 10.7 の `Line` は
  `import { Line } from "@react-three/drei"`、`points` に `Vec3[]` をそのまま渡せる
- `RoomStrokes` は `ViewerCanvas` の children として Canvas 内に置く(012 の差し込み口)
- 決定事項 **D7 / D8 / D28 / D30**(docs/task-breakdown.md §3)
- R3F コンポーネントの描画テストは書かない。テスト対象は annotation ストアと `dispatchServerMessage`
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/store/annotation.ts
import type { Stroke, Vec3 } from "@shared/types";

export type AnnotationMode = "orbit" | "pen" | "comment";   // D8。排他
/** 先頭が既定色。6 色の "#rrggbb"(小文字) */
export const STROKE_COLORS: readonly string[];
export const DEFAULT_STROKE_COLOR: string;                   // = STROKE_COLORS[0]

export interface AnnotationStoreState {
  strokes: Record<string, Stroke>;   // ルームのライブな線(全員分)。key は stroke.id
  mode: AnnotationMode;              // 初期値 "orbit"
  color: string;                     // 初期値 DEFAULT_STROKE_COLOR
  drafting: Vec3[] | null;           // 描画中の点列(017 が積む)。初期値 null
  replayStrokes: Stroke[];           // コメント再現用(D7)。WS には流さない。初期値 []

  /** welcome 受信時の全置換 */
  applyWelcome(strokes: Stroke[]): void;
  /** 同 id は上書き */
  addStroke(stroke: Stroke): void;
  /** 未知の id なら何もしない */
  removeStroke(strokeId: string): void;
  /** その userId の線をすべて消す */
  clearByUser(userId: string): void;
  /** mode を変える。変更時は drafting を null に戻す */
  setMode(mode: AnnotationMode): void;
  /** /^#[0-9a-f]{6}$/i に合わなければ無視。保持は小文字に正規化 */
  setColor(color: string): void;
  beginDraft(point: Vec3): void;              // drafting = [point]
  appendDraftPoint(point: Vec3): void;        // drafting が null なら無視
  /** drafting を返して null に戻す。null なら [] */
  endDraft(): Vec3[];
  setReplayStrokes(strokes: Stroke[]): void;
  reset(): void;
}
export const useAnnotationStore: /* zustand の UseBoundStore<StoreApi<AnnotationStoreState>> */;

/** 表示順(createdAt 昇順、同値は id 昇順)に並べた配列。純粋関数 */
export function orderedStrokes(strokes: Record<string, Stroke>): Stroke[];
```

```tsx
// web/src/features/annotation/StrokeLines.tsx
import type { Stroke } from "@shared/types";
/** 受け取った線をそのまま drei Line で描く純粋表示(D30)。
 *  1 本 1 Line、color は stroke.color、lineWidth 3(ピクセル固定)、depthTest true。
 *  opacity 省略時 1(1 未満なら transparent) */
export function StrokeLines(props: { strokes: Stroke[]; opacity?: number }): React.ReactElement;

// web/src/features/annotation/RoomStrokes.tsx
/** ストアの strokes(orderedStrokes)を StrokeLines へ渡す。加えて drafting が 2 点以上なら
 *  現在の color で 1 本余分に描く(描画中のプレビュー)。Canvas 内に置く */
export function RoomStrokes(): React.ReactElement;
```

`realtime-dispatch.ts` への追加(013 / 014 の表に足す):

| msg.type | 反映先 |
| --- | --- |
| `welcome` | 既存の反映に加えて `annotation.applyWelcome(msg.strokes)` |
| `stroke:add` | `annotation.addStroke(msg.stroke)` |
| `stroke:remove` | `annotation.removeStroke(msg.strokeId)` |
| `stroke:clear` | `annotation.clearByUser(msg.userId)` |

`ReviewPage` への追加分: `<ViewerCanvas ...>` の children に `<RoomStrokes />` を足す
(`<RemoteCameras />` と並べる)。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| ストア初期値 | `strokes:{}`、`mode:"orbit"`、`color === DEFAULT_STROKE_COLOR`、`drafting:null`、`replayStrokes:[]` |
| `STROKE_COLORS` | 長さ 6、すべて `/^#[0-9a-f]{6}$/` に一致、重複なし |
| `applyWelcome([s1, s2])` | `strokes` が 2 件。以前の内容は消える |
| `addStroke(s1)` を 2 回(2 回目は color 違い) | 1 件のまま、後勝ち |
| `removeStroke("s1")` / `removeStroke("nope")` | 消える / 何も起きず throw しない |
| `clearByUser("u1")`(u1 の線 2 本、u2 の線 1 本) | u2 の 1 本だけ残る |
| `clearByUser("nope")` | 変わらない |
| `setMode("pen")` | `mode === "pen"` |
| `beginDraft(p)` → `setMode("comment")` | `drafting === null` |
| `setColor("#00FF00")` | `color === "#00ff00"` |
| `setColor("red")` / `setColor("#12345")` | 変わらない |
| `beginDraft(p1)` → `appendDraftPoint(p2)` | `drafting` が `[p1, p2]` |
| `appendDraftPoint(p)`(drafting null) | `drafting` は null のまま |
| `endDraft()`(2 点あり) | 2 点の配列を返し、`drafting === null` |
| `endDraft()`(drafting null) | `[]` |
| `setReplayStrokes([s1])` → `setReplayStrokes([])` | `[s1]` → `[]`。`strokes` は影響を受けない |
| `orderedStrokes({b: createdAt 2, a: createdAt 1, c: createdAt 1})` | `[a(id"a"), c, b]`(createdAt 昇順、同値は id 昇順) |
| `reset()` | 初期値に戻る |
| `dispatchServerMessage(welcome)`(strokes 2 本) | `annotation.strokes` が 2 件(session / presence の反映も従来どおり) |
| `dispatchServerMessage({type:"stroke:add", stroke})` | 1 件増える |
| `dispatchServerMessage({type:"stroke:remove", strokeId})` | 消える |
| `dispatchServerMessage({type:"stroke:clear", userId:"u1"})` | u1 の線だけ消える |
| 013 / 014 で通した dispatch のテスト | 引き続き通る |

## やらないこと
- ポインタ入力・レイキャスト・`stroke:add` の送信・ツールバー(017)
- コメント再現で `replayStrokes` を積む側と `ReplayStrokes` の描画(020)。ここでは state だけ
- `CameraRig` / `ViewerCanvas` / `ModelMesh` の変更
- R3F コンポーネントの描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(annotation ストアの state / action、StrokeLines と RoomStrokes の役割分担)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
