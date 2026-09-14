---
id: 076
title: web 対象メッシュの各頂点から基準メッシュ表面への符号付き距離を three-mesh-bvh で計算する compare/deviation.ts と、ビューア重ね描きの汎用マーカー
feature: web
depends_on: []
owns: [web/src/features/compare/deviation.ts, web/src/features/compare/compare_Summary.md, web/tests/compare-deviation.test.ts, web/src/features/viewer/mesh-display.ts, web/tests/mesh-display.test.ts, web/src/features/viewer/viewer_Summary.md, web/web_Summary.md]
reads: [web/src/features/viewer/pick.ts, web/src/features/viewer/model-target.ts, web/tests/pick.test.ts, web/tests/summary-coverage.test.ts, package.json]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
ブラッシュアップ前後のモデルを比べるため、「対象」モデルの各頂点が「基準」モデルの表面から
どれだけ外側(飛び出し)/内側(へこみ)にあるかを、ワールド座標の符号付き距離として計算する
純粋 three.js モジュールを作る。描画(077)と結線(078)は別タスク。
あわせて、077 が作る比較用の重ね描き Mesh を既存の mesh-display が走査対象にしないよう、
ビューア重ね描きの汎用マーカーを mesh-display.ts に導入する。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `three-mesh-bvh` 0.8.3 が package.json の dependencies に宣言済みで、`import { MeshBVH } from "three-mesh-bvh"`
  が typecheck と web の vitest(jsdom)で動くことを計画時に確認済み。**`npm install` は実行しない**(AGENTS.md)
- `MeshBVH` の API(node_modules/three-mesh-bvh/src/index.d.ts:17-21, :43, :67-72):
  `new MeshBVH(geometry: BufferGeometry, options?)`、
  `closestPointToPoint(point: Vector3, target?: HitPointInfo, minThreshold?, maxThreshold?): HitPointInfo | null`、
  `HitPointInfo = { point: Vector3; distance: number; faceIndex: number }`。`faceIndex` は geometry の index 上の
  三角形番号(index の `faceIndex * 3` から 3 頂点)。geometry に index が無ければ MeshBVH が index を生成するが、
  本タスクでは自前で常に index を付けるので依存しない
- three.js は 0.186.0。`BufferAttribute` / `InterleavedBufferAttribute` はどちらも `getX(i)` / `getY(i)` / `getZ(i)` を持つ
  (glTF は interleaved を返しうるので `.array` を直接読まない)
- 既存の mesh-display(web/src/features/viewer/mesh-display.ts)は、`applyMeshDisplay(root, mode)` が
  `root.traverse` で `Mesh` を集め(:72-75)、`isMeshDisplayOverlay` な物だけを除外している。
  ワイヤフレーム重ね描き Mesh は親 Mesh と**同じ geometry を共有する子**として付く(:36-52)。
  077 の比較用重ね描きも同様に子として付く。互いに相手を「比較対象の Mesh」「表示方法を適用する Mesh」と
  誤認しないよう、両者共通のマーカーを本タスクで導入する
- `web/tests/mesh-display.test.ts`(216 行)が mesh-display の振る舞いを固定している。`isMeshDisplayOverlay` の
  意味と `MESH_DISPLAY_OVERLAY_KEY = "meshDisplayOverlay"` は変えない
- `SkinnedMesh` は `matrixWorld` だけを掛ければレスト姿勢(バインドポーズ)のワールド座標になる。
  ボーンの現在姿勢は反映しない(仕様)
- `web/tests/summary-coverage.test.ts` が、src の全ファイルが最寄りの `_Summary.md` に載っていること、
  全テストファイル名がいずれかの Summary に載っていること、**全フォルダ Summary が web/web_Summary.md から
  索引されていること**を検査する。新規フォルダ `web/src/features/compare/` には `compare_Summary.md` を作り、
  web_Summary.md の索引(:19-28)に `src/features/compare/compare_Summary.md` を足す

### 計画時に実測済みの事実

下記契約と同等のプロトタイプを three 0.186 + three-mesh-bvh 0.8.3 で実行し、次を確認済み。

- 半径 1 の球(128 分割、16,641 頂点)を、x>0.5 の頂点だけ 1.1 倍、x<-0.5 の頂点だけ 0.9 倍にしたものを対象、
  元の球を基準にすると、符号付き距離はそれぞれ +0.100 / −0.100、それ以外は 0 付近になった
- BVH 構築 13.5ms、全頂点の距離計算 48ms(基準 32,512 三角形)

## インターフェイス契約

### 変更 web/src/features/viewer/mesh-display.ts

