---
id: 116
title: ダークテーマの CSS トークンを定義し documentElement へ data-theme を反映する
feature: theme
depends_on: [115]
owns: [web/src/styles/tokens.css, web/src/features/theme/ThemeEffect.tsx, web/src/features/theme/theme_Summary.md, web/src/app/App.tsx, web/src/app/app_Summary.md, web/web_Summary.md, web/tests/theme-effect.test.ts, web/tests/styles-rules.test.ts]
reads: [web/src/features/theme/theme-mode.ts, web/src/store/theme.ts, web/src/styles/base.css, web/src/styles/controls.css, web/src/main.tsx, web/tests/trail-bar.test.ts, web/tests/trail-rig.test.ts, web/tests/viewer-styles.test.ts, web/src/app/ReviewPage.tsx, web/src/app/UploadPage.tsx]
verify: npm run typecheck && npm run test
status: done
---

## 目的
UI 全体をダークテーマにできるようにする。テーマの選択自体は 115 の theme ストアが持っているので、
このタスクは「ダークのときの色の値」を `tokens.css` に置き、選択結果を
`documentElement` の `data-theme` 属性へ反映する結線を作る。

## 前提
- 115 で `web/src/features/theme/theme-mode.ts` と `web/src/store/theme.ts` ができている。
  - `resolveThemeMode(mode, prefersDark): "light" | "dark"`
  - `useThemeStore` の `mode` / `prefersDark` / `setPrefersDark(prefersDark)`
  - `selectResolvedTheme(state): ResolvedThemeMode`
- **スタイル規約 D35**: 生の 16 進色・`rgb()` / `rgba()` / `hsl()` は
  `web/src/styles/tokens.css` 以外に書けない。`web/tests/styles-rules.test.ts:114` が
  `src/**/*.css` を再帰走査して機械検証している。**ダークの値はすべて `tokens.css` の中に置く**
- 同テストの `it("defines every token in the :root block")` は
  `tokens.css` の**最初の `:root { ... }` ブロック**を正規表現 `/:root\s*\{([\s\S]*?)\}/` で取り出し、
  `tokenNames` の全トークンがそこに `--name:` の形であることを確かめる。
  したがって**ライトの定義は今の `:root { ... }` に残したまま**、
  ダークは別のブロックとして**その後ろに**足す。最初のブロックからトークンを消してはならない
- `web/src/styles/base.css` には `color-scheme` の宣言が無い。`tokens.css` 側で宣言する
- `--color-surface-translucent` は `color-mix(in srgb, var(--color-surface) 88%, transparent)`、
  `--focus-ring-color` は `var(--color-accent)` と、**他のトークンを参照して定義されている**。
  CSS 変数は参照時に解決されるので、`--color-surface` / `--color-accent` を上書きすれば
  自動的に追従する。**この 2 つはダーク側で再定義しない**
- コンポーネントのテストは testing-library を使わず、`react-dom/client` の `createRoot` と
  React の `act` を使って jsdom へ描く流儀になっている。`web/tests/trail-bar.test.ts:1-60` が最も近い前例で、
  ファイル先頭で `Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });` を宣言している
- jsdom には `window.matchMedia` が無い。テストでは `Object.defineProperty(window, "matchMedia", ...)` か
  `vi.stubGlobal` で差し替える。**本体は `matchMedia` が無くても動かなければならない**
- `web/src/app/App.tsx` は現在 25 行で、`route.name` によって 3 通りの `return` を持つ

## インターフェイス契約

### `web/src/styles/tokens.css`

今の `:root { ... }` はそのまま残し、その中に 1 行だけ足す。

```css
:root {
  /* ...既存の定義はすべてそのまま... */
  color-scheme: light;
}
```

