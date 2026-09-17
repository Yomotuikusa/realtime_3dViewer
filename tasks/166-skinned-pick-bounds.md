---
id: 166
title: web アニメーション再生中のスキンメッシュをピックできるようにする(バウンディングの無効化)
feature: viewer
depends_on: []
owns: [web/src/features/viewer/pick.ts, web/src/features/viewer/CameraRig.tsx, web/src/features/outliner/pick-selection.ts, web/tests/skinned-pick.test.ts, web/src/features/viewer/viewer_Summary.md, web/src/features/outliner/outliner_Summary.md]
reads: [web/src/features/comments/CommentPickLayer.tsx, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/outliner/SelectionPickLayer.tsx, web/src/features/viewer/PlaybackRig.tsx, web/tests/pick.test.ts, web/tests/outliner-pick.test.ts, web/tests/fit-camera.test.ts, web/tests/camera-animation.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
アニメーションを再生中のオブジェクトにコメント・ペン・選択のクリックが当たらない。
three の `SkinnedMesh` がレイキャスト前の足切りに使うバウンディングがボーンの動きに追従せず、
最初に計算された 1 フレームのポーズのまま固定されるため。ピックの直前に捨てて計算し直させる。

## 前提
(実装者が知らない、このタスクの外側で既に決まっている事実だけを書く)

- three は 0.186.0。`SkinnedMesh.raycast()` は三角形判定の前に
  `this.boundingSphere`(null のときだけ現ポーズで自動計算)と `this.boundingBox`(null ならスキップ)で
  早期 return する。どちらもアニメーションでは更新されない。
  三角形判定自体はボーン変形済み座標で行われるため、足切りさえ外れれば正しく当たる
- `mesh.boundingBox` は drei の `<Bounds>` が `box.setFromObject(target)` するときに
  `Box3.expandByObject` 経由で計算される(`node_modules/@react-three/drei/core/Bounds.js:75`)。
  `ViewerCanvas` はモデルを `<Bounds fit={false} clip>` の中に置いている
- 実測(test_ubr.fbx, 41x41 本のレイ): フレーム 0 のポーズでバウンディングを固定すると、
  フレーム 18 で当たるレイは 84 本、毎回計算し直すと 343 本。再生が進むほど表面の大半が反応しなくなる
- レイキャストでピックしている箇所は次の 2 つだけである。どちらも `raycaster.intersectObject(target, true)` を使う
  - `pickModel` … web/src/features/viewer/pick.ts:44。CommentPickLayer と AnnotationLayer が呼ぶ
  - `pickSelection` … web/src/features/outliner/pick-selection.ts:32。SelectionPickLayer が呼ぶ
  `features/joint/joint-pick.ts` はボーンのスクリーン距離で判定しておりレイキャストを使わないため対象外
- 全体表示(フィット)は `CameraRig.tsx:82` の `bounds.refresh(getModelTarget() ?? undefined).clip()` で、
  同じ固定済み `boundingBox` を読むためポーズが動くとフィット範囲もずれる
- 既存のソース契約テストが `CameraRig.tsx` の本文に対し
  `fitCamera(` / `getModelTarget()` / `.clip()` を含むこと、`.fit()` / `.reset()` を含まないことを要求する
  (web/tests/fit-camera.test.ts:66)。この 5 つの条件を壊さずに変更すること
- `Object3D` 型は `boundingBox` / `boundingSphere` / `isSkinnedMesh` を持たない。型を絞る必要がある

## インターフェイス契約

web/src/features/viewer/pick.ts に追加する。

```ts
import type { Object3D, SkinnedMesh } from "three";

/**
 * 配下のスキンメッシュのバウンディングを捨てる。
 * three はレイキャスト時に boundingSphere が null なら現在のポーズで計算し直し、
 * boundingBox が null なら箱の足切りを行わない。アニメーション中のピックの直前に呼ぶ。
 */
export function invalidateSkinnedBounds(target: Object3D | null): void;
```

呼び出し箇所は次の 3 つ。いずれも既存の引数・戻り値は変えない。

```ts
// pick.ts: pickModel の中。target が null でないことを確認した直後、setFromCamera より前
invalidateSkinnedBounds(target);

// outliner/pick-selection.ts: pickSelection の中。target が null でないことを確認した直後
invalidateSkinnedBounds(target);

// viewer/CameraRig.tsx: fitSeq を処理する useEffect の中。bounds.refresh(...) より前
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `invalidateSkinnedBounds(null)` | 何もせずに返る。例外を投げない |
| 通常の `Mesh` だけを含む `Group` を渡す | `mesh.geometry.boundingSphere` を書き換えない(呼び出し前後で同一参照または同値) |
| `SkinnedMesh` を含むツリーを渡す | その `SkinnedMesh` の `boundingBox` と `boundingSphere` が両方 `null` になる |
| 入れ子(`Group` > `Group` > `SkinnedMesh`)を渡す | 深さに関わらず `null` になる |
| ボーン移動前に `pickModel(ndc(0,0))` | 交点が返り、`point[0]` ≈ 0 |
| 上の後にボーンを x=+2 へ動かし `pickModel(ndc(0.858, 0))` | 交点が返り、`point[0]` ≈ 2(許容 ±0.05)、`normal` ≈ [0,0,1] |
| 同じ状態で `pickModel(ndc(0,0))`(元のポーズの位置) | `null` |
| 現ポーズと重ならない `Box3` を `mesh.boundingBox` に手で入れてから `pickModel` | 交点が返る(箱の足切りに落ちない) |
| ボーンを動かした後に `pickSelection` | `{ versionId, objectId }` が返る(`null` にならない) |
| `CameraRig.tsx` の本文 | `invalidateSkinnedBounds(` を含み、その呼び出しが `bounds.refresh(` より前にある |

ndc 0.858 の根拠: カメラ fov 50°・距離 5・aspect 1 なので画面半幅は `5 * tan(25°) = 2.3315`、
x = 2 の点は `2 / 2.3315 = 0.858`。テストではこの式をコメントに残すこと。

テストで使うスキンメッシュは次の形で組む(web/tests/skinned-pick.test.ts、新規ファイル)。

```ts
// 1x1 の板の全頂点を 1 本のボーンへ重み 1 で結ぶ
const geometry = new PlaneGeometry(1, 1);
const count = geometry.attributes.position.count;
geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
geometry.setAttribute("skinWeight", new Float32BufferAttribute(
  Float32Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
const bone = new Bone();
const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
mesh.add(bone);
mesh.updateMatrixWorld(true);
mesh.bind(new Skeleton([bone]));
// ポーズを動かすときは bone.position.set(2, 0, 0) の後に mesh.updateMatrixWorld(true)
```

カメラは `new PerspectiveCamera(50, 1, 0.1, 100)` を (0, 0, 5) に置き原点を向ける。
`pickSelection` のテストでは `scenes` に `{ v1: sceneRoot }` を渡し、`sceneRoot` にこのメッシュを入れて
`sceneRoot` 自体を `target` とする。

## やらないこと
- 毎フレームの再計算は行わない。`PlaybackRig` / `playback-driver.ts` / `PlaybackClock` は変更しない
- 視錐台カリング(`frustumCulled` と `Frustum.intersectsObject` が読む同じ `boundingSphere`)の対応は別タスク。
  ここでは扱わない
- モーフターゲットだけで変形するメッシュは対象にしない(`isSkinnedMesh` が真のものだけを見る)
- `CommentPickLayer` / `AnnotationLayer` / `SelectionPickLayer` は変更しない。
  呼び出し側ではなく `pickModel` / `pickSelection` の内部で無効化する
- 既存の `web/tests/pick.test.ts` と `web/tests/outliner-pick.test.ts` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md と outliner_Summary.md が更新されている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
