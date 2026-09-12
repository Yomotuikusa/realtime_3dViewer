# trail

## 目的

選択した版のアニメーションクリップを参照のまま登録し、版内の Object3D を共有参照へ変換・解決し、クリップ全フレームの軌跡位置を root ローカル座標でサンプリングする。

## ファイル一覧と役割

- model-clips.ts: versionId ごとの AnimationClip 配列を参照のまま保持する Zustand レジストリと選択関数を提供する
- trail-target.ts: 登録 scene と Object3D の間で、重ね描きを除外した ObjectPartRef を相互変換する
- trail-sample.ts: 専用 AnimationMixer でクリップをフレーム単位に進め、対象の root ローカル位置を Float32Array に収集する

## 公開インターフェイス

- model-clips.ts: `ModelClipsState`、`useModelClipsStore`、`selectModelClips`
- trail-target.ts: `ResolvedTrailTarget`、`objectPartRefOf`、`resolveTrailTarget`
- trail-sample.ts: `MAX_TRAIL_FRAMES`、`TrailSample`、`sampleTrail`

## 他フォルダとの関係

`useModelScene` が各版の loader から受け取った AnimationClip 配列を登録する。`trail-target` は compare の scene レジストリと outliner の plain tree / path 解決を利用する。`trail-sample` は viewer の秒・フレーム変換を利用し、描画や再生用 Rig には依存しない。

## テスト

- tests/model-clips.test.ts: クリップ登録、同一参照の通知抑止、条件付き解除、選択、reset を検証する
- tests/trail-target.test.ts: ObjectPartRef の生成・解決、重ね描き除外、往復変換を検証する
- tests/trail-sample.test.ts: フレーム数、位置補間、root ローカル変換、ポーズ復元、Mixer 破棄を検証する