```ts
/** ビューアが後付けする重ね描き Mesh 共通の userData キー。値は true。
 *  mesh-display のワイヤフレーム重ね描きと compare の比較重ね描きの両方が付ける */
export const VIEWER_OVERLAY_KEY = "viewerOverlay";

/** userData[VIEWER_OVERLAY_KEY] === true なら、ビューアが後付けした重ね描き(モデル本体ではない) */
export function isViewerOverlay(object: Object3D): boolean;
```

- `createWireframeOverlay` は従来の `MESH_DISPLAY_OVERLAY_KEY` に加えて `userData[VIEWER_OVERLAY_KEY] = true` も付ける
- `applyMeshDisplay` の走査(:72-75)は `!isMeshDisplayOverlay(object)` を `!isViewerOverlay(object)` に置き換える
  (ワイヤフレーム重ね描きは両方のキーを持つので従来どおり除外される)
- `overlayChildren`(:59-61)は従来どおり `isMeshDisplayOverlay` で絞る(**比較重ね描きを remove / dispose しない**)
- 他の公開シグネチャは変えない

### 新規 web/src/features/compare/deviation.ts

```ts
import { BufferGeometry, Mesh, Object3D } from "three";

/** 比較の対象・基準として三角形を採用する Mesh か。
 *  Mesh かつ InstancedMesh でなく、isViewerOverlay でないもの(SkinnedMesh は含む) */
export function isComparableMesh(object: Object3D): object is Mesh;

/** root 配下(root 自身を含む)の isComparableMesh な Mesh を traverse 順で集める */
export function collectComparableMeshes(root: Object3D): Mesh[];

/**
 * root 配下の全比較対象 Mesh の三角形を、各 Mesh の matrixWorld を掛けたワールド座標の
 * position(Float32、itemSize 3)と index だけを持つ1つの BufferGeometry にまとめる。
 * - 先頭で root.updateMatrixWorld(true) を呼ぶ
 * - index の無い geometry は 0,1,2,... の連番 index として扱う
 * - 2つ目以降の Mesh の index には、それまでの頂点数を足す
 * - drawRange / groups / morph / skinning は無視する(レスト姿勢)
 * - 比較対象 Mesh が1つも無ければ null
 */
export function bakeWorldTriangles(root: Object3D): BufferGeometry | null;

export interface MeshDeviation {
  /** 対象側の Mesh(target 配下の元オブジェクト。複製ではない) */
  mesh: Mesh;
  /** mesh.geometry の頂点ごとの符号付き距離(ワールド単位)。長さは position.count。
   *  正 = 基準表面の外側(飛び出し)、負 = 内側(へこみ)、0 = 表面上 */
  signedDistance: Float32Array;
}

export interface DeviationResult {
  /** 基準の三角形集合のバウンディングボックスの最大辺長(ワールド単位)。しきい値の基準になる */
  baseSize: number;
  /** collectComparableMeshes(target) と同じ順 */
  meshes: MeshDeviation[];
}

/**
 * target 配下の各比較対象 Mesh の各頂点について、base 配下の表面までの符号付き最短距離を求める。
 * - base を bakeWorldTriangles して MeshBVH を作る。null なら null を返す
 * - target.updateMatrixWorld(true) を呼び、各頂点に mesh.matrixWorld を掛けてワールド座標にする
 * - 各頂点 v について closestPointToPoint で最近点 p と faceIndex を得る。
 *   その三角形の面法線 n(index の巻き順、Triangle.getNormal)を使い、
 *   sign = dot(v - p, n) >= 0 ? +1 : -1、signedDistance = sign * distance。distance が 0 なら 0
 * - closestPointToPoint が null を返した頂点は Infinity
 */
export function computeDeviation(target: Object3D, base: Object3D): DeviationResult | null;
```

## 振る舞い

### mesh-display(web/tests/mesh-display.test.ts に追加。既存テストは変えない)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `createWireframeOverlay(mesh).userData` | `MESH_DISPLAY_OVERLAY_KEY` と `VIEWER_OVERLAY_KEY` の両方が true。`isViewerOverlay` true |
| `isViewerOverlay(new Group())` / userData に `viewerOverlay: false` | false |
| `VIEWER_OVERLAY_KEY` だけ true の Mesh(比較重ね描きを模したもの)を Mesh の子に置き、`applyMeshDisplay(root, "wireframe")` | その子の材質の `wireframe` は変わらない(false のまま) |
| 同じ構成で `applyMeshDisplay(root, "solid-wireframe")` | その子にはワイヤフレーム重ね描きが付かない。親 Mesh には従来どおり1つ付く |
| 同じ構成で solid-wireframe のあと `applyMeshDisplay(root, "solid")` | `VIEWER_OVERLAY_KEY` だけの子は remove されない(比較重ね描きを消さない) |

