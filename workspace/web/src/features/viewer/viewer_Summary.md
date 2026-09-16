# viewer

## 目的
Canvas、モデル、カメラ、ライティング、焦点距離、内蔵アニメーション再生、HUD、ポインター入力を合成した 3D ビューアを提供する。FBX / OBJ の多角形輪郭辺も表示する。

## ファイル一覧と役割
- ViewerCanvas.tsx: Canvas、ライティング、焦点距離、Bounds、全オブジェクト、カメラを合成するビューア。display ストアの `meshDisplay` と各版の `fileName` をモデルへ渡し、theme ストアの `background` を Canvas の背景へ渡し、`MeshCompareRig` を一つ配置する。版ごとのモデルを単一 group に置き、その group を共通モデルターゲットへ登録する。`children` は RemoteCameras / StrokeLines / AnnotationLayer など後続機能の差し込み口
- SceneLights.tsx: lighting ストアの角度から環境光・主ライト・反転した補助ライトを Bounds 外へ描画する
- LightGizmo.tsx: 枠なしで3Dビュー右下へ重ねる、Y軸まわりに45°回転した立方体ギズモを描画し、水平ドラッグ・矢印キー・リセットをライトストアへ接続する
- light-gizmo.ts: ギズモの寸法・回転・カメラ定数、マーカー座標、ドラッグ／キー入力、yaw 表示の純粋関数
- FocalLengthRig.tsx: camera ストアの焦点距離を PerspectiveCamera の垂直画角へ反映する描画なしの Rig。Bounds の計算対象外
- ClipPlanesRig.tsx: camera ストアのモデル最大辺長から PerspectiveCamera の near / far を反映する描画なしの Rig。Bounds の計算対象外
- clip-planes.ts: モデルサイズからカメラの near / far を求める比率と `clipPlanesFor` を提供する
- FocalLengthSlider.tsx: HUD 内で焦点距離を 14〜300mm の範囲で変更するスライダー。ラベルと値を上段、入力を下段に配置する
- focal-length.ts: 固定センサー高を使う焦点距離／垂直画角の換算と既定画角
- CameraMenu.tsx: 焦点距離、枠と影を持つ十字配置の既定視点・全体表示・視点リセットを3ブロックに分けて描画するカメラメニュー本体。操作後もメニューを閉じない
- ViewerHud.tsx: ペン／コメントの toggle ボタンとペン道具、常設のメッシュ表示モードバー・ジョイント表示バー・モーション軌跡バー、排他的に開閉する半透明のカメラメニュー、CameraMenu、LightGizmo、Follow 中の参加者色フレーム、描画基準、操作ヒントを各ストアと keymap に接続する。再生 UI はビュー下部の timeline 機能へ委譲する
- DisplayModeBar.tsx: `useDisplayStore` のメッシュ表示方法をアイコン3択バーへ反映し、選択時にローカル更新して `mesh:display` をルームへ送信する
- display-icons.tsx: 共通の正六角形アイソメ立方体から、メッシュ・ワイヤフレーム・メッシュ+ワイヤのインライン SVG アイコンを描画する
- HudMenu.tsx: カメラのトグルボタンと、開いているときだけ表示する `role="group"` パネルを描画する制御コンポーネント。開閉用の chevron を表示し、Escape の閉じ処理を親へ通知する
- hud-menu.ts: HUD のカメラメニューの ID・順序・表示名、初期状態と排他的トグルの純粋な状態遷移
- playback.ts: AnimationClip の名前・長さの要約、選択クリップ長、時刻の clamp とループ前進を提供する純粋関数
- playback-frames.ts: glTF のキー時刻から fps を判定し、秒と表示フレームを変換する純粋関数
- playback-driver.ts: AnimationMixer の単一クリップ action の切替、絶対時刻適用、対象外の停止と破棄を担う Three.js ドライバ
- playback-source.ts: 登録済みクリップからアニメーション付き版を number 順に抽出し、ルーム指定を優先して再生対象を解決する純粋関数
- playback-source-sync.ts: 解決した実 AnimationClip の要約・fps・sourceId を playback ストアへ同期し、利用者操作の source 切替を送信する処理
- usePlaybackSource.ts: objects、model-clips、display の購読から再生対象、対象クリップ、アニメーション付き版一覧を useMemo で解決する hook
- PlaybackSourceSync.tsx: Canvas 内で解決済みの再生対象を playback ストアへ同期する描画なしの部品
- PlaybackClock.tsx: Canvas に一つだけ配置し、再生中の playback 時刻を毎フレーム一度だけ進める描画なしの部品
- PlaybackRig.tsx: 各モデルの playback ストアの sourceId が一致するときだけ clipIndex と time を AnimationMixer へ反映し、それ以外を初期ポーズへ戻す描画なしの Rig。時刻は進めない
- hud-labels.ts: HUD のモード、カメラ／ライト、メッシュ表示、Follow、透過表示、描画基準、ヒントの日本語文言と純粋な判定関数
- view-presets.ts: 正面／背面／右／左の向き、十字セルと並び順、距離を保ったプリセットカメラ計算、既定視点一致判定と回転ロック判定
- lighting.ts: `@shared/types` 由来の `LightAngles` を再エクスポートし、ワールド固定ライトの角度の正規化・クランプ・ドラッグ回転と主／補助ライト座標を提供する
- ModelMesh.tsx: 拡張子から形式を判別して glTF / `PolygonEdgeFBXLoader` / `PolygonEdgeOBJLoader` へ割り、`useModelScene` で共通接続する。形式ごとに同一オリジン用の LoadingManager を指定し、読み込み前に `installFbxSkinCompat()` を呼び、`visible` を scene に反映する。OBJ は材質なしの単色表示、FBX はスケール補正なしとする。Draco 圧縮時のデコーダ取得（`https://www.gstatic.com/...`）は drei の別 manager による外部依存として残る
- fbx-compat.ts: FBXLoader が未対応の Model を Group または Bone にしてスキンを適用しようとする場合に、no-op の `bind` で該当ノードのスキン適用だけを読み飛ばす
- useModelScene.ts: 読み込み済みの glTF / FBX / OBJ の scene を共通処理へ接続する。primary のモデルだけバウンディングボックスからモデルサイズを記録して初回 Fit を要求し、全版の `animations` を trail のクリップレジストリへ登録する。theme ストアの `wireframe` を数値化して `meshDisplay` を全 Mesh へ適用し、アンマウント時は solid に戻す。`versionId` と scene を比較用レジストリへ登録し、アンマウント時に同じ参照だけを解除する
- polygon-edge-material.ts: `MeshBasicMaterial` に多角形輪郭辺の attribute / varying / discard を注入する 1px 固定の shader 材質を生成し、属性付き材質の判定を提供する
- mesh-display.ts: MeshDisplayMode に応じた材質の wireframe / polygon offset 切替と、通常メッシュへ追従する raycast 無効のワイヤフレーム重ね描きを冪等に管理する。多角形属性付き Mesh は wireframe 時に輪郭辺材質へ差し替え、solid-wireframe 時は輪郭辺材質の重ね描きを使い、元材質を復元・破棄する。ワイヤフレーム色は既定値または呼び出し側の `0xrrggbb` を受け取る。ワイヤフレームと比較重ね描きを共通の `VIEWER_OVERLAY_KEY` で識別し、表示方法の走査から除外する
- model-loading.ts: glTF の `buffers` / `images` などが参照する data/blob URI と同一オリジン URL だけを許可する LoadingManager を作り、外部 URL を `about:blank` に置換する
- model-target.ts: React や Zustand に依存せず、現在のレイキャスト対象 `Object3D` を保持する `setModelTarget` / `getModelTarget`
- fit-camera.ts: 初期視点と同じ斜め方向からモデル全体を見る Fit カメラ目標を純粋関数で作る
- pick.ts: Canvas 座標を NDC に変換し、共通モデルターゲットへ可視な祖先だけを対象に最近傍レイキャストを行う。交点と、逆転置の法線行列で変換して正規化したワールド系法線を返す
- follow.ts: Follow 対象のカメラと焦点距離の妥当性判定、共有カメラ関数を使った 1 フレーム分の補間
- camera-animation.ts: 既定視点・視点再現の400ms時間基準アニメーションと ease-out 補間を提供する
- CameraRig.tsx: OrbitControls を常時有効にしてカメラストアと同期し、Reset・Fit・時間基準のカメラ再現・Follow を処理する。Fit はモデル本体の箱から `fitCamera` で目標を作り `requestCamera` に積む(`Bounds` 内部補間は使わない)。既定視点ちょうどの向きでは `enableRotate` を false にし、Follow 中は回転ロックしない。OrbitControls の減衰を無効にし操作は即時反映する。補間中のユーザー操作で補間を中断する。Follow 中だけ対象の焦点距離もカメラストアへ反映し、controls.domElement に Alt 操作、右ドラッグ dolly、Shift+右ドラッグのライト回転を接続する
- camera-input.ts: OrbitControls の Alt／非 Alt 時のマウス割り当てと、target からの距離を指数的に変える右ドラッグ dolly の純粋関数
- viewer-pointer.ts: controls.domElement へ Maya 式の pointer、contextmenu、マウス抑止イベントを接続し、右ドラッグ dolly／Shift+右ドラッグのライト回転と後始末を提供する
- send-throttle.ts: 値の複製・同値判定を差し替え可能な汎用送信 throttle。先頭送信と窓明けトレーリング送信、送信失敗の再試行、受信値を送信済みとして扱う `markSent`、破棄時の保留送信キャンセルを提供する
- camera-throttle.ts: `CameraPayload`（カメラと焦点距離）向けの比較・複製を定義し、汎用 `send-throttle` へ委譲して送信成功時刻から 50ms ごとの先頭送信と窓明けトレーリング送信を行う。送信失敗は未送信としてタイマーまたは次の更新で再試行し、破棄時に保留送信をキャンセルする
- useCameraBroadcast.ts: `selfCamera` または焦点距離の変更を `camera-throttle` へ渡し、`camera` メッセージへ焦点距離を載せる。送信成功時に自分の presence カメラと焦点距離も更新する。`shouldSendCamera` は従来の判定インターフェイスとして公開する
- useLightBroadcast.ts: lighting ストアの local 更新を汎用 throttle 経由で `light` メッセージへ送り、remote 更新は `markSent` で保留値を破棄してエコーを防ぐ。50ms 間隔で角度を送信する
- viewer.css: HUD のモード選択、枠線と影付きの常設メッシュ表示モードバーと右上カメラメニュー、焦点距離スライダー、各メニューのブロック区切りと十字配置、表示モードの押下状態、Follow 中の参加者色フレームと操作ヒント、160px の枠を持たないライトギズモのプレーン CSS

