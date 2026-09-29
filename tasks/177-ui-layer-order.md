---
id: 177
title: UI の重なり順を単一のレイヤー表に一元化する
feature: app
depends_on: []
owns: [web/src/styles/tokens.css, web/src/features/layout/layers.ts, web/src/features/layout/layout.css, web/src/features/layout/layout_Summary.md, web/src/app/review.css, web/src/app/app_Summary.md, web/src/features/objects/objects.css, web/src/features/comments/CommentCallout.tsx, web/src/features/comments/CommentPins.tsx, web/src/features/presence/RemoteCameras.tsx, web/tests/review-styles.test.ts, web/tests/comment-callout.test.ts, web/tests/ui-layers.test.ts]
reads: [web/src/app/ReviewPage.tsx, web/src/app/SettingsDialog.tsx, web/src/app/JoinDialog.tsx, web/src/app/review-dock.css, web/src/features/objects/DeleteObjectDialog.tsx, web/src/features/viewer/viewer.css, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/comments/comments.css, web/src/features/presence/presence.css, web/src/features/layout/ResizeHandle.tsx, web/tests/objects-delete.test.ts, web/tests/layout-styles.test.ts, web/tests/viewer-styles.test.ts, web/src/features/comments/comments_Summary.md, web/src/features/presence/presence_Summary.md]
verify: npm run typecheck && npm run test
status: done
---

## 目的
3D 内の drei `<Html>` が既定で z-index 16777271 前後を使うため、設定ダイアログや削除確認の上に
コメントピン・吹き出しが乗ってしまう。DOM 側も z-index が 1〜3 の狭い値しか持たず、段の設計が
存在しない。重なり順を 1 枚の表として `tokens.css` に定義し、全レイヤーをそこへ揃える。

## 前提
(すべて現状のコードで確認済みの事実。推測ではない)

### 現在の z-index と、それが置かれている場所

| 要素 | 現在の値 | DOM 上の位置 |
| --- | --- | --- |
| コメントピン / リモートカメラ名札 | drei 既定 `[16777271, 0]` の距離補間 | `.review-stage` 内の canvas ラッパ |
| コメント吹き出し `CommentCallout` | `zIndexRange={[16777272, 16777272]}` 固定 | 同上 |
| `.review-hud` | 1 (`review.css:132`) | `.review-stage` 直下 (`ReviewPage.tsx:205`) |
| `.resize-handle` | 1 (`layout.css:3`) | `.review-body` 直下 |
| `.review-backdrop` | 2 (`review.css:147`) | `.review-viewer` 直下 (`ReviewPage.tsx:249-250`) |
| `.review-stage__error` | 2 (`review.css:220`) | `.review-stage` 直下 (`ReviewPage.tsx:225`) |
| `.objects-delete__backdrop` | 3 (`objects.css:84`) | 右パネル内、`position: fixed` |
| `.review-page__alert` | 指定なし (`review.css:70`) | `.review-page` 直下 (`ReviewPage.tsx:169`) |

### 壊れている理由
- `.review-stage` は `position: relative` を持つが `z-index` が無く、stacking context を作っていない
  (`review.css:126-130`)。`.review-viewer` も同様。そのため canvas ラッパ内の `<Html>` が付ける
  1600 万台の z-index が、`.review-viewer` 直下の `.review-backdrop`(2) と直接比較され、必ず勝つ
- `DeleteObjectDialog` は `className="review-backdrop objects-delete__backdrop"` の併用で、
  `.review-backdrop` の `inset: 0` を使いつつ `position` だけ `fixed` に上書きしている
  (`DeleteObjectDialog.tsx:28`)

### drei `<Html>` の zIndexRange の仕様
`node_modules/@react-three/drei/web/Html.js` の `objectZIndex(el, camera, zIndexRange)`(53-63 行) は
`A = (range[1] - range[0]) / (far - near)`、`B = range[1] - A * far`、`z = round(A * dist + B)` を返す。
`dist === near` のとき `range[0]`、`dist === far` のとき `range[1]` になる。
**つまり `range[0]` がカメラに近い側(大きい値)、`range[1]` が遠い側**である。既定値は
`zIndexRange = [16777271, 0]`(99 行)。`occlude` を使っていないので `zRange` は渡した値がそのまま使われる
(244-247 行)。本プロジェクトは `occlude` を使っていない。

