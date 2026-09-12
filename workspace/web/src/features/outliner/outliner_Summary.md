# outliner

## 目的

読み込み済みモデルの scene 階層を、版ごとのルート行と種別アイコン付きの折りたたみツリーとして表示する。各ノードは重ね描きを数えない部位 path を持ち、行ごとの表示・非表示をルームへ共有する。行選択はローカルの selection ストアで管理する。

## ファイル一覧と役割

- outliner-tree.ts: three の scene から、重ね描きを除外したプレーンなアウトライナ木と部位 path を作り、ノード種別を判定し、path から Object3D を検索する
- visibility.ts: scene ルートを除く重ね描きでないオブジェクトへ、共有された非表示 path を再帰的に適用する
- VisibilityRig.tsx: objects ストアの `hiddenParts` と model-scenes ストアを購読し、版ごとの scene へ部位表示状態を同期する Canvas 用 Rig
- selection.ts: 選択中の版と Object3D uuid を保持する Zustand ストアと選択判定を提供する
- pick-selection.ts: 3D ビューのレイキャスト交点から、登録済み scene の版全体に対応する選択を解決する純粋関数を提供する
- SelectionPickLayer.tsx: annotation が通常モードのとき、Canvas の左クリックを版全体の選択または空クリックの解除へ結び付ける描画なし部品
- selection-highlight.ts: 選択対象と子孫へオレンジ(0xf97316、不透明度 0.6)の選択重ね描きを付け外しする純粋関数を提供する
- SelectionRig.tsx: 選択ストアと scene レジストリを購読し、選択重ね描きを管理する Canvas 用 Rig
- outliner-labels.ts: 見出し、表示列、状態、種別、名前、展開操作の表示文言を提供する
- outliner-icons.tsx: 7 種別のインライン SVG アイコン、表示列の瞳、展開用山形を提供する
- OutlinerRow.tsx: 1 行と再帰的なノード枝を treeitem/group として描画し、行ごとの表示チェックボックスを提供する
- Outliner.tsx: objects / model-scenes / selection ストアを購読し、版と scene 木を描画する。`send` で `object:visibility` と `object:part-visibility` を共有する
- outliner.css: アウトライナのレイアウト、インデント、展開、選択、非表示状態、表示列とチェックボックスを定義する

## 公開インターフェイス

- outliner-tree.ts: `OutlinerNodeKind`、`OutlinerNode`、`classifyObject`、`buildOutlinerTree`、`plainChildren`、`childPath`、`objectAtPath`、`toggleId`
- selection.ts: `OutlinerSelection`、`SelectionStoreState`、`useSelectionStore`、`isSelected`。`select` は同じ選択の再設定で state を更新しない
- pick-selection.ts: `versionOfObject`、`pickSelection`
- SelectionPickLayer.tsx: `SelectionPickLayer`
- selection-highlight.ts: `SELECTION_OVERLAY_KEY`、`SELECTION_COLOR`、`SELECTION_MESH_OPACITY`、`isSelectionOverlay`、`createSelectionOverlay`、`applySelectionHighlight`、`clearSelectionHighlight`
- SelectionRig.tsx: `SelectionRig`
- visibility.ts: `applyPartVisibility`
- VisibilityRig.tsx: `VisibilityRig`
- outliner-labels.ts: アウトライナ文言定数、`KIND_LABELS`、`nodeLabel`、`expandAriaLabel`、`visibilityAriaLabel`
- outliner-icons.tsx: `OUTLINER_ICON_VIEW_BOX`、各種アイコン、`EyeIcon`、`OUTLINER_KIND_ICONS`、`OutlinerKindIcon`
- OutlinerRow.tsx: `OutlinerRowProps`、`OutlinerRow`、`OutlinerBranchProps`、`OutlinerBranch`
- Outliner.tsx: `Outliner`

## 他機能との関係

版一覧は objects ストア、scene は compare の model-scenes ストア、選択は selection ストアで SelectionRig が読む。3D クリック選択は ReviewPage(105) の ViewerCanvas 内に配置する。
選択重ね描きは `VIEWER_OVERLAY_KEY` を持つので表示モード・比較・アウトライナ木から除外される。Rig の配置は ReviewPage(096)。
ビューア重ね描きの除外判定とメッシュアイコンの図案は viewer の既存公開インターフェイスを利用する。選択・展開状態はルームへ送信しない。表示・非表示は送信する(設計書 §13.5)。
部位の表示・非表示はルーム共有(設計書 §13.5)。鍵は uuid ではなく `path`(重ね描きを数えない子インデックス)。Rig は objects ストアの `hiddenParts` を読む。配置は ReviewPage(102)。
既知の制限として、Rig は hidden path にない部位を一律 `visible = true` に戻すため、読み込み時点で `visible = false` だったオブジェクトの状態は保持しない。

## テスト

- tests/outliner-tree.test.ts: 種別判定、階層、重ね描き除外、プレーン木、不変な展開切替を検証する
- tests/outliner-selection.test.ts: 選択の設定、解除、置換、clear、reset、判定を検証する
- tests/outliner-pick.test.ts: 登録 scene の祖先解決、可視・最近傍・重ね描き除外を含む 3D 版選択と SelectionPickLayer／ReviewPage のソース契約を検証する
- tests/outliner-labels.test.ts: 表示文言、種別ラベル、名前整形、展開 aria ラベルを検証する
- tests/outliner-styles.test.ts: アイコンの SVG 属性、CSS 状態規則、コンポーネントの構造を検証する
- tests/outliner-highlight.test.ts: 選択重ね描きの生成、適用、解除、Rig のソース契約を検証する
- tests/outliner-visibility.test.ts: 部位 path による可視性適用、重ね描き・root の保持、VisibilityRig のソース契約を検証する
