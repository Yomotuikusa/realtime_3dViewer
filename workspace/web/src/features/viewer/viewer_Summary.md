# viewer

## 目的
Canvas、モデル、カメラ、ライティング、焦点距離、HUD、ポインター入力を合成した 3D ビューアを提供する。

## ファイル一覧と役割
- ViewerCanvas.tsx: Canvas、ライティング、焦点距離、Bounds、モデル、カメラを合成するビューア。`children` は RemoteCameras / StrokeLines / AnnotationLayer など後続機能の差し込み口
- SceneLights.tsx: lighting ストアの角度から環境光・主ライト・反転した補助ライトを Bounds 外へ描画する
- LightGizmo.tsx: 枠なしで3Dビュー右下へ重ねる、Y軸まわりに45°回転した立方体ギズモを描画し、水平ドラッグ・矢印キー・リセットをライトストアへ接続する
- light-gizmo.ts: ギズモの寸法・回転・カメラ定数、マーカー座標、ドラッグ／キー入力、yaw 表示の純粋関数
- FocalLengthRig.tsx: camera ストアの焦点距離を PerspectiveCamera の垂直画角へ反映する描画なしの Rig。Bounds の計算対象外
- FocalLengthSlider.tsx: HUD 内で焦点距離を 14〜300mm の範囲で変更するスライダー。ラベルと値を上段、入力を下段に配置する
- focal-length.ts: 固定センサー高を使う焦点距離／垂直画角の換算と既定画角
- CameraMenu.tsx: 焦点距離、枠と影を持つ十字配置の既定視点・全体表示・視点リセットを3ブロックに分けて描画するカメラメニュー本体。操作後もメニューを閉じない
- ViewerHud.tsx: ペン／コメントの toggle ボタンとペン道具を左上に、最初から展開した半透明カメラパネルを右上に表示し、CameraMenu、LightGizmo、Follow 中の参加者色フレームと左端に接して面の全高を占める参加者色の縦帯・不透明な面の上辺タブ、描画基準、操作ヒントを各ストアと keymap に接続する。メニュー内の Escape はメニューだけを閉じる
- HudMenu.tsx: カメラのトグルボタンと、開いているときだけ表示する `role="group"` パネルを描画する制御コンポーネント。開閉用の chevron を表示し、Escape の閉じ処理を親へ通知する
- hud-menu.ts: HUD メニューの ID・順序・表示名、初期表示メニューとトグルの純粋な状態遷移
- hud-labels.ts: ツールモード・色・Follow・視点操作・ライトギズモ・焦点距離・十字中央／視点グループ・透過表示・描画基準・ヒントの日本語文言と純粋な判定関数
- view-presets.ts: 正面／背面／右／左の向き、十字セルと並び順、距離を保ったプリセットカメラ計算、既定視点一致判定と回転ロック判定
- lighting.ts: ワールド固定ライトの角度の正規化・クランプ・ドラッグ回転と主／補助ライト座標を提供する
- ModelMesh.tsx: 同一オリジン用の LoadingManager を指定して `useGLTF` でモデルをロードし、バウンディングボックスからモデルサイズを記録して初回 Fit を要求する。ロード中の `scene` を共通モデルターゲットへ登録し、アンマウント時に解除する。Draco 圧縮時のデコーダ取得（`https://www.gstatic.com/...`）は drei の別 manager による外部依存として残る
- model-loading.ts: glTF の `buffers` / `images` などが参照する data/blob URI と同一オリジン URL だけを許可する LoadingManager を作り、外部 URL を `about:blank` に置換する
- model-target.ts: React や Zustand に依存せず、現在のレイキャスト対象 `Object3D` を保持する `setModelTarget` / `getModelTarget`
- fit-camera.ts: 初期視点と同じ斜め方向からモデル全体を見る Fit カメラ目標を純粋関数で作る
- pick.ts: Canvas 座標を NDC に変換し、共通モデルターゲットへ最近傍レイキャストを行う。交点と、逆転置の法線行列で変換して正規化したワールド系法線を返す
- follow.ts: Follow 対象のカメラと焦点距離の妥当性判定、共有カメラ関数を使った 1 フレーム分の補間
- camera-animation.ts: 既定視点・視点再現の400ms時間基準アニメーションと ease-out 補間を提供する
- CameraRig.tsx: OrbitControls を常時有効にしてカメラストアと同期し、Reset・Fit・時間基準のカメラ再現・Follow を処理する。Fit はモデル本体の箱から `fitCamera` で目標を作り `requestCamera` に積む(`Bounds` 内部補間は使わない)。既定視点ちょうどの向きでは `enableRotate` を false にし、Follow 中は回転ロックしない。OrbitControls の減衰を無効にし操作は即時反映する。補間中のユーザー操作で補間を中断する。Follow 中だけ対象の焦点距離もカメラストアへ反映し、controls.domElement に Alt 操作、右ドラッグ dolly、Shift+右ドラッグのライト回転を接続する
- camera-input.ts: OrbitControls の Alt／非 Alt 時のマウス割り当てと、target からの距離を指数的に変える右ドラッグ dolly の純粋関数
- viewer-pointer.ts: controls.domElement へ Maya 式の pointer、contextmenu、マウス抑止イベントを接続し、右ドラッグ dolly／Shift+右ドラッグのライト回転と後始末を提供する
- camera-throttle.ts: `CameraPayload`（カメラと焦点距離）を最新値だけ保持し、`payloadEquals` で両方を比較しながら送信成功時刻から 50ms ごとの先頭送信と窓明けトレーリング送信を行う。送信失敗は未送信としてタイマーまたは次の更新で再試行し、破棄時に保留送信をキャンセルする
- useCameraBroadcast.ts: `selfCamera` または焦点距離の変更を `camera-throttle` へ渡し、`camera` メッセージへ焦点距離を載せる。送信成功時に自分の presence カメラと焦点距離も更新する。`shouldSendCamera` は従来の判定インターフェイスとして公開する
- viewer.css: HUD のモード選択、枠線と影付きの右上カメラメニュー、焦点距離スライダー、カメラメニューのブロック区切りと十字配置、Follow 中の参加者色フレームと左端に接して面の全高を占める参加者色の縦帯・不透明な面の上辺タブ、操作ヒント、160px の枠を持たないライトギズモのプレーン CSS