### 既存テストが文字列で見ている箇所(本タスクで書き換える)
- `web/tests/review-styles.test.ts:31-38` が `.review-stage__error` と `.review-hud` の
  `z-index:\s*(\d+)` を正規表現で拾って大小比較している。`var(--...)` にすると `undefined` になり落ちる
- `web/tests/comment-callout.test.ts:19` が
  `"<Html position={comment.anchor} zIndexRange={[16777272, 16777272]}>"` を完全一致で検査している

### 変更しないが影響範囲の確認に要る事実
- `web/tests/objects-delete.test.ts:65` は `.objects-delete__backdrop` の `position: fixed` だけを
  見ており、`z-index` は見ていない。**このテストは変更しない**
- `web/tests/layout-styles.test.ts` は `.resize-handle` の `data-axis` 系セレクタだけを見ており、
  `z-index` は見ていない。**このテストは変更しない**
- `web/tests/viewer-styles.test.ts:133-142` は `.hud-menu__panel` の `top/left/right/border-top/background`
  だけを見ており、`z-index` は見ていない。**このテストは変更しない**
- `web/src/features/presence/` に `RemoteCameras` の `<Html>` を検査するテストは存在しない

## インターフェイス契約

### 1. `web/src/styles/tokens.css` — 段の定義

`:root` の末尾(現在の `--follow-frame-width: 4px;` = 52 行目の直後)に、コメント付きでこの 7 行を足す。
**値は下表のとおり厳密に。`:root[data-theme="dark"]` には一切足さない**(重なり順はテーマに依らない)。

```css
  /* 重なり順の段。数値が大きいほど手前。出典はここ 1 か所で、
     drei の zIndexRange に渡す数値だけ features/layout/layers.ts が同じ値を持つ */
  --z-canvas-overlay: 1000;
  --z-canvas-callout: 1001;
  --z-hud: 1100;
  --z-resize-handle: 1200;
  --z-stage-error: 1300;
  --z-modal: 1400;
  --z-alert: 1500;
```

| トークン | 値 | 対象 |
| --- | --- | --- |
| `--z-canvas-overlay` | 1000 | 3D 内 `<Html>`(コメントピン・リモートカメラ名札)の**近距離側**。遠距離側は 0 |
| `--z-canvas-callout` | 1001 | コメント吹き出し。距離補間せず固定 |
| `--z-hud` | 1100 | `.review-hud` |
| `--z-resize-handle` | 1200 | `.resize-handle` |
| `--z-stage-error` | 1300 | `.review-stage__error` |
| `--z-modal` | 1400 | `.review-backdrop`(入室・設定・バージョン削除確認) |
| `--z-alert` | 1500 | `.review-page__alert` |

### 2. `web/src/features/layout/layers.ts` — 新規

CSS 変数は drei の数値 prop に渡せないため、canvas オーバーレイの 2 段だけを TS 定数として持つ。
値の出典は `tokens.css` で、一致は `web/tests/ui-layers.test.ts` が機械検証する。

```ts
/**
 * 3D 内 Html の重なり順。値の出典は styles/tokens.css の --z-canvas-* で、
 * 一致は tests/ui-layers.test.ts が検査する。
 * drei の zIndexRange は [カメラに近い側, 遠い側] の順。
 */

/** コメントピン・リモートカメラ名札。カメラに近いものほど手前に出る。 */
export const CANVAS_OVERLAY_Z_RANGE: [number, number] = [1000, 0];

/** コメント吹き出し。距離に依らず固定し、常にピンより 1 段手前に置く。 */
export const CANVAS_CALLOUT_Z_RANGE: [number, number] = [1001, 1001];
```

### 3. `web/src/app/review.css`

```css
/* 126 行目のルール。canvas ラッパ内 Html の巨大な z-index を
   ステージ内へ閉じ込め、ダイアログやアラートの上へ抜けないようにする */
.review-stage {
  position: relative;
  isolation: isolate;
  min-height: 0;
  overflow: hidden;
}

.review-hud        { z-index: var(--z-hud); }         /* 132 行目のルール内。1 を置換 */
.review-backdrop   { z-index: var(--z-modal); }       /* 147 行目のルール内。2 を置換 */
.review-stage__error { z-index: var(--z-stage-error); } /* 220 行目のルール内。2 を置換 */

/* 70 行目のルール。static のままでは z-index が効かないので position を足す */
.review-page__alert {
  position: relative;
  z-index: var(--z-alert);
  margin: var(--space-2) var(--space-4) 0;
}
```

