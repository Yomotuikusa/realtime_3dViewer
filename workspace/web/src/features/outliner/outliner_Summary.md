# outliner

## 目的

読み込み済みモデルの scene 階層を、版ごとのルート行と種別アイコン付きの折りたたみツリーとして表示する。行選択はローカルの selection ストアで管理する。

## ファイル一覧と役割

- outliner-tree.ts: three の scene から、重ね描きを除外したプレーンなアウトライナ木を作り、ノード種別を判定する
- selection.ts: 選択中の版と Object3D uuid を保持する Zustand ストアと選択判定を提供する
- selection-highlight.ts: 選択対象と子孫へ accent 色の選択重ね描きを付け外しする純粋関数を提供する
- SelectionRig.tsx: 選択ストアと scene レジストリを購読し、選択重ね描きを管理する Canvas 用 Rig
- outliner-labels.ts: 見出し、状態、種別、名前、展開操作の表示文言を提供する
- outliner-icons.tsx: 7 種別のインライン SVG アイコンと展開用山形を提供する
- OutlinerRow.tsx: 1 行と再帰的なノード枝を treeitem/group として描画する
- Outliner.tsx: objects / model-scenes / selection ストアを購読し、版と scene 木を描画する
- outliner.css: アウトライナのレイアウト、インデント、展開、選択、非表示状態を定義する

## 公開インターフェイス

- outliner-tree.ts: `OutlinerNodeKind`、`OutlinerNode`、`classifyObject`、`buildOutlinerTree`、`toggleId`
- selection.ts: `OutlinerSelection`、`SelectionStoreState`、`useSelectionStore`、`isSelected`
- selection-highlight.ts: `SELECTION_OVERLAY_KEY`、`SELECTION_COLOR`、`SELECTION_MESH_OPACITY`、`isSelectionOverlay`、`createSelectionOverlay`、`applySelectionHighlight`、`clearSelectionHighlight`
- SelectionRig.tsx: `SelectionRig`
- outliner-labels.ts: アウトライナ文言定数、`KIND_LABELS`、`nodeLabel`、`expandAriaLabel`
- outliner-icons.tsx: `OUTLINER_ICON_VIEW_BOX`、各種アイコン、`OUTLINER_KIND_ICONS`、`OutlinerKindIcon`
- OutlinerRow.tsx: `OutlinerRowProps`、`OutlinerRow`、`OutlinerBranchProps`、`OutlinerBranch`
- Outliner.tsx: `Outliner`

## 他機能との関係

版一覧は objects ストア、scene は compare の model-scenes ストア、選択は selection ストアで 095 の Rig が読む、配置は 096 の ReviewPage。
選択重ね描きは `VIEWER_OVERLAY_KEY` を持つので表示モード・比較・アウトライナ木から除外される。Rig の配置は ReviewPage(096)。
ビューア重ね描きの除外判定とメッシュアイコンの図案は viewer の既存公開インターフェイスを利用する。選択・展開状態はルームへ送信しない。

## テスト

- tests/outliner-tree.test.ts: 種別判定、階層、重ね描き除外、プレーン木、不変な展開切替を検証する
- tests/outliner-selection.test.ts: 選択の設定、解除、置換、clear、reset、判定を検証する
- tests/outliner-labels.test.ts: 表示文言、種別ラベル、名前整形、展開 aria ラベルを検証する
- tests/outliner-styles.test.ts: アイコンの SVG 属性、CSS 状態規則、コンポーネントの構造を検証する
- tests/outliner-highlight.test.ts: 選択重ね描きの生成、適用、解除、Rig のソース契約を検証する
