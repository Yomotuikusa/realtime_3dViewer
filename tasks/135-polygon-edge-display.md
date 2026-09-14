---
id: 135
title: ビューアで多角形の輪郭辺をワイヤー表示し、FBX / OBJ を対応ローダーで読む
feature: viewer
depends_on: [133, 134]
owns: [web/src/features/viewer/polygon-edge-material.ts, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/model-scene.test.ts, web/tests/polygon-edge-display.test.ts]
reads: [web/src/features/polygon-edges/polygon-edges_Summary.md, web/src/features/polygon-edges/polygon-edges.ts, web/src/features/polygon-edges/polygon-edge-loaders.ts, web/src/features/viewer/useModelScene.ts, web/src/features/theme/viewer-colors.ts, web/tests/mesh-display.test.ts, web/tests/mesh-display-color.test.ts, node_modules/three/src/renderers/shaders/ShaderLib/meshbasic.glsl.js]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
133 / 134 で geometry に付いた多角形の輪郭辺の属性を使い、`wireframe` と `solid-wireframe` の両モードで
FBX / OBJ のメッシュを分割前の多角形(四角形など)の線で描く。属性のないメッシュ(glTF など)は今までどおり三角形の線で描く。

## 前提
- 属性名と判定関数: `POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE`(頂点ごとの重心座標 vec3)、`POLYGON_EDGE_MASK_ATTRIBUTE`(三角形ごとの輪郭フラグ vec3。成分 j が 1 なら頂点 j の対辺が輪郭)、`hasPolygonEdges(geometry)`。web/src/features/polygon-edges/polygon-edges.ts
- ローダー: `PolygonEdgeFBXLoader extends FBXLoader`、`PolygonEdgeOBJLoader extends OBJLoader`。どちらも `parse` の後に属性を付ける。web/src/features/polygon-edges/polygon-edge-loaders.ts
- 現在の表示切替は `applyMeshDisplay(root, mode, wireframeColor?)`。`wireframe` は材質の `wireframe = true`、`solid-wireframe` は材質へ polygonOffset を入れ、`createWireframeOverlay(mesh, color)` で作った子 Mesh(userData に `MESH_DISPLAY_OVERLAY_KEY` と `VIEWER_OVERLAY_KEY`)を重ねる。InstancedMesh には重ねない。web/src/features/viewer/mesh-display.ts:80-101
- 呼び出し側は `useModelScene`。モードとテーマ色が変わるたびに `applyMeshDisplay` を呼び、アンマウント時に `"solid"` で呼んで元へ戻す。web/src/features/viewer/useModelScene.ts:39-41, 53
- ローダーの選択は `ModelMesh.tsx` の `useLoader(FBXLoader, src, extendLoader)` / `useLoader(OBJLoader, src, extendLoader)`。web/src/features/viewer/ModelMesh.tsx:51-58
- `web/tests/model-scene.test.ts:38-49` は ModelMesh.tsx のソース文字列に `FBXLoader` / `OBJLoader` の import と `useLoader(FBXLoader, ...)` を要求している。このタスクで新ローダーに合わせて書き換える
- `web/tests/mesh-display.test.ts` と `web/tests/mesh-display-color.test.ts` の既存ケース(BoxGeometry など属性のない geometry)はすべてそのまま通す
- 選択のレイキャストは `Mesh.raycast` で、`material.visible` や材質の種類に関係なく当たる(three/src/objects/Mesh.js に visible の参照はない)。`pick.ts` は `object.visible` だけを見る
- three は WebGL2 のみなので GLSL の `fwidth` は使える。MeshBasicMaterial の GLSL は `#include <common>`、`#include <begin_vertex>`、`#include <clipping_planes_fragment>` を含む(node_modules/three/src/renderers/shaders/ShaderLib/meshbasic.glsl.js)。`Material.onBeforeCompile(shader, renderer)` で `shader.vertexShader` / `shader.fragmentShader` を文字列置換でき、`customProgramCacheKey()` を返すとプログラムのキャッシュキーになる
- ワイヤーの色は `useThemeStore` の `wireframe` 色(`0xrrggbb`)。既定値と重ね描きの不透明度は `WIREFRAME_OVERLAY_COLOR` / `WIREFRAME_OVERLAY_OPACITY`(mesh-display.ts:10-13)