## 公開インターフェイス
- ViewerCanvas.tsx: `ViewerCanvas({ modelSrc, children? })`
- SceneLights.tsx: `SceneLights()`
- LightGizmo.tsx: `LightGizmo()`。回転した立方体、固定カメラに収まるライトマーカー、水平入力、リセットボタンを描画する
- light-gizmo.ts: `GIZMO_SIZE_PX`、`GIZMO_BOX_ROTATION_Y` などのギズモ定数、`gizmoMarkerPosition`、`gizmoDragStep`、`gizmoKeyDeltaX`、`yawDegrees`、`yawText`
- FocalLengthRig.tsx: `FocalLengthRig()`
- FocalLengthSlider.tsx: `FocalLengthSlider()`。ラベル・値とスライダーを別段に描画する
- CameraMenu.tsx: `CameraMenu()`。焦点距離、十字の既定視点／全体表示、視点リセットを描画し、操作後もカメラ要求だけを行う
- focal-length.ts: `SENSOR_HEIGHT_MM`、`FOCAL_LENGTH_STEP_MM`、`fovFromFocalLength`、`focalLengthFromFov`、`DEFAULT_FOV`
- ViewerHud.tsx: `ViewerHud({ send })`。カメラメニュー本体を `CameraMenu` に、ライト操作ギズモを `LightGizmo` に委譲する
- HudMenu.tsx: `HudMenu({ id, open, onToggle, onClose, children })`。カメラメニューの開閉 state を持たず、Escape を親へ通知する
- hud-menu.ts: `HudMenuId`、`HUD_MENU_ORDER`、`HUD_MENU_LABELS`、`HUD_MENU_INITIAL`、`toggleHudMenu`
- hud-labels.ts: `ToolMode`、`MODE_LABELS`、`MODE_ORDER`、`VIEW_PRESET_LABELS`、`FIT_SHORT_LABEL`、`VIEW_PRESETS_LABEL`、`PLACEMENT_LABELS`、`PLACEMENT_ORDER`、各種ラベル（`FOCAL_LENGTH_LABEL` / `OVERLAY_LABEL` / `LIGHT_DIRECTION_LABEL` / `LIGHT_RESET_LABEL` を含む）、`focalLengthText`、`colorName`、`followingLabel`、`HintInput`（`placement` を含む）、`hint`、`withShortcut`
- view-presets.ts: `ViewPreset`、`VIEW_PRESET_ORDER`、`GridCell`、`VIEW_CROSS_CENTER`、`VIEW_PRESET_CELLS`、`VIEW_PRESET_DIRECTIONS`、`MIN_PRESET_DISTANCE`、`PRESET_MATCH_EPSILON`、`presetCamera`、`matchViewPreset`、`rotationLocked`
- lighting.ts: `LightAngles`、ライト定数、`normalizeYaw`、`clampPitch`、`rotateLight`、`lightPosition`、`fillLightPosition`
- ModelMesh.tsx: `ModelMesh({ src })`
- camera-throttle.ts: `CameraPayload`、`payloadEquals`、`CameraThrottleDeps`、`CameraThrottle`、`createCameraThrottle`
- model-loading.ts: `BLOCKED_RESOURCE_URL`、`resolveModelResourceUrl`、`createModelLoadingManager`
- model-target.ts: `setModelTarget(obj)`、`getModelTarget()`
- pick.ts: `toNdc(rect, clientX, clientY)`、`pickModel(raycaster, camera, ndc, target)`
- follow.ts: `FOLLOW_LERP_T`、`FollowTarget`、`followTargetCamera`、`followStep`
- camera-animation.ts: `CAMERA_ANIMATION_DURATION_MS`、`CameraAnimation`、`easeOutCubic`、`startCameraAnimation`、`stepCameraAnimation`
- CameraRig.tsx: `CameraRig()`
- fit-camera.ts: `FIT_DIRECTION`、`fitCamera(center, distance)`
- camera-input.ts: `ViewerMouseButtons`、`MOUSE_BUTTONS_ALT`、`MOUSE_BUTTONS_IDLE`、`mouseButtonsFor`、`DOLLY_SPEED`、`MIN_DOLLY_DISTANCE`、`dollyPosition`
- viewer-pointer.ts: `ViewerControlsLike`、`ViewerPointerDeps`、`attachViewerPointer(controls, deps)`
- useCameraBroadcast.ts: `shouldSendCamera`、`useCameraBroadcast(send)`