上は該当プロパティだけを示したもので、**各ルールの他のプロパティは現状のまま残す**。
`isolation: isolate` は `.review-stage` にだけ付ける(`.review-viewer` や `.review-body` には付けない)。

### 4. `web/src/features/layout/layout.css`

`.resize-handle`(1 行目)の `z-index: 1` を `z-index: var(--z-resize-handle);` に置換する。他は変えない。

### 5. `web/src/features/objects/objects.css`

`.objects-delete__backdrop`(82 行目)から `z-index: 3;` の行を**削除**し、`position: fixed;` だけを残す。
併用している `.review-backdrop` が `--z-modal` を持つので、このルールに z-index は要らない。

```css
.objects-delete__backdrop {
  position: fixed;
}
```

### 6. `<Html>` 3 箇所

```tsx
// web/src/features/comments/CommentCallout.tsx
import { CANVAS_CALLOUT_Z_RANGE } from "../layout/layers";
<Html position={comment.anchor} zIndexRange={CANVAS_CALLOUT_Z_RANGE}>

// web/src/features/comments/CommentPins.tsx
import { CANVAS_OVERLAY_Z_RANGE } from "../layout/layers";
<Html position={anchor} center zIndexRange={CANVAS_OVERLAY_Z_RANGE}>

// web/src/features/presence/RemoteCameras.tsx
import { CANVAS_OVERLAY_Z_RANGE } from "../layout/layers";
<Html position={[0, tagOffset, 0]} center zIndexRange={CANVAS_OVERLAY_Z_RANGE}>
```

`center` と `position` の指定は現状のまま変えない。`transform` や `occlude` は追加しない。

### 7. `web/tests/ui-layers.test.ts` — 新規

`review-styles.test.ts` と同じ `ruleBody(text, selector)` ヘルパーを持ち、次を検査する
(ヘルパーは既存ファイルから写す。テスト間で共有モジュールを作らない現在の方針に合わせる)。

1. `tokens.css` の `:root { ... }` ブロックに 7 トークンが上表の値で定義されている
2. 7 トークンの値が上表の順に**厳密な単調増加**である
3. `:root[data-theme="dark"]` ブロックに `--z-` で始まる宣言が 1 つも無い
4. `layers.ts` の `CANVAS_OVERLAY_Z_RANGE` が `[--z-canvas-overlay の値, 0]`、
   `CANVAS_CALLOUT_Z_RANGE` が `[--z-canvas-callout の値, --z-canvas-callout の値]` と一致する
5. `review.css` の `.review-stage` に `isolation: isolate` がある
6. `review.css` の `.review-hud` / `.review-backdrop` / `.review-stage__error` / `.review-page__alert` が
   それぞれ `var(--z-hud)` / `var(--z-modal)` / `var(--z-stage-error)` / `var(--z-alert)` を参照し、
   `.review-page__alert` が `position: relative` を持つ
7. `layout.css` の `.resize-handle` が `var(--z-resize-handle)` を参照する
8. `objects.css` の `.objects-delete__backdrop` に `z-index` が無く、`position: fixed` は残っている
9. `review.css` / `layout.css` / `objects.css` に `z-index: <生の数値>` が 1 つも残っていない
   (`z-index:\s*\d` にマッチしない)
10. `CommentPins.tsx` / `CommentCallout.tsx` / `RemoteCameras.tsx` が `layers.ts` から import した
    定数を `zIndexRange` に渡しており、`zIndexRange={[` という生の配列リテラルを書いていない

jsdom は z-index を解決しないので、重なり順そのものは描画テストでは検証できない。
トークンの単調性(検査 2)と参照の一致(検査 4〜8)で担保する。

### 8. 既存テストの書き換え

`web/tests/review-styles.test.ts` の `"places the model error above the HUD"`(31-38 行)は、
数値の大小比較をやめてトークン参照の検査に置き換える。大小関係は `ui-layers.test.ts` の検査 2 が持つ。

