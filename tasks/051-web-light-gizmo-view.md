---
id: 051
title: web ライトギズモの立方体を 45° に向け、マーカー軌道が収まるまで視野と描画領域を広げる
feature: web
depends_on: [050]
owns: [web/src/features/viewer/light-gizmo.ts, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/viewer.css, web/tests/light-gizmo.test.ts, web/tests/viewer-styles.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/lighting.ts, web/src/store/lighting.ts, web/tests/summary-coverage.test.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
右下のライトギズモは立方体を正面から見ているため面が1つしか見えず、ライトマーカーの軌道
(半径 2.2)が固定カメラの視野からはみ出して見切れる。立方体を Y 軸まわりに 45° 回して
上面と2側面が見える向きにし、カメラを引いて全角度のマーカーが視野に収まるようにする。
カメラを引いたぶん立方体が小さく見えるので、Canvas の一辺を 112px から 160px に広げる。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- ギズモの定数は `light-gizmo.ts`: `GIZMO_SIZE_PX = 112`、`GIZMO_BOX_SIZE = 1.4`、`GIZMO_ORBIT_RADIUS = 2.2`、
  `GIZMO_MARKER_RADIUS = 0.16`、`GIZMO_CAMERA_POSITION = [0, 2.4, 4.6]`、`GIZMO_CAMERA_FOV = 40`。
  web/src/features/viewer/light-gizmo.ts:4-13。`tests/light-gizmo.test.ts:19-27` がこれらを直書きで assert する
- `LightGizmo.tsx` の `GizmoScene` は `<mesh>`(回転なし)に `boxGeometry` を置き、`GizmoCamera` が
  `camera.lookAt(0, 0, 0)` する。`<Canvas camera={{ position: GIZMO_CAMERA_POSITION, fov: GIZMO_CAMERA_FOV }}>`。
  web/src/features/viewer/LightGizmo.tsx:18-49, 105-112
- マーカー位置は `gizmoMarkerPosition(angles) = lightPosition(angles, GIZMO_ORBIT_RADIUS)`。yaw は [-π, π)、
  pitch は ±`MAX_LIGHT_PITCH`(85°)。web/src/features/viewer/light-gizmo.ts:17-19, web/src/features/viewer/lighting.ts:12, 48-56
- 現在のカメラでは、マーカー球の縁を投影した NDC 座標の絶対値が最大 1.39 になり(1 を超えると画面外)、
  見切れる。位置 `[0, 3.5, 6.7]` / fov 40 では最大 0.90 に収まる(計画時に three の `PerspectiveCamera.project` で
  yaw 5° 刻み × pitch {-85°, -42.5°, 0, 42.5°, 85°} を総当たりして確認済み)
- `viewer.css` の `.light-gizmo` は `width: 112px; height: 112px`、`.hud-hint` は
  `right: calc(112px + var(--space-3) * 2)` でギズモを避けている。web/src/features/viewer/viewer.css:144-164
  (task 049 / 050 の追記で行番号は 20 行前後ずれる)
- `tests/viewer-styles.test.ts` は `.light-gizmo` に `width` / `height` の宣言があることを検査している(値は見ていない)。
  `ruleBody(text, selector)` でセレクタ完全一致のルール本文を取り出せる。web/tests/viewer-styles.test.ts:15-24
- `three`(0.186)は依存に含まれ、vitest の jsdom 環境で `PerspectiveCamera` / `Vector3` の数学は WebGL なしで動く
- TSX 内の three.js マテリアル色は生色禁止の対象外。CSS には生の色値を書けない

## インターフェイス契約

```ts
// web/src/features/viewer/light-gizmo.ts(定数の変更・追加。関数は変えない)
/** ギズモ Canvas の一辺(px)。CSS の幅と合わせる */
export const GIZMO_SIZE_PX = 160;
/** 立方体の Y 軸まわりの回転(ラジアン)。辺を手前に向けて上面と2側面を見せる */
export const GIZMO_BOX_ROTATION_Y = Math.PI / 4;
/** ギズモを見る固定カメラの位置と画角(度)。マーカー軌道が全角度で収まる距離 */
export const GIZMO_CAMERA_POSITION: Vec3 = [0, 3.5, 6.7];
export const GIZMO_CAMERA_FOV = 40;
```

```tsx
// web/src/features/viewer/LightGizmo.tsx: 立方体メッシュだけ変更する
<mesh rotation={[0, GIZMO_BOX_ROTATION_Y, 0]}>
  <boxGeometry args={[GIZMO_BOX_SIZE, GIZMO_BOX_SIZE, GIZMO_BOX_SIZE]} />
  <meshStandardMaterial color="#d0d5dd" />
</mesh>
```

```css
/* web/src/features/viewer/viewer.css: 値だけ変更する */
.light-gizmo { width: 160px; height: 160px; }              /* 他の宣言は据え置く */
.hud-hint { right: calc(160px + var(--space-3) * 2); }     /* 他の宣言は据え置く */
```

```ts
// web/tests/light-gizmo.test.ts に追加するヘルパ(テストファイル内)
/**
 * position に置いて原点を向く fov=GIZMO_CAMERA_FOV・アスペクト 1 のカメラで、
 * yaw を -180°〜175° の 5° 刻み、pitch を {-MAX, -MAX/2, 0, MAX/2, MAX}(MAX = MAX_LIGHT_PITCH)
 * で総当たりし、マーカー中心からカメラの右・左・上・下へ GIZMO_MARKER_RADIUS ずらした点を
 * Vector3.project した NDC の |x|, |y| の最大値を返す。
 */
function worstMarkerNdc(position: Vec3): number;
```

## 振る舞い
`tests/light-gizmo.test.ts` / `tests/viewer-styles.test.ts` の各 it がこの表の1行に対応する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `GIZMO_SIZE_PX`、`GIZMO_BOX_ROTATION_Y`、`GIZMO_CAMERA_POSITION`、`GIZMO_CAMERA_FOV` | `160`、`Math.PI / 4`、`[0, 3.5, 6.7]`、`40`(既存の定数 it を更新する) |
| `GIZMO_BOX_SIZE`、`GIZMO_ORBIT_RADIUS`、`GIZMO_MARKER_RADIUS`、`GIZMO_KEY_STEP_PX` | 従来どおり `1.4`、`2.2`、`0.16`、`20` |
| `worstMarkerNdc(GIZMO_CAMERA_POSITION)` | `0.95` 以下(全角度でマーカー球が画面内に収まる) |
| `worstMarkerNdc([0, 2.4, 4.6])`(旧カメラ) | `1` より大きい(このテストが見切れを検出できることの確認) |
| `gizmoMarkerPosition`、`gizmoDragStep`、`gizmoKeyDeltaX`、`yawDegrees`、`yawText` | 従来どおり(既存 it をそのまま残す) |
| LightGizmo.tsx の全文 | `rotation={[0, GIZMO_BOX_ROTATION_Y, 0]}` を含む |
| `ruleBody(viewer.css, ".light-gizmo")` | `width: ${GIZMO_SIZE_PX}px` と `height: ${GIZMO_SIZE_PX}px` を含む(`light-gizmo.ts` から定数を import して比較する) |
| `ruleBody(viewer.css, ".hud-hint")` | `right` 宣言に `${GIZMO_SIZE_PX}px` を含む |
| 画面上のギズモ | 立方体は辺を手前に向け、上面と左右2面が見える。マーカーが軌道のどこにあっても Canvas の縁で切れない |
| ドラッグ・矢印キー・リセット | 従来どおり(操作系は変更しない) |

## やらないこと
- カメラの向き(`lookAt(0, 0, 0)`)や方位は変えない。回すのは立方体メッシュだけで、マーカーの世界座標と
  主ライトの対応は変えない
- `GIZMO_ORBIT_RADIUS`、`GIZMO_BOX_SIZE`、`GIZMO_MARKER_RADIUS`、`GIZMO_KEY_STEP_PX`、`GIZMO_CAMERA_FOV` の値は変えない
- ライト・マテリアルの色や強度、`ambientLight` / `directionalLight` の構成は変えない
- `.light-gizmo` の `position` / `right` / `bottom` / `border-radius`、`.light-gizmo__stage` / `__reset` は変更しない
- `.hud-hint` の `right` 以外の宣言は変更しない
- `lighting.ts`、`store/lighting.ts`、`SceneLights.tsx` は変更しない
- ギズモの寸法を CSS 変数化しない(px 直書きのまま、テストで TS 定数と一致を検査する)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md の「ファイル一覧と役割」(LightGizmo.tsx / light-gizmo.ts / viewer.css)、「公開インターフェイス」(light-gizmo.ts に `GIZMO_BOX_ROTATION_Y`)、「テスト」(tests/light-gizmo.test.ts / tests/viewer-styles.test.ts)が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
