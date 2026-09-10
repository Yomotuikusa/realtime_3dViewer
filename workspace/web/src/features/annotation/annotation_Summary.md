# annotation

## 目的
表面または空間の描画基準でルームの線を描き、メッシュに埋もれた線を含む annotation レイヤーを表示する。

## ファイル一覧と役割
- StrokeLines.tsx: annotation ストアの透過表示設定を購読し、受け取った `Stroke[]` を通常線と必要な深度テスト無効の細い透過線として drei `Line` で描画する表示コンポーネント
- stroke-overlay.ts: `Stroke` から通常線・透過線の描画 spec を組み立てる定数・型・純粋関数
- RoomStrokes.tsx: annotation ストアのライブ線を表示順で描画し、2点以上の draft を現在色のプレビュー線として追加する Canvas 内レイヤー
- stroke-build.ts: 法線オフセット、モデルサイズ依存の `simplify`、送信可能性判定、Undo 用の自分の最新線の選択
- draw-plane.ts: カメラ位置と注視点から視線垂直な描画平面を作り、レイとの交点を求める純粋関数
- AnnotationLayer.tsx: Pen モード時だけ Canvas の DOM ポインターイベントを購読し、Alt なしの左ドラッグで表面または注視点の描画平面へ点を積み、終了時に `stroke:add` を送信する Canvas 内レイヤー。空間モードの平面は pointerdown 時に固定する
- AnnotationToolbar.tsx: ペンモード中の色・表面/空間の描画基準選択、自分の線の 1本戻す / 自分の線を消す、メッシュに埋もれた線の透過表示切替を提供するペン道具
- annotation.css: ペン道具と色ボタンのプレーン CSS

## 公開インターフェイス
- StrokeLines.tsx: `StrokeLines({ strokes, opacity? })`（annotation ストアの `overlay` を購読）
- stroke-overlay.ts: `BASE_LINE_WIDTH`、`OVERLAY_LINE_WIDTH`、`OVERLAY_OPACITY_RATIO`、`StrokeLineSpec`、`strokeLineSpecs`
- draw-plane.ts: `DrawPlane`、`DrawRay`、`PARALLEL_EPSILON`、`viewPlaneAt`、`intersectPlane`
- RoomStrokes.tsx: `RoomStrokes()`
- stroke-build.ts: `offsetAlongNormal`、`buildStroke`、`latestOwnStrokeId`
- AnnotationLayer.tsx: `AnnotationLayer({ send })`
- AnnotationToolbar.tsx: `AnnotationToolbar({ send })`（色・表面/空間の描画基準選択・1本戻す・自分の線を消す・`overlay` 切替）

## 他フォルダとの関係
`RoomStrokes` はライブ線を `orderedStrokes` の createdAt/id 順で `StrokeLines` に渡し、draft が2点以上ならプレビュー線を1本追加する。`StrokeLines` はライブ線とコメント再現線の
双方で同じ `overlay` 設定を購読し、通常線に加えて必要な場合だけ深度テスト無効の細い透過線を重ねる。
`AnnotationLayer` は Pen モード中だけ
`gl.domElement` の pointerdown / pointermove / pointerup / pointercancel を購読し、表面モードでは
ヒット点を `offsetAlongNormal` でモデル表面から少し浮かせて draft に追加する。空間モードでは実カメラ位置と
`selfCamera.target` から作った、注視点を通る視線垂直平面へレイを投影し、pointerdown 時の平面を
ストローク中固定するためモデルの外でも線が続き、法線オフセットは適用しない。終了時に `buildStroke` で
間引き、接続が open かつ selfId がある場合だけ `stroke:add` を送信する。draft は終了時に消し、
送信した線はサーバー配信を待つためローカルへ追加しない。
viewer_Summary.md を参照。

## テスト
- tests/draw-plane.test.ts: 視線垂直な描画平面の生成、レイとの交差、平行/後方/始点交差の除外、非破壊性のテスト
- tests/stroke-build.test.ts: 線の法線オフセット、間引き、送信可能性、Undo 対象選択のテスト
- tests/stroke-overlay.test.ts: 通常線・深度テスト無効の透過線 spec の順序、props、透明度、非破壊性のテスト
