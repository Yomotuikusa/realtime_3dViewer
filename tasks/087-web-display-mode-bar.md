---
id: 087
title: web メッシュ表示モードを「表示」ドロップダウンから HUD 常設のアイコンバーへ作り直す
feature: web
depends_on: []
owns: [web/src/features/viewer/DisplayModeBar.tsx, web/src/features/viewer/display-icons.tsx, web/src/features/viewer/DisplayMenu.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/tests/display-mode-bar.test.ts, web/tests/hud-menu.test.ts, web/tests/viewer-styles.test.ts]
reads: [shared/src/types.ts, shared/src/protocol.ts, web/src/store/display.ts, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/CameraMenu.tsx, web/src/features/timeline/transport-icons.tsx, web/src/features/timeline/PlaybackTimeline.tsx, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, web/tests/hud-labels.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
メッシュの表示方法(メッシュ / ワイヤフレーム / メッシュ+ワイヤ)は現在、HUD 右上の
「表示 ▾」ドロップダウンを開いてから縦に並んだテキストボタンを押す 2 クリック操作である。
他の DCC ツール(Blender・Maya・Modo)はどれもビューポート隅に**常時見えている
横並びのアイコン・セグメントバー**で 1 クリック切替になっている。これに倣い、
「表示」メニューを廃止して既存の[ペン][コメント]バーと同じ体裁のアイコンバーを常設する。

送信・ストア・3D への適用(072〜074)はすべて完成しているため、本タスクは UI の作り直しだけである。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 現在の `DisplayMenu.tsx` が「同値なら何もしない → `setMeshDisplay(mode)` → `send({ type: "mesh:display", mode })`」
  を行っている。web/src/features/viewer/DisplayMenu.tsx。**この選択ロジックはそのまま新コンポーネントへ移す**
- `useDisplayStore` に `meshDisplay` / `setMeshDisplay(mode)` / `reset()` がある。web/src/store/display.ts
- `send` は `(msg: ClientMessage) => boolean`。戻り値は無視する(未接続でもローカルは切り替わり、
  再接続時の welcome で同期される)
- `ViewerHud` は `.hud-menus` の中で `HudMenu` を排他的に 1 つだけ開く。
  `openMenu` の state と `toggleHudMenu` / `HUD_MENU_INITIAL` は**カメラ用として残す**。
  web/src/features/viewer/ViewerHud.tsx:38, :59-76
- `hud-menu.ts` の `HudMenuId` は現在 `"camera" | "display"`。`HUD_MENU_ORDER` は
  `web/tests/hud-menu.test.ts` からしか参照されていない(`ViewerHud` は使っていない)
- `.hud-modes`(ペン/コメントのセグメント枠)は viewer.css:12-20 にあり、
  `display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-overlay);`。
  **このルールと `.hud-mode` は変更しない**
- `.hud-menus` は `display: flex; gap: var(--space-2); margin-left: auto;`。viewer.css:33-37
- `.hud-menu` は `width: 13.5rem`(カメラメニューの幅)。アイコンバーは `.hud-menu` ではないので影響を受けない
- `.hud-menu__item[aria-pressed="true"]`(viewer.css:100-104)の**唯一の使用者は `DisplayMenu` である**。
  `CameraMenu` のボタンに `aria-pressed` は無い。controls.css に汎用の `.btn[aria-pressed="true"]` があるため、
  このルールを消しても他は壊れない
- `.btn` は `min-height: 2rem; padding: var(--space-1) var(--space-3); border: 1px solid var(--color-border);`。
  web/src/styles/controls.css:1-10
- インライン SVG アイコンの前例は web/src/features/timeline/transport-icons.tsx(`viewBox="0 0 16 16"`、
  `aria-hidden="true"`、`focusable="false"`、`fill="currentColor"`)。使う側はボタンに
  `aria-label` と `title` を同じ文言で付ける。web/src/features/timeline/PlaybackTimeline.tsx:65-67
- CSS の規約: 生の色は `tokens.css` 以外で禁止、状態は `aria-*` / `data-*` で表現、
  `!important` / `@import` 禁止。`web/tests/styles-rules.test.ts` が機械検証する。
  **`currentColor` と `fill-opacity` は生の色ではないので使ってよい**
- `web/tests/summary-coverage.test.ts` は「src の全ファイルが最寄りの `_Summary.md` に載っている」
  「`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っている」を検査する。
  消したファイルが Summary に残っていても落ちないが、実態と合わせること
- web のテストは jsdom で `@testing-library` が無い。React コンポーネントのレンダリングテストは書けないが、
  **引数なしの関数コンポーネントを直接呼べば `ReactElement` が返り、`.type` / `.props` は検査できる**
- `web/tests/viewer-styles.test.ts` の `ruleBody(cssText, selector)` はセレクタに**完全一致**する
  ルールの本文を返し、無ければ `null`

## インターフェイス契約

### 新規 web/src/features/viewer/display-icons.tsx

16x16 の正六角形アイソメ立方体。頂点は次の 7 点に固定する(中心 `8 8` が手前の頂点)。

```
上 8 1.5 / 右上 13.6 4.75 / 右下 13.6 11.25 / 下 8 14.5 / 左下 2.4 11.25 / 左上 2.4 4.75 / 手前 8 8
```

```tsx
import type { ReactElement } from "react";
import type { MeshDisplayMode } from "@shared/types";

export const CUBE_VIEW_BOX = "0 0 16 16";
/** 立方体の外形(閉じた六角形) */
export const CUBE_OUTLINE = "M8 1.5 13.6 4.75v6.5L8 14.5 2.4 11.25v-6.5Z";
/** 上面・左面・右面の菱形 */
export const CUBE_TOP = "M8 1.5 13.6 4.75 8 8 2.4 4.75Z";
export const CUBE_LEFT = "M2.4 4.75 8 8v6.5L2.4 11.25Z";
export const CUBE_RIGHT = "M13.6 4.75v6.5L8 14.5V8Z";
/** 手前の頂点から出る3本の稜線(手前だけ。奥の垂直辺は含まない) */
export const CUBE_FRONT_EDGES = "M8 8 2.4 4.75M8 8 13.6 4.75M8 8v6.5";
/** 手前の2本 + 縦の一直線(手前と奥の垂直辺が重なる)。ワイヤフレーム専用 */
export const CUBE_ALL_EDGES = "M8 8 2.4 4.75M8 8 13.6 4.75M8 1.5V14.5";

/** 3面を currentColor で塗り分ける。光源は上なので top を最も明るくする */
function CubeFaces({ top, left, right }: { top: number; left: number; right: number }): ReactElement;

/** 面だけ。線を描かない */
export function SolidIcon(): ReactElement;
/** 線だけ。奥の稜線も見える */
export function WireframeIcon(): ReactElement;
/** 薄い面に手前の稜線を重ねる */
export function SolidWireframeIcon(): ReactElement;

export const MESH_DISPLAY_ICONS: Readonly<Record<MeshDisplayMode, () => ReactElement>> = {
  solid: SolidIcon,
  wireframe: WireframeIcon,
  "solid-wireframe": SolidWireframeIcon,
};
```

3 つのアイコンの中身をそのまま書く。ここから外れる描画をしないこと。

```tsx
function CubeFaces({ top, left, right }: { top: number; left: number; right: number }): ReactElement {
  return (
    <g fill="currentColor">
      <path d={CUBE_TOP} fillOpacity={top} />
      <path d={CUBE_LEFT} fillOpacity={left} />
      <path d={CUBE_RIGHT} fillOpacity={right} />
    </g>
  );
}

export function SolidIcon(): ReactElement {
  return (
    <svg className="hud-display__icon" viewBox={CUBE_VIEW_BOX} aria-hidden="true" focusable="false">
      <CubeFaces top={1} left={0.55} right={0.8} />
    </svg>
  );
}

export function WireframeIcon(): ReactElement {
  return (
    <svg
      className="hud-display__icon"
      viewBox={CUBE_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    >
      <path d={CUBE_OUTLINE} />
      <path d={CUBE_ALL_EDGES} />
    </svg>
  );
}

export function SolidWireframeIcon(): ReactElement {
  return (
    <svg className="hud-display__icon" viewBox={CUBE_VIEW_BOX} aria-hidden="true" focusable="false">
      <CubeFaces top={0.45} left={0.25} right={0.35} />
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
        <path d={CUBE_OUTLINE} />
        <path d={CUBE_FRONT_EDGES} />
      </g>
    </svg>
  );
}
```

- `width` / `height` 属性は付けない(CSS の `.hud-display__icon` で決める)
- 押下中のボタンでは `currentColor` が `--color-on-accent`(白)になる。`fill-opacity` による
  濃淡はそのまま成立するので、押下時用の別アイコンは作らない

### 新規 web/src/features/viewer/DisplayModeBar.tsx

```tsx
export function DisplayModeBar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

描画(`MESH_DISPLAY_ORDER` の順に 1 つの map で描く)。

```html
<div class="hud-display" role="group" aria-label="メッシュの表示">
  <button class="btn hud-display__btn" type="button" aria-pressed="true"  aria-label="メッシュ"        title="メッシュ">…</button>
  <button class="btn hud-display__btn" type="button" aria-pressed="false" aria-label="ワイヤフレーム"  title="ワイヤフレーム">…</button>
  <button class="btn hud-display__btn" type="button" aria-pressed="false" aria-label="メッシュ+ワイヤ" title="メッシュ+ワイヤ">…</button>
</div>
```

- グループの `aria-label` は `MESH_DISPLAY_LABEL`、各ボタンの `aria-label` と `title` は
  `MESH_DISPLAY_LABELS[mode]`。**文言はテキストとして表示せず、アイコンだけを描く**
- 中身は `MESH_DISPLAY_ICONS[mode]` を `const Icon = ...` に取り出して `<Icon />` で描く
- クリック: `meshDisplay === mode` なら何もしない。違えば `setMeshDisplay(mode)` してから
  `send({ type: "mesh:display", mode })`。`send` の戻り値は無視する
- `btn--quiet` は付けない。`onClose` は受け取らない(ドロップダウンではないので閉じる概念が無い)

### 削除 web/src/features/viewer/DisplayMenu.tsx

ファイルごと削除する。中身は `DisplayModeBar.tsx` へ移る。

### 変更 web/src/features/viewer/hud-menu.ts

「表示」メニューが無くなるので、074 以前の状態へ戻す。`HUD_MENU_INITIAL` と `toggleHudMenu` の
実装は**変えない**(カメラ用に使い続ける)。doc コメントの「カメラが左、表示が右」も実態に合わせる。

```ts
export type HudMenuId = "camera";
/** 右上に並べるメニューの順。 */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera"];
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = { camera: "カメラ" };
export const HUD_MENU_INITIAL: HudMenuId | null = "camera";
export function toggleHudMenu(open: HudMenuId | null, clicked: HudMenuId): HudMenuId | null;
```

### 変更 web/src/features/viewer/hud-labels.ts

**値は一切変えない。** `MESH_DISPLAY_LABEL` の doc コメントだけを実態に合わせる。

```ts
/** メッシュ表示モードバーの role="group" の aria-label */
export const MESH_DISPLAY_LABEL = "メッシュの表示";
```

`MESH_DISPLAY_LABELS` / `MESH_DISPLAY_ORDER` は現状のまま(ボタンの `aria-label` / `title` に使う)。
したがって `web/tests/hud-labels.test.ts` は変更しない。

### 変更 web/src/features/viewer/ViewerHud.tsx

- `import { DisplayMenu } from "./DisplayMenu";` を `import { DisplayModeBar } from "./DisplayModeBar";` に差し替える
- `.hud-menus` の中身を次にする(アイコンバーがカメラメニューの**左**)

```tsx
      <div className="hud-menus">
        <DisplayModeBar send={send} />
        <HudMenu
          id="camera"
          open={openMenu === "camera"}
          onToggle={() => setOpenMenu((open) => toggleHudMenu(open, "camera"))}
          onClose={() => setOpenMenu(null)}
        >
          <CameraMenu />
        </HudMenu>
      </div>
```

`id="display"` の `HudMenu` ブロックは削除する。`.hud-modes` の JSX、`openMenu` の state、
その他の JSX は**変更しない**。

### 変更 web/src/features/viewer/viewer.css

1. `.hud-menus`(:33-37)に 1 行だけ足す。高さの違うバーとメニューを上端で揃えるため。

```css
.hud-menus {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-left: auto;
}
```

2. `.hud-menu__item[aria-pressed="true"]` のルールを**削除**する(使用者が消えるため)。

3. 既存の `.hud-display`(`display: grid` のもの)を次の 3 ルールに置き換える。
   枠の宣言は `.hud-modes` と同じ値にする(ペン/コメントのバーと並べて同じ体裁にする)。

```css
.hud-display {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
}

.hud-display__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
}

.hud-display__btn[aria-pressed="true"] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.hud-display__icon {
  width: 1.125rem;
  height: 1.125rem;
}
```

`.hud-modes` / `.hud-mode` / `.hud-mode[aria-pressed="true"]` は**変更しない**。

## 振る舞い

### display-icons(web/tests/display-mode-bar.test.ts に新規追加)

関数コンポーネントを直接呼んで `ReactElement` の `.type` / `.props` を検査する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `CUBE_VIEW_BOX` | `"0 0 16 16"` |
| `CUBE_OUTLINE` | `"Z"` で終わる。`"M"` の出現がちょうど 1 回 |
| `CUBE_TOP` / `CUBE_LEFT` / `CUBE_RIGHT` | どれも `"Z"` で終わる。3 つとも互いに異なる |
| `CUBE_FRONT_EDGES` | `"M"` の出現がちょうど 3 回。`"Z"` を含まない |
| `CUBE_ALL_EDGES` | `"M"` の出現がちょうど 3 回。`"Z"` を含まない。`CUBE_FRONT_EDGES` と異なる |
| `SolidIcon()` | `.type` が `"svg"`。`props.viewBox` が `CUBE_VIEW_BOX`、`props.className` が `"hud-display__icon"`、`props["aria-hidden"]` が `"true"`、`props.focusable` が `"false"` |
| `SolidIcon()` | `props.stroke` と `props.fill` が `undefined`(面は子の `g` が塗る) |
| `WireframeIcon()` | `props.fill` が `"none"`、`props.stroke` が `"currentColor"`、`props.strokeWidth` が `"1"` |
| `SolidWireframeIcon()` | `props.fill` と `props.stroke` が `undefined`(子側で指定する) |
| 3 つのアイコンすべて | `props.width` と `props.height` が `undefined` |
| `MESH_DISPLAY_ICONS` のキー | `MESH_DISPLAY_ORDER` と同じ 3 つ(`Object.keys` を sort して比較) |
| `MESH_DISPLAY_ICONS` の各値 | `typeof` が `"function"`。呼ぶと `.type` が `"svg"` の要素を返す |
| `MESH_DISPLAY_ICONS.solid` | `SolidIcon` と同一参照(`toBe`) |

### ソース検査(同じ web/tests/display-mode-bar.test.ts に追加)

`web/tests/viewer-styles.test.ts` の `readFileSync` + `srcDir` の解決方法をそのまま真似る。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `DisplayModeBar.tsx` | `className="btn hud-display__btn"` がちょうど 1 箇所(map で描く) |
| `DisplayModeBar.tsx` | `btn--quiet` を含まない、`onClose` を含まない |
| `DisplayModeBar.tsx` | `aria-label={MESH_DISPLAY_LABEL}`、`title={MESH_DISPLAY_LABELS[mode]}`、`type: "mesh:display"` を含む |
| `DisplayModeBar.tsx` | `MESH_DISPLAY_LABELS[mode]` をテキストの子として描かない(`>{MESH_DISPLAY_LABELS` を含まない) |
| `ViewerHud.tsx` | `<DisplayModeBar send={send} />` を含む |
| `ViewerHud.tsx` | `id="display"` を含まない、`DisplayMenu` を含まない |
| `features/viewer/DisplayMenu.tsx` | `existsSync` が false(削除されている) |

### hud-menu(web/tests/hud-menu.test.ts の既存テストを更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `HUD_MENU_ORDER` | `["camera"]` |
| `HUD_MENU_LABELS` | `{ camera: "カメラ" }` |
| `HUD_MENU_INITIAL` | `"camera"` |
| `toggleHudMenu(null, "camera")` | `"camera"` |
| `toggleHudMenu("camera", "camera")` | `null` |

`"display"` を渡す `it.each` の行は削除する(型に存在しなくなる)。

### スタイル検査(web/tests/viewer-styles.test.ts を更新)

既存の 4 つの it — "styles the selected display menu item" / "lays out display choices as a grid" /
"connects ViewerHud to the display menu" / "defines display menu buttons from one quiet-free map" —
と `displayMenuText` の読み込み行(:15)を**削除**し、次を追加する。
"keeps all camera menu item buttons quiet-free" と "adds the control shadow to camera menu items" は
`CameraMenu` / `.hud-menu__item` が対象なので**変更しない**。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `.hud-display` と `.hud-modes` の両ルール本文 | `display: inline-flex` / `gap: 2px` / `padding: 2px` / `border-radius: var(--radius-md)` / `background: var(--color-surface)` / `box-shadow: var(--shadow-overlay)` の 6 宣言をどちらも含む |
| `.hud-display__btn` | `width: 2rem`、`padding: 0`、`border: 0` を含む |
| `.hud-display__btn[aria-pressed="true"]` | `background: var(--color-accent)`、`color: var(--color-on-accent)` を含む |
| `.hud-display__icon` | `width` と `height` の宣言を持つ |
| `.hud-menus` | `align-items: flex-start` を含む |
| `.hud-menu__item[aria-pressed="true"]` | `ruleBody` が `null`(ルールが削除されている) |
| `ViewerHud.tsx` | `<DisplayModeBar send={send} />` を含む |

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| ビューを開く | 右上に「立方体アイコン 3 つのバー」と「カメラ ▾」が左右に並び、バーは常に見えている |
| 3 つのアイコン | 左から 塗りつぶし立方体 / 線だけの立方体 / 薄い面に線が乗った立方体。16px でも 3 種の違いが分かる |
| 現在の表示方法のボタン | accent 色で塗られ、アイコンが白く抜ける |
| アイコンにホバー | 「メッシュ」「ワイヤフレーム」「メッシュ+ワイヤ」のツールチップが出る |
| 「ワイヤフレーム」を 1 クリック | メニューを開かずに 3D ビューが線描画になり、押下状態が移る。同室の他の参加者にも反映される |
| 押下中のボタンをもう一度押す | 何も起きない(送信もしない) |
| 他の参加者が切り替える | 自分の押下状態と 3D ビューが追従する |
| 「カメラ ▾」を開閉する | 従来どおり。表示バーは開閉に関係なく出たまま |
| ペン / コメントのバーと見比べる | 枠・角丸・影・押下色が同じ体裁になっている |
| Escape | カメラメニューだけが閉じる。表示バーは何も変わらない |
| キーボード操作 | Tab でバーの 3 ボタンに順に入り、Enter / Space で切り替わる |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- 表示方法は**ルーム共有の単一値**である。送受信・ストア・3D 適用(072〜074)は完成しており、
  本タスクでは `shared/` `server/` `web/src/store/` `web/src/app/` `mesh-display.ts` を一切触らない
- アイコンは**インライン SVG のみ**。画像ファイル・アイコンフォント・外部ライブラリを追加しない
- 3 つのアイコンは同じ頂点定数から描く。図案がずれないよう、面と外形のパス文字列は
  モジュールの定数に切り出して共有する(契約のとおり)
- バーは `.hud-menu` ではない。`HudMenu` でラップしたり `width: 13.5rem` を与えたりしない
- `role="group"` は 1 つだけ(バー全体)。個々のボタンに `role` を付けない。
  `radiogroup` / `role="radio"` にはしない(既存のペン/コメントバーと流儀を揃える)
- 選択の見た目は `aria-pressed` だけで表現する。`data-*` や追加クラスで状態を持たない

## やらないこと
- ショートカットキーの割り当て(`keymap.ts` / `ShortcutSettings` の変更)
- 表示方法の localStorage 保存
- 線の色・太さの設定 UI
- `.hud-modes` / `.hud-mode`(ペン・コメントのバー)の見た目変更やクラス名の共通化リファクタ
- `HudMenu.tsx` / `CameraMenu.tsx` / `LightGizmo.tsx` / `ObjectList.tsx` の変更
- `hud-labels.ts` の**値**の変更(doc コメント 1 行のみ)
- `web/tests/hud-labels.test.ts` の変更
- 4 つ目以降の表示モード追加、テクスチャ表示やレンダープレビュー相当の追加

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している(`DisplayMenu.tsx` は削除)
- [ ] インターフェイス契約どおりのシグネチャ・パス定数・SVG 構造で実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md を更新している。具体的には
      `DisplayMenu.tsx` の行を削除し `DisplayModeBar.tsx` / `display-icons.tsx` を追加、
      `ViewerHud.tsx` と `hud-menu.ts` の説明から「表示メニュー」を消してアイコンバーに直し、
      公開インターフェイス節と テスト節(`display-mode-bar.test.ts` の追加、
      `hud-menu.test.ts` / `viewer-styles.test.ts` の説明更新)を実態に合わせる
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
