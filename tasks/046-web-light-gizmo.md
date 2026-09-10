---
id: 046
title: web ライトの向きを右下の立方体ギズモで操作する
feature: web
depends_on: [045]
owns: [web/src/features/viewer/light-gizmo.ts, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/tests/light-gizmo.test.ts, web/tests/hud-menu.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [web/src/features/viewer/lighting.ts, web/src/store/lighting.ts, web/src/features/viewer/SceneLights.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/viewer-pointer.ts, web/src/app/review.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/styles-rules.test.ts, web/tests/lighting.test.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
ライトの向きは現在 Shift+右ドラッグでしか変えられず、右上「ライト」メニューには
「ライトリセット」しかない。ビューア右下に小さな立方体を置いた 3D ギズモを常設し、
立方体の陰影とライトマーカーで現在の向きを見せ、左右ドラッグで回せるようにする。
リセットは小さなアイコンボタンに任せ、「ライト」ドロップダウンは廃止する。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- ライトの向きは `useLightingStore` の `angles: LightAngles`(`yaw` は [-π, π)、`pitch` は
  ±MAX_LIGHT_PITCH)で、`rotate(deltaX, deltaY)` が `rotateLight` で px 量を角度に変える
  (`LIGHT_ROTATE_SPEED = 0.008` rad/px。deltaX→yaw、deltaY→pitch)。`reset()` で既定値へ戻る。
  web/src/store/lighting.ts:8-30, web/src/features/viewer/lighting.ts:11-46
- `lightPosition(angles, distance)` は yaw=0 で +Z、yaw=π/2 で +X に向かう球面座標を返す。
  web/src/features/viewer/lighting.ts:48-56
- メインシーンは `SceneLights` が `ambientLight` + 主 `directionalLight`(`lightPosition`)+
  補助ライトを置く。web/src/features/viewer/SceneLights.tsx
- メインの `<Canvas>` は `@react-three/fiber` の `Canvas` を `style` 指定で置いている。
  web/src/features/viewer/ViewerCanvas.tsx:13-16。依存追加なしで2枚目の `Canvas` が使える
- Shift+右ドラッグによるライト回転は `viewer-pointer.ts` が `deps.onLightRotate` 経由で
  `rotate` を呼ぶ。本タスクでは**そのまま残す**。web/src/features/viewer/viewer-pointer.ts:53-66
- task 045 完了時点の `ViewerHud.tsx` は、`.hud-menus` に `<HudMenu id="camera">` と
  `<HudMenu id="light">`(中身は `LIGHT_RESET_LABEL` のボタン1つ)を並べ、
  `openMenu: HudMenuId | null` の state で開閉している
- `hud-menu.ts` の `HudMenuId = "camera" | "light"`、`HUD_MENU_ORDER = ["camera", "light"]`、
  `HUD_MENU_LABELS = { camera: "カメラ", light: "ライト" }`。`tests/hud-menu.test.ts:11-12` が
  この2値を直書きで assert している。web/src/features/viewer/hud-menu.ts:1-10
- `HudMenu.tsx` は `HUD_MENU_LABELS[id]` を参照するだけで、`HudMenuId` が1値になっても変更不要
- `.hud` は `display: contents` で、`.hud-follow`(上中央)と `.hud-hint`(左下、`max-width: 40rem`)
  は `.review-hud` に対する `position: absolute` で置かれている。web/src/features/viewer/viewer.css:101-134
- `.review-hud` は `position: absolute; inset: 0; pointer-events: none` で、子孫のうち `.btn` /
  `[role="toolbar"]` / `[role="group"]` / `[role="status"]` / `[role="alert"]` だけが
  `pointer-events: auto` になる(子孫に継承される)。web/src/app/review.css:92-105
- 入室前は `.review-backdrop`(z-index 2)が `.review-hud`(z-index 1)を覆うので、ギズモの
  表示可否をここで制御する必要はない。web/src/app/review.css:108-115
- CSS に生の色値を書けない(`tests/styles-rules.test.ts:106-111`)。TSX 内の three.js マテリアル色は
  対象外(`ViewerCanvas.tsx:17` に先例あり)。`!important` / `@import` も禁止
- `hud-labels.ts` の `LIGHT_RESET_LABEL = "ライトリセット"` は残し、リセットボタンの `aria-label` に使う。
  `hint()` の「Shift+右ドラッグでライトの向き」の文言は変えない
- `web_Summary.md` は 300 行の上限に近い(task 045 後で 275 行前後)

## インターフェイス契約

```ts
// web/src/features/viewer/light-gizmo.ts(新規・React に依存しない純粋関数と定数)
import type { Vec3 } from "@shared/types";
import type { LightAngles } from "./lighting";

/** ギズモ Canvas の一辺(px)。CSS の幅と合わせる */
export const GIZMO_SIZE_PX = 112;
/** 立方体の一辺 */
export const GIZMO_BOX_SIZE = 1.4;
/** ライトマーカーが回る軌道半径と、マーカー球の半径 */
export const GIZMO_ORBIT_RADIUS = 2.2;
export const GIZMO_MARKER_RADIUS = 0.16;
/** ギズモを見る固定カメラの位置と画角(度)。メインカメラには連動しない */
export const GIZMO_CAMERA_POSITION: Vec3 = [0, 2.4, 4.6];
export const GIZMO_CAMERA_FOV = 40;
/** 矢印キー1回ぶんの水平移動量(px 相当)。rotate(deltaX, 0) に渡す */
export const GIZMO_KEY_STEP_PX = 20;

/** ライトマーカーのワールド座標。lightPosition(angles, GIZMO_ORBIT_RADIUS) と同じ */
export function gizmoMarkerPosition(angles: LightAngles): Vec3;

/** ドラッグ中の pointer と直前の X 座標 */
export interface GizmoDrag {
  pointerId: number;
  clientX: number;
}

/**
 * pointermove 1回ぶんの処理。drag が null、または pointerId が一致しなければ null。
 * 一致すれば rotate へ渡す deltaX(= clientX - drag.clientX)と clientX を更新した drag を返す。
 * 上下方向は扱わない(yaw のみ)。
 */
export function gizmoDragStep(
  drag: GizmoDrag | null,
  pointerId: number,
  clientX: number,
): { deltaX: number; drag: GizmoDrag } | null;

/** キーに対応する水平移動量。ArrowLeft → -GIZMO_KEY_STEP_PX、ArrowRight → +GIZMO_KEY_STEP_PX、他は null */
export function gizmoKeyDeltaX(key: string): number | null;

/** yaw(ラジアン)を四捨五入した度数。aria-valuenow 用。範囲は [-180, 180] */
export function yawDegrees(yaw: number): number;

/** aria-valuetext 用。`${yawDegrees(yaw)}°` */
export function yawText(yaw: number): string;
```

```ts
// web/src/features/viewer/hud-menu.ts(変更)
export type HudMenuId = "camera";
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera"];
export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = { camera: "カメラ" };
// toggleHudMenu / menuAfterPointerDown のシグネチャは変えない
```

```ts
// web/src/features/viewer/hud-labels.ts(追記)
/** ギズモの role="slider" の aria-label */
export const LIGHT_DIRECTION_LABEL = "ライトの向き";
```

```tsx
// web/src/features/viewer/LightGizmo.tsx(新規。props なし)
/**
 * 右下に常設するライト操作ギズモ。生成する DOM:
 * <div class="light-gizmo" role="group" aria-label={LIGHT_DIRECTION_LABEL}>
 *   <div class="light-gizmo__stage" role="slider" tabIndex={0}
 *        aria-label={LIGHT_DIRECTION_LABEL} aria-valuemin={-180} aria-valuemax={180}
 *        aria-valuenow={yawDegrees(yaw)} aria-valuetext={yawText(yaw)}
 *        onPointerDown/onPointerMove/onPointerUp/onPointerCancel/onKeyDown>
 *     <Canvas ...>  ← @react-three/fiber。立方体・ライト・マーカー
 *   </div>
 *   <button class="btn btn--quiet light-gizmo__reset" type="button"
 *           aria-label={LIGHT_RESET_LABEL} title={LIGHT_RESET_LABEL}>
 *     <svg aria-hidden="true">…反時計回りの矢印(↺)…</svg>
 *   </button>
 * </div>
 */
export function LightGizmo(): ReactElement;
```

`ViewerHud.tsx`: `<HudMenu id="light">` を削除し、`.hud-menus` の外(`.hud-follow` と同じ階層)に
`<LightGizmo />` を置く。`resetLighting` / `LIGHT_RESET_LABEL` の import は `ViewerHud` から消える。
`ViewerHud({ send })` のシグネチャは変えない。

### Canvas の中身(LightGizmo.tsx)
- `<Canvas camera={{ position: GIZMO_CAMERA_POSITION, fov: GIZMO_CAMERA_FOV }} gl={{ alpha: true }} frameloop="demand" style={{ width: "100%", height: "100%" }}>`
  (`frameloop="demand"` は推奨。ストアの角度変更で再描画されないことが分かった場合は既定の
  frameloop に戻してよい。要件は「角度が変わったら絵が追従する」こと)
- カメラは `lookAt` 原点。OrbitControls などの操作は付けない
- `<ambientLight intensity={0.35} />`
- `<directionalLight position={gizmoMarkerPosition(angles)} intensity={2.0} />`
- 立方体: `<mesh><boxGeometry args={[GIZMO_BOX_SIZE, GIZMO_BOX_SIZE, GIZMO_BOX_SIZE]} /><meshStandardMaterial color="#d0d5dd" /></mesh>`
- マーカー: `<mesh position={gizmoMarkerPosition(angles)}><sphereGeometry args={[GIZMO_MARKER_RADIUS, 16, 16]} /><meshBasicMaterial color="#f59e0b" /></mesh>`
  (`meshBasicMaterial` なので陰影を受けず常に同じ色。深度テストは既定のままにし、立方体の裏へ回ったら隠れる)
- 背景は透明(`<color attach="background">` を置かない)。下地の色は CSS の `.light-gizmo` に持たせる

### pointer / キー処理(LightGizmo.tsx。ステージ div の React ハンドラで行う)
- `onPointerDown`: `button === 0` のときだけ `drag = { pointerId, clientX }` を `useRef` に保持し、
  `currentTarget.setPointerCapture(pointerId)`。他のボタンは無視
- `onPointerMove`: `gizmoDragStep(drag, pointerId, clientX)` が非 null なら `rotate(deltaX, 0)` を呼び drag を更新
- `onPointerUp` / `onPointerCancel`: pointerId が一致すれば capture を解放して drag を null に
- `onKeyDown`: `gizmoKeyDeltaX(event.key)` が非 null なら `preventDefault()` して `rotate(deltaX, 0)`
- リセットボタン `onClick`: `useLightingStore.getState().reset()`(またはセレクタで取った `reset`)

### CSS の要点(viewer.css)
- `.light-gizmo`: `position: absolute; right: var(--space-3); bottom: var(--space-3); width: 112px; height: 112px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface);
  box-shadow: var(--shadow-overlay); overflow: hidden`
- `.light-gizmo__stage`: `width: 100%; height: 100%; cursor: ew-resize; touch-action: none`。
  `:focus-visible` で `outline: 2px solid var(--focus-ring-color); outline-offset: -2px`
- `.light-gizmo__reset`: `position: absolute; right: var(--space-1); bottom: var(--space-1); min-height: 0;
  width: 1.5rem; height: 1.5rem; padding: 0; display: grid; place-items: center`。svg は 14px 角、`currentColor` で描く
- `.hud-hint` に `right: calc(112px + var(--space-3) * 2)` を足し、左下のヒントがギズモの下に潜らないようにする
  (`max-width: 40rem` は残す)
- `.hud-menu__panel` など task 045 が作った区切り線・十字のスタイルは変更しない

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `gizmoMarkerPosition({ yaw: 0, pitch: 0 })` | `[0, 0, GIZMO_ORBIT_RADIUS]`(各成分 toBeCloseTo) |
| `gizmoMarkerPosition({ yaw: π/2, pitch: 0 })` | `[GIZMO_ORBIT_RADIUS, 0, 0]` |
| `gizmoMarkerPosition({ yaw: π/4, pitch: π/4 })` | `lightPosition(angles, GIZMO_ORBIT_RADIUS)` と一致 |
| `gizmoDragStep(null, 1, 100)` | `null` |
| `gizmoDragStep({ pointerId: 1, clientX: 100 }, 2, 130)` | `null`(別 pointer) |
| `gizmoDragStep({ pointerId: 1, clientX: 100 }, 1, 130)` | `{ deltaX: 30, drag: { pointerId: 1, clientX: 130 } }` |
| `gizmoDragStep({ pointerId: 1, clientX: 100 }, 1, 70)` | `{ deltaX: -30, drag: { pointerId: 1, clientX: 70 } }` |
| `gizmoKeyDeltaX("ArrowLeft")` / `("ArrowRight")` | `-GIZMO_KEY_STEP_PX` / `GIZMO_KEY_STEP_PX` |
| `gizmoKeyDeltaX("ArrowUp")`, `("a")`, `("")` | `null` |
| `yawDegrees(0)`, `yawDegrees(π/2)`, `yawDegrees(-π)` | `0`, `90`, `-180` |
| `yawDegrees(π/4)` | `45`(`0.7853…` rad → 四捨五入) |
| `yawText(π/2)` | `"90°"` |
| `HUD_MENU_ORDER` / `HUD_MENU_LABELS` | `["camera"]` / `{ camera: "カメラ" }` |
| `toggleHudMenu(null, "camera")` / `("camera", "camera")` | `"camera"` / `null`(既存の挙動を維持) |
| `LIGHT_DIRECTION_LABEL`、`LIGHT_RESET_LABEL` | `"ライトの向き"`、`"ライトリセット"` |
| 画面表示 | 右上のトグルは「カメラ」だけ。ビューア右下に 112px 角のギズモが常に表示される |
| ギズモ内の左ボタンドラッグで右へ 100px | `rotate(100, 0)` 相当に yaw が増え、マーカーと立方体の陰影が連動して回る。pitch は変わらない |
| ギズモ内で上下にだけドラッグ | 何も変わらない |
| ギズモにフォーカスして `→` を押す | `rotate(GIZMO_KEY_STEP_PX, 0)` 相当に yaw が増える。`←` は減る。ページはスクロールしない |
| Shift+右ドラッグでメインビューア上で pitch を変える | ギズモのマーカーが上下に動き、立方体の陰影も追従する(ギズモから pitch は変えられないが表示はする) |
| マーカーが立方体の裏側(カメラから見て奥)へ回る | 立方体に隠れて見えなくなる(深度テスト) |
| リセットアイコンを押す | `reset()` が呼ばれ `DEFAULT_LIGHT_ANGLES` に戻る。ギズモは閉じたり消えたりしない |
| `aria-valuenow` | 現在の yaw を `yawDegrees` で度にした値。ドラッグやキーで更新される |
| 左下の操作ヒントが長い | ギズモの左端より手前で折り返し、ギズモに重ならない |
| `npm run test:web` の `styles-rules` | CSS に生の色値がなく通る |

## やらないこと
- `lighting.ts`・`store/lighting.ts`・`SceneLights.tsx` は変更しない(`rotate(deltaX, 0)` と `reset()` をそのまま使う)
- `viewer-pointer.ts` の Shift+右ドラッグによるライト回転は削除も変更もしない
- ギズモから pitch を変える操作(上下ドラッグ、↑↓キー)は付けない
- ギズモのカメラをメインカメラの向きに連動させない
- `HudMenu.tsx` は変更しない(`HudMenuId` が1値になっても動く)
- task 045 が作った `CameraMenu.tsx` / `FocalLengthSlider.tsx` / `view-presets.ts` は変更しない
- 新しい依存を追加しない(`@react-three/fiber` / `three` の既存依存だけで描く)
- `tokens.css` に新トークンを足さない
- `web_Summary.md` の追記は差分最小に留める(`light-gizmo.ts` / `LightGizmo.tsx` を「ファイル一覧と役割」と
  「公開インターフェイス」に1行ずつ足し、`ViewerHud.tsx` / `hud-menu.ts` / `hud-labels.ts` / `viewer.css` の
  既存行を書き換え、「ライト」メニューに関する記述は削除する。300 行を超えない)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の純粋関数・定数の行に対応するテストが `tests/light-gizmo.test.ts`(新規)/
      `tests/hud-menu.test.ts` / `tests/hud-labels.test.ts` にあり、通る
- [ ] web_Summary.md が更新されている(300 行以内)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
