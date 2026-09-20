# compare

## 目的

基準モデル表面から対象モデルの各頂点までのワールド座標の符号付き距離を、three-mesh-bvh で同期的に計算する。

## ファイル一覧と役割

- deviation.ts: 比較対象 Mesh の収集、ワールド座標への三角形ベイク、基準表面の BVH 最近点からの符号付き頂点距離計算を提供する
- triangle-clip.ts: 三角形を距離しきい値の等値線で切り、しきい値以上側の三角形へ分割する純粋関数を提供する
- difference-geometry.ts: 符号付き距離から飛び出し側・へこみ側のパッチを切り出した非 index geometry を生成する純粋関数を提供する
- difference-material.ts: ライトの影響を受ける MeshStandardMaterial を飛び出し・へこみ用に 2 つ作り、比較色を更新する。既定の比較色は viewer color defaults から取得する
- difference-mesh.ts: 切断済み差分 geometry を持つ差分 Mesh の作成・再利用・材質切替・取り外し・破棄を提供し、SkinnedMesh の変形状態と表示除外キーを共有する
- target-surface.ts: 差分だけ表示するときに比較対象 Mesh の layer 0 を切り替え、描画とレイキャストから本体を外す
- model-scenes.ts: versionId ごとにマウント中の ModelMesh の glTF scene を参照のまま登録する Zustand ストアと選択関数を提供する
- compare-visibility.ts: 比較中に対象が表示されている場合だけ、基準版の描画を止める判定を提供する
- MeshCompareRig.tsx: display ストアの比較設定とロード済み scene を結び、対象 scene の距離計算と差分 Mesh を管理する Canvas 用 Rig。theme ストアの `compareOutside` / `compareInside` を購読して差分 Mesh へ渡す

## 公開インターフェイス

- deviation.ts: `isComparableMesh`、`collectComparableMeshes`、`bakeWorldTriangles`、`MeshDeviation`、`DeviationResult`、`computeDeviation`
- triangle-clip.ts: `Corner`、`ClipVertex`、`ClipTriangle`、`clipTriangleAtOrAbove`
- difference-geometry.ts: `DIFFERENCE_OUTSIDE_MATERIAL`、`DIFFERENCE_INSIDE_MATERIAL`、`buildDifferenceGeometry`
- difference-material.ts: `COMPARE_OUTSIDE_COLOR`、`COMPARE_INSIDE_COLOR`、`DIFFERENCE_POLYGON_OFFSET`、`CompareColors`、`createDifferenceMaterials`、`setDifferenceColors`
- difference-mesh.ts: `CompareDifferenceOptions`、`MESH_COMPARE_DIFFERENCE_KEY`、`MESH_COMPARE_DIFFERENCE_MATERIALS_KEY`、`MESH_COMPARE_DIFFERENCE_SOURCE_KEY`、`isMeshCompareDifference`、`createCompareDifference`、`sourceDifferenceMaterials`、`applyCompareDifference(mesh, signedDistance, threshold, colors, options)`、`clearCompareDifferences`
- target-surface.ts: `setCompareSurfacesHidden(meshes, hidden)`
- model-scenes.ts: `ModelScenesState`、`useModelScenesStore`、`selectModelScene`
- compare-visibility.ts: `isHiddenByCompare`
- MeshCompareRig.tsx: `ZERO_THRESHOLD_RATIO`、`thresholdWorld`、`MeshCompareRig`

## 他フォルダとの関係

`viewer/mesh-display.ts` の `isViewerOverlay` を共有し、ビューアが後付けしたワイヤフレームや差分 Mesh を比較対象・アウトライナ・ピックから除外する。比較中は `ViewerCanvas` が `isHiddenByCompare` で基準の版の描画を止め、`baseVisible` で戻す。`differencesOnly` 中は対象の本体を layer 0 から外すので描画とレイキャストの両方から外れるが、差分 Mesh は子の layer 1 に残る。`colorized` と `differencesOnly` は互いに独立で、`colorized` が false でも差分 Mesh は表示され、対象本体の材質を複製せず 2 スロットへ参照する。`differencesOnly` が true のときは着色の有無に関わらず対象の本体を layer 0 から外すので、両方が効いているときは差分 Mesh だけがモデル色で見える。比較色材質は userData に保持して色を更新し、着色を再開したときに同じ材質へ戻す。差分はしきい値の等値線で三角形を切った index 無しの実メッシュで、`MeshStandardMaterial` によりライトの影響を受ける。比較色材質は対象本体と同一面なので polygonOffset で手前に描くが、着色 OFF では対象本体の材質をそのまま共有する。しきい値の変更は距離計算なしに geometry を同期で作り直す。切断で生じた頂点のスキンウェイトは近い端点の値を写すので、アニメ再生時に縁がわずかにずれうる。計算はレスト姿勢で行い、ボーンの現在姿勢やモーフは反映しない。面の表裏が反転したモデルでは符号が逆になる。計算は同期的にメインスレッドを止めるため、Worker 化は今後の課題とする。

## テスト

- tests/compare-deviation.test.ts: 比較対象の識別・収集、ワールド座標ベイク、基準サイズ、箱・球・SkinnedMesh の符号付き距離を検証する
- tests/compare-triangle-clip.test.ts: 距離しきい値で三角形を切る各頂点分類と切断点を検証する
- tests/compare-difference-geometry.test.ts: 差分 geometry の切り出し、属性補間、groups、index・morph・skinning 対応を検証する
- tests/compare-difference-material.test.ts: 差分用 MeshStandardMaterial の既定値・polygonOffset・色更新と Rig の theme 色結線を検証する
- tests/compare-difference-mesh.test.ts: 差分 Mesh の作成・再利用、切断 geometry、比較色と対象材質の切替、SkinnedMesh、raycast 無効化、mesh-display との共存、材質を壊さない破棄を検証する
- tests/compare-target-surface.test.ts: 対象本体の layer 0 を切り替える描画・レイキャスト抑止、他 layer と子の維持、冪等性を検証する
- tests/compare-model-scenes.test.ts: versionId ごとの scene 登録・同一参照の通知抑止・条件付き解除・不変更新・選択・reset を検証する
- tests/compare-rig.test.ts: しきい値換算と MeshCompareRig のストア／計算／差分 Mesh 結線をソース検査する
- tests/compare-visibility.test.ts: 比較中の基準描画抑制・復帰、対象の表示状態、ViewerCanvas／CompareControls のソース結線を検証する

## 検証

`npm run typecheck && npm run test`