```ts
  it("places the model error above the HUD", () => {
    expect(ruleBody(reviewCssText, ".review-stage__error")).toContain("z-index: var(--z-stage-error)");
    expect(ruleBody(reviewCssText, ".review-hud")).toContain("z-index: var(--z-hud)");
  });
```

`web/tests/comment-callout.test.ts:19` の完全一致文字列を、新しい呼び出しと import の検査に差し替える。
同ファイルの他の検査(`stopPropagation` が 2 回、`style={{` を含まない 等)はそのまま通ること。

## 振る舞い

期待する重なり順は、下から順に
**ピン・名札 → 吹き出し → HUD → リサイズハンドル → ステージのエラーカード → モーダル → アラート帯**。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 設定ダイアログを開いた状態でコメントを選択している | ダイアログと暗転背景がピン・吹き出しより手前 |
| バージョン削除の確認ダイアログとコメントピンが重なる | 確認ダイアログが手前(`.review-backdrop` の `--z-modal` が効く) |
| 入室ダイアログ表示中にリモートカメラの名札が画面内にある | 入室ダイアログが手前 |
| HUD のツールバーボタンの真下にコメントピンが来る | ツールバーが手前(ピンはボタンの裏に隠れる) |
| ライトギズモとコメントピンが重なる | ギズモが手前(ギズモは HUD の中) |
| 左右ドックのリサイズハンドルと HUD の端が重なる | ハンドルが手前 |
| モデル読み込み失敗のエラーカードと HUD が重なる | エラーカードが手前(従来どおり) |
| コメントを選択してピンと吹き出しが重なる | 吹き出しが手前(1001 > 最大 1000) |
| コメントピンが複数あり前後する | カメラに近いピンほど手前(`[1000, 0]` の距離補間) |
| 通信エラー帯が出ている | 従来どおり `.review-page` の grid 2 行目に並び、ビューアとは重ならない。段の定義は整合のために置くだけ |
| ライトテーマ / ダークテーマを切り替える | 重なり順は変わらない(`--z-` はダークテーマで再定義しない) |
| HUD のカメラメニューを開く | 従来どおり HUD 内でトグルの下に重なる(`.hud-menu__panel` の局所 z-index は据え置き) |
| ドック列をスクロールする | 従来どおり `.review-dock-bar` が sticky で列の中身より手前(局所 z-index は据え置き) |

## やらないこと
- `web/src/features/viewer/viewer.css` の `.hud-menu__panel { z-index: 1 }` と
  `web/src/app/review-dock.css` の `.review-dock-bar { z-index: 1 }` は**変更しない**。
  どちらも HUD 内・ドック内だけの局所的な前後関係で、グローバルな段とは別物である
- `comments.css` / `presence.css` / `theme.css` / `timeline.css` / `outliner.css` / `annotation.css` /
  `shortcuts.css` / `view-settings*.css` / `light-gizmo.css` / `controls.css` / `base.css` は変更しない
- `ReviewPage.tsx` の DOM 構造・要素の並び順・`pointer-events` の設計は変更しない。
  重なり順は z-index だけで決める
- `SettingsDialog.tsx` / `JoinDialog.tsx` / `DeleteObjectDialog.tsx` の JSX は変更しない
  (`className` の組み合わせも現状のまま)
- `<Html>` に `occlude` / `transform` / `wrapperClass` を追加しない。`zIndexRange` だけを足す
- `.review-viewer` や `.review-body` に `isolation` / `z-index` を付けない
- `web/tests/objects-delete.test.ts` / `layout-styles.test.ts` / `viewer-styles.test.ts` /
  `comments-styles.test.ts` / `objects-styles.test.ts` は変更しない
- `comments_Summary.md` / `presence_Summary.md` / `objects_Summary.md` は変更しない
  (いずれも z-index に言及しておらず、記述が古くならない)
- `shared/` と `server/` には一切触れない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのトークン名・値・シグネチャで実装されている
- [ ] 振る舞い表のうち機械検証できる行に対応するテストが `web/tests/ui-layers.test.ts` にあり、通る
- [ ] `layout_Summary.md` のファイル一覧・公開インターフェイスに `layers.ts` を追加し、
      テスト欄に `tests/ui-layers.test.ts` を加えている
- [ ] `app_Summary.md` の `review.css` の説明に重なり順の段(出典は `styles/tokens.css`)を書き、
      テスト欄に `tests/ui-layers.test.ts` を加えている
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test` が成功する