### deviation(web/tests/compare-deviation.test.ts に新規追加)

基準は `Mesh(BoxGeometry(2, 2, 2), MeshStandardMaterial)` を `Group` に入れたもの(以下「基準箱」)。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `isComparableMesh` に Mesh / SkinnedMesh | true |
| `isComparableMesh` に InstancedMesh / Group / Line / `userData[VIEWER_OVERLAY_KEY] = true` の Mesh | false |
| `collectComparableMeshes` で Group の下に Mesh、Group(Mesh を含む)、Line、重ね描き Mesh を持つツリー | 重ね描き以外の Mesh を traverse 順で返す。root 自身が Mesh なら含む |
| `bakeWorldTriangles` で位置 (5,0,0)・scale 2 の `Mesh(BoxGeometry(1,1,1))`(行列は未更新) | position の x の最小が 4、最大が 6。index は元と同じ長さ |
| `bakeWorldTriangles` で Mesh を2つ(1つ目 24 頂点、2つ目 24 頂点) | position.count 48、index.count 72、2つ目の index の最小値が 24 |
| `bakeWorldTriangles` で `toNonIndexed()` した Box(36 頂点) | index が 0..35 の連番 |
| `bakeWorldTriangles` で Line だけ / 空 Group | null |
| `bakeWorldTriangles` の戻り値 | 元の Mesh の geometry と別オブジェクトで、元の position は変更されない |
| `computeDeviation(Box(1,1,1) を基準箱に)` | 全 24 頂点が −0.5(`toBeCloseTo(-0.5, 5)`)。`baseSize` が 2 |
| `computeDeviation(Box(4,4,4) を基準箱に)` | 全頂点が +√3(`toBeCloseTo(Math.sqrt(3), 5)`) |
| `computeDeviation(Box(2,2,2) を基準箱に)`(同一形状) | 全頂点の絶対値が 1e-6 未満 |
| 基準箱を (10,0,0) の Group に入れ、対象 Box(1,1,1) の Mesh を position (10,0,0) に置く | 全頂点 −0.5(ワールド変換を反映) |
| 上と同じ基準で対象 Box(1,1,1) を原点に置く | 全頂点が +8.5 以上(基準の外) |
| 対象: 半径 1 の `SphereGeometry(1, 64, 64)` の x>0.5 の頂点を 1.1 倍、x<−0.5 の頂点を 0.9 倍。基準: 元の球 | 1.1 倍した頂点は 0.08〜0.12、0.9 倍した頂点は −0.12〜−0.08、その他は絶対値 0.02 未満 |
| `baseSize` で基準が `BoxGeometry(2, 4, 6)` | 6 |
| 対象が InstancedMesh と `VIEWER_OVERLAY_KEY` の Mesh を含む | `meshes` にそれらは無い。`meshes[i].mesh` は target 配下の元オブジェクトと `toBe` |
| 対象が `toNonIndexed()` の Box | `signedDistance.length` が 36 |
| 対象が SkinnedMesh(Bone 1本の Skeleton に bind、Box(1,1,1)) | 計算される(全頂点 −0.5) |
| 基準に比較対象 Mesh が無い(Line だけ) | null |
| 対象に比較対象 Mesh が無い | `{ baseSize: 2, meshes: [] }` |

### Summary
- 新規 `web/src/features/compare/compare_Summary.md`: 節構成は web_Summary.md の規約(`# compare` / 目的 / ファイル一覧と役割 /
  公開インターフェイス / 他フォルダとの関係 / テスト)。「他フォルダとの関係」に、レスト姿勢で計算すること、
  対象のポリゴンが粗いと三角形内部の逸脱は拾えないこと、面の表裏が反転したモデルでは符号が逆になること、
  計算は同期でメインスレッドを止めること(Worker 化は今後)を制約として書く
- viewer_Summary.md に `VIEWER_OVERLAY_KEY` / `isViewerOverlay` と mesh-display の走査規則の変更を反映する
- web_Summary.md の索引に compare_Summary.md を足す

## やらないこと
- 重ね描き Mesh の生成・着色(077)、React への結線(078)
- しきい値の解釈(`baseSize` を返すだけ)
- BVH のキャッシュ、Web Worker、進捗通知
- ボーン姿勢・モーフの反映
- `pick.ts` / `ModelMesh.tsx` / `ViewerCanvas.tsx` の変更
- 基準側から見た逸脱(対象に無い部分)の計算

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] compare_Summary.md を新規作成し、viewer_Summary.md と web_Summary.md を更新している
- [ ] すべてのファイルが300行以内(特に mesh-display.test.ts)
- [ ] verify: に書いたコマンドが成功する
