---
id: 138
title: web CSS に書かれた寸法・列数を TS 定数から渡し、フォールバック値との一致をテストで固定する
feature: web
depends_on: [137]
owns: [web/src/features/theme/ColorWheel.tsx, web/src/features/theme/ColorPicker.tsx, web/src/features/theme/theme.css, web/src/features/theme/theme_Summary.md, web/tests/theme-styles.test.ts, web/tests/color-wheel.test.ts, web/tests/layout-tokens.test.ts, web/src/features/layout/layout_Summary.md]
reads: [web/src/styles/tokens.css, web/src/features/layout/resize.ts, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/features/theme/color-wheel.ts, web/src/features/theme/theme-palette.ts, web/tests/styles-rules.test.ts, web/tests/resize.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
同じ寸法が TS 定数と CSS の両方に別々に書かれている箇所が 3 組ある(カラーホイールの一辺、パレットの列数、
パネル・アウトライナの既定幅)。CSS は静的なので TS から生成できないが、実行時は TS 定数を CSS 変数で渡し、
CSS 側には初回描画用のフォールバックだけを残して、その一致をテストで機械検証する。

## 前提
- カラーホイール: `web/src/features/theme/color-wheel.ts:4` `WHEEL_SIZE = 176`。`ColorWheel.tsx:101-107` の `<canvas>` は
  `width={WHEEL_SIZE} height={WHEEL_SIZE}`、外側は `:92` の `<div className="theme-wheel" …>`。
  一方 `theme.css:100-104` は `.theme-wheel { position: relative; width: 176px; height: 176px; }` と数値で書いている
- パレット: `web/src/features/theme/theme-palette.ts:42` `THEME_PALETTE_COLUMNS = 9` は export されているが
  `ColorPicker.tsx` も `theme.css` も使っておらず、`theme.css:79-83` が `grid-template-columns: repeat(9, 1fr)` と別に書いている。
  `ColorPicker.tsx:41-53` の `<div className="theme-palette" role="group" aria-label={PALETTE_LABEL}>` が対象
- パネル幅: `web/src/styles/tokens.css:48-49` `--panel-width: 22rem; --outliner-width: 16rem;`(= 352px / 256px)と
  `web/src/features/layout/resize.ts:8` `PANEL_WIDTH_DEFAULT_PX = 352`、`:17` `OUTLINER_WIDTH_DEFAULT_PX = 256`。
  `ReviewPage.tsx:160-165` が `.review-body` の style に `"--outliner-width": effectiveOutlinerWidth + "px"` /
  `"--panel-width": effectivePanelWidth + "px"` を**既に**渡しており、`review.css:77, 82, 88` はその変数を読む。
  したがって tokens.css の値は React が描く前のフォールバックにしかならない。tokens.css は変更しない
- `web/tests/styles-rules.test.ts` の規則: `tokenNames`(`:20-65`)は `:root` に必須(`--panel-width` `--outliner-width` を含む)。
  `var(--x)` は CSS のどこかで宣言されているかフォールバック付きなら可(`:149-159`)。生の色は tokens.css 以外に書けない。
  `.tsx` の inline style は検査対象外(`ColorWheel.tsx:111, 116` の `--marker-x` 等が既にこの形)
- `web/tests/color-wheel.test.ts` は `ColorWheel` の React 部品の DOM とポインター操作を検証する(`theme_Summary.md:48`)。
  `web/tests/theme-styles.test.ts` は表示色設定 CSS のレイアウト・属性状態・固定色禁止を検証する(`theme_Summary.md:52`)。
  この 2 ファイルの既存アサーションのうち `176px` / `repeat(9` を直接検査している行があれば、実装者は新しい形に合わせて書き換える
- `web/tests/resize.test.ts:44, 71-72` が 352 / 256 を固定している(値は変えないので通る)
- Summary: `theme_Summary.md:12-16`(color-wheel.ts / ColorWheel.tsx / theme-palette.ts / ColorPicker.tsx)、`:42-54`(テスト)。
  `layout_Summary.md:28-32`(テスト)

## インターフェイス契約

```tsx
// web/src/features/theme/ColorWheel.tsx
//   外側の <div className="theme-wheel"> に style={{ "--wheel-size": `${WHEEL_SIZE}px` } as CSSProperties} を足す

// web/src/features/theme/ColorPicker.tsx
import { THEME_PALETTE, THEME_PALETTE_COLUMNS } from "./theme-palette";
//   <div className="theme-palette"> に style={{ "--theme-palette-columns": THEME_PALETTE_COLUMNS } as CSSProperties} を足す
```

```css
/* web/src/features/theme/theme.css */
.theme-palette { grid-template-columns: repeat(var(--theme-palette-columns, 9), 1fr); /* 他は従来どおり */ }
.theme-wheel { position: relative; width: var(--wheel-size, 176px); height: var(--wheel-size, 176px); }
```

```ts
// web/tests/layout-tokens.test.ts(新規。ソース検査)
//   tokens.css の --panel-width / --outliner-width の rem 値 × 16 が PANEL_WIDTH_DEFAULT_PX / OUTLINER_WIDTH_DEFAULT_PX と一致すること、
//   ReviewPage.tsx が両変数を inline style で渡していることを検証する
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ColorWheel` を描画 | `.theme-wheel` 要素の `style` に `--wheel-size: 176px`(= `${WHEEL_SIZE}px`)がある。canvas の `width`/`height` 属性は従来どおり `WHEEL_SIZE` |
| `theme.css` の `.theme-wheel` ブロック | `width: var(--wheel-size, 176px)` と `height: var(--wheel-size, 176px)` を含み、フォールバックの数値が `WHEEL_SIZE` と一致する(正規表現で取り出して比較) |
| `theme.css` の `.theme-palette` ブロック | `repeat(var(--theme-palette-columns, 9), 1fr)` を含み、フォールバックが `THEME_PALETTE_COLUMNS` と一致する |
| `ColorPicker.tsx` のソース | `"--theme-palette-columns": THEME_PALETTE_COLUMNS` を含む |
| `tokens.css` の `--panel-width` | `22rem` のような rem 値で、`× 16` が `PANEL_WIDTH_DEFAULT_PX` と一致する |
| `tokens.css` の `--outliner-width` | 同様に `OUTLINER_WIDTH_DEFAULT_PX` と一致する |
| `ReviewPage.tsx` のソース | `"--outliner-width": effectiveOutlinerWidth + "px"` と `"--panel-width": effectivePanelWidth + "px"` を含む |
| `styles-rules.test.ts` | 通る(新しい `var()` はすべてフォールバック付き。tokens.css の `:root` は変更しない) |
| 既存テスト | すべて通る |

## やらないこと
- `tokens.css` / `resize.ts` / `ReviewPage.tsx` / `review.css` は変更しない
- 寸法・列数の値を変えない
- タイムラインの `--timeline-track-height`(`timeline.css:14`、既にフォールバック付きで `PlaybackTimeline.tsx:49` が渡している)は対象外
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりに実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] theme_Summary.md(ColorWheel.tsx / ColorPicker.tsx の説明と `## テスト`)と layout_Summary.md(`## テスト` に layout-tokens.test.ts)が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
