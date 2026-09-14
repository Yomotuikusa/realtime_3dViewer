---
id: 074
title: web HUD 右上に「表示」メニューを新設し、メッシュ / ワイヤフレーム / メッシュ+ワイヤの3択で切り替えてルームへ送信する
feature: web
depends_on: [073]
owns: [web/src/features/viewer/DisplayMenu.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/tests/hud-menu.test.ts, web/tests/hud-labels.test.ts, web/tests/viewer-styles.test.ts]
reads: [shared/src/types.ts, shared/src/protocol.ts, web/src/store/display.ts, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/CameraMenu.tsx, web/src/features/objects/ObjectList.tsx, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
メッシュの表示方法をユーザーが切り替えられるようにする。右上の「カメラ」メニューの隣に
「表示」メニューを新設し、3択のボタンでローカルのストアを更新してからルームへ送信する。
これで 072〜074 が揃い、切替がルーム全員の画面に反映される。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 072 で `ClientMessage` に `{ type: "mesh:display"; mode: MeshDisplayMode }` があり、
  サーバは送信元以外へ中継する。したがって自分のストアは自分で更新する
  (`ObjectList` の表示切替と同じ流儀。web/src/features/objects/ObjectList.tsx)
- 072 の `useDisplayStore` に `meshDisplay` / `setMeshDisplay(mode)` がある。web/src/store/display.ts
- 073 で `ViewerCanvas` → `ModelMesh` がストアの値をシーンへ適用する。UI 側は 3D に触らない
- `ViewerHud({ send })` は `send: (msg: ClientMessage) => boolean` を受け取り、
  `AnnotationToolbar` へ渡している。web/src/features/viewer/ViewerHud.tsx:27, :56
- HUD メニューは `HudMenu({ id, open, onToggle, onClose, children })` が汎用の開閉部品で、
  `ViewerHud` が `openMenu: HudMenuId | null` の単一 state で**排他的に**1つだけ開く。
  web/src/features/viewer/ViewerHud.tsx:38, :59-67。`hud-menu.ts` の `HudMenuId` は現在 `"camera"` だけで、
  `HUD_MENU_ORDER` / `HUD_MENU_LABELS` / `HUD_MENU_INITIAL` / `toggleHudMenu` がある
- `.hud-menus` は `display: flex; gap` で、`.hud-menu` は `width: 13.5rem`。`.hud-menu__panel` は
  トグルの直下に絶対配置される。web/src/features/viewer/viewer.css:33-72
- メニュー内のボタンは `className="btn hud-menu__item"`(`btn--quiet` を付けない)で、
  `.hud-menu__section` で区切る。web/src/features/viewer/CameraMenu.tsx
- 押下状態の見た目は `.hud-mode[aria-pressed="true"]` が前例(accent 背景)。viewer.css:27-31
- `web/tests/viewer-styles.test.ts` は `ruleBody(cssText, selector)` で CSS のテキストを、
  `viewerHudText` / `cameraMenuText` / `hudMenuText` でソースを読んで検査する。
  :145-149 は `ViewerHud` が `useState<HudMenuId | null>(HUD_MENU_INITIAL)` を含むことを固定している
- `web/tests/hud-menu.test.ts` は `HUD_MENU_ORDER` を `["camera"]`、`HUD_MENU_LABELS` を
  `{ camera: "カメラ" }` と `toEqual` で固定している。本タスクで更新する
- CSS の規約: 生の色は `tokens.css` 以外で禁止、状態は `aria-*` / `data-*` で表現、
  `!important` / `@import` 禁止。`tests/styles-rules.test.ts` が機械検証する
- web のテストは jsdom で `@testing-library` がない。React コンポーネントのレンダリングテストは書けない

## インターフェイス契約

### 変更 web/src/features/viewer/hud-menu.ts

```ts
export type HudMenuId = "camera" | "display";
/** 右上に並べる順。カメラが左、表示が右 */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera", "display"];
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = { camera: "カメラ", display: "表示" };
/** 変更しない。ページ表示直後はカメラだけ開いている */
export const HUD_MENU_INITIAL: HudMenuId | null = "camera";
/** 変更しない */
export function toggleHudMenu(open: HudMenuId | null, clicked: HudMenuId): HudMenuId | null;
```

### 変更 web/src/features/viewer/hud-labels.ts

`PLACEMENT_ORDER` の直後に足す。

```ts
/** 「表示」メニューの role="group" の aria-label */
export const MESH_DISPLAY_LABEL = "メッシュの表示";
export const MESH_DISPLAY_LABELS: Readonly<Record<MeshDisplayMode, string>> = {
  solid: "メッシュ",
  wireframe: "ワイヤフレーム",
  "solid-wireframe": "メッシュ+ワイヤ",
};
export const MESH_DISPLAY_ORDER: readonly MeshDisplayMode[] = ["solid", "wireframe", "solid-wireframe"];
```

### 新規 web/src/features/viewer/DisplayMenu.tsx

```tsx
export function DisplayMenu({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

描画:
```html
<div class="hud-menu__section hud-display" role="group" aria-label="メッシュの表示">
  <button class="btn hud-menu__item" type="button" aria-pressed="true">メッシュ</button>
  <button class="btn hud-menu__item" type="button" aria-pressed="false">ワイヤフレーム</button>
  <button class="btn hud-menu__item" type="button" aria-pressed="false">メッシュ+ワイヤ</button>
</div>
```

- ボタンは `MESH_DISPLAY_ORDER` の順。`aria-pressed` は `useDisplayStore` の `meshDisplay` と一致するものだけ true
- クリック: 現在値と同じなら何もしない。違えば `setMeshDisplay(mode)` してから
  `send({ type: "mesh:display", mode })`。`send` の戻り値は無視する
  (未接続でもローカルは切り替わる。再接続時の welcome で同期される)
- `onClose` を受け取らない(CameraMenu と同じく、閉じるのは HudMenu の Escape だけ)

### 変更 web/src/features/viewer/ViewerHud.tsx

`.hud-menus` の中で、既存の camera の `<HudMenu>` の直後に足す。

```tsx
<HudMenu
  id="display"
  open={openMenu === "display"}
  onToggle={() => setOpenMenu((open) => toggleHudMenu(open, "display"))}
  onClose={() => setOpenMenu(null)}
>
  <DisplayMenu send={send} />
</HudMenu>
```

### 変更 web/src/features/viewer/viewer.css

`.hud-menu__section + .hud-menu__section` の直後に足す。

```css
.hud-menu__item[aria-pressed="true"] {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.hud-display {
  display: grid;
  gap: var(--space-1);
}
```

## 振る舞い

### hud-menu(web/tests/hud-menu.test.ts の既存テストを更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `HUD_MENU_ORDER` | `["camera", "display"]` |
| `HUD_MENU_LABELS` | `{ camera: "カメラ", display: "表示" }` |
| `HUD_MENU_INITIAL` | `"camera"` |
| `toggleHudMenu(null, "display")` | `"display"` |
| `toggleHudMenu("camera", "display")` | `"display"`(カメラが閉じて表示が開く) |
| `toggleHudMenu("display", "display")` | `null` |
| `toggleHudMenu("display", "camera")` | `"camera"` |

### hud-labels(web/tests/hud-labels.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `MESH_DISPLAY_LABEL` | `"メッシュの表示"` |
| `MESH_DISPLAY_LABELS` | `{ solid: "メッシュ", wireframe: "ワイヤフレーム", "solid-wireframe": "メッシュ+ワイヤ" }` |
| `MESH_DISPLAY_ORDER` | `["solid", "wireframe", "solid-wireframe"]`。先頭が `DEFAULT_MESH_DISPLAY` |
| `MESH_DISPLAY_ORDER` の全要素 | `MESH_DISPLAY_LABELS` にキーがある |

### スタイルとソース検査(web/tests/viewer-styles.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `viewer.css` の `.hud-menu__item[aria-pressed="true"]` | 存在し、`background: var(--color-accent)` と `color: var(--color-on-accent)` を含む |
| `viewer.css` の `.hud-display` | 存在し、`display: grid` を含む |
| `ViewerHud.tsx` | `id="display"` を含み、`<DisplayMenu send={send} />` を含む。`useState<HudMenuId | null>(HUD_MENU_INITIAL)` は従来どおり |
| `DisplayMenu.tsx` | `className="btn hud-menu__item"` を持つ button がちょうど1箇所(map で描く)、`btn--quiet` を含まない、`onClose` を含まない、`aria-label={MESH_DISPLAY_LABEL}` を含む、`type: "mesh:display"` を含む |
| 既存の "keeps all camera menu item buttons quiet-free" | `CameraMenu` だけを対象にしているので変更不要 |

### コンポーネントの振る舞い(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| 「表示」トグルを押す | パネルが開き、「カメラ」パネルは閉じる。「メッシュ」が押下状態 |
| 「ワイヤフレーム」を押す | 自分の 3D ビューが線描画になり、ボタンの押下状態が移る。同室の他の参加者の画面も線描画になる |
| 「メッシュ+ワイヤ」を押す | 陰影付きのモデルに濃いグレーの線が重なる。同室の全員で同じ |
| 押下中のボタンをもう一度押す | 何も起きない(送信もしない) |
| 他の参加者が切り替える | 自分の押下状態と 3D ビューが追従する |
| パネル内で Escape | 「表示」パネルが閉じる。ペン／コメントのモードは解除されない |
| 切替後に入室した参加者 | 同じ表示方法で見え始める |

## やらないこと
- ショートカットキーの割り当て(`keymap.ts` / `ShortcutSettings` の変更)
- 表示方法の localStorage 保存
- 線の色・太さの設定 UI
- `HudMenu.tsx` / `CameraMenu.tsx` / `ObjectList.tsx` の変更
- ストア・dispatch・protocol・`ModelMesh` / `ViewerCanvas` の変更(072 / 073 で済んでいる)
- 「表示」と「カメラ」を同時に開く(既存の排他挙動のまま)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md に DisplayMenu.tsx、hud-menu / hud-labels の追加、ViewerHud と viewer.css の変更を載せている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
