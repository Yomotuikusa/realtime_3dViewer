# polygon-edges

## 目的

OBJLoader / FBXLoader が三角形分割した多角形について、元の輪郭辺を判定する頂点属性を geometry に付ける。OBJ は Mesh ごとの面順、FBX は Geometry の PolygonVertexIndex と Model/Geometry の接続を読み取り、`PolygonEdgeFBXLoader` が FBXLoader の Model ID 付き Mesh へ属性付与まで結び付ける。

## ファイル一覧と役割

- polygon-edges.ts: 三角形の重心座標属性と輪郭辺マスク属性の生成、既存属性の判定を提供する
- obj-polygons.ts: OBJ のオブジェクト区切り・Line/Points 状態・面頂点数を解析し、Mesh に対応する多角形サイズを返す
- polygon-edge-loaders.ts: OBJLoader / FBXLoader の Mesh 出力へ多角形輪郭属性を付ける `PolygonEdgeOBJLoader` / `PolygonEdgeFBXLoader` を提供する
- fbx-polygons.ts: FBX 形式の振り分け、`PolygonVertexIndex` の面頂点数変換、`FbxPolygonInfo` を提供する
- fbx-ascii.ts: FBX ASCII の Geometry と Connections から多角形情報を読む
- fbx-binary.ts: FBX バイナリの必要なノードと圧縮配列を読む

## 公開インターフェイス

- polygon-edges.ts: `POLYGON_EDGE_BARYCENTRIC_ATTRIBUTE`、`POLYGON_EDGE_MASK_ATTRIBUTE`、`hasPolygonEdges`、`applyPolygonEdges`
- obj-polygons.ts: `readObjPolygonSizes`
- polygon-edge-loaders.ts: `PolygonEdgeOBJLoader`
- polygon-edge-loaders.ts: `PolygonEdgeFBXLoader`
- fbx-polygons.ts: `FbxPolygonInfo`、`polygonSizesFromVertexIndex`、`readFbxPolygons`
- fbx-ascii.ts: `readFbxAsciiPolygons`
- fbx-binary.ts: `isFbxBinary`、`readFbxBinaryPolygons`

## 他フォルダとの関係

three の `OBJLoader` が返す非インデックス Mesh geometry と OBJ の file 順の面情報を結び付ける。`PolygonEdgeFBXLoader` は `FBXLoader` の出力を走査し、Model ID → Geometry ID の `Connections` 対応と Geometry の `PolygonVertexIndex` を結び付ける。ビューアの実際の結線は後続タスク135、描画用の属性利用や表示切替は `viewer/` が担当する。

## テスト

- tests/polygon-edges.test.ts: polygon edge 属性生成、既存属性の再適用、PolygonEdgeOBJLoader の Mesh 結線を検証する
- tests/obj-polygons.test.ts: OBJ のオブジェクト区切り、プリミティブ種別、面頂点数の読み取りを検証する
- tests/fbx-polygons.test.ts: FBX ASCII / バイナリの面情報と PolygonEdgeFBXLoader の結線を検証する
