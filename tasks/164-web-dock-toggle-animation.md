---
id: 164
title: web ドックの開閉を列幅の補間でアニメーションさせ、HUD の再表示ボタンを閉じ切ってから出す
feature: layout
depends_on: [163]
owns: [web/src/styles/tokens.css, web/src/features/layout/useDockAnimation.ts, web/src/features/layout/layout_Summary.md, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/app/review-dock.css, web/src/app/app_Summary.md, web/tests/dock-animation.test.ts, web/tests/styles-rules.test.ts]
reads: [web/src/app/ReviewDock.tsx, web/src/app/review-labels.ts, web/src/features/layout/useLayoutFlag.ts, web/src/features/layout/ResizeHandle.tsx, web/src/features/layout/layout-storage.ts, web/src/styles/base.css, web/src/styles/controls.css, web/tests/dock-toggle.test.ts, web/tests/dock-structure.test.ts, web/tests/layout-styles.test.ts, web/tests/layout-tokens.test.ts, web/tests/comments-styles.test.ts, web/tests/viewer-styles.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

ドックの開閉が一瞬で切り替わるため、どちらの列が畳まれたのか目で追えない。
列幅を 200ms で補間し、閉じ切ってから HUD の再表示ボタンが現れるようにする。
163 で入れた「閉じても中身を残す」構造の上に、CSS と小さなフックを足すだけで実現する。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### 163 が用意した構造(このタスクでは構造を変えない)

- ドック 1 列は `DockColumn`(`web/src/app/ReviewDock.tsx`)が描画する。閉じていても
  `<aside>` はアンマウントされず、`data-open="false"` と `inert` が付き、列幅が `0px` になる。
- 内側の `.review-dock__inner` が `--outliner-open-width` / `--panel-open-width`
  (`ReviewPage.tsx` の inline style が常に実幅を入れる)で開いていたときの幅を保つ。
  したがって**列幅さえ補間すれば、中身は潰れずスライドして見える**。
- ドック用の CSS は `web/src/app/review-dock.css` にある。`.review-hud .review-dock-expand` も
  そこにある。`.review-body` と `.review-outliner` / `.review-panel` は `web/src/app/review.css`。

### 補間のしかた

- 列幅は `.review-body` の inline style が px で与える CSS 変数で決まるため、
  **`@property` で型付き登録しないと `transition` が効かない**。登録すれば
  `grid-template-columns` と、`--outliner-width` を参照する `ResizeHandle` の
  `left: calc(var(--outliner-width) - 4px)`(`review.css:86-89`)が同時に動く。
- ただし同じ変数はリサイズのドラッグとキー操作でも毎フレーム変わる。常時 transition を掛けると
  ハンドルが指に追従しなくなるため、**開閉トグルの直後だけ**
  `.review-body[data-dock-animating="true"]` を立てて補間する。
- `web/src/styles/base.css:41-46` に `prefers-reduced-motion: reduce` で
  `transition-duration` と `animation-duration` を `0.01ms` にする一括指定が既にある。
  このタスクで reduced-motion 向けの分岐を足す必要はない。
- `tokens.css` にある時間トークンは `--duration-fast: 120ms`(`:47`)だけである。

### 触るファイルの既存検査

- `web/tests/styles-rules.test.ts:100-108`: `tokenNames` に挙げた名前が `tokens.css` の
  **最初の `:root { … }` ブロック**の中で宣言されていること。抽出は
  `/:root\s*\{([\s\S]*?)\}/` で最初の `}` までなので、`@property` ブロックは
  **`:root` より後(ファイル末尾)に置けば影響しない**。
- `web/tests/layout-tokens.test.ts:16-20`: `--panel-width\s*:\s*([0-9.]+)rem` の最初の一致から
  既定幅を読む。`@property --panel-width {` はこの形に一致しないので、末尾に置く限り安全。
- `web/tests/styles-rules.test.ts:152-163`: `src` 配下の CSS の生の色・未宣言変数参照・
  `!important`・`@import` の禁止。`--duration-medium` は `:root` で宣言するので参照してよい。
- `web/tests/summary-coverage.test.ts`: 新規の `useDockAnimation.ts` は
  `layout_Summary.md` に相対パスで、`dock-animation.test.ts` はいずれかの Summary に
  ファイル名で載せる必要がある。

### 現在の行数(上限 300 行、いずれも 163 完了後の見込み)

`tokens.css` 79、`ReviewPage.tsx` 約 280、`review.css` 約 233、`review-dock.css` 約 60、
`layout_Summary.md` 37、`app_Summary.md` 約 75、`styles-rules.test.ts` 178。

`ReviewPage.tsx` は下の契約どおりで **+3 行**(約 283 行)に収まる。
これを超えそうになったら行を足さず、`ReviewDock.tsx` 側へ寄せられないかを先に検討すること。

## インターフェイス契約

### web/src/styles/tokens.css

`:root` の `--duration-fast: 120ms;` の**次の行**に 1 行足す。

```css
  --duration-medium: 200ms;
```

`@property` はファイル末尾(`:root[data-theme="dark"]` ブロックより後)に置く。

```css
/* 列幅を transition できるよう型付きで登録する。
   実効値は :root の既定と ReviewPage の inline style が与える。 */
@property --outliner-width {
  syntax: "<length>";
  inherits: true;
  initial-value: 0px;
}

@property --panel-width {
  syntax: "<length>";
  inherits: true;
  initial-value: 0px;
}
```

### web/src/features/layout/useDockAnimation.ts(新規)

```ts
import { useCallback, useEffect, useRef, useState } from "react";

/** 列幅を補間する時間(ms)。tokens.css の --duration-medium と揃える。 */
export const DOCK_ANIMATION_MS = 200;
/** フラグを落とすまでの待ち。補間の終端で transition が外れて跳ねないよう少し長く取る。 */
export const DOCK_ANIMATION_RELEASE_MS = DOCK_ANIMATION_MS + 60;

/**
 * ドック開閉の直後だけ true を返すフック。true の間だけ列幅に transition を掛け、
 * リサイズのドラッグやキー操作では補間しない。
 * toggle は開閉フラグのセッタと次の値を受け取り、アニメーションを始めてから値を変える。
 * 続けて呼ぶと待ちは延長される。アンマウント時にタイマーを片付ける。
 */
export function useDockAnimation(): readonly [
  animating: boolean,
  toggle: (setOpen: (open: boolean) => void, open: boolean) => void,
] {
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const toggle = useCallback((setOpen: (open: boolean) => void, open: boolean): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setAnimating(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAnimating(false);
    }, DOCK_ANIMATION_RELEASE_MS);
    setOpen(open);
  }, []);

  return [animating, toggle] as const;
}
```

### web/src/app/ReviewPage.tsx

足すのは import 1 行、フック 1 行、属性 1 行の**計 3 行だけ**。残りは既存行の書き換えである。

- `import { useDockAnimation } from "../features/layout/useDockAnimation";` を
  `useLayoutSize` の import の次の行に置く。
- `const [panelOpen, setPanelOpen] = useLayoutFlag("panelOpen");` の次の行に置く。

```tsx
const [dockAnimating, toggleDock] = useDockAnimation();
```

- `.review-body` の `<div>` に属性を 1 つ足す(`style` はそのまま)。

```tsx
<div
  ref={bodyRef}
  className="review-body"
  data-dock-animating={dockAnimating}
  style={{ /* 163 のまま */ } as CSSProperties}
>
```

- 開閉の 4 か所を書き換える。`useLayoutFlag` のセッタは `(open: boolean) => void` なので
  そのまま渡せる。`setOutlinerOpen` / `setPanelOpen` の直接呼び出しはこの 4 か所以外に無い。

```tsx
// 左 DockColumn
onToggle={(open) => toggleDock(setOutlinerOpen, open)}
// 右 DockColumn
onToggle={(open) => toggleDock(setPanelOpen, open)}
// HUD の左 DockExpandButton
onExpand={() => toggleDock(setOutlinerOpen, true)}
// HUD の右 DockExpandButton
onExpand={() => toggleDock(setPanelOpen, true)}
```

### web/src/app/review.css

`.review-body` ルールの**次**に 1 ルール足す。他のルールは変更しない。

```css
/* 開閉トグルの直後だけ列幅を補間する。リサイズのドラッグやキー操作では補間しない。 */
.review-body[data-dock-animating="true"] {
  transition:
    --outliner-width var(--duration-medium) ease,
    --panel-width var(--duration-medium) ease;
}
```

### web/src/app/review-dock.css

`.review-hud .review-dock-expand` の宣言の最後に `animation` を 1 行足し、
ファイル末尾に `@keyframes` を置く。時間の並びは
`<name> <duration> <timing> <delay> <fill-mode>` の順である。

```css
.review-hud .review-dock-expand {
  /* 163 の宣言はそのまま */
  animation: review-dock-expand-in var(--duration-fast) ease var(--duration-medium) backwards;
}

/* 列が閉じ切ってから現れる。開くときは即座に消えるのでアニメーションしない。 */
@keyframes review-dock-expand-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
```

### web/tests/styles-rules.test.ts

`tokenNames` 配列の `"--duration-fast",` の次の行に `"--duration-medium",` を足す。
他は変更しない。

### web/tests/dock-animation.test.ts(新規)

`useDockAnimation` の DOM テストと、`tokens.css` / `review.css` / `review-dock.css` /
`ReviewPage.tsx` のソース検査を置く。CSS のルール本文を取り出すヘルパは
`dock-structure.test.ts` と同じ `ruleBody` を使ってよい(属性セレクタもエスケープされる)。
タイマーは `vi.useFakeTimers()` を使い、`afterEach` で `vi.useRealTimers()` に戻す。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `useDockAnimation` を描画した直後 | `animating` が `false` |
| `toggle(setOpen, false)` を呼ぶ | 同じコミットで `animating` が `true` になり、`setOpen` が `false` を引数にちょうど 1 回呼ばれる |
| `toggle` の後に `DOCK_ANIMATION_RELEASE_MS - 1` ms 進める | `animating` は `true` のまま |
| さらに 1ms 進めて合計 `DOCK_ANIMATION_RELEASE_MS` にする | `animating` が `false` に戻る |
| `toggle` を呼び、100ms 進めてからもう一度 `toggle` を呼ぶ | 1 回目から数えて `DOCK_ANIMATION_RELEASE_MS` 経過した時点では `animating` が `true`(待ちが延長される)。2 回目から `DOCK_ANIMATION_RELEASE_MS` 経過で `false` |
| `toggle` を呼んだ直後にアンマウントする | 保留中のタイマーが片付く(`vi.getTimerCount()` が `0`) |
| 定数 | `DOCK_ANIMATION_MS` が `200`、`DOCK_ANIMATION_RELEASE_MS` が `DOCK_ANIMATION_MS` より大きい |
| `tokens.css` のソース | `:root` ブロック内に `--duration-medium: 200ms` があり、その ms 値が `DOCK_ANIMATION_MS` と一致する |
| `tokens.css` のソース | `@property --outliner-width` と `@property --panel-width` があり、どちらのブロックにも `syntax: "<length>"` と `inherits: true` がある。どちらも `:root` ブロックより後に現れる |
| `tokens.css` のソース | `--panel-width` / `--outliner-width` の rem 既定値(`layout-tokens` が読む形)が残っている |
| `review.css` のソース | `.review-body[data-dock-animating="true"]` のルール本文に `transition` があり、`--outliner-width` と `--panel-width` と `var(--duration-medium)` を含む |
| `review.css` のソース | `.review-body` 本体(属性セレクタ無しのルール)には `transition` が無い |
| `review-dock.css` のソース | `@keyframes review-dock-expand-in` があり、`opacity: 0` と `opacity: 1` を含む |
| `review-dock.css` のソース | `.review-hud .review-dock-expand` のルール本文の `animation` に `review-dock-expand-in`、`var(--duration-medium)`、`backwards` を含む |
| `ReviewPage.tsx` のソース | `useDockAnimation()` と `data-dock-animating={dockAnimating}` を含む |
| `ReviewPage.tsx` のソース | `toggleDock(setOutlinerOpen, open)` / `toggleDock(setPanelOpen, open)` / `toggleDock(setOutlinerOpen, true)` / `toggleDock(setPanelOpen, true)` を各 1 件含み、`onToggle={setOutlinerOpen}` / `onToggle={setPanelOpen}` を含まない |
| 163 の既存テスト | `dock-toggle.test.ts` / `dock-structure.test.ts` / `layout-styles.test.ts` / `layout-tokens.test.ts` はそのまま通る |

## やらないこと

- `DockColumn` / `DockCollapseBar` / `DockExpandButton` の DOM・props の変更、
  `review-icons.tsx` の変更。163 の構造をそのまま使う。
- `useLayoutFlag` / `layout-storage.ts` / `useLayoutSize.ts` / `resize.ts` / `ResizeHandle.tsx` の変更。
  ドラッグ中に transition を止めるのは `data-dock-animating` の有無だけで行い、
  ハンドル側に状態を足さない。
- `prefers-reduced-motion` 向けの個別指定(`base.css` の一括指定に任せる)。`base.css` も変更しない。
- 開くときの HUD 再表示ボタンの退場アニメーション、ドックの中身のフェード、
  `ViewerHud` や `PlaybackTimeline` のアニメーション。
- `--duration-fast` の値の変更、既存 `transition` を持つ他コンポーネント
  (`controls.css` / `outliner.css` / `comments.css`)の変更。
- reads に挙げたテストファイルの変更。

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・CSS で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `layout_Summary.md` に `useDockAnimation.ts` と `tests/dock-animation.test.ts` を追記し、
      `app_Summary.md` の `ReviewPage.tsx` / `review.css` / `review-dock.css` の説明を
      アニメーションを含む内容に直している
- [ ] すべてのファイルが 300 行以内(特に `ReviewPage.tsx` が 283 行前後に収まっている)
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