続けて、ファイル末尾に次のブロックを足す。**ここに挙げたトークンだけを上書きし、
`--color-surface-translucent` と `--focus-ring-color` は書かない**。

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  --color-bg: #0f1218;
  --color-surface: #171b23;
  --color-surface-subtle: #1e232d;
  --color-surface-muted: #272d39;
  --color-text: #e7eaf0;
  --color-text-muted: #9aa4b5;
  --color-border: #333b49;
  --color-border-strong: #4c566a;
  --color-accent: #7aa7ff;
  --color-accent-subtle: #1c2740;
  --color-on-accent: #0f1218;
  --color-danger: #f87171;
  --color-danger-subtle: #2a1616;
  --color-danger-border: #6b2b2b;
  --color-success: #4ade80;
  --color-success-subtle: #10261a;
  --color-warning: #fbbf24;
  --color-warning-subtle: #2a2010;

  --shadow-overlay: 0 4px 16px rgba(0, 0, 0, 0.55);
  --shadow-control: 1px 2px 3px rgba(0, 0, 0, 0.45);
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.45);
}
```

`--color-on-accent` がダークで暗い色になるのは、`--color-accent` が明るい青になり
その上に乗る文字は暗くないと読めないためである(`.btn--primary` が両方を使う)。

### 新規 `web/src/features/theme/ThemeEffect.tsx`

```ts
/** レビュー画面・アップロード画面の外側に 1 つだけ置く、描画しない部品。 */
export function ThemeEffect(): null;
```

次の 2 つの副作用だけを持つ。

1. マウント時に `window.matchMedia?.("(prefers-color-scheme: dark)")` を取り、
   - 取れたら `useThemeStore.getState().setPrefersDark(media.matches)` で今の値を反映し、
     `media.addEventListener("change", handler)` を購読して、`handler` で
     `setPrefersDark(event.matches)` を呼ぶ。クリーンアップで `removeEventListener` する
   - `window.matchMedia` が無い / 呼んで例外になる / 返り値に `addEventListener` が無い場合は
     何もしない(例外を外へ出さない)
   - 依存配列は空([])。ストアの action は `useThemeStore.getState()` 経由で呼ぶ
2. `resolveThemeMode(mode, prefersDark)` の結果を
   `document.documentElement.dataset.theme` へ代入する。`mode` が `"system"` のときも
   解決後の `"light"` / `"dark"` を入れる(属性を消したり `"system"` を入れたりしない)。
   依存配列は解決結果

`mode` と `prefersDark` は `useThemeStore` から購読する(`selectResolvedTheme` を使ってよい)。

### `web/src/app/App.tsx`

3 つの `return` の外側へ `<ThemeEffect />` を出す。ルートのどの画面でもテーマが効くようにする。

```tsx
export function App(): React.ReactElement {
  const route = useRoute();
  return (
    <>
      <ThemeEffect />
      {routeContent(route)}
    </>
  );
}
```

今の 3 分岐は `function routeContent(route: Route): React.ReactElement` として同じファイル内に切り出し、
中身は現在の `return` をそのまま移す(`navigate` を使う not-found の `<a>` も含めて変えない)。
`Route` 型は `./routes` から import する(既に export されているものを使い、`routes.ts` は変更しない)。

### `web/tests/styles-rules.test.ts`

既存の `it` は消さず緩めず、次の 1 件を足す。

```ts
it("overrides the dark palette without touching derived tokens", () => { /* 下の振る舞い表のとおり */ });
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `tokens.css` の最初の `:root` ブロック | 既存の全トークンが残っている(既存テストが通る) |
| `tokens.css` の `:root` | `color-scheme: light` を含む |
| `tokens.css` | `:root[data-theme="dark"]` のブロックがちょうど 1 つある |
| dark ブロック | `color-scheme: dark` を含む |
| dark ブロックが上書きするトークン | 契約に挙げた 18 個の `--color-*` と 3 個の `--shadow-*` を**すべて**含む |
| dark ブロック | `--color-surface-translucent` と `--focus-ring-color` を**含まない**(派生トークンなので自動追従させる) |
| dark ブロックの各 `--color-*` の値 | `/^#[0-9a-f]{6}$/` に一致する(小文字 6 桁) |
| dark と light の同名トークンの値 | すべて異なる(上書きの意味がある) |
| `tokens.css` 以外の CSS | 生の 16 進色・`rgb(` / `rgba(` / `hsl(` を含まない(既存テスト) |
| `ThemeEffect` を描画(`matchMedia` なし) | 例外にならず、`document.documentElement.dataset.theme` が設定される |
| `ThemeEffect` を描画(`mode: "light"`) | `dataset.theme === "light"` |
| `ThemeEffect` を描画(`mode: "dark"`) | `dataset.theme === "dark"` |
| `ThemeEffect` を描画(`mode: "system"`、matchMedia が `matches: true`) | `dataset.theme === "dark"`、ストアの `prefersDark` が true |
| `ThemeEffect` を描画(`mode: "system"`、matchMedia が `matches: false`) | `dataset.theme === "light"` |
| 描画後に `setMode("dark")` | `dataset.theme` が `"dark"` に変わる |
| 描画後に matchMedia の `change` を `matches: true` で発火(`mode: "system"`) | `dataset.theme` が `"dark"` に変わる |
| `mode: "light"` のまま `change` を `matches: true` で発火 | `dataset.theme` は `"light"` のまま(`prefersDark` だけ変わる) |
| アンマウント | `removeEventListener` が同じ handler で呼ばれる |
| `matchMedia` が例外を投げる | 例外が外へ出ず、`dataset.theme` は設定される |
| `matchMedia` の返り値に `addEventListener` が無い | 例外が外へ出ず、`matches` の値は反映される |
| `App.tsx` のソース | `<ThemeEffect />` をちょうど 1 つ含む |
| `App` を `route` = upload で描画 | `UploadPage` が描かれ、`dataset.theme` が設定される |
| `App` を未知のパスで描画 | 従来どおり not-found の文言とリンクが描かれる |

## やらないこと
- **`prefers-color-scheme` のメディアクエリを CSS に書かない**。OS 追従は theme ストアの
  `prefersDark` と `data-theme` 属性の 1 経路だけで実現する(CSS と JS の二重管理にしない)
- 3D ビュー側の色の適用。`ViewerCanvas.tsx` の背景色 `#f5f7fa` は**このタスクでは変えない**(122 の担当)
- 設定 UI(テーマを切り替えるボタン)。117 / 118 / 119 の担当。
  このタスクの時点でテーマを変える手段はテストからの `setMode` だけでよい
- `web/src/styles/base.css` / `controls.css` と各機能フォルダの CSS の変更。
  ダーク化はトークンの上書きだけで行う。個別 CSS が生色を持っていないことは既存テストが保証している
- `web/src/app/routes.ts` の変更。`Route` 型は既にあるものを使う
- `web/src/features/theme/` の他のファイル(`viewer-colors.ts` など 115 の成果物)の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `theme_Summary.md` に `ThemeEffect.tsx` を相対パスで、`tests/theme-effect.test.ts` を
      ファイル名で追記している
- [ ] `app_Summary.md` の `App.tsx` の記述に `ThemeEffect` と `routeContent` を反映している
- [ ] `web/web_Summary.md` の `src/styles/tokens.css` の説明に、ダークの上書きブロックがあることを追記している
- [ ] すべてのファイルが300行以内(`tokens.css` は現在 50 行、`app_Summary.md` は 59 行)
- [ ] verify: に書いたコマンドが成功する
