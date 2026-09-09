---
id: 023
title: web スタイル基盤(デザイントークン・ベース・共通コントロール・規約テスト)
feature: web
depends_on: [022]
owns: [web/src/styles/tokens.css, web/src/styles/base.css, web/src/styles/controls.css, web/src/main.tsx, web/tests/styles-rules.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, ../docs/DESIGN_SKILL.md, web/index.html, web/vite.config.ts, web/vitest.config.ts, web/src/app/ReviewPage.tsx, web/src/app/UploadPage.tsx, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/comments/CommentList.tsx, web/src/features/comments/CommentPins.tsx]
verify: npm run typecheck && npm run test:web && npm run build
status: done
---

## 目的
024 以降の UI タスクが共有するセマンティックトークン・ベーススタイル・共通コントロールを
単独の owns で置き、D26(CSS ファイル禁止)を解除する(D34 / D35)。
**このタスクでは既存コンポーネントの見た目を変えない**。004(server foundation)と同じ位置づけ。

## 前提
- 現在 web に CSS ファイルは 1 つも無く、全コンポーネントが inline `style={{}}` で書かれている
  (D26)。既存の色値は `#101828`(文字)/ `#667085`(薄い文字)/ `#d0d5dd`(枠)/ `#f5f7fa`(Canvas 背景)/
  `#b42318` `#8a1c1c` `#fff5f5` `#f0b8b8`(エラー)/ `#175cd3` `#eaf2ff`(選択・強調)。
  トークンはこれらを**引き継いで**命名する(`docs/DESIGN_SKILL.md` §1.1: 既存の規約を延長する)
- `web/src/main.tsx` は 4 行で、`App` を `createRoot` に渡すだけ
- Vite は `.css` の `import` を標準で扱う(プラグイン不要)。vitest は `tests/**/*.test.{ts,tsx}` だけを
  対象にし、テストはコンポーネントを import しないので CSS import はテストに影響しない
- `npm run build` は 1 秒以内に終わる(rolldown)。CSS の import 切れは build でしか検出できないため verify に含める
- D35(スタイル方式)、D36(用語表)、D37(対象環境)は `docs/task-breakdown.md` §3 を正とする
- `docs/DESIGN_SKILL.md` は React 18 前提だが本プロジェクトは React 19.2。差異は無視してよい(D38)
- 依存の追加・package.json の変更は禁止。Web フォントを読まない(D37)

## インターフェイス契約

```css
/* web/src/styles/tokens.css — :root に置くカスタムプロパティ。名前は以下をすべて定義する(値は調整可) */
:root {
  /* 文字 */
  --font-ui: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  --text-xs: 0.75rem;   /* 12px 補助 */
  --text-sm: 0.8125rem; /* 13px メタ */
  --text-md: 0.875rem;  /* 14px 本文・コントロール(既定) */
  --text-lg: 1rem;      /* 16px 節見出し */
  --text-xl: 1.125rem;  /* 18px ページ見出し(アプリ画面では大きくしない: SKILL §3.3) */
  --leading: 1.5;
  /* 間隔(4px 基準。SKILL §3.2) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px;
  /* 角丸(SKILL §3.6: 控えめ) */
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px;
  /* 色(既存 inline 値を引き継ぐ) */
  --color-bg: #ffffff;
  --color-surface: #ffffff;
  --color-surface-subtle: #f5f7fa;
  --color-surface-muted: #eaecf0;
  --color-text: #101828;
  --color-text-muted: #667085;
  --color-border: #d0d5dd;
  --color-border-strong: #98a2b3;
  --color-accent: #175cd3;
  --color-accent-subtle: #eaf2ff;
  --color-on-accent: #ffffff;
  --color-danger: #b42318;
  --color-danger-subtle: #fff5f5;
  --color-danger-border: #f0b8b8;
  --color-success: #067647;
  --color-success-subtle: #ecfdf3;
  --color-warning: #b54708;
  --color-warning-subtle: #fffaeb;
  /* 影は重ね UI(ダイアログ・HUD)だけ(SKILL §3.7) */
  --shadow-overlay: 0 4px 16px rgba(16, 24, 40, 0.16);
  /* フォーカス(SKILL §9: 必ず見える) */
  --focus-ring-color: var(--color-accent);
  /* 動き */
  --duration-fast: 120ms;
  /* レイアウト */
  --panel-width: 22rem;
  --header-height: 3rem;
}
```

```css
/* web/src/styles/base.css — リセットと既定。要素セレクタと :focus-visible のみ。クラスは定義しない */
/* 必須:
   - *, *::before, *::after { box-sizing: border-box }
   - html, body, #root { height: 100% }   ← ReviewPage が 100vh グリッドを組む前提
   - body { margin: 0; font: var(--text-md)/var(--leading) var(--font-ui); color: var(--color-text); background: var(--color-bg) }
   - button, input, textarea, select { font: inherit; color: inherit }
   - h1, h2, h3, p, ul { margin: 0 }  (余白はコンポーネント側で付ける)
   - :focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px }
   - @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important } }
*/
```