## 公開インターフェイス
- ViewerCanvas.tsx: `ViewerCanvas({ children? })`。theme ストアの `background` を hex 文字列のまま Canvas 背景へ渡す
- SceneLights.tsx: `SceneLights()`
- LightGizmo.tsx: `LightGizmo()`。回転した立方体、固定カメラに収まるライトマーカー、水平入力、リセットボタンを描画する
- light-gizmo.ts: `GIZMO_SIZE_PX`、`GIZMO_BOX_ROTATION_Y` などのギズモ定数、`gizmoMarkerPosition`、`gizmoDragStep`、`gizmoKeyDeltaX`、`yawDegrees`、`yawText`
- FocalLengthRig.tsx: `FocalLengthRig()`
- ClipPlanesRig.tsx: `ClipPlanesRig()`。camera ストアの `modelSize` から PerspectiveCamera の near / far を更新する
- clip-planes.ts: `NEAR_PLANE_RATIO`、`FAR_PLANE_RATIO`、`ClipPlanes`、`clipPlanesFor`
- FocalLengthSlider.tsx: `FocalLengthSlider()`。ラベル・値とスライダーを別段に描画する
- CameraMenu.tsx: `CameraMenu()`。焦点距離、十字の既定視点／全体表示、視点リセットを描画し、操作後もカメラ要求だけを行う
- focal-length.ts: `SENSOR_HEIGHT_MM`、`FOCAL_LENGTH_STEP_MM`、`fovFromFocalLength`、`focalLengthFromFov`、`DEFAULT_FOV`
- ViewerHud.tsx: `ViewerHud({ send })`。常設メッシュ表示モードバーを `DisplayModeBar` に、ジョイント表示バーを `JointDisplayBar` に、モーション軌跡バーを `TrailBar` に、カメラメニュー本体を `CameraMenu` に、ライト操作ギズモを `LightGizmo` に委譲する
- DisplayModeBar.tsx: `DisplayModeBar({ send })`。メッシュ表示のアイコン3択を描画し、ローカルストア更新後に `mesh:display` を送信する
- display-icons.tsx: `SolidIcon()`、`WireframeIcon()`、`SolidWireframeIcon()`、`MESH_DISPLAY_ICONS` と共通立方体パス定数
- HudMenu.tsx: `HudMenu({ id, open, onToggle, onClose, children })`。カメラメニューの開閉 state を持たず、Escape を親へ通知する
- hud-menu.ts: `HudMenuId`、`HUD_MENU_ORDER`、`HUD_MENU_LABELS`、`HUD_MENU_INITIAL`、`toggleHudMenu`
- hud-labels.ts: `ToolMode`、`MODE_LABELS`、`MODE_ORDER`、`VIEW_PRESET_LABELS`、`FIT_SHORT_LABEL`、`VIEW_PRESETS_LABEL`、`PLACEMENT_LABELS`、`PLACEMENT_ORDER`、`MESH_DISPLAY_LABEL`、`MESH_DISPLAY_LABELS`、`MESH_DISPLAY_ORDER`、カメラ／ライト／Follow のラベル、`focalLengthText`、`colorName`、`followingLabel`、`HintInput`、`hint`、`withShortcut`
- view-presets.ts: `ViewPreset`、`VIEW_PRESET_ORDER`、`GridCell`、`VIEW_CROSS_CENTER`、`VIEW_PRESET_CELLS`、`VIEW_PRESET_DIRECTIONS`、`MIN_PRESET_DISTANCE`、`PRESET_MATCH_EPSILON`、`presetCamera`、`matchViewPreset`、`rotationLocked`
- lighting.ts: `LightAngles`（`@shared/types` 由来の再エクスポート）、ライト定数、`normalizeYaw`、`clampPitch`、`rotateLight`、`lightPosition`、`fillLightPosition`
- ModelMesh.tsx: `ModelMesh({ src, fileName, versionId, visible, primary, meshDisplay })`、`MODEL_COMPONENTS`
- fbx-compat.ts: `installFbxSkinCompat()`
- useModelScene.ts: `useModelScene(scene, animations, options)`、`ModelSceneOptions`。wireframe 色は theme ストアから購読する
- polygon-edge-material.ts: `POLYGON_EDGE_LINE_WIDTH`、`POLYGON_EDGE_MATERIAL_KEY`、`isPolygonEdgeMaterial(material)`、`createPolygonEdgeMaterial(color, opacity)`
- mesh-display.ts: `MESH_DISPLAY_OVERLAY_KEY`、`VIEWER_OVERLAY_KEY`、`POLYGON_EDGE_ORIGINAL_MATERIAL_KEY`、`WIREFRAME_OVERLAY_COLOR`、`WIREFRAME_OVERLAY_OPACITY`、`isMeshDisplayOverlay`、`isViewerOverlay`、`createWireframeOverlayMaterial(color?)`、`createWireframeOverlay(mesh, color?)`、`applyMeshDisplay(root, mode, wireframeColor?)`
- PlaybackClock.tsx: `PlaybackClock()`
- playback.ts: `PlaybackClip`、`clipSummaries`、`currentDuration`、`clampTime`、`advanceTime`
- playback-frames.ts: `DEFAULT_FPS`、fps 判定・clamp・秒／フレーム変換関数
- playback-driver.ts: `PlaybackDriver`、`createPlaybackDriver`
- playback-source.ts: `ClipRegistry`、`animatedObjects`、`resolvePlaybackSource`
- playback-source-sync.ts: `syncPlaybackClips`、`switchPlaybackSource`
- usePlaybackSource.ts: `usePlaybackSource`
- PlaybackSourceSync.tsx: `PlaybackSourceSync`
- PlaybackRig.tsx: `PlaybackRig({ root, clips, versionId })`
- camera-throttle.ts: `CameraPayload`、`payloadEquals`、`CameraThrottleDeps`、`CameraThrottle`、`createCameraThrottle`
- send-throttle.ts: `SendThrottleDeps<T>`、`SendThrottle<T>`、`createSendThrottle<T>`
- useLightBroadcast.ts: `lightAnglesEqual`、`LightingChange`、`onLightingChange`、`useLightBroadcast`
- model-loading.ts: `BLOCKED_RESOURCE_URL`、`resolveModelResourceUrl`、`createModelLoadingManager`
- model-target.ts: `setModelTarget(obj)`、`getModelTarget()`
- pick.ts: `toNdc(rect, clientX, clientY)`、`isVisibleInScene(object)`、`pickModel(raycaster, camera, ndc, target)`
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

