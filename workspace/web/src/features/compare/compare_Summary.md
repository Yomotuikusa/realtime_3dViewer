# compare

## 目的

基準モデル表面から対象モデルの各頂点までのワールド座標の符号付き距離を、three-mesh-bvh で同期的に計算する。

## ファイル一覧と役割

- deviation.ts: 比較対象 Mesh の収集、ワールド座標への三角形ベイク、基準表面の BVH 最近点からの符号付き頂点距離計算を提供する

## 公開インターフェイス

- deviation.ts: `isComparableMesh`、`collectComparableMeshes`、`bakeWorldTriangles`、`MeshDeviation`、`DeviationResult`、`computeDeviation`

## 他フォルダとの関係

`viewer/mesh-display.ts` の `isViewerOverlay` を共有し、ビューアが後付けしたワイヤフレームや比較重ね描きを比較対象から除外する。計算はレスト姿勢で行い、ボーンの現在姿勢やモーフは反映しない。対象のポリゴンが粗い場合、三角形内部の逸脱は拾えない。面の表裏が反転したモデルでは符号が逆になる。計算は同期的にメインスレッドを止めるため、Worker 化は今後の課題とする。

## テスト

- tests/compare-deviation.test.ts: 比較対象の識別・収集、ワールド座標ベイク、基準サイズ、箱・球・SkinnedMesh の符号付き距離を検証する
