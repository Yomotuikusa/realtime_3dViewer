# layout

## 目的

横または縦の境界をポインター／キーボードでリサイズする共通部品と、レイアウト寸法の localStorage 保存を提供する。

## ファイル一覧と役割

- resize.ts: リサイズ軸・向き、寸法仕様、範囲丸め、パネル上限、ドラッグ値、キー操作値の純粋関数
- layout-storage.ts: レイアウト寸法の localStorage 読み書きと不正値・例外の処理
- useLayoutSize.ts: 保存済み寸法を初期値にする React state hook
- useElementSize.ts: ResizeObserver または初回の DOM 測定で要素サイズを追従する hook
- ResizeHandle.tsx: pointer capture、ダブルクリック、キーボード操作を扱う separator 要素
- layout.css: ハンドルの共通配置寸法、カーソル、状態表示

## 公開インターフェイス

- resize.ts: `ResizeAxis`、`ResizeSide`、`ResizeDrag`、`LayoutSizeName`、`SizeSpec`、各寸法定数（`OUTLINER_WIDTH_MIN_PX` / `OUTLINER_WIDTH_DEFAULT_PX` を含む）、`LAYOUT_SIZE_SPECS`、`clampSize`、`panelWidthMax`、`outlinerWidthMax`、`resizeDragValue`、`resizeKeyValue`
- layout-storage.ts: `LAYOUT_STORAGE_KEY`、`loadLayoutSize`、`saveLayoutSize`
- useLayoutSize.ts: `useLayoutSize(name)`
- useElementSize.ts: `ElementSize`、`useElementSize(ref)`
- ResizeHandle.tsx: `ResizeHandleProps`（`side` は省略時 `"end"`）、`ResizeHandle(props)`

## 他機能との関係

`ReviewPage` は `.review-body` の幅を `useElementSize` で測り、`panelWidthMax` と `useLayoutSize("panelWidth")` を使って右サイドパネルの幅を決める。タスク 065 のタイムライン高さも同じ寸法仕様・ハンドル・保存 API を利用できる。左ドック（outliner）は `useLayoutSize("outlinerWidth")` と `side="start"` を使う。

## テスト

- tests/resize.test.ts: 寸法定数、丸め、パネル上限、予約幅、ドラッグ値、向き・軸ごとのキー操作、ハンドル配線のテスト
- tests/layout-storage.test.ts: レイアウト寸法の保存・読み出し、不正値、既存値保持、localStorage 例外のテスト
- tests/layout-styles.test.ts: 共通ハンドル CSS と ReviewPage の接続をソース検査