`ViewerHud` は右上のカメラメニューを単一のローカル state で排他的に管理し、常設のメッシュ表示モードバー、ジョイント表示バー、モーション軌跡バーをその左へ置く。初期状態では半透明のカメラパネルを展開して右下へ `LightGizmo` を常設する。
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

`useLightBroadcast` は lighting ストアの `origin` が local の変更だけを `LIGHT_SEND_INTERVAL_MS` の汎用 throttle へ渡す。
remote の受信値は `markSent` で最後の値として記録し、保留中の自分の値とタイマーを捨てるため、受信値を送り返さない。
light の送信成功時にストアを追加更新することはない。

後続の viewer 機能は `ViewerCanvas` の `children` 差し込み口に RemoteCameras / StrokeLines /
AnnotationLayer などのレイヤーを追加する。`ModelMesh` が登録する `model-target` を `pickModel` に渡すと、
Canvas のクライアント座標を NDC 化して再帰的にモデルをレイキャストでき、交点法線はヒットした
オブジェクトの `matrixWorld` の逆転置法線行列でワールド系へ変換して正規化される。

`ModelMesh` は拡張子から glTF / FBX / OBJ のローダーを選び、FBX / OBJ は多角形輪郭属性を付ける専用ローダーを使う。`useModelScene` は形式によらず primary のモデルサイズ・Fit・表示モード・比較レジストリと全版のクリップ登録を接続する。OBJ は材質なしで単色表示され、FBX のスケールは補正しない。`usePlaybackSource` は room の playbackSource を優先し、未指定または対象外ならアニメーションを持つ number 最小の版を選ぶ。`PlaybackSourceSync` はその版のクリップ要約と fps を playback ストアへ登録し、`PlaybackClock` が Canvas で一度だけ時刻を進める。各 `PlaybackRig` は一致する sourceId のモデルだけを LoopRepeat 再生し、対象外の action は初期ポーズへ戻す。`ViewerCanvas` の背景と `useModelScene` のワイヤフレーム重ね描きは theme ストアの実効色を購読して反映する。`meshDisplay` は `applyMeshDisplay` で各モデルへ適用され、属性付き Mesh の wireframe は `polygonEdgeMaterial` で輪郭辺だけを描き、属性のない Mesh は従来の三角形ワイヤーを使う。`VIEWER_OVERLAY_KEY` を持つビューアの重ね描きを走査対象から除外する。solid-wireframe の重ね描きは skeleton / morph の参照を共有し、raycast を無効にしてコメントのピンや表面ペンの判定を二重化しない。コメントのピンや表面ペンの線はアニメーションに追従せず、作成時のワールド座標に留まる。
`three` の FBXLoader が未対応の attrType(NurbsSurface / Line)を Group にするため、そこへ繋がったスキンは読み飛ばす。NURBS サーフェスは描画されない。

