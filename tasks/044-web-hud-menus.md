---
id: 044
title: web HUD のカメラ・ライト操作を右上のドロップダウンにまとめる
feature: web
depends_on: [043]
owns: [web/src/features/viewer/hud-menu.ts, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/tests/hud-menu.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [web/src/features/viewer/FocalLengthSlider.tsx, web/src/features/viewer/view-presets.ts, web/src/features/annotation/AnnotationToolbar.tsx, web/src/features/shortcuts/useShortcuts.ts, web/src/features/shortcuts/keymap.ts, web/src/features/shortcuts/shortcut-labels.ts, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/styles-rules.test.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
HUD の左上に視点・ライト・焦点距離の操作が1行で横並びになっていて見づらい。
ペン／コメントは左上に残し、カメラ系とライト系を画面右上の「カメラ」「ライト」
2つのドロップダウンにまとめる。あわせて文言を「視点リセット」「ライトリセット」に統一する。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 現在の `ViewerHud` は `.hud__row` の中に、モード切替(`.hud-modes`)→ ペン道具
  (`mode === "pen"` のときだけ `<AnnotationToolbar>`)→ `.hud-view`(視点を戻す／全体を表示)→
  `.hud-view`(正面／背面／右／左)→ `.hud-light`(ライトを戻す)→ `<FocalLengthSlider />` を
  並べ、その外に `.hud-follow`(追従中バッジ)と `.hud-hint`(操作ヒント)を置いている。
  web/src/features/viewer/ViewerHud.tsx:44-95
- `.hud` は `display: contents` で、`.hud__row` / `.hud-follow` / `.hud-hint` は
  `.review-hud`(`position: absolute; inset: 0; display: flex; align-items: flex-start;
  padding: var(--space-3); pointer-events: none`)の直接の flex 子になる。
  web/src/features/viewer/viewer.css:1-10, web/src/app/review.css:92-101
- `.review-hud` の子孫のうち `.btn` / `[role="toolbar"]` / `[role="group"]` /
  `[role="status"]` / `[role="alert"]` だけが `pointer-events: auto` に戻る。
  **ドロップダウンのパネルは `role="group"` にすること。** web/src/app/review.css:103-105
- `.hud-follow` は `position: absolute; top; left: 50%` の上中央、`.hud-hint` は左下の絶対配置。
  どちらも変更しない。web/src/features/viewer/viewer.css:59-97
- `FocalLengthSlider` は `<div className="hud-focal" role="group" aria-label="焦点距離">` を返す。
  props なし。**このタスクでは変更しない。** web/src/features/viewer/FocalLengthSlider.tsx
- 既定視点は `presetCamera(preset, useCameraStore.getState().selfCamera)` の結果を
  `requestCamera` へ渡す。順序は `VIEW_PRESET_ORDER`(front, back, right, left)。
  web/src/features/viewer/ViewerHud.tsx:63-74, web/src/features/viewer/view-presets.ts
- 「視点を戻す」は `useCameraStore` の `requestReset`、「全体を表示」は `requestFit`、
  「ライトを戻す」は `useLightingStore` の `reset` を呼ぶ。web/src/features/viewer/ViewerHud.tsx:37-40
- ショートカットは `window` の **bubble phase** の `keydown` で処理され、
  `Escape` は既定で `clearMode`(ペン／コメントモード解除)に割り当てられている。
  `isTypingTarget` は `INPUT` / `TEXTAREA` / `SELECT` 上の keydown を無視する。
  web/src/features/shortcuts/useShortcuts.ts:41, web/src/features/shortcuts/keymap.ts:22,137-143
- `RESET_LABEL` / `FIT_LABEL` はショートカット設定画面の `ACTION_LABELS` からも参照される。
  改名すれば設定画面の表示も連動する。web/src/features/shortcuts/shortcut-labels.ts:6-12
- `web/tests/hud-labels.test.ts` は `RESET_LABEL` が `"視点を戻す"`、`LIGHT_RESET_LABEL` が
  `"ライトを戻す"` であることを検査している(27, 34-35 行目)。**このタスクで書き換える。**
- `viewer.css` に生の色(`#rrggbb` / `rgb()`)と `!important` を書いてはならない。
  使える CSS 変数は `web/src/styles/tokens.css` の `:root` にあるものだけ。
  `web/tests/styles-rules.test.ts` が機械的に検査している
- `.btn` / `.btn--quiet` / `.btn[aria-pressed="true"]` は controls.css に定義済み。
  web/src/styles/controls.css:1-44
- web のテストは jsdom 環境で `@testing-library` がない。
  **React コンポーネントのレンダリングテストは書けない。** `document.createElement` で
  DOM を組み立てて純粋関数へ渡すテストは書ける。web/vitest.config.ts
- `hud-labels.ts` は 87 行、`ViewerHud.tsx` は 97 行、`viewer.css` は 97 行、
  `hud-labels.test.ts` は 104 行、`web_Summary.md` は 262 行

## インターフェイス契約

### 新規 web/src/features/viewer/hud-menu.ts

React に依存しない純粋なモジュール。

```ts
export type HudMenuId = "camera" | "light";

/** 右上に並べる順 */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera", "light"];

/** トグルボタンの表示名 */
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = {
  camera: "カメラ",
  light: "ライト",
};

/**
 * トグルボタン押下後に開いているメニュー。
 * 開いているものを押せば閉じる(null)。別のものを押せばそちらに切り替わる。
 */
export function toggleHudMenu(open: HudMenuId | null, clicked: HudMenuId): HudMenuId | null;

/**
 * document の pointerdown 後に開いているメニュー。
 * target が root の内側(root 自身を含む)なら open のまま、外側なら null。
 * root が null、または target が Node でなければ null。
 */
export function menuAfterPointerDown(
  open: HudMenuId | null,
  root: Element | null,
  target: EventTarget | null,
): HudMenuId | null;
```

### 新規 web/src/features/viewer/HudMenu.tsx

表示だけを担当する。開閉 state は持たない。

```tsx
export interface HudMenuProps {
  id: HudMenuId;
  open: boolean;
  /** トグルボタン押下 */
  onToggle: () => void;
  /** パネル内で Escape が押された */
  onClose: () => void;
  children: ReactNode;
}

export function HudMenu({ id, open, onToggle, onClose, children }: HudMenuProps): ReactElement;
```

出力する DOM は次の形にする。`panelId` は `` `hud-menu-${id}` ``。

```tsx
<div className="hud-menu" onKeyDown={handleKeyDown}>
  <button
    className="btn hud-menu__toggle"
    type="button"
    aria-haspopup="true"
    aria-expanded={open}
    aria-controls={panelId}
    onClick={onToggle}
  >
    {HUD_MENU_LABELS[id]}
  </button>
  {open && (
    <div id={panelId} className="hud-menu__panel" role="group" aria-label={HUD_MENU_LABELS[id]}>
      {children}
    </div>
  )}
</div>
```

`handleKeyDown` は `event.key === "Escape"` かつ `open` のときだけ
`event.preventDefault(); event.stopPropagation(); onClose();` を行う。
それ以外のキーは何もしない(伝播も止めない)。

### 変更 web/src/features/viewer/hud-labels.ts

既存の export はすべて残し、値だけ次のように変更する。

```ts
export const RESET_LABEL = "視点リセット";
export const LIGHT_RESET_LABEL = "ライトリセット";
```

`FIT_LABEL`(`"全体を表示"`)、`FOCAL_LENGTH_LABEL`(`"焦点距離"`)、`VIEW_PRESET_LABELS` は変えない。

### 変更 web/src/features/viewer/ViewerHud.tsx

props のシグネチャは変更しない。

```tsx
export function ViewerHud({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

出力する DOM は次の構造にする(購読しているストアの取り方は現状どおり)。

```tsx
<div className="hud">
  <div className="hud__row">
    <div className="hud-modes" role="group" aria-label="操作モード">…現状のまま…</div>
    {mode === "pen" && <AnnotationToolbar send={send} />}
  </div>
  <div className="hud-menus" ref={menusRef}>
    <HudMenu id="camera" open={openMenu === "camera"} onToggle={…} onClose={…}>
      <FocalLengthSlider />
      {VIEW_PRESET_ORDER.map((preset) => (
        <button key={preset} className="btn btn--quiet hud-menu__item" type="button" onClick={…}>
          {VIEW_PRESET_LABELS[preset]}
        </button>
      ))}
      <button className="btn btn--quiet hud-menu__item" type="button" onClick={…}>
        {withShortcut(RESET_LABEL, keymap.viewReset)}
      </button>
      <button className="btn btn--quiet hud-menu__item" type="button" onClick={…}>
        {withShortcut(FIT_LABEL, keymap.viewFit)}
      </button>
    </HudMenu>
    <HudMenu id="light" open={openMenu === "light"} onToggle={…} onClose={…}>
      <button className="btn btn--quiet hud-menu__item" type="button" onClick={…}>
        {LIGHT_RESET_LABEL}
      </button>
    </HudMenu>
  </div>
  {followingUserId !== null && (…現状の .hud-follow のまま…)}
  <p className="hud-hint" …>…現状のまま…</p>
</div>
```

- `openMenu` は `useState<HudMenuId | null>(null)` のローカル state
- `onToggle` は `setOpenMenu((open) => toggleHudMenu(open, id))`
- `onClose` は `setOpenMenu(null)`
- 各 `hud-menu__item` の `onClick` は「対応する action を呼んだあと `setOpenMenu(null)`」
- `useEffect` で `openMenu !== null` のときだけ `document` に `pointerdown` リスナーを登録し、
  `setOpenMenu((open) => menuAfterPointerDown(open, menusRef.current, event.target))` を行う。
  cleanup でリスナーを外す

### 変更 web/src/features/viewer/viewer.css

- `.hud-view` / `.hud-light` の規則は使わなくなるので削除する
- `.hud-focal` / `.hud-focal__range` / `.hud-focal__value` は残す
- 次を追加する(色はすべて tokens.css の変数)

```css
.hud-menus {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.hud-menu {
  position: relative;
}

.hud-menu__toggle {
  box-shadow: var(--shadow-overlay);
}

.hud-menu__toggle[aria-expanded="true"] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.hud-menu__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 1;
  display: grid;
  gap: var(--space-1);
  min-width: 12rem;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
}

.hud-menu__item {
  justify-content: flex-start;
  text-align: left;
}

.hud-menu__panel .hud-focal {
  padding: var(--space-1) 0;
  border: 0;
  box-shadow: none;
}
```

## 振る舞い

### toggleHudMenu

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `toggleHudMenu(null, "camera")` | `"camera"` |
| `toggleHudMenu(null, "light")` | `"light"` |
| `toggleHudMenu("camera", "camera")` | `null` |
| `toggleHudMenu("light", "light")` | `null` |
| `toggleHudMenu("camera", "light")` | `"light"` |
| `toggleHudMenu("light", "camera")` | `"camera"` |

### menuAfterPointerDown

`document.createElement` で `root` とその子 `inner`、無関係な `outside` を作ってテストする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `open` が `null`(target は何でも) | `null` |
| `open` が `"camera"`、target が `root` の子孫 `inner` | `"camera"` |
| `open` が `"camera"`、target が `root` 自身 | `"camera"` |
| `open` が `"light"`、target が `root` の外の `outside` | `null` |
| `open` が `"camera"`、`root` が `null` | `null` |
| `open` が `"camera"`、target が `null` | `null` |
| `open` が `"camera"`、target が Node でないオブジェクト(`{}` を `EventTarget` として渡す) | `null` |
| `HUD_MENU_ORDER` | `["camera", "light"]` |
| `HUD_MENU_LABELS` | `{ camera: "カメラ", light: "ライト" }` |

### hud-labels(変更分)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `RESET_LABEL` | `"視点リセット"` |
| `LIGHT_RESET_LABEL` | `"ライトリセット"` |
| `withShortcut("視点リセット", "Shift+KeyR")` | `"視点リセット (Shift+R)"` |
| `FIT_LABEL` / `FOCAL_LENGTH_LABEL` / `VIEW_PRESET_LABELS` | 変更なし(既存テストが通り続ける) |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| 初期表示 | 左上にペン／コメント、右上に「カメラ」「ライト」ボタン。パネルは閉じている |
| 「カメラ」を押す | ボタンの下に、焦点距離スライダー → 正面 → 背面 → 右 → 左 → 視点リセット (R) → 全体を表示 (F) が縦に並ぶ |
| 「ライト」を押す | ボタンの下に「ライトリセット」だけが出る |
| カメラを開いた状態で「ライト」を押す | カメラが閉じてライトが開く(同時に開くのは1つ) |
| 開いているボタンをもう一度押す | 閉じる |
| 「正面」を押す | 正面視点へ移動し、パネルが閉じる |
| 「視点リセット」を押す | 位置・注視点・焦点距離が初期値へ戻り、パネルが閉じる |
| 「全体を表示」を押す | fit が走り、パネルが閉じる |
| 「ライトリセット」を押す | ライトが既定方向へ戻り、パネルが閉じる |
| 焦点距離スライダーをドラッグする | 焦点距離が変わる。パネルは閉じない |
| パネルの外(ビューア含む)を pointerdown する | パネルが閉じる。ビューア上ならそのままカメラ操作やペン描画が始まる |
| パネル内でフォーカスがある状態で Esc | パネルだけ閉じる。ペン／コメントモードは解除されない |
| パネルが閉じている状態で Esc | 既存どおり `clearMode` が動く |
| パネルが開いている状態で R / F キー | 既存どおり視点リセット／全体を表示が動く。パネルの開閉状態は変わらない |
| ペンモードでペン道具が左上に出ている | 右上のボタンと重ならず、道具が長くても `.hud__row` が折り返す |
| 追従中バッジ | 上中央のまま |
| 操作ヒント | 左下のまま |
| ショートカット設定画面の項目名 | 「視点リセット」「全体を表示」と表示される |
| 入室前(JoinDialog 表示中) | backdrop が z-index 2 で覆うので操作できない(現状どおり) |
| レビュー画面を離れて戻る | パネルは閉じている |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `menuAfterPointerDown` は `root !== null && target instanceof Node && root.contains(target)`
  が真なら `open` を返し、それ以外は `null` を返す。`open === null` なら早期に `null`
- pointerdown リスナーは **`document`** に登録する(`window` ではない)。`.review-hud` の
  外側、たとえばサイドパネルやヘッダを押しても閉じるようにするため
- リスナーは `openMenu !== null` のときだけ登録する。閉じているときに毎回 `setState` を
  呼ばない
- Escape の処理は `HudMenu` の root `div` の React `onKeyDown` で行う。React の合成イベントは
  `document` で処理されるため `window` の bubble より先に届き、`stopPropagation()` で
  `useShortcuts` の `clearMode` を止められる。`window` に独自の keydown リスナーを足さない
- `HudMenu` の `aria-controls` は `open` に関わらず常に付ける。パネルは `open` のときだけ描画する
  (`hidden` 属性や CSS での非表示にしない)
- `hud-menu__item` は `.btn .btn--quiet` に加えて付ける。`.btn` の `display: inline-flex` を
  前提に `justify-content: flex-start` で左寄せにする
- `withShortcut` による `(R)` `(F)` の併記は残す。既定視点(正面など)にはショートカットがないので
  併記しない
- 「視点リセット」「ライトリセット」の文言は `hud-labels.ts` の定数だけを変える。
  `shortcut-labels.ts` は `RESET_LABEL` を参照しているので変更不要
- `.hud__row` の `flex-wrap: wrap` / `gap` は変えない。`.hud-menus` は `margin-left: auto`
  で右端に寄せる(`.review-hud` は `display: flex` なので効く)
- `viewer.css` から `.hud-view` / `.hud-light` を消したあと、`src/` 内にこれらのクラスの
  参照が残っていないことを `grep` で確認する

## やらないこと
- `FocalLengthSlider.tsx` / `review.css` / `controls.css` / `tokens.css` を変更しない
- ペン道具(`AnnotationToolbar`)とモード切替(`.hud-modes`)の見た目・挙動を変えない
- 追従中バッジ・操作ヒントの位置と文言を変えない
- メニューの開閉状態を zustand ストアや localStorage に持たない(ローカル `useState` のみ)
- メニューにキーボードショートカットを割り当てない(`ShortcutAction` を増やさない)
- パネル内の矢印キーによるフォーカス移動(roving tabindex)を実装しない
- `role="menu"` / `role="menuitem"` を使わない(スライダーが混在するため `role="group"` にする)
- ヘッダの「ショートカット設定」ボタンを移動しない
- `store/` 配下、`CameraRig.tsx`、`SceneLights.tsx`、`shared/`、`server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`hud-menu.test.ts` を新規に追加し、`hud-labels.test.ts` の文言検査を
      「視点リセット」「ライトリセット」に更新する)
- [ ] `web/tests/styles-rules.test.ts` が通る(`viewer.css` に生の色と `!important` がない)
- [ ] `src/` 内に `.hud-view` / `.hud-light` の参照が残っていない
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`hud-menu.ts` / `HudMenu.tsx` の追加、`ViewerHud` の右上メニュー構成、
      文言変更、Escape がメニューを閉じるだけでモード解除しないこと)
- [ ] すべてのファイルが300行以内(`web_Summary.md` を含む)
- [ ] `npm run typecheck && npm run test:web` が成功する
