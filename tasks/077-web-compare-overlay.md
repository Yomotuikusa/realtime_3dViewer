---
id: 077
title: web 符号付き距離を赤(飛び出し)/青(へこみ)の頂点色で重ね描きする compare/overlay.ts
feature: web
depends_on: [076]
owns: [web/src/features/compare/overlay.ts, web/src/features/compare/compare_Summary.md, web/tests/compare-overlay.test.ts]
reads: [web/src/features/compare/deviation.ts, web/src/features/viewer/mesh-display.ts, web/tests/mesh-display.test.ts, web/src/features/viewer/pick.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
076 が計算した頂点ごとの符号付き距離を、対象 Mesh の上に「しきい値以上に飛び出した部分は赤、
へこんだ部分は青、それ以外は透明」で重ね描きする three.js モジュールを作る。
元の材質・テクスチャは触らず、mesh-display のワイヤフレーム重ね描きと同じく子 Mesh として付ける。
しきい値の変更は距離の再計算なしに色だけ塗り直せるようにする。React への結線は 078。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 076 の `MeshDeviation.signedDistance` は `mesh.geometry` の position.count と同じ長さの Float32Array で、
  正 = 飛び出し、負 = へこみ、ワールド単位。web/src/features/compare/deviation.ts
- 076 で mesh-display.ts に `VIEWER_OVERLAY_KEY` / `isViewerOverlay` が入り、`applyMeshDisplay` は
  `isViewerOverlay` な Mesh を走査しない。ワイヤフレーム重ね描きは `MESH_DISPLAY_OVERLAY_KEY` と
  `VIEWER_OVERLAY_KEY` の両方を持つ。本タスクの重ね描きは `VIEWER_OVERLAY_KEY` と自分のキーの両方を付ける
  (**`MESH_DISPLAY_OVERLAY_KEY` は付けない**。付けると mesh-display に remove される)
- ワイヤフレーム重ね描きの作り方(SkinnedMesh の bind、morphTargetInfluences の共有、raycast 無効化)は
  web/src/features/viewer/mesh-display.ts:36-52 が前例。`pickModel` は `intersectObject(target, true)` で再帰判定するので
  (web/src/features/viewer/pick.ts:46)重ね描きの raycast は無効にしないとコメントのピン判定が二重になる
- three 0.186 で `BufferGeometry.setAttribute` に他の geometry の `BufferAttribute` オブジェクトをそのまま渡せば
  GPU バッファは共有される。頂点色は `color` 属性が itemSize 4 のとき `vertexColors: true` の材質でアルファも
  頂点ごとに効く(計画時に jsdom 上で `SkinnedMesh` + itemSize 4 の生成を確認済み)
- `geometry.dispose()` はその geometry に付いている全属性の GPU バッファを解放する。共有している属性を付けたまま
  dispose すると元 Mesh のバッファまで消える(次の描画で再アップロードされるが無駄)。
  よって破棄時は共有属性を外してから dispose する(契約参照)
- `new Color(0xdc2626)` の `r` / `g` / `b` は three の ColorManagement により linear 値になっており、
  頂点色属性にはその値をそのまま書けばよい(three が出力時に sRGB へ戻す)
- three の透明オブジェクトは `renderOrder` 昇順、同値なら奥から順に描かれる。ワイヤフレーム重ね描き(renderOrder 0)を
  比較の色の上に描くため、比較重ね描きは `renderOrder = -1` にする
- `web/tests/summary-coverage.test.ts` が新規ファイル・新規テストの Summary 掲載を検査する

## インターフェイス契約

### 新規 web/src/features/compare/overlay.ts

```ts
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from "three";

/** 比較重ね描き Mesh の userData キー。値は true */
export const MESH_COMPARE_OVERLAY_KEY = "meshCompareOverlay";
/** 飛び出し(正の距離)の色。赤 */
export const COMPARE_OUTSIDE_COLOR = 0xdc2626;
/** へこみ(負の距離)の色。青 */
export const COMPARE_INSIDE_COLOR = 0x2563eb;
/** 着色部分の不透明度 */
export const COMPARE_OVERLAY_OPACITY = 0.85;

/** userData[MESH_COMPARE_OVERLAY_KEY] === true なら比較重ね描き */
export function isMeshCompareOverlay(object: Object3D): boolean;

/**
 * mesh.geometry の position / normal / uv 以外は持たず、次を共有する新しい BufferGeometry を作る。
 * - position、index(あれば)、skinIndex / skinWeight(あれば)は同じ BufferAttribute オブジェクトを setAttribute / setIndex
 * - morphAttributes.position(あれば)は同じ配列参照を代入し、morphTargetsRelative を写す
 * - "color" は自前の Float32BufferAttribute(position.count * 4, itemSize 4)。初期値は全 0(透明)
 *   (元 geometry の color 属性は使わない・変更しない)
 * - boundingBox / boundingSphere は元 geometry の参照を写す(再計算しない)
 */
export function createCompareOverlayGeometry(mesh: Mesh): BufferGeometry;

/** 着色用の共有しない材質。vertexColors true、color 白、transparent true、depthWrite false、toneMapped false */
export function createCompareOverlayMaterial(): MeshBasicMaterial;

/**
 * mesh の子として付ける重ね描き Mesh を作る(まだ add はしない)。
 * - SkinnedMesh なら SkinnedMesh を作り bindMode を写して bind(mesh.skeleton, mesh.bindMatrix)。それ以外は Mesh
 * - geometry は createCompareOverlayGeometry(mesh)、material は createCompareOverlayMaterial()
 * - morphTargetInfluences / morphTargetDictionary は参照を共有
 * - raycast は何もしない関数に差し替える
 * - renderOrder = -1
 * - userData[MESH_COMPARE_OVERLAY_KEY] = true、userData[VIEWER_OVERLAY_KEY] = true
 */
export function createCompareOverlay(mesh: Mesh): Mesh;

/**
 * geometry の color 属性(itemSize 4)を signedDistance と threshold から書き直し、needsUpdate = true にする。
 * 頂点 i(0 <= i < min(color.count, signedDistance.length))について
 * - d >= threshold        → COMPARE_OUTSIDE_COLOR の r,g,b と COMPARE_OVERLAY_OPACITY
 * - d <= -threshold       → COMPARE_INSIDE_COLOR の r,g,b と COMPARE_OVERLAY_OPACITY
 * - それ以外・NaN・±Infinity → 0,0,0,0
 * 範囲外の頂点は 0,0,0,0。threshold は 0 以上の有限数を前提とし検証しない
 */
export function colorizeDeviation(geometry: BufferGeometry, signedDistance: Float32Array, threshold: number): void;

/**
 * mesh に比較重ね描きの子が無ければ createCompareOverlay で作って add し、あれば再利用する。
 * その geometry を colorizeDeviation で塗り直し、重ね描き Mesh を返す。何度呼んでも子は1つ。
 */
export function applyCompareOverlay(mesh: Mesh, signedDistance: Float32Array, threshold: number): Mesh;

/**
 * root 配下(root 自身を含む)の比較重ね描きをすべて親から remove し、破棄する。
 * 破棄: material.dispose()、geometry から color 以外の属性を deleteAttribute し setIndex(null)、
 * morphAttributes を {} にしてから geometry.dispose()(共有バッファを解放しないため)。
 * ワイヤフレーム重ね描き(MESH_DISPLAY_OVERLAY_KEY)には触らない。
 */
export function clearCompareOverlays(root: Object3D): void;
```

## 振る舞い(web/tests/compare-overlay.test.ts に新規追加)

対象は `Mesh(BoxGeometry(1,1,1), MeshStandardMaterial)`(24 頂点)と、`Bone` 1本の `Skeleton` に `bind` した
`SkinnedMesh`(`skinIndex` / `skinWeight` 属性を持たせ、`morphTargetInfluences = [0.5]`、
`geometry.morphAttributes.position = [position のクローン]`)。`readSource` の要領は web/tests/mesh-display.test.ts。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createCompareOverlayGeometry(mesh)` | 元と別の BufferGeometry。`getAttribute("position")` / `getIndex()` が元と `toBe`。`normal` / `uv` 属性が無い |
| 同(SkinnedMesh) | `skinIndex` / `skinWeight` が元と `toBe`、`morphAttributes.position` が元と `toBe`、`morphTargetsRelative` が一致 |
| color 属性 | `itemSize` 4、`count` が position.count、全要素 0、元 geometry に color 属性が生えない |
| 元 geometry に color 属性(itemSize 3)がある | 重ね描きの color は別オブジェクトで itemSize 4。元の color は変更されない |
| `createCompareOverlayMaterial()` | `MeshBasicMaterial`、`vertexColors` true、`color.getHex()` が 0xffffff、`transparent` true、`depthWrite` false、`toneMapped` false |
| `createCompareOverlay(mesh)` | `instanceof Mesh`、`userData[MESH_COMPARE_OVERLAY_KEY]` と `userData[VIEWER_OVERLAY_KEY]` が true、`userData[MESH_DISPLAY_OVERLAY_KEY]` が undefined、`renderOrder` −1、まだ `mesh.children` に無い |
| `createCompareOverlay(skinnedMesh)` | `instanceof SkinnedMesh`、`skeleton` が親と `toBe`、`bindMatrix.equals`、`bindMode` 一致、`morphTargetInfluences` が `toBe` |
| 重ね描きに `new Raycaster()` の `intersectObject(overlay)` | `[]` |
| 重ね描きを add した親に `intersectObject(mesh, true)` | add 前と同じ件数 |
| `isMeshCompareOverlay` に重ね描き / 素の Mesh / `createWireframeOverlay(mesh)` | true / false / false |
| `colorizeDeviation(g, d, 0.1)` で d = [0.2, −0.2, 0.05, −0.05, 0.1, −0.1, NaN, Infinity, −Infinity, ...] | 0.2 と 0.1 は `new Color(COMPARE_OUTSIDE_COLOR)` の r,g,b と 0.85、−0.2 と −0.1 は INSIDE の色と 0.85、0.05 / −0.05 / NaN / ±Infinity は 0,0,0,0。`color.needsUpdate` が true(`version` が増える) |
| `colorizeDeviation(g, d, 0)` | d > 0 は赤、d < 0 は青、d = 0 は透明 |
| `signedDistance.length` が頂点数より短い | 範囲外の頂点は 0,0,0,0。例外を投げない |
| `signedDistance.length` が頂点数より長い | 頂点数分だけ塗り、例外を投げない |
| 一度赤に塗った頂点を、しきい値を上げて塗り直す | 透明(0,0,0,0)に戻る |
| `applyCompareOverlay(mesh, d, t)` | 戻り値が `mesh.children` の中の `isMeshCompareOverlay` な唯一の子。色が塗られている |
| `applyCompareOverlay` を2回 | 同じ重ね描きオブジェクト(`toBe`)を返し、子は1つのまま。2回目のしきい値で塗り直されている |
| `clearCompareOverlays(root)` で Group 下の2つの Mesh にそれぞれ重ね描きがある | どちらも remove される。各 material の `dispose` と geometry の `dispose` が呼ばれる(`vi.spyOn`)。dispose 時点で重ね描き geometry に `position` / `skinIndex` が無く index が null。元 Mesh の geometry には position / index が残っている |
| `clearCompareOverlays` で Mesh に `createWireframeOverlay` の子と比較重ね描きの両方がある | 比較重ね描きだけ remove。ワイヤフレーム重ね描きは残る |
| `clearCompareOverlays` で重ね描きの無いツリー | 例外を投げず何もしない |
| `applyMeshDisplay(root, "solid-wireframe")`(076 の mesh-display)を比較重ね描き付きの Mesh に適用 | 比較重ね描きの材質は wireframe にならず、比較重ね描きの下にワイヤフレーム重ね描きが付かない。その後 `applyMeshDisplay(root, "solid")` でも比較重ね描きは残る |

### 結線後の全体像(078 の後に成立する。直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| 対象が基準から飛び出している部分 | 陰影付きのモデルの上に不透明度 0.85 の赤が乗る。しきい値未満は元の色のまま |
| へこんでいる部分 | 同じく青 |
| メッシュ+ワイヤ表示にする | 赤青の上に線が見える |
| 対象を非表示にする | 赤青も消える(子なので visible を継承) |
| モデル表面をクリックしてコメント | 通常時と同じ位置にピンが立つ |

## やらないこと
- 距離の計算(076)、React への結線・しきい値のワールド換算(078)
- 段階的なヒートマップ(2色 + 透明のみ)
- 色・不透明度の設定 UI
- InstancedMesh への重ね描き
- `mesh-display.ts` / `deviation.ts` の変更(必要になったら申し送り)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] compare_Summary.md に overlay.ts と compare-overlay.test.ts を載せている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
