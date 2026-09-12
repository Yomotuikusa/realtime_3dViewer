# joint

## 目的

各版の scene にジョイントを球、親子関係を線として重ね描きし、アニメーション中も現在位置へ追従させる。x-ray 表示の切り替えも提供する。

## ファイル一覧と役割

- joint-display.ts: Bone の収集、親子リンクの生成、球と線の overlay の作成・更新・x-ray 切り替え・破棄を提供する
- JointRig.tsx: display ストアと各版 scene を購読し、Canvas 内で overlay のライフサイクルと毎フレーム更新を管理する

## 公開インターフェイス

- joint-display.ts: `JOINT_OVERLAY_KEY`、色・サイズ・x-ray 定数、`JointLink`、`JointOverlay`、`collectJoints`、`jointLinks`、`addJointOverlay`、`jointOverlayOf`、`updateJointOverlay`、`setJointOverlayXray`、`removeJointOverlay`
- JointRig.tsx: `JointRig`

## 他フォルダとの関係

表示設定は display ストアの `jointDisplay`(ルーム共有・設計書 §13.5)。可視化は `VIEWER_OVERLAY_KEY` を持つためアウトライナ・部位パス・選択・比較の対象にならない。配置は ReviewPage(107)。scene は compare の `useModelScenesStore` から取得し、描画更新は React Three Fiber の `useFrame` で行う。

## テスト

- joint-display.test.ts: ジョイント収集・リンク・overlay の構造・x-ray・raycast 無効化・破棄を検証する
- joint-update.test.ts: ボーンの現在位置、root ローカル座標、動的属性の更新を検証する
- joint-rig.test.ts: JointRig の store 購読、effect、frame loop、依存配列をソース検査する