```css
/* web/src/styles/controls.css — 全画面で共有する小さなコントロール。これ以外のクラスは置かない */
/* .btn            基本(枠あり・surface 背景・radius-md・padding: var(--space-1) var(--space-3)・min-height 2rem)
   .btn--primary   accent 背景 / on-accent 文字(1 画面に 1〜2 個: SKILL §4.1)
   .btn--quiet     枠なし・背景なし(hover で surface-subtle)
   .btn--danger    danger 文字(hover で danger-subtle)
   .btn[disabled]  opacity 0.5 + cursor: not-allowed
   .btn[aria-pressed="true"]  accent-subtle 背景 + accent 枠(モード・トグルの選択状態。D35)
   .field          label > 見出し文字 + input の縦積み(display:grid; gap: var(--space-1))
   .field__label   text-sm・text-muted
   .input          input/textarea 共通(枠 border・radius-md・padding var(--space-2)・focus は :focus-visible に任せる)
   .alert          role="alert" 用(danger-subtle 背景・danger-border 枠・danger 文字・padding var(--space-2) var(--space-3)・radius-md)
   .badge          小さな状態表示(text-xs・padding 0 var(--space-2)・radius-sm・border 1px)。色は data-tone="neutral|accent|success|danger|warning" で切り替える
   .visually-hidden 視覚的に隠すがスクリーンリーダーには読ませる標準定義 */
```

```tsx
// web/src/main.tsx — 先頭で 3 つを import する(順序: tokens → base → controls)
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/controls.css";
```

```ts
// web/tests/styles-rules.test.ts — D35 の規約を機械検証する。web/src 配下の *.css を node:fs で走査する
// (テストは node で動く。パスは new URL("../src", import.meta.url) で解決)
// 走査対象: web/src/**/*.css(再帰。readdirSync(dir, { recursive: true }))
// 実装役への注意: 024 以降が追加する CSS もこのテストの対象になる。特定のファイル名に依存させない
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `tokens.css` を読む | 上の契約に列挙した `--font-ui` 〜 `--header-height` の**全名前**が `:root { ... }` 内に `--名前:` として存在する |
| `src/**/*.css` のうち `styles/tokens.css` 以外 | `#` + 16進 3〜8 桁の色、`rgb(`、`rgba(`、`hsl(` を**含まない**(色は必ず `var(--color-*)` 経由。D35) |
| `src/**/*.css` の各 `var(--名前)` 参照 | `--名前` が `src/**/*.css` のどこかで `--名前:` として宣言されている、**または**参照が `var(--名前, フォールバック)` の形でフォールバックを持つ(参加者色 `--user-color` のような TSX 側から与える変数の書き方) |
| `src/**/*.css` のうち `styles/base.css` 以外 | `!important` を含まない |
| `src/**/*.css` | `@import` を含まない(import は TSX 側で行う) |
| `main.tsx` | `./styles/tokens.css` `./styles/base.css` `./styles/controls.css` を**この順に** import している(ファイルを読んで検証) |
| `npm run build` | 成功し、`web/dist/assets/*.css` が 1 つ以上生成される |
| 既存の全テスト | 引き続き通る |
| 既存コンポーネントの inline style | **変更しない**(見た目の変化はこのタスクでは起こさない) |

## やらないこと
- 既存コンポーネント(`ReviewPage` `UploadPage` `AnnotationToolbar` 等)の inline style を CSS へ移すこと。それは 024〜027 の仕事
- `web/index.html` の変更(フォント・meta を足さない)
- CSS Modules / Tailwind / CSS-in-JS の導入、依存の追加、`vite.config.ts` `vitest.config.ts` の変更
- ダークテーマ、レスポンシブ用ブレークポイント(D37)
- `controls.css` に上記以外のクラスを足すこと(画面固有のスタイルは各機能フォルダの CSS に置く。D35)

## 目視確認(マージ後に人間が行う)
- `npm run dev:server` + `npm run dev:web` でレビュー画面を開き、**見た目が 022 時点と実質同じ**であること
  (`base.css` の `h1/h2/p/ul` の margin 0 と body 14px 化で微差は出てよい。崩れがあれば 024 で吸収する)
- Tab キーでフォーカスが青い輪で見えること

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] `tokens.css` が契約の全トークン名を定義し、`base.css` `controls.css` が契約の範囲に収まっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(`styles/` の 3 ファイルの役割、D35 の規約、`styles-rules.test.ts` の検証内容)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web && npm run build` が成功する
- [ ] 最終メッセージに `docs/DESIGN_SKILL.md` §16「Visual audit」の 3・4・5・11 への回答を書く(トークンの選択が控えめか)