## テスト
- tests/camera-broadcast.test.ts: カメラ送信 throttle の間隔・比較判定テスト
- tests/camera-input.test.ts: Alt／非 Alt のマウス割り当て、指数 dolly、最小距離、入力配列非破壊のテスト
- tests/camera-throttle.test.ts: `payloadEquals`、焦点距離を含む先頭送信、最新値のトレーリング、重複抑止、送信失敗の再試行、破棄時キャンセルのテスト
- tests/send-throttle.test.ts: 汎用 throttle の先頭送信、最新値のトレーリング、`markSent` による保留破棄・送信済み判定・間隔維持、破棄、失敗後の mark、複製のテスト
- tests/light-broadcast.test.ts: ライト角度の厳密比較と local／remote 更新の throttle 呼び分け・順序のテスト
- tests/focal-length.test.ts: 焦点距離と垂直画角の換算テスト
- tests/clip-planes.test.ts: モデルサイズからの near / far 計算、無効値の既定値、比率、Rig と Canvas の結線を検証
- tests/follow.test.ts: Follow 対象のカメラ・焦点距離の判定、複製、補間、収束テスト
- tests/camera-animation.test.ts: ease-out補間、独立複製、時間基準の開始前・途中・到達・NaN、CameraRig の減衰無効化のソース検査
- tests/fit-camera.test.ts: Fit 方向・距離・中心の非破壊性、既定視点非一致、CameraRig の Bounds 内部補間を使わないことのソース検査
- tests/hud-labels.test.ts: HUD のモード・操作・透過表示・描画基準・メッシュ表示・Follow・既定視点文言とヒントのテスト
- tests/display-mode-bar.test.ts: 共通立方体パス、3種類の SVG アイコン、アイコン対応表、表示モードバーのソース構造と旧表示メニュー削除のテスト
- tests/hud-menu.test.ts: HUD カメラメニューの初期表示、順序・表示名、排他的トグルの純粋関数テスト
- tests/playback.test.ts: クリップ要約、選択中クリップ長、時刻 clamp、ループ前進のテスト
- tests/playback-driver.test.ts: AnimationMixer の絶対時刻適用、action 切替、停止と再開、無効 index、破棄のテスト
- tests/playback-source.test.ts: アニメーション付き版の抽出・優先解決、source 切替、クリップ要約同期のテスト
- tests/playback-source-sync.test.ts: PlaybackSourceSync の実マウントによる後登録、source 切替、登録解除と fallback のテスト
- tests/light-gizmo.test.ts: ライトギズモの定数、回転、カメラ視野、座標・入力・表示の純粋関数テスト
- tests/lighting.test.ts: ライト角度の正規化・クランプ・ドラッグ回転・主／補助ライト座標を検証
- tests/model-loading.test.ts: 埋め込み・同一オリジン URL の許可、外部 URL の遮断、LoadingManager の URL modifier のテスト
- tests/model-target.test.ts: モデルターゲットの登録・取得テスト
- tests/pick.test.ts: NDC 変換、可視な交点だけの再帰レイキャスト、ワールド法線変換、useModelScene／PlaybackClock／PlaybackRig／ViewerCanvas／ReviewPage のソース検査
- tests/fbx-compat.test.ts: Group / Bone への no-op bind、SkinnedMesh の本来の bind の維持、冪等なインストールをテスト
- tests/model-scene.test.ts: FBX / OBJ / glTF ローダーの選択、同一オリジン manager、形式対応表、OBJ の不変アニメーション配列、共通副作用の分離、ViewerCanvas の fileName 受け渡し、FBX 互換処理の読み込み前呼び出しをソース検査し、useModelScene のクリップ登録・条件付き解除を実マウントで検証する
- tests/mesh-display.test.ts: MeshDisplayMode ごとの材質切替、ワイヤフレーム重ね描きの共有状態・raycast 無効化・冪等性・破棄、対象外オブジェクトと結線のテスト
- tests/mesh-display-color.test.ts: ワイヤフレーム色の既定値・明示指定・theme ストア購読と Canvas 背景の結線を検証する
- tests/polygon-edge-display.test.ts: 多角形輪郭材質の shader 設定・差し替え／復元・破棄・重ね描き・InstancedMesh / SkinnedMesh / レイキャストとローダー結線を検証する
- tests/view-presets.test.ts: 既定視点の方向・順序・単位ベクトル・距離維持・最小距離・非破壊性、既定視点一致と回転ロック判定のテスト
- tests/viewer-pointer.test.ts: capture phase の割り当て、Alt+右ドラッグ dolly、pointer capture、継続・終了・ブラウザ既定動作抑止、cleanup のテスト
- tests/viewer-styles.test.ts: カメラメニューと常設表示モードバーの枠・配置・押下状態、初期展開と操作後の非クローズ、カメラメニューのボタン状態と影、160px のライトギズモとヒントの退避幅、ライトギズモの枠廃止、シャドウトークン、Follow フレームと上辺タブ、CSS セレクタ完全一致のテキスト検査
