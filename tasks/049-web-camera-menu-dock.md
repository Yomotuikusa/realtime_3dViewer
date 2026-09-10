---
id: 049
title: web カメラメニューを最初から展開した半透明のドッキングパネルにする
feature: web
depends_on: []
owns: [web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/viewer.css, web/src/styles/tokens.css, web/tests/hud-menu.test.ts, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/FocalLengthSlider.tsx, web/src/features/viewer/hud-labels.ts, web/src/styles/controls.css, web/src/app/review.css, web/tests/summary-coverage.test.ts, web/web_Summary.md, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右上「カメラ」メニューは閉じた状態で始まり、3D ビューをクリックするたびに閉じる。トグルは
文字幅の小さなボタンで、パネルは 4px 離れた別カードとして浮いている。これを、最初から展開
された常設パネルにし、トグルとパネルを同じ幅で上下に結合(ドッキング)し、背景を少し透かして
3D ビューに馴染ませる。折りたたみはトグルボタンと Escape でだけ行う。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 開閉 state は `ViewerHud.tsx` の `useState<HudMenuId | null>(null)` で、外側 pointerdown で
  閉じる `useEffect` と `menusRef` がある。web/src/features/viewer/ViewerHud.tsx:38-50, 70
- `HudMenu` は制御コンポーネントで、`open` が真のときだけ `.hud-menu__panel`(`role="group"`)を
  描く。Escape はメニュー内で `stopPropagation` してから `onClose` を呼ぶ(この Escape 処理は残す)。
  web/src/features/viewer/HudMenu.tsx:15-22
- `CameraMenu({ onClose })` は視点4方向・全体表示・視点リセットの押下後に `onClose()` を呼ぶ。
  web/src/features/viewer/CameraMenu.tsx:20-23, 54, 69, 81。`FocalLengthSlider` はメニューを閉じない
- `hud-menu.ts` は `HudMenuId`("camera" のみ)、`HUD_MENU_ORDER`、`HUD_MENU_LABELS`、`toggleHudMenu`、
  `menuAfterPointerDown` を公開し、`tests/hud-menu.test.ts:22-39` が `menuAfterPointerDown` を検査する。
  `menuAfterPointerDown` の利用箇所は `ViewerHud.tsx:46` だけ
- 現在の CSS: `.hud-menu { position: relative }`、`.hud-menu__toggle { box-shadow: var(--shadow-overlay) }`、
  `.hud-menu__toggle[aria-expanded="true"]` はアクセント色で塗る、`.hud-menu__panel` は
  `top: calc(100% + var(--space-1)); right: 0; min-width: 13.5rem; background: var(--color-surface)` の
  絶対配置。web/src/features/viewer/viewer.css:39-66
- `.btn` は `border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-surface)` を持ち、`.btn:hover` が `background: var(--color-surface-subtle)`。
  web/src/styles/controls.css:1-15。viewer.css は controls.css より後に読み込まれるので、同じ詳細度なら
  viewer.css が勝つ
- `.review-hud` は `pointer-events: none` で、`.btn` / `[role="group"]` などだけ `pointer-events: auto`。
  web/src/app/review.css:92-105
- CSS の生の色値(`#…` / `rgb(` / `rgba(` / `hsl(`)は `styles/tokens.css` にしか書けない。`color-mix()` と
  `var()` の組み合わせはどのファイルでも書ける。`!important` / `@import` は禁止。
  web/tests/styles-rules.test.ts:107-112, 126-131
- `tests/styles-rules.test.ts:20-60` の `tokenNames` に載せた変数は `:root` 内の定義が検査される
- `tests/viewer-styles.test.ts` は CSS / TSX をテキストで読み、`ruleBody(text, selector)` で
  セレクタ完全一致のルール本文を取り出す。web/tests/viewer-styles.test.ts:15-24
- `tests/summary-coverage.test.ts` は `src` 配下の各ソースと `tests/*.test.ts` が Summary に載ることを
  検査する。本タスクで新規ファイルは作らないので、既存の掲載を維持すればよい
- 行数: viewer.css 193、ViewerHud.tsx 97、viewer-styles.test.ts 72、viewer_Summary.md 111、tokens.css 46

## インターフェイス契約

```ts
// web/src/features/viewer/hud-menu.ts
// menuAfterPointerDown は削除する。以下を追記する
/** ページ表示直後に開いているメニュー。カメラは常設パネルとして最初から展開する。 */
export const HUD_MENU_INITIAL: HudMenuId | null = "camera";
```

```tsx
// web/src/features/viewer/CameraMenu.tsx: props を廃止する(CameraMenuProps も削除)
export function CameraMenu(): ReactElement;
// 視点4方向・全体表示・視点リセットの onClick は各 request 呼び出しだけを行う
```

```tsx
// web/src/features/viewer/HudMenu.tsx: HudMenuProps は変更しない。トグルの中身だけ変える
<button className="btn hud-menu__toggle" type="button" aria-haspopup="true"
        aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
  <span>{HUD_MENU_LABELS[id]}</span>
  <span className="hud-menu__chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
</button>
```

```tsx
// web/src/features/viewer/ViewerHud.tsx
const [openMenu, setOpenMenu] = useState<HudMenuId | null>(HUD_MENU_INITIAL);
// 外側 pointerdown の useEffect、menusRef、useEffect / useRef の import を削除する
// <div className="hud-menus"> の ref も外す
<CameraMenu />
// HudMenu への open / onToggle / onClose の渡し方は変えない(Escape で閉じる)
```

```css
/* web/src/styles/tokens.css の :root に追記(--color-warning-subtle の直後) */
--color-surface-translucent: color-mix(in srgb, var(--color-surface) 88%, transparent);
```

```ts
// web/tests/styles-rules.test.ts: tokenNames の "--color-warning-subtle" の直後に追加
"--color-surface-translucent",
```

```css
/* web/src/features/viewer/viewer.css(既存ルールの置き換え。宣言はこの内容にする) */
.hud-menu {
  position: relative;
  width: 13.5rem;
}

.hud-menu__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-surface-translucent);
  backdrop-filter: blur(6px);
  box-shadow: var(--shadow-overlay);
}

.hud-menu__toggle[aria-expanded="true"] {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: none;
}

.hud-menu__chevron {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.hud-menu__panel {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  z-index: 1;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--color-surface-translucent);
  backdrop-filter: blur(6px);
  box-shadow: var(--shadow-overlay);
}
```

## 振る舞い
`tests/viewer-styles.test.ts` / `tests/hud-menu.test.ts` の各 it がこの表の1行に対応する。
CSS・TSX の検査は既存の `ruleBody` / 正規表現によるテキスト検査で行う。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `HUD_MENU_INITIAL` | `"camera"` |
| `hud-menu.ts` の公開 API | `menuAfterPointerDown` を export しない(`tests/hud-menu.test.ts:22-39` の2つの it を削除し、`HUD_MENU_INITIAL` の it を足す) |
| `toggleHudMenu`、`HUD_MENU_ORDER`、`HUD_MENU_LABELS` | 従来どおり(既存 it をそのまま残す) |
| tokens.css の `:root` | `--color-surface-translucent` が定義され、値に `color-mix(` と `var(--color-surface)` を含む |
| `ruleBody(viewer.css, ".hud-menu")` | `width: 13.5rem` を含む |
| `ruleBody(viewer.css, ".hud-menu__toggle")` | `width: 100%` と `background: var(--color-surface-translucent)` を含む |
| `ruleBody(viewer.css, '.hud-menu__toggle[aria-expanded="true"]')` | `--color-accent` を含まず、`border-bottom-left-radius: 0` と `border-bottom-right-radius: 0` を含む |
| `ruleBody(viewer.css, ".hud-menu__panel")` | `top: 100%`、`left: 0`、`right: 0`、`border-top: 0`、`background: var(--color-surface-translucent)` を含み、`min-width` を含まない |
| ViewerHud.tsx の全文 | `useState<HudMenuId \| null>(HUD_MENU_INITIAL)` を含み、`menuAfterPointerDown` と `addEventListener` を含まない |
| CameraMenu.tsx の全文 | `onClose` を含まない。`hud-menu__item` を含む className は従来どおり3つで `btn--quiet` を含まない(既存 it) |
| HudMenu.tsx の全文 | `hud-menu__chevron` を含む |
| ページ表示直後 | カメラパネルが展開された状態で右上に出る |
| 3D ビューや他の HUD をクリック | パネルは閉じない |
| 視点ボタン・全体表示・視点リセットを押す | カメラ要求は従来どおり積まれ、パネルは閉じない |
| トグルボタンを押す | 展開↔折りたたみが切り替わる(`toggleHudMenu`) |
| パネル内で Escape | パネルが折りたたまれ、ショートカットの `clearMode` には伝播しない(従来どおり) |
| 展開中のトグル | 下の角丸が無く、パネルと 1px の境界線 1 本で結合して見える。塗りはアクセント色ではなく半透明サーフェス |
| 既存 `tests/styles-rules.test.ts` | 追加後も全件通る(生色は tokens.css のみ、新トークンが `:root` にある) |

## やらないこと
- `.hud-menus`、`.hud-modes`、`.hud-mode`、`.hud-menu__item`、`.hud-menu__section`、`.hud-focal*`、`.hud-views`、`.hud-view` は変更しない
- `.hud-follow` / `.hud-hint` / `.light-gizmo*` は変更しない(追従表示の変更は task 050、ギズモは task 051)
- `.hud-menu__toggle:hover` の上書きは足さない(`.btn:hover` のまま)
- `HudMenuProps` のシグネチャと Escape の処理は変えない
- `HUD_MENU_LABELS` の文言は変えない。折りたたみ表示は `▴` / `▾` の文字だけで、アイコン SVG は足さない
- 開閉状態を localStorage などへ保存しない
- 左上のモード切替や `AnnotationToolbar` に半透明化を広げない
- `controls.css`、`review.css`、`web_Summary.md` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md の「ファイル一覧と役割」(ViewerHud.tsx / HudMenu.tsx / hud-menu.ts / CameraMenu.tsx / viewer.css)、「公開インターフェイス」(CameraMenu.tsx / HudMenu.tsx / hud-menu.ts)、「他フォルダとの関係」の「開いているメニューの外側で pointerdown すると閉じ」の記述、「テスト」(tests/hud-menu.test.ts / tests/viewer-styles.test.ts)が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
