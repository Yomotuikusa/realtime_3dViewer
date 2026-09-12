# joint

## 目的

各版の scene にジョイントを球、親子関係を線として重ね描きし、アニメーション中も現在位置へ追従させる。3D ビューでのジョイント選択と選択中マーカー、x-ray 表示の切り替えも提供する。

## ファイル一覧と役割

- joint-display.ts: Bone の収集、親子リンクの生成、球と線の overlay の作成・更新・x-ray 切り替え・破棄を提供する
- joint-pick.ts: overlay 内の Bone を画面座標へ投影し、クリック位置に最も近いジョイントのピック結果を選択へ変換する
- joint-highlight.ts: 選択中 Bone のワールド位置へ追従するオレンジのマーカーを作成・更新・破棄する
- JointRig.tsx: display・selection ストアと各版 scene を購読し、overlay と選択マーカーのライフサイクルおよび毎フレーム更新を管理する
- JointDisplayBar.tsx: ジョイント表示と x-ray 表示を常設アイコンバーで切り替え、display ストアを更新して `joint:display` を送信する
- joint-icons.tsx: ジョイントの骨と x-ray 面を表すインライン SVG アイコンと形状定数を提供する
- joint-labels.ts: ジョイント表示バーの日本語 aria-label / title 定数を提供する

## 公開インターフェイス

- joint-display.ts: `JOINT_OVERLAY_KEY`、色・サイズ・x-ray 定数、`JointLink`、`JointOverlay`、`collectJoints`、`jointLinks`、`jointRadius`、`addJointOverlay`、`jointOverlayOf`、`updateJointOverlay`、`setJointOverlayXray`、`removeJointOverlay`
- joint-pick.ts: `JOINT_PICK_RADIUS_PX`、`JointHit`、`pickJoint`、`jointSelectionOf`
- joint-highlight.ts: 選択マーカー定数、`SelectedJointMarker`、`addSelectedJointMarker`、`selectedJointMarkerOf`、`updateSelectedJointMarker`、`removeSelectedJointMarker`
- JointRig.tsx: `JointRig`
- JointDisplayBar.tsx: `JointDisplayBar({ send })`
- joint-icons.tsx: `JOINT_VIEW_BOX`、`JOINT_POINTS`、`JOINT_DOT_RADIUS`、`JOINT_LINK_PATH`、`JOINT_XRAY_SURFACE`、`JointIcon()`、`JointXrayIcon()`
- joint-labels.ts: `JOINT_DISPLAY_LABEL`、`JOINT_VISIBLE_LABEL`、`JOINT_XRAY_LABEL`

## 他フォルダとの関係

表示設定は display ストアの `jointDisplay`(ルーム共有・設計書 §13.5)。可視化と選択マーカーは `VIEWER_OVERLAY_KEY` を持つためアウトライナ・部位パス・表示モード・比較の対象にならない。配置は ReviewPage(107)。HUD への設置は `features/viewer/ViewerHud.tsx`。スタイルは viewer.css の `.hud-display` を再利用する。scene は compare の `useModelScenesStore` から取得し、描画更新は React Three Fiber の `useFrame` で行う。クリック選択は outliner の SelectionPickLayer から画面距離方式の joint-pick を先に試す。

## テスト

- joint-display.test.ts: ジョイント収集・リンク・overlay の構造・x-ray・raycast 無効化・破棄を検証する
- joint-pick.test.ts: overlay の可視性、画面距離、深度範囲、版順、選択変換を検証する
- joint-highlight.test.ts: 選択マーカーの idempotency、材質、位置更新、overlay 属性、破棄を検証する
- joint-update.test.ts: ボーンの現在位置、root ローカル座標、動的属性の更新を検証する
- joint-rig.test.ts: JointRig の store 購読、effect、frame loop、依存配列をソース検査する
- joint-display-bar.test.ts: ジョイント SVG アイコンの形状・属性、バーの切り替えと送信、ViewerHud への設置を検証する
