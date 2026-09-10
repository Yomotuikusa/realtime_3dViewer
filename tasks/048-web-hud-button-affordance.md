---
id: 048
title: web カメラメニューのボタンに枠と影を付け、ライトギズモの枠を廃止する
feature: web
depends_on: []
owns: [web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/viewer.css, web/src/styles/tokens.css, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/light-gizmo.ts, web/src/styles/controls.css, web/src/app/review.css, web/tests/summary-coverage.test.ts, web/web_Summary.md, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右上「カメラ」メニュー内のボタンは境界線が透明で、押せるものに見えない。各ボタンに枠線と
右下方向の弱いドロップシャドウを付け、一目でインタラクト可能だと伝える。
右下のライトギズモは白い枠付きの箱になっており、その枠を廃止して 3D ビューへ直接重ねる。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- カメラメニューの中身は `CameraMenu.tsx` が描く。ボタンは視点4方向(`VIEW_PRESET_ORDER.map`)・
  全体表示・視点リセットの計6個で、className はそれぞれ
  `"btn btn--quiet hud-menu__item hud-view"`(web/src/features/viewer/CameraMenu.tsx:49, 62)と
  `"btn btn--quiet hud-menu__item"`(同:77)。`FocalLengthSlider` はボタンではない
- `.btn` は `border: 1px solid var(--color-border); background: var(--color-surface)` を持ち、
  `.btn--quiet` がそれを `border-color: transparent; background: transparent` で打ち消している。
  web/src/styles/controls.css:1-33。`.btn:hover` と `.btn--quiet:hover` はどちらも
  `background: var(--color-surface-subtle)` で同じ
- メニューのパネル `.hud-menu__panel` の背景は `var(--color-surface)`。`.hud-menu__item` は
  `justify-content: flex-start; text-align: left` だけを持つ。web/src/features/viewer/viewer.css:53-71
- 影のトークンは `--shadow-overlay: 0 4px 16px rgba(16, 24, 40, 0.16)` の1つだけ。
  web/src/styles/tokens.css:40
- `.light-gizmo` は `position: absolute; right/bottom: var(--space-3); width/height: 112px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-overlay); overflow: hidden`。
  web/src/features/viewer/viewer.css:156-167。子の `.light-gizmo__stage`(`<Canvas>` を包む)と
  `.light-gizmo__reset`(`btn btn--quiet`、web/src/features/viewer/LightGizmo.tsx:115)は変更対象外
- ギズモの `<Canvas>` は 112px 固定で、ライトマーカー(軌道半径 2.2)はカメラ `[0, 2.4, 4.6]` /
  fov 40 の視野(半径約 1.89)に収まらないことがある。これは本タスクでは直さない(人間の決定)。
  web/src/features/viewer/light-gizmo.ts:5-13
- CSS には生の色値(`#…` / `rgb(` / `rgba(` / `hsl(`)を `styles/tokens.css` 以外に書けない。
  `tests/styles-rules.test.ts:106-111` が検査する。`!important` / `@import` も禁止
- `tests/styles-rules.test.ts:20-60` の `tokenNames` に載せた変数は `:root` 内に定義されている
  ことが検査される(未掲載の変数を定義しても失敗はしない)
- `tests/summary-coverage.test.ts` は、`web/tests/*.test.ts` の各ファイル名がいずれかの
  `*_Summary.md` に含まれること、`src` 配下の各ソースが最寄りの Summary に相対パスで載ることを
  検査する。viewer.css / CameraMenu.tsx は `viewer_Summary.md` に、tokens.css は `web_Summary.md` に
  既に載っている(説明文の変更は任意、パスの掲載は維持する)
- `viewer_Summary.md` は 110 行、viewer.css は 196 行、tokens.css は 45 行(上限 300 行)

## インターフェイス契約

```css
/* web/src/styles/tokens.css の :root に追記(--shadow-overlay の直後) */
--shadow-control: 1px 2px 3px rgba(16, 24, 40, 0.14);
```

```css
/* web/src/features/viewer/viewer.css(既存ルールの変更) */
.hud-menu__item {
  justify-content: flex-start;
  text-align: left;
  box-shadow: var(--shadow-control);
}

.light-gizmo {
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  width: 112px;
  height: 112px;
}
```

```tsx
// web/src/features/viewer/CameraMenu.tsx: 3か所の className から btn--quiet を外す
className="btn hud-menu__item hud-view"   // 視点4方向・全体表示
className="btn hud-menu__item"            // 視点リセット
```

```ts
// web/tests/styles-rules.test.ts: tokenNames の "--shadow-overlay" の直後に追加
"--shadow-control",
```

```ts
// web/tests/viewer-styles.test.ts(新規)。styles-rules.test.ts と同じく CSS をテキストで読む
/** text 中で selector にちょうど一致するルールの `{ ... }` の中身。無ければ null。 */
function ruleBody(text: string, selector: string): string | null;
```

## 振る舞い
`tests/viewer-styles.test.ts` の各 it がこの表の1行に対応する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| tokens.css の `:root` ブロック | `--shadow-control` が定義され、値の先頭2つの長さ(x, y オフセット)がどちらも正の px |
| viewer.css の `ruleBody(text, ".hud-menu__item")` | `box-shadow: var(--shadow-control)` を含む |
| CameraMenu.tsx の全文 | `className="..."` のうち `hud-menu__item` を含むものが3つあり、いずれも `btn--quiet` を含まない |
| viewer.css の `ruleBody(text, ".light-gizmo")` | `border` / `background` / `box-shadow` / `overflow` で始まる宣言を含まない |
| viewer.css の `ruleBody(text, ".light-gizmo")` | `position` / `right` / `bottom` / `width` / `height` の宣言を含む |
| `ruleBody(text, ".light-gizmo")` の一致判定 | `.light-gizmo__stage` や `.light-gizmo__reset` のブロックを誤って拾わない(セレクタ完全一致) |
| 既存 `tests/styles-rules.test.ts` | 追加後も全件通る(生色は tokens.css のみ、`--shadow-control` が `:root` にある) |

## やらないこと
- `.light-gizmo__stage` / `.light-gizmo__reset` / `.hud-hint` のスタイルと、`LightGizmo.tsx` は変更しない
  (リセットボタンは `btn--quiet` のまま据え置く)
- `GIZMO_SIZE_PX`、`GIZMO_CAMERA_POSITION`、`GIZMO_CAMERA_FOV` など `light-gizmo.ts` の定数は変更しない
- hover / active / focus でシャドウを変えない。`.btn` の `transition` に `box-shadow` を足さない
- `.hud-menu__toggle`(カメラのトグルボタン)と `FocalLengthSlider` には枠・影を足さない
- `controls.css` の `.btn` / `.btn--quiet` は変更しない
- `web_Summary.md` は変更しない(tokens.css の掲載は既にある)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md の「ファイル一覧と役割」(viewer.css / CameraMenu.tsx / LightGizmo.tsx の説明)と「テスト」(tests/viewer-styles.test.ts)が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する(設定した場合)