## 他フォルダとの関係
`CameraRig` は Reset 発生時に未消費の `pendingCamera` も破棄し、Reset 後の古い再現要求が補間を開始しないようにする。`selfCamera` の派生 boolean で既定視点ちょうどの向きだけ `OrbitControls.enableRotate` を無効化する。Follow 中は、回転無効時には OrbitControls の `start` が発火せず操作で `presence.unfollow()` できなくなるためロックしない。
CameraRig の毎フレーム処理は D27 の優先順位に従う。

`ViewerHud` は右上のカメラメニューをローカル state だけで管理し、初期状態では半透明パネルを展開して右下へ `LightGizmo` を常設する。
3D ビューや他の HUD の pointerdown では閉じず、トグルボタンまたはメニュー内の Escape だけで折りたたむ。Escape はショートカットの
`clearMode` へ伝播せずメニューだけを閉じる。
`selfCamera` をクリック時に読み、`presetCamera` で注視点と距離を保った視点を作ってカメラストアの
`requestCamera` へ積む。全体表示はモデル本体の箱だけを `bounds.refresh(modelTarget)` で計算し、初期視点と同じ斜め方向の目標を `fitCamera` で作って同じ `requestCamera` へ積む。要求は `CameraRig` が開始時のカメラを固定し、既定視点と同じ補間を行う。補間中の Alt 操作・ホイール・右ドラッグ dolly は補間を中断し、消費時と操作時に Follow を解除する。
到達時は目標をストアへ完全一致で保存する。
`FocalLengthRig` は焦点距離を固定センサー高から換算した垂直画角として PerspectiveCamera に適用し、
`FocalLengthSlider` はその値をローカルに変更する。焦点距離は `camera` WebSocket メッセージへ載せるが、コメントや localStorage には保存しない。

| 状況 | 動作 |
| --- | --- |
| `resetSeq` が増えた | `DEFAULT_CAMERA` へ即座に戻し、追従中なら `presence.unfollow()`。 |
| `fitSeq` が増えた | モデル本体の箱から斜め方向の Fit 目標を作り、`requestCamera` に積む。`Bounds` 内部補間は使わない。 |
| `pendingCamera` が非 null | controls があるフレームで消費し、開始時のカメラから 400ms 補間する。controls がない場合は持ち越す。 |
| 補間中 | 経過時間に応じて ease-out で進め、通常フレームは epsilon 更新、到達フレームは exact 更新して補間をクリアする。操作開始時は補間を中断する。 |
| `followTargetCamera(...)` が非 null | `followStep` の結果をカメラと `controls.target` に適用し、到達後も追従を継続する。 |
| それ以外 | カメラを変更しない。 |

