# compare

## 目的

基準モデル表面から対象モデルの各頂点までのワールド座標の符号付き距離を、three-mesh-bvh で同期的に計算する。

## ファイル一覧と役割

- deviation.ts: 比較対象 Mesh の収集、ワールド座標への三角形ベイク、基準表面の BVH 最近点からの符号付き頂点距離計算を提供する
- overlay.ts: 符号付き距離を赤・青・透明の頂点色で比較対象 Mesh に重ね描きし、再利用・破棄する関数を提供する
- model-scenes.ts: versionId ごとにマウント中の ModelMesh の glTF scene を参照のまま登録する Zustand ストアと選択関数を提供する
- MeshCompareRig.tsx: display ストアの比較設定とロード済み scene を結び、対象 scene の距離計算と比較重ね描きを管理する Canvas 用 Rig

## 公開インターフェイス

- deviation.ts: `isComparableMesh`、`collectComparableMeshes`、`bakeWorldTriangles`、`MeshDeviation`、`DeviationResult`、`computeDeviation`
- overlay.ts: `MESH_COMPARE_OVERLAY_KEY`、比較色・不透明度定数、`isMeshCompareOverlay`、`createCompareOverlayGeometry`、`createCompareOverlayMaterial`、`createCompareOverlay`、`colorizeDeviation`、`applyCompareOverlay`、`clearCompareOverlays`
- model-scenes.ts: `ModelScenesState`、`useModelScenesStore`、`selectModelScene`
- MeshCompareRig.tsx: `thresholdWorld`、`MeshCompareRig`

## 他フォルダとの関係

`viewer/mesh-display.ts` の `isViewerOverlay` を共有し、ビューアが後付けしたワイヤフレームや比較重ね描きを比較対象から除外する。overlay.ts は元 geometry の変形属性を共有し、色属性だけを所有して閾値変更時に再利用する。計算はレスト姿勢で行い、ボーンの現在姿勢やモーフは反映しない。対象のポリゴンが粗い場合、三角形内部の逸脱は拾えない。面の表裏が反転したモデルでは符号が逆になる。計算は同期的にメインスレッドを止めるため、Worker 化は今後の課題とする。

## テスト

- tests/compare-deviation.test.ts: 比較対象の識別・収集、ワールド座標ベイク、基準サイズ、箱・球・SkinnedMesh の符号付き距離を検証する
- tests/compare-overlay.test.ts: 比較重ね描きの geometry / material、変形共有、頂点色、再利用、raycast 無効化、mesh-display との共存、破棄を検証する
- tests/compare-model-scenes.test.ts: versionId ごとの scene 登録・同一参照の通知抑止・条件付き解除・不変更新・選択・reset を検証する
- tests/compare-rig.test.ts: しきい値換算と MeshCompareRig のストア／計算／重ね描き結線をソース検査する
