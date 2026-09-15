# compare

## 目的

基準モデル表面から対象モデルの各頂点までのワールド座標の符号付き距離を、three-mesh-bvh で同期的に計算する。

## ファイル一覧と役割

- deviation.ts: 比較対象 Mesh の収集、ワールド座標への三角形ベイク、基準表面の BVH 最近点からの符号付き頂点距離計算を提供する
- overlay-geometry.ts: 比較重ね描き用 geometry に元 geometry の position / index / 変形属性を共有させ、所有する compareDistance 属性へ符号付き距離を書き込む
- overlay-material.ts: compareDistance の補間値をフラグメントシェーダで赤・青・透明に判定する共有しない MeshBasicMaterial と uniform 更新 API を提供する。既定の比較色は viewer color defaults から取得する
- overlay.ts: 比較重ね描き Mesh の作成・再利用・取り外し・破棄を提供し、geometry の距離属性と material の uniform を更新する
- model-scenes.ts: versionId ごとにマウント中の ModelMesh の glTF scene を参照のまま登録する Zustand ストアと選択関数を提供する
- compare-visibility.ts: 比較中に対象が表示されている場合だけ、基準版の描画を止める判定を提供する
- MeshCompareRig.tsx: display ストアの比較設定とロード済み scene を結び、対象 scene の距離計算と比較重ね描きを管理する Canvas 用 Rig。theme ストアの `compareOutside` / `compareInside` を購読して塗り重ねへ渡す

## 公開インターフェイス

- deviation.ts: `isComparableMesh`、`collectComparableMeshes`、`bakeWorldTriangles`、`MeshDeviation`、`DeviationResult`、`computeDeviation`
- overlay-geometry.ts: `COMPARE_DISTANCE_ATTRIBUTE`、`createCompareOverlayGeometry`、`writeCompareDistance`
- overlay-material.ts: `COMPARE_OUTSIDE_COLOR`、`COMPARE_INSIDE_COLOR`、`COMPARE_OVERLAY_OPACITY`、`COMPARE_OVERLAY_UNIFORMS_KEY`、`COMPARE_PROGRAM_CACHE_KEY`、`CompareColors`、`CompareOverlayUniforms`、`createCompareOverlayMaterial`、`compareOverlayUniforms`、`setCompareOverlayUniforms`
- overlay.ts: 上記 overlay-geometry.ts / overlay-material.ts の再 export に加え、`MESH_COMPARE_OVERLAY_KEY`、`isMeshCompareOverlay`、`createCompareOverlay`、`applyCompareOverlay(mesh, signedDistance, threshold, colors)`、`clearCompareOverlays`
- model-scenes.ts: `ModelScenesState`、`useModelScenesStore`、`selectModelScene`
- compare-visibility.ts: `isHiddenByCompare`
- MeshCompareRig.tsx: `ZERO_THRESHOLD_RATIO`、`thresholdWorld`、`MeshCompareRig`

## 他フォルダとの関係

`viewer/mesh-display.ts` の `isViewerOverlay` を共有し、ビューアが後付けしたワイヤフレームや比較重ね描きを比較対象から除外する。比較中は `ViewerCanvas` が `isHiddenByCompare` で基準の版の描画を止め、`baseVisible` で戻す。overlay.ts は元 geometry の位置・index・変形属性を共有し、compareDistance だけを所有する。比較色としきい値は `MeshCompareRig` が渡し、overlay-material.ts の uniform に更新するため距離計算なしに色を変えられる。符号付き距離は頂点間で線形補間されるので、基準面が強く曲がる大きな三角形では交線位置がずれる。また、薄い基準で最近点の面が隣接頂点ごとに変わり符号反転した場合は三角形途中に透明帯が出る。これらは許容する近似である。計算はレスト姿勢で行い、ボーンの現在姿勢やモーフは反映しない。面の表裏が反転したモデルでは符号が逆になる。計算は同期的にメインスレッドを止めるため、Worker 化は今後の課題とする。

## テスト

- tests/compare-deviation.test.ts: 比較対象の識別・収集、ワールド座標ベイク、基準サイズ、箱・球・SkinnedMesh の符号付き距離を検証する
- tests/compare-overlay.test.ts: 比較重ね描きの geometry / 共有属性 / 距離属性、SkinnedMesh、再利用、raycast 無効化、mesh-display との共存、破棄を検証する
- tests/compare-overlay-shader.test.ts: MeshBasicMaterial の設定、GLSL の頂点距離補間・三値判定、uniform の同一参照を検証する
- tests/compare-overlay-color.test.ts: 比較色の既定値・uniform 更新・再利用時の色更新と theme ストアから Rig への結線を検証する
- tests/compare-model-scenes.test.ts: versionId ごとの scene 登録・同一参照の通知抑止・条件付き解除・不変更新・選択・reset を検証する
- tests/compare-rig.test.ts: しきい値換算と MeshCompareRig のストア／計算／重ね描き結線をソース検査する
- tests/compare-visibility.test.ts: 比較中の基準描画抑制・復帰、対象の表示状態、ViewerCanvas／CompareControls のソース結線を検証する

## 検証

`npm run typecheck && npm run test`