## インターフェイス契約

```ts
// web/src/features/viewer/polygon-edge-material.ts(新規)
import { MeshBasicMaterial, type Material } from "three";

/** 線の太さ(px)。GLSL の define POLYGON_EDGE_LINE_WIDTH に "1.0" として渡す */
export const POLYGON_EDGE_LINE_WIDTH = 1;
/** userData のキー。値は true */
export const POLYGON_EDGE_MATERIAL_KEY = "polygonEdgeMaterial";

export function isPolygonEdgeMaterial(material: Material): boolean;

/**
 * 多角形の輪郭辺だけを描く材質。color は 0xrrggbb。
 * MeshBasicMaterial に onBeforeCompile で属性・varying・discard を差し込む。
 * side は DoubleSide(三角形ワイヤーと同じく裏側の線も見える)、toneMapped false、
 * transparent は opacity < 1 のときだけ true、depthWrite は opacity >= 1 のときだけ true。
 * customProgramCacheKey は "polygonEdge" を返す。
 */
export function createPolygonEdgeMaterial(color: number, opacity: number): MeshBasicMaterial;
```
GLSL の差し込み(置換前の `#include` 行は残す):
- 頂点: `#include <common>` の後に `attribute vec3 polygonEdgeBarycentric; attribute vec3 polygonEdgeMask; varying vec3 vPolygonEdgeBarycentric; varying vec3 vPolygonEdgeMask;`、`#include <begin_vertex>` の後に両 varying への代入
- フラグメント: `#include <common>` の後に両 varying の宣言、`#include <clipping_planes_fragment>` の後に
  `vec3 edgeDistance = vPolygonEdgeBarycentric / fwidth(vPolygonEdgeBarycentric);`
  `vec3 onEdge = step(edgeDistance, vec3(POLYGON_EDGE_LINE_WIDTH)) * step(0.5, vPolygonEdgeMask);`
  `if (max(onEdge.x, max(onEdge.y, onEdge.z)) < 0.5) discard;`

```ts
// web/src/features/viewer/mesh-display.ts(既存に追加・変更。既存の export と定数はすべて残す)
/** wireframe モードで差し替える前の材質を退避する userData キー。値は Material | Material[] */
export const POLYGON_EDGE_ORIGINAL_MATERIAL_KEY = "polygonEdgeOriginalMaterial";

/** 既存。geometry に輪郭辺の属性があれば createPolygonEdgeMaterial(color, WIREFRAME_OVERLAY_OPACITY)、なければ従来の wireframe 材質 */
export function createWireframeOverlay(mesh: Mesh, color?: number): Mesh;

/** 既存シグネチャ。振る舞い表のとおり拡張する */
export function applyMeshDisplay(root: Object3D, mode: MeshDisplayMode, wireframeColor?: number): void;
```
`applyMeshDisplay` の手順(root 配下の重ね描きでない各 Mesh について):
1. `userData[POLYGON_EDGE_ORIGINAL_MATERIAL_KEY]` があれば、いま付いている差し替え材質を dispose し、退避した材質を `mesh.material` に戻してキーを消す
2. 従来どおり材質の `wireframe` / `polygonOffset` を設定する
3. 従来どおり `solid-wireframe` なら重ね描きを 1 つ付け(InstancedMesh を除く)、それ以外なら重ね描きを外して dispose する
4. `mode === "wireframe"` かつ `hasPolygonEdges(mesh.geometry)` かつ InstancedMesh でなければ、`mesh.material` を退避キーへ入れ、
   `createPolygonEdgeMaterial(color ?? WIREFRAME_OVERLAY_COLOR, 1)` に差し替える。元が配列なら同じ長さの配列(要素はそれぞれ別の材質インスタンス)

```tsx
// web/src/features/viewer/ModelMesh.tsx
import { PolygonEdgeFBXLoader, PolygonEdgeOBJLoader } from "../polygon-edges/polygon-edge-loaders";
// useLoader(PolygonEdgeFBXLoader, src, extendLoader) / useLoader(PolygonEdgeOBJLoader, src, extendLoader)
// useGLTF、extendLoader、NO_ANIMATIONS、MODEL_COMPONENTS の形は変えない
```

