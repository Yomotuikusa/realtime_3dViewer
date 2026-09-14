# polygon-edges

## 目的

OBJLoader が扇状に三角形分割した多角形について、元の輪郭辺を判定する頂点属性を geometry に付ける。OBJ の Mesh オブジェクトごとに面の頂点数を読み取り、専用ローダーで属性付与まで結び付ける。

## ファイル一覧と役割

- polygon-edges.ts: 三角形の重心座標属性と輪郭辺マスク属性の生成、既存属性の判定を提供する
- obj-polygons.ts: OBJ のオブジェクト区切り・Line/Points 状態・面頂点数を解析し、Mesh に対応する多角形サイズを返す
- polygon-edge-loaders.ts: OBJLoader の Mesh 出力へ多角形輪郭属性を付ける `PolygonEdgeOBJLoader` を提供する

## 公開インターフェイス

- polygon-edges.ts: `POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE`、`POLYGON_EDGE_MASK_ATTRIBUTE`、`hasPolygonEdges`、`applyPolygonEdges`
- obj-polygons.ts: `readObjPolygonSizes`
- polygon-edge-loaders.ts: `PolygonEdgeOBJLoader`

## 他フォルダとの関係

three の `OBJLoader` が返す非インデックス Mesh geometry と OBJ の file 順の面情報を結び付ける。描画用の属性利用やビューアの表示切替は `viewer/` の後続タスクが担当する。

## テスト

- tests/polygon-edges.test.ts: polygon edge 属性生成、OBJ 面読み取り、PolygonEdgeOBJLoader の Mesh 結線を検証する