カメラ操作とライト回転は `CameraRig` が `useThree().controls` の `OrbitControls` に `attachViewerPointer` を接続する。Shift+右ドラッグはカメラを動かさず、lighting ストアだけを更新する。
常時有効な OrbitControls の割り当ては、Alt なしでは全ボタンを無効、Alt 押下中は左回転・中パン・右無効とし、
ホイールは常に OrbitControls の dolly を使う。右ドラッグだけは `dollyPosition` でカメラ位置を変更し、
左／中ドラッグは OrbitControls に任せる。入力開始時は Follow を解除し、カメラ更新は既存の epsilon 判定付きストアへ渡す。

OrbitControls の `start` はユーザー操作として `presence.unfollow()` を呼び、追従によるプログラム更新では解除しない。
`useCameraBroadcast` は selfCamera または焦点距離の変更を `createCameraThrottle` へ渡し、前回送信から
`CAMERA_SEND_INTERVAL_MS` 以上かつ `payloadEquals` で異なる場合だけ、camera と焦点距離を送信する。
窓内の最新値はタイマーで送信し、送信成功値を複製して保持する。送信成功時は自分の presence カメラと
焦点距離も更新し、Follow 中も送信を継続する。`followTargetCamera` は対象の焦点距離を未送信なら
`null` として返し、`CameraRig` は Follow 中だけその値を補間せずに自分の camera ストアへ適用する。
presence_Summary.md を参照。

後続の viewer 機能は `ViewerCanvas` の `children` 差し込み口に RemoteCameras / StrokeLines /
AnnotationLayer などのレイヤーを追加する。`ModelMesh` が登録する `model-target` を `pickModel` に渡すと、
Canvas のクライアント座標を NDC 化して再帰的にモデルをレイキャストでき、交点法線はヒットした
オブジェクトの `matrixWorld` の逆転置法線行列でワールド系へ変換して正規化される。

## テスト
- tests/camera-broadcast.test.ts: カメラ送信 throttle の間隔・比較判定テスト
- tests/camera-input.test.ts: Alt／非 Alt のマウス割り当て、指数 dolly、最小距離、入力配列非破壊のテスト
- tests/camera-throttle.test.ts: `payloadEquals`、焦点距離を含む先頭送信、最新値のトレーリング、重複抑止、送信失敗の再試行、破棄時キャンセルのテスト
- tests/focal-length.test.ts: 焦点距離と垂直画角の換算テスト
- tests/follow.test.ts: Follow 対象のカメラ・焦点距離の判定、複製、補間、収束テスト
- tests/camera-animation.test.ts: ease-out補間、独立複製、時間基準の開始前・途中・到達・NaN、CameraRig の減衰無効化のソース検査
- tests/fit-camera.test.ts: Fit 方向・距離・中心の非破壊性、既定視点非一致、CameraRig の Bounds 内部補間を使わないことのソース検査
- tests/hud-labels.test.ts: HUD のモード・操作・透過表示・描画基準・Follow・既定視点文言とヒントのテスト
- tests/hud-menu.test.ts: HUD メニューの初期表示、順序・表示名、トグルの純粋関数テスト
- tests/light-gizmo.test.ts: ライトギズモの定数、回転、カメラ視野、座標・入力・表示の純粋関数テスト
- tests/lighting.test.ts: ライト角度の正規化・クランプ・ドラッグ回転・主／補助ライト座標を検証
- tests/model-loading.test.ts: 埋め込み・同一オリジン URL の許可、外部 URL の遮断、LoadingManager の URL modifier のテスト
- tests/model-target.test.ts: モデルターゲットの登録・取得テスト
- tests/pick.test.ts: NDC 変換、モデルの再帰レイキャスト、ワールド法線変換テスト
- tests/view-presets.test.ts: 既定視点の方向・順序・単位ベクトル・距離維持・最小距離・非破壊性、既定視点一致と回転ロック判定のテスト
- tests/viewer-pointer.test.ts: capture phase の割り当て、Alt+右ドラッグ dolly、pointer capture、継続・終了・ブラウザ既定動作抑止、cleanup のテスト
- tests/viewer-styles.test.ts: 半透明で上下に結合したカメラメニュー、初期展開と操作後の非クローズ、カメラメニューのボタン影、160px のライトギズモとヒントの退避幅、ライトギズモの枠廃止、シャドウトークン、Follow フレームと上辺タブ、CSS セレクタ完全一致のテキスト検査
