---
id: 034
title: web メッシュに埋もれた線の透過表示(オーバーレイ)
feature: web
depends_on: []
owns: [web/src/features/annotation/stroke-overlay.ts, web/src/features/annotation/StrokeLines.tsx, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/viewer/hud-labels.ts, web/src/store/annotation.ts, web/tests/stroke-overlay.test.ts, web/tests/store-annotation.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [web/src/features/annotation/RoomStrokes.tsx, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/annotation/stroke-build.ts, web/src/features/comments/ReplayStrokes.tsx, web/src/features/comments/replay.ts, web/src/features/viewer/ViewerHud.tsx, web/src/store/session.ts, web/src/app/review-stores.ts, shared/shared_Summary.md, shared/src/types.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
線がメッシュに埋もれると完全に隠れてしまい、モデルの内側を指し示す描画が伝わらない。
1本のストロークを「通常線」と「深度テストを無効にした細い半透明線」の2本で描き、
埋もれた部分だけが薄く透けて見えるようにする。ON/OFF はペン道具から切り替える。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `StrokeLines` は受け取った `Stroke[]` を drei の `Line` で1本ずつ描くだけの表示コンポーネントで、
  props は `{ strokes: Stroke[]; opacity?: number }`(`opacity` の既定は 1)。現在は
  `points` / `color` / `lineWidth={3}` / `depthTest` / `opacity` / `transparent={opacity < 1}` を渡している。
  web/src/features/annotation/StrokeLines.tsx:5-20
- drei の `LineProps` は `Omit<ThreeElement<typeof Line2>>` と `Omit<ThreeElement<typeof LineMaterial>>` を
  含むため、`depthTest` / `depthWrite` / `transparent` / `opacity` / `renderOrder` をそのまま渡せる。
  `depthWrite` を渡さない場合の `LineMaterial` の既定値は `true`。
- `StrokeLines` の呼び出しは2箇所しかない。
  - `RoomStrokes`: ライブ線を `orderedStrokes` の順で渡し、2点以上の draft を現在色のプレビュー線として
    末尾に足す。`opacity` は渡さないので 1。web/src/features/annotation/RoomStrokes.tsx:8-25
  - `ReplayStrokes`: コメント再現線に `opacity={REPLAY_OPACITY}` を渡す。
    web/src/features/comments/ReplayStrokes.tsx:7-10
- `REPLAY_OPACITY` は `0.6`。web/src/features/comments/replay.ts:7
- `AnnotationToolbar` は `ViewerHud` から `mode === "pen"` のときだけ描画される。
  中身は色ボタン群(`.annotation-colors`)、`UNDO_LABEL` のボタン、`CLEAR_LABEL` のボタンで、
  後者2つは `className="btn btn--quiet"` を使う。
  web/src/features/viewer/ViewerHud.tsx:48, web/src/features/annotation/AnnotationToolbar.tsx:20-59
- annotation ストアの `reset()` は `initialState` を撒き直す。テスト専用ではなく、
  `review-stores.ts` からレビュー画面のアンマウント時にも呼ばれる。
  web/src/store/annotation.ts:36-42, web/src/store/annotation.ts:119-121, web/src/app/review-stores.ts
- three は不透明オブジェクトを先に、半透明オブジェクトを後に描く。`renderOrder` はそのグループ内の
  並び替えでしかない。したがって通常線が不透明(`opacity` が 1)のとき、`transparent` な透過線は
  必ず通常線より後に描かれる。
- web のテストは jsdom 環境で、`@testing-library` は導入されていない。React コンポーネントの
  レンダリングテストは書けないため、検証対象は純粋関数とストアに限られる。web/vitest.config.ts

## インターフェイス契約

### 新規 web/src/features/annotation/stroke-overlay.ts

```ts
import type { Stroke, Vec3 } from "@shared/types";

/** 通常線の太さ。既存の StrokeLines と同じ値。 */
export const BASE_LINE_WIDTH = 3;
/** 透過線の太さ。通常線より細くして、見えている部分での重なりを目立たせない。 */
export const OVERLAY_LINE_WIDTH = 1.5;
/** 透過線の不透明度は、通常線の不透明度にこの比を掛けた値にする。 */
export const OVERLAY_OPACITY_RATIO = 0.35;

/** drei の Line に渡す値。key は React の key に使い、残りはそのまま props に展開する。 */
export interface StrokeLineSpec {
  key: string;
  points: Vec3[];
  color: string;
  lineWidth: number;
  depthTest: boolean;
  depthWrite: boolean;
  transparent: boolean;
  opacity: number;
}

/**
 * 1本の Stroke を描くための Line の spec を、描画順(通常線 → 透過線)に返す。
 * overlay が true なら2要素、false なら通常線だけの1要素。
 * stroke.points は複製せず同じ配列を載せてよいが、破壊的に変更してはならない。
 */
export function strokeLineSpecs(
  stroke: Stroke,
  options: { opacity: number; overlay: boolean },
): StrokeLineSpec[];
```

### 変更 web/src/store/annotation.ts

`AnnotationStoreState` に次を足す。他のメンバーのシグネチャは変更しない。

```ts
  /** メッシュに埋もれた線を透過表示するか。初期値 true */
  overlay: boolean;
  /** 同値なら state を更新しない */
  setOverlay(overlay: boolean): void;
```

`initialState` に `overlay: true` を加える(`reset()` が初期値へ戻すのに必要)。

### 変更 web/src/features/annotation/StrokeLines.tsx

props のシグネチャは変更しない。`overlay` は props ではなく annotation ストアから購読する。

```tsx
export function StrokeLines({ strokes, opacity = 1 }: { strokes: Stroke[]; opacity?: number }): ReactElement;
```

### 変更 web/src/features/viewer/hud-labels.ts

```ts
export const OVERLAY_LABEL = "透過表示";
```

既存のエクスポートは変更しない。

## 振る舞い

### strokeLineSpecs

`stroke` は `{ id: "s1", userId: "u1", color: "#ff0000", points: [[0,0,0],[1,1,1]], createdAt: 1 }` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ opacity: 1, overlay: true }` | 2要素。`[0]` が通常線、`[1]` が透過線 |
| `{ opacity: 1, overlay: false }` | 1要素。通常線だけ |
| 通常線の `key` | `"s1"`(= `stroke.id`) |
| 通常線の `color` / `lineWidth` / `depthTest` / `depthWrite` | `"#ff0000"` / `3` / `true` / `true` |
| 通常線の `opacity` | `options.opacity` と同値 |
| `opacity: 1` の通常線の `transparent` | `false` |
| `opacity: 0.6` の通常線の `transparent` | `true` |
| 透過線の `key` | `"s1:overlay"` |
| 透過線の `color` / `lineWidth` / `depthTest` / `depthWrite` / `transparent` | `"#ff0000"` / `1.5` / `false` / `false` / `true` |
| `opacity: 1` の透過線の `opacity` | `0.35` |
| `opacity: 0.6` の透過線の `opacity` | `0.21`(= `0.6 * 0.35`。浮動小数のため `toBeCloseTo` で比較する) |
| どの spec の `points` も | `stroke.points` と内容が等しい |
| 呼び出しの前後で `stroke.points` | 変化しない(破壊的に変更しない) |
| 2要素の `key` | 互いに重複しない |

### annotation ストアの overlay

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `overlay` が `true` |
| `setOverlay(false)` | `overlay` が `false` |
| `setOverlay(true)` を `true` の状態で呼ぶ | `overlay` は `true` のまま。state オブジェクトは同一のまま(更新しない) |
| `setOverlay(false)` のあと `reset()` | `overlay` が `true` に戻る |
| `setOverlay` は他のメンバーに影響しない | `strokes` / `mode` / `color` / `drafting` / `replayStrokes` が変わらない |

### hud-labels

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `OVERLAY_LABEL` | `"透過表示"` |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| 既定 | 透過表示 ON。メッシュに埋もれた線が薄い細線として透けて見える |
| ペン道具の「透過表示」ボタンを押す | OFF になり、埋もれた線が従来どおり完全に隠れる |
| そのボタンの `aria-pressed` | `overlay` の値と一致する |
| ライブ線 / 描画中の draft / コメント再現線 | すべて同じ `overlay` 設定に従う(`StrokeLines` が一箇所でストアを読むため) |
| コメント再現線(`opacity` 0.6)の透過線 | `opacity` は `0.21` |
| 透過表示 OFF のときの通常線 | 034 の前の描画と完全に同じ props になる |
| レビュー画面を離れて戻る | `reset()` により透過表示は ON に戻る |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **通常線の props は値を変えない。** 既存の `lineWidth={3}` / `depthTest`(有効) /
  `transparent={opacity < 1}` / `opacity` をそのまま維持し、`renderOrder` は指定しない。
  `depthWrite` は `LineMaterial` の既定値と同じ `true` を明示的に渡す(spec の形を2本で揃えるため)。
  変えるのは「透過線を1本足す」ことだけである
- 透過線は通常線より後に描かれるため、モデルに隠れていない部分では通常線の上に同色の細い半透明線が
  重なる。中心がわずかに濃くなるだけなので**これを許容する**。回避のために通常線を
  `transparent` にしたり `renderOrder` を振ったりしない
- `StrokeLines` は `useAnnotationStore((state) => state.overlay)` を購読する。呼び出し側3箇所へ
  props を配らないのは、透過表示が全ストロークへ一律に効く表示設定だからである。
  `StrokeLines` の props シグネチャは変えない
- `StrokeLines` の描画は `strokes.flatMap((stroke) => strokeLineSpecs(...).map(({ key, ...props }) =>
  <Line key={key} {...props} />))` の形にする。spec の組み立てを `StrokeLines` の中に書かない
  (jsdom ではコンポーネントを検証できないため、判定できる場所へ寄せる)
- 「透過表示」ボタンは `AnnotationToolbar` の中で `CLEAR_LABEL` のボタンより後(右端)に置き、
  `className="btn btn--quiet"` / `type="button"` / `aria-pressed={overlay}` とする。
  他のボタンと違い、接続状態(`connection`)では無効化しない。表示設定であって送信を伴わないため
- `annotation.css` と `viewer.css` は変更しない。`.annotation-tools` は `inline-flex` + `gap` なので
  ボタンを足すだけで並ぶ

## やらないこと
- 通常線の太さ・色・不透明度・深度テストの変更はしない
- 透過線の太さや不透明度をユーザーが調整するUIは作らない。定数で固定する
- `renderOrder` による描画順の制御はしない
- 破線(`dashed`)や色の変更で埋もれた部分を区別することはしない。太さと不透明度だけで区別する
- モデル側(`ModelMesh`)を半透明にする・輪郭線を出すといったモデルの表示変更はしない
- 透過表示の状態を WebSocket で他の参加者へ送らない。各自のローカル表示設定である
- 透過表示の状態を localStorage へ保存しない
- `RoomStrokes.tsx` / `ReplayStrokes.tsx` / `ViewerHud.tsx` は変更しない
- `shared/` と `server/` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`stroke-overlay.test.ts` を新規に追加し、`store-annotation.test.ts` に `overlay` の系列を、
      `hud-labels.test.ts` に `OVERLAY_LABEL` を足す)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`stroke-overlay.ts` の追加、`StrokeLines` がストアを購読するようになったこと、
      `overlay` / `setOverlay` / `OVERLAY_LABEL` を含む)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
