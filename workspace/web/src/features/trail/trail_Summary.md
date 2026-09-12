# trail

## 目的

選択した版のアニメーションクリップを参照のまま登録し、版内の Object3D を共有参照へ変換・解決し、クリップ全フレームの軌跡位置を root ローカル座標でサンプリングする。共有設定とサンプリング結果を結び付け、3D ビューへ折れ線・フレーム点・現在位置マーカーを重ね描きする。

## ファイル一覧と役割

- model-clips.ts: versionId ごとの AnimationClip 配列を参照のまま保持する Zustand レジストリと選択関数を提供する
- trail-target.ts: 登録 scene と Object3D の間で、重ね描きを除外した ObjectPartRef を相互変換する
- trail-sample.ts: 専用 AnimationMixer でクリップをフレーム単位に進め、対象の root ローカル位置を Float32Array に収集する
- trail-overlay.ts: サンプル座標から折れ線・フレーム点・現在位置マーカーを作り、重ね描きのライフサイクルを管理する
- TrailRig.tsx: display / scene / clip / playback ストアを購読し、軌跡の生成・破棄と毎フレームの現在位置更新を管理する

## 公開インターフェイス

- model-clips.ts: `ModelClipsState`、`useModelClipsStore`、`selectModelClips`
- trail-target.ts: `ResolvedTrailTarget`、`objectPartRefOf`、`resolveTrailTarget`
- trail-sample.ts: `MAX_TRAIL_FRAMES`、`TrailSample`、`sampleTrail`
- trail-overlay.ts: `TRAIL_OVERLAY_KEY`、色・倍率・描画順定数、`TrailOverlay`、`addTrailOverlay`、`trailOverlayOf`、`setTrailCurrentFrame`、`removeTrailOverlay`
- TrailRig.tsx: `TrailRig`

## 他フォルダとの関係

`useModelScene` が各版の loader から受け取った AnimationClip 配列を登録する。`trail-target` は compare の scene レジストリと outliner の plain tree / path 解決を利用する。`trail-sample` は viewer の秒・フレーム変換を利用し、描画や再生用 Rig には依存しない。`TrailRig` は display / compare / playback ストアと joint の半径計算を利用し、`ReviewPage` の `ViewerCanvas` 内で `JointRig` の後に配置される。オーバーレイは `VIEWER_OVERLAY_KEY` を持つため、アウトライナ・表示モード・比較・部位可視・選択・ジョイント収集から除外される。

## テスト

- tests/model-clips.test.ts: クリップ登録、同一参照の通知抑止、条件付き解除、選択、reset を検証する
- tests/trail-target.test.ts: ObjectPartRef の生成・解決、重ね描き除外、往復変換を検証する
- tests/trail-sample.test.ts: フレーム数、位置補間、root ローカル変換、ポーズ復元、Mixer 破棄を検証する
- tests/trail-overlay.test.ts: 軌跡の3子構成、描画設定、現在位置更新、再生成、リソース破棄を検証する
- tests/trail-rig.test.ts: TrailRig のストア購読、条件付き生成、cleanup、frame loop、ReviewPage 配置をソース検査する