## 振る舞い
"属性あり" は `hasPolygonEdges(mesh.geometry)` が true の Mesh(テストでは 133 の `applyPolygonEdges` で四角形 1 枚の geometry を作る)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `solid`、属性あり | 材質は元のまま。wireframe=false、重ね描きなし、退避キーなし |
| `wireframe`、属性なし(BoxGeometry) | 従来どおり材質の wireframe=true、重ね描きなし、材質は差し替えない |
| `wireframe`、属性あり、材質 1 つ | `mesh.material` が `isPolygonEdgeMaterial` な材質(opacity 1、transparent false、depthWrite true、色 = 引数の色)になり、元の材質が退避キーに入る。重ね描きは付かない |
| `wireframe`、属性あり、材質が配列(長さ 2) | 長さ 2 の配列に差し替わり、2 要素は別インスタンス。退避キーに元の配列が入る |
| `wireframe` → `solid` | `mesh.material` が元の材質(同じインスタンス、配列なら同じ配列)に戻り、退避キーが消え、差し替え材質は dispose される(`dispose` をスパイして呼ばれたことを確認) |
| `wireframe` → 色を変えて再度 `wireframe` | 古い差し替え材質が dispose され、新しい色の差し替え材質になる。退避キーは元の材質のまま |
| `wireframe` → `solid-wireframe` | 材質が元に戻り、輪郭辺の重ね描きが 1 つ付く |
| `solid-wireframe`、属性あり | 重ね描きの材質が `isPolygonEdgeMaterial`(opacity = `WIREFRAME_OVERLAY_OPACITY`、transparent true、depthWrite false)。元の材質は polygonOffset 付きでそのまま |
| `solid-wireframe`、属性なし | 従来どおり wireframe=true の MeshBasicMaterial の重ね描き(既存テストのまま) |
| `solid-wireframe` を 2 回 | 重ね描きは 1 つのまま(冪等) |
| InstancedMesh、属性あり、`wireframe` | 差し替えず従来どおり wireframe=true。重ね描きなし |
| SkinnedMesh、属性あり、`wireframe` | 差し替わる。`skeleton` と `bindMatrix` は変わらない |
| `wireframe` で差し替え中に `Raycaster.intersectObject(mesh)` | 差し替え前と同じ回数当たる(選択できる) |
| `createPolygonEdgeMaterial` の `onBeforeCompile` を、`#include <common>` `#include <begin_vertex>` `#include <clipping_planes_fragment>` を含む仮の shader オブジェクトで呼ぶ | vertexShader に両 attribute と両 varying、fragmentShader に `fwidth` と `discard` と `POLYGON_EDGE_LINE_WIDTH` が入り、元の `#include` 行は残る |
| `createPolygonEdgeMaterial(0x112233, 1)` | `side === DoubleSide`、`toneMapped === false`、`defines.POLYGON_EDGE_LINE_WIDTH === "1.0"`、`customProgramCacheKey() === "polygonEdge"`、`userData[POLYGON_EDGE_MATERIAL_KEY] === true` |
| ModelMesh.tsx のソース | `useLoader(PolygonEdgeFBXLoader, src, extendLoader)` と `useLoader(PolygonEdgeOBJLoader, src, extendLoader)` を含み、`from "three/examples/jsm/loaders/FBXLoader.js"` / `OBJLoader.js` を含まない。`useGLTF(src, true, true, extendLoader)`、`animations={NO_ANIMATIONS}`、`MODEL_COMPONENTS` の 4 キー、`loader.manager = createModelLoadingManager(location.origin)` が 1 回、は従来どおり |
| `useModelScene.ts` | 変更しない(`applyMeshDisplay(scene, meshDisplay,` / `applyMeshDisplay(scene, "solid",` の呼び出しはそのまま) |

## やらないこと
- shared / server は変更しない(表示モードの種類も増やさない)
- glTF に対する多角形推定はしない
- 選択重ね描き(outliner/selection-highlight.ts)・比較重ね描き(compare/overlay.ts)・軌跡は変更しない
- 線幅の設定 UI は作らない(1px 固定)
- useModelScene.ts、ViewerCanvas.tsx は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。web/tests/mesh-display.test.ts / mesh-display-color.test.ts の既存ケースも通る
- [ ] viewer_Summary.md が更新されている(polygon-edge-material.ts、mesh-display.ts と ModelMesh.tsx の役割、polygon-edge-display.test.ts を載せる)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
