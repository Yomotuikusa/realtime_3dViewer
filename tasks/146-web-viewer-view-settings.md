---
id: 146
title: web ワイヤー重ね描きの不透明度と dolly / ライト回転の感度を表示設定から取る
feature: viewer
depends_on: [142, 144]
owns: [web/src/features/viewer/mesh-display.ts, web/src/features/viewer/useModelScene.ts, web/src/features/viewer/camera-input.ts, web/src/features/viewer/viewer-pointer.ts, web/src/features/viewer/CameraRig.tsx, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/mesh-display.test.ts, web/tests/camera-input.test.ts, web/tests/viewer-pointer.test.ts, web/tests/light-gizmo.test.ts]
reads: [web/src/store/view-settings.ts, web/src/features/view-settings/view-settings.ts, web/src/features/view-settings/view-settings_Summary.md, web/src/store/lighting.ts, web/src/features/viewer/lighting.ts, web/src/features/viewer/light-gizmo.ts, web/src/features/viewer/polygon-edge-material.ts, web/tests/camera-animation.test.ts, web/tests/model-scene.test.ts, web/tests/mesh-display-color.test.ts, web/tests/polygon-edge-display.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
144 が定義した `wireframeOverlayOpacity` / `dollySensitivity` / `lightRotateSensitivity` をビューア側の消費箇所へ結線する。
感度は既存の係数に掛ける倍率で、ポインタ操作にだけ効かせる(矢印キーの刻みは変えない)。

## 前提
- 144 のストア: `useViewSettingsStore`、`selectViewSetting(key)`、`useViewSettingsStore.getState().settings`。既定値は
  `wireframeOverlayOpacity` 0.6、`dollySensitivity` 1、`lightRotateSensitivity` 1
- ワイヤー重ね描き: `web/src/features/viewer/mesh-display.ts:14` `WIREFRAME_OVERLAY_OPACITY = 0.6`。
  `createWireframeOverlayMaterial(color?)`(`:36`、`:41` で opacity)、`createWireframeOverlay(mesh, color?)`(`:48`。`:50` の多角形属性付き分岐は
  `createPolygonEdgeMaterial(color ?? WIREFRAME_OVERLAY_COLOR, WIREFRAME_OVERLAY_OPACITY)`)、`applyMeshDisplay(root, mode, wireframeColor?)`(`:106`)。
  solid-wireframe で既に重ね描きがあれば作り直さない(冪等。`mesh-display.test.ts:140-150`)。重ね描きの材質は常に 1 つ(配列にならない)。
  `createPolygonEdgeMaterial(color, opacity)` は `transparent` を `opacity < 1` のときだけ、`depthWrite` を `opacity >= 1` のときだけ true にする(135 の契約)
- `useModelScene.ts:39-41` `useEffect(() => { applyMeshDisplay(scene, meshDisplay, hexToNumber(wireframeColor)); }, [meshDisplay, scene, wireframeColor])`。
  `:53` のアンマウント effect は `"solid"` で呼ぶ(変更しない)
- dolly: `web/src/features/viewer/camera-input.ts:30` `DOLLY_SPEED = 0.005`、`:35` `dollyPosition(position, target, deltaX)` が `:47` で `Math.exp(-DOLLY_SPEED * deltaX)`。
  呼び出し元は `viewer-pointer.ts:70-74`。`ViewerPointerDeps`(`viewer-pointer.ts:13-20`)は `onUserInteract` / `onCameraChange` / `onLightRotate(deltaX, deltaY)`。
  `CameraRig.tsx:64-68` が `attachViewerPointer(controls, { onUserInteract, onCameraChange, onLightRotate: (deltaX, deltaY) => useLightingStore.getState().rotate(deltaX, deltaY) })`
- ライト回転: `viewer-pointer.ts:62` が Shift+右ドラッグの移動量で `deps.onLightRotate` を呼ぶ。`LightGizmo.tsx:63-70` の `handlePointerMove` が
  `useLightingStore.getState().rotate(step.deltaX, 0)`、`:80-87` の `handleKeyDown` が `gizmoKeyDeltaX(event.key)` の値で `rotate(deltaX, 0)`。
  ストアの `rotate` は `rotateLight(angles, deltaX, deltaY)`(`lighting.ts:32-40`、`LIGHT_ROTATE_SPEED = 0.008`)を呼ぶ。**`store/lighting.ts` と `lighting.ts` は変更しない**(149 が触る)
- 固定しているテスト: `camera-input.test.ts:27-28`(`DOLLY_SPEED` 相対)、`mesh-display.test.ts:104`(`WIREFRAME_OVERLAY_OPACITY` 相対)、
  `light-gizmo.test.ts:69-80`(LightGizmo のソース。`:79` の `rotation={[0, GIZMO_BOX_ROTATION_Y, 0]}` 契約は変えない)、`camera-animation.test.ts:93-105`(CameraRig のソースに `enableDamping={false}` 等。変更しない行)
- `viewer_Summary.md:36`(mesh-display.ts)、`:34`(useModelScene.ts)、`:43`(CameraRig.tsx)、`:9`(LightGizmo.tsx)、`:44`(camera-input.ts)

## インターフェイス契約

```ts
// web/src/features/viewer/camera-input.ts(既存 export はすべて残す)
/** speed(既定 DOLLY_SPEED)を 1px あたりの係数にする */
export function dollyPosition(position: Vec3, target: Vec3, deltaX: number, speed?: number): Vec3;

// web/src/features/viewer/viewer-pointer.ts
export interface ViewerPointerDeps {
  onUserInteract(): void;
  onCameraChange(): void;
  onLightRotate(deltaX: number, deltaY: number): void;
  /** dolly の 1px あたりの係数。省略時 DOLLY_SPEED。移動のたびに呼ぶ */
  dollySpeed?: () => number;
}
// :70 は dollyPosition(position, target, deltaX, deps.dollySpeed?.() ?? DOLLY_SPEED)
```

```tsx
// web/src/features/viewer/CameraRig.tsx:64-68
attachViewerPointer(controls as unknown as ViewerControlsLike, {
  onUserInteract: handleUserInteract,
  onCameraChange: handleChange,
  onLightRotate: (deltaX, deltaY) => {
    const sensitivity = useViewSettingsStore.getState().settings.lightRotateSensitivity;
    useLightingStore.getState().rotate(deltaX * sensitivity, deltaY * sensitivity);
  },
  dollySpeed: () => DOLLY_SPEED * useViewSettingsStore.getState().settings.dollySensitivity,
});

// web/src/features/viewer/LightGizmo.tsx:66(handlePointerMove だけ。handleKeyDown は変えない)
//   const sensitivity = useViewSettingsStore.getState().settings.lightRotateSensitivity;
//   useLightingStore.getState().rotate(step.deltaX * sensitivity, 0);
```

```ts
// web/src/features/viewer/mesh-display.ts(既存 export はすべて残す)
/** 既定 WIREFRAME_OVERLAY_OPACITY。生成時から transparent = opacity < 1、depthWrite = opacity >= 1(輪郭辺材質と同じ規則) */
export function createWireframeOverlayMaterial(color?: number, opacity?: number): MeshBasicMaterial;
/** 多角形属性付きの分岐は createPolygonEdgeMaterial(color ?? WIREFRAME_OVERLAY_COLOR, opacity ?? WIREFRAME_OVERLAY_OPACITY) */
export function createWireframeOverlay(mesh: Mesh, color?: number, opacity?: number): Mesh;
/**
 * overlayOpacity(既定 WIREFRAME_OVERLAY_OPACITY)は solid-wireframe の重ね描きに使う。
 * - 重ね描きが無い Mesh: createWireframeOverlay(mesh, wireframeColor, overlayOpacity) で付ける
 * - 既に重ね描きがある Mesh: 作り直さず、その材質(1 つ)の opacity を書き換え、
 *   transparent = opacity < 1、depthWrite = opacity >= 1 に揃える。needsUpdate は不要(uniform の変更だけ)
 */
export function applyMeshDisplay(root: Object3D, mode: MeshDisplayMode, wireframeColor?: number, overlayOpacity?: number): void;

// web/src/features/viewer/useModelScene.ts:39-41
//   const overlayOpacity = useViewSettingsStore(selectViewSetting("wireframeOverlayOpacity"));
//   useEffect(() => { applyMeshDisplay(scene, meshDisplay, hexToNumber(wireframeColor), overlayOpacity); }, [meshDisplay, scene, wireframeColor, overlayOpacity]);
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `dollyPosition(p, t, 100)` | 従来どおり `Math.exp(-DOLLY_SPEED * 100)` 倍(既存テストのまま) |
| `dollyPosition(p, t, 100, DOLLY_SPEED * 2)` | 距離が `Math.exp(-DOLLY_SPEED * 200)` 倍 |
| `attachViewerPointer` に `dollySpeed: () => DOLLY_SPEED * 2` を渡して Alt+右ドラッグ 100px | `dollySpeed` が呼ばれ、位置が `dollyPosition(…, 100, DOLLY_SPEED * 2)` と一致する(`viewer-pointer.test.ts` の既存の dolly テストと同じ組み立て) |
| `dollySpeed` を渡さない | 従来どおり `DOLLY_SPEED`(既存テストのまま) |
| `CameraRig.tsx` のソース | `dollySpeed: () => DOLLY_SPEED * useViewSettingsStore.getState().settings.dollySensitivity` と `settings.lightRotateSensitivity` を含み、`enableDamping={false}` 等の既存契約は変わらない |
| `LightGizmo.tsx` のソース | `handlePointerMove` 内に `settings.lightRotateSensitivity` を含み、`handleKeyDown` の `rotate(deltaX, 0)` は変わらない |
| `createWireframeOverlayMaterial(color)` / `createWireframeOverlay(mesh)` | 従来どおり `opacity === WIREFRAME_OVERLAY_OPACITY` |
| `createWireframeOverlay(mesh, color, 0.2)` | 重ね描きの `material.opacity === 0.2`、`transparent === true`、`depthWrite === false` |
| 多角形属性付き Mesh に `createWireframeOverlay(mesh, color, 0.2)` | `isPolygonEdgeMaterial` な材質で `opacity === 0.2` |
| `applyMeshDisplay(root, "solid-wireframe", color, 0.6)` の後 `(root, "solid-wireframe", color, 0.2)` | 重ね描きは 1 つのまま(冪等)で、その材質の `opacity === 0.2`、`transparent === true`、`depthWrite === false` |
| 続けて `(root, "solid-wireframe", color, 1)` | `opacity === 1`、`transparent === false`、`depthWrite === true` |
| `applyMeshDisplay(root, "wireframe", color, 0.2)` | 重ね描きなし。多角形属性付き Mesh の差し替え材質は opacity 1 のまま(overlayOpacity は使わない) |
| `applyMeshDisplay(root, "solid")` | 従来どおり重ね描きを外して dispose |
| `useModelScene.ts` のソース(`model-scene.test.ts` の既存ソース検査に影響しないこと) | `selectViewSetting("wireframeOverlayOpacity")` を含み、`applyMeshDisplay(scene, meshDisplay, hexToNumber(wireframeColor), overlayOpacity)` を呼ぶ。アンマウントの `applyMeshDisplay(scene, "solid",` は残る |
| 既存テスト | すべて通る |

### 目視確認(マージ後に人間が行う)
| 操作 | 期待する結果 |
| --- | --- |
| 表示方法を「面 + 線」にして「ワイヤー重ね描きの不透明度」を動かす | 線の濃さが即座に変わる(モデルの再読み込みは起きない) |
| 「dolly の感度」×4 で Alt+右ドラッグ | 同じドラッグ量で 4 倍速く寄る |
| 「ライト回転の感度」×0.25 で Shift+右ドラッグとギズモドラッグ | 回転が遅くなる。矢印キーの刻みは変わらない |

## やらないこと
- `store/lighting.ts` / `features/viewer/lighting.ts` / `light-gizmo.ts`(`GIZMO_KEY_STEP_PX`)は変更しない
- `polygon-edge-material.ts` は変更しない(opacity は引数で渡せる)
- 144 のストア・UI・ラベルは変更しない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md の該当ファイルの説明と公開インターフェイスが更新され、view-settings への参照が入っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
