# shared

## 目的
フロントエンドとサーバが共有するドメイン型と、実行時検証用の zod スキーマを一箇所で提供する。
各スキーマは対応する interface/type と同じファイルに置き、`satisfies z.ZodType<T>` で型整合を検証する。

## ファイル一覧と役割
- tsconfig.json: 型検査設定(../tsconfig.base.json を継承。`@shared/*` は shared/src を指す)
- vitest.config.ts: テスト設定(tests/**/*.test.ts、cacheDir は .vite)
- src/types.ts: Vec3、CameraState、Stroke、Comment(`CommentPlayback` によるクリップ添字・フレーム位置と任意の再生対象 versionId を含む)、ModelVersion、Project(全 versions と latestVersion の整合性を含む)、LightAngles、ライト明るさ倍率、MeshDisplayMode、MeshCompare、JointDisplay、PresenceUser、ObjectPath、ObjectPartRef の型と、ストローク点数・コメント添付本数・識別子・ファイル名・自由文字列・焦点距離・ライト角度/明るさ・メッシュ表示方法・比較設定・ジョイント表示設定・コメント再生位置・版内オブジェクトパスを検証する zod スキーマ
- src/api.ts: REST のエラー、プロジェクト名、コメント入出力スキーマ(`CreateCommentInput` は任意の `CommentPlayback` を含み、添付ストローク本数を共有上限で検証する)、`ModelFormat` / `modelFormat` / `MODEL_CONTENT_TYPES` と upload 定数
- src/protocol.ts: WS の ClientMessage/ServerMessage 型(カメラの focalLength、ルーム共有 light / light:brightness / mesh display / mesh compare / joint:display / trail:display / playback:source、オブジェクト可視性・部位可視性・版追加・版削除を含む)、送信間隔定数、discriminated union スキーマ、JSON フレーム parse 関数
- src/camera.ts: three.js に依存しない CameraState/Vec3 の比較、補間、複製(NaN は補間開始点として処理)、焦点距離(mm)のクランプ
- src/stroke.ts: `SIMPLIFY_TOLERANCE_RATIO` に基づく許容誤差を使った、反復処理による3D Ramer–Douglas–Peucker の点列間引きと共有点数上限による送信可否判定
- src/compare.ts: `MeshCompare` の active 判定、全フィールド比較、浅い複製、共有しきい値目盛と最寄り添字を行う three.js 非依存の純粋関数
- src/object-part.ts: `ObjectPath` の配列変換、参照キー生成、部位参照比較を行う three.js 非依存の純粋関数
- src/joint.ts: `JointDisplay` の全フィールド比較と浅い複製を行う three.js 非依存の純粋関数
- src/trail.ts: `MotionTrail` の型・既定値・ObjectPartRef を含む zod スキーマ・比較・複製を提供する
- src/index.ts: shared の全公開面を再エクスポート(types / api / protocol / camera / stroke / compare / object-part / joint / trail)
- tests/index.test.ts: shared の公開面とプレースホルダ除去を検証
- tests/types.test.ts: 各ドメインスキーマの safeParse の受理・拒否テスト
- tests/lighting.test.ts: 共有ライト角度の有限数検証、範囲外値の受理、余分なキー除去のテスト
- tests/types-bounds.test.ts: 識別子、ファイル名、プロジェクト名、コメント文字列の長さ・文字種上限テスト
- tests/api.test.ts: REST スキーマ、定数、trim・境界値のテスト
- tests/protocol.test.ts: Client/Server の全メッセージ種別と parse 関数のテスト
- tests/protocol-object-removed.test.ts: `object:removed` の Server スキーマ受理、必須 versionId、JSON parse のテスト
- tests/mesh-compare.test.ts: mesh compare の 0.1‰ 格子の受理・拒否と目盛一覧・最寄り添字、baseVisible の任意指定と同値判定、純粋関数、protocol の受信・parse テスト
- tests/joint.test.ts: ジョイント表示の既定値、比較、複製、スキーマ、公開面のテスト
- tests/protocol-joint.test.ts: `joint:display` の Client/Server variant、welcome optional、parse のテスト
- tests/camera.test.ts: カメラの比較、補間、クランプ、複製のテスト
- tests/stroke.test.ts: 点列間引き、許容誤差、送信可能範囲のテスト
- tests/comment-playback.test.ts: コメント再生位置と任意の versionId の型・スキーマ、REST 入力、WS コメント受信のテスト
- tests/object-part.test.ts: `ObjectPath` / `ObjectPartRef` のスキーマ、部位参照ヘルパー、公開面のテスト
- tests/trail.test.ts: モーション軌跡の比較、複製、既定値、スキーマ境界のテスト
- tests/protocol-trail.test.ts: `trail:display` の Client/Server variant、welcome optional、parse のテスト
- tests/protocol-light-brightness.test.ts: ライト明るさ倍率の定数・範囲、Client/Server variant、welcome optional、JSON parse の検証テスト
- tests/protocol-playback.test.ts: `playback:source` の Client/Server variant、welcome optional、必須 ID の検証テスト

## 公開インターフェイス
- 型: `Vec3`, `CameraState`, `Stroke`, `CommentStatus`, `CommentPlayback`, `Comment`(`playback` は任意・null 許容), `ModelVersion`, `Project`(`versions` と `latestVersion` を含む), `LightAngles`, ライト明るさ倍率(`MIN_LIGHT_BRIGHTNESS` / `MAX_LIGHT_BRIGHTNESS` / `DEFAULT_LIGHT_BRIGHTNESS`), `MeshDisplayMode`, `MeshCompare`, `JointDisplay`, `MotionTrail`, `ActiveMeshCompare`, `PresenceUser`(`focalLength` は任意), `ObjectPath`, `ObjectPartRef`
- スキーマ: `Vec3Schema`, `ColorSchema`, `CameraStateSchema`, `FocalLengthSchema`, `LightAnglesSchema`, `LightBrightnessSchema`, `MeshDisplayModeSchema`, `MeshCompareSchema`, `JointDisplaySchema`, `MotionTrailSchema`, `StrokeSchema`, `CommentStatusSchema`, `CommentPlaybackSchema`, `CommentSchema`, `ModelVersionSchema`, `ProjectSchema`, `PresenceUserSchema`, `ObjectPathSchema`, `ObjectPartRefSchema`
- api: `ErrorCode`, `ApiError`, `ApiErrorSchema`, `MAX_UPLOAD_BYTES_DEFAULT`, `ALLOWED_MODEL_EXTENSIONS`, `ModelFormat`, `modelFormat`, `MODEL_CONTENT_TYPES`, `ProjectNameSchema`, `CreateCommentInput`, `UpdateCommentStatusInput`, `ListCommentsQuery`
- protocol: `ClientMessage`, `ServerMessage`, `ClientMessageSchema`, `ServerMessageSchema`, `ParseResult`, `parseClientMessage`, `parseServerMessage`, `MAX_NAME_LENGTH`, `CAMERA_SEND_INTERVAL_MS`, `LIGHT_SEND_INTERVAL_MS`; Client の表示操作、Server の `welcome` 表示状態、`light:brightness`、`object:added` / `object:removed` を含む各イベントを提供する
- types の定数: `MAX_ID_LENGTH`, `MAX_FILE_NAME_LENGTH`, `MAX_PROJECT_NAME_LENGTH`, `MAX_AUTHOR_NAME_LENGTH`, `MAX_COMMENT_BODY_LENGTH`, `MIN_STROKE_POINTS`, `MAX_STROKE_POINTS`, `MAX_COMMENT_STROKES`, `MAX_OBJECT_PATH_LENGTH`, `MIN_FOCAL_LENGTH_MM`, `MAX_FOCAL_LENGTH_MM`, `DEFAULT_FOCAL_LENGTH_MM`, `MIN_LIGHT_BRIGHTNESS`, `MAX_LIGHT_BRIGHTNESS`, `DEFAULT_LIGHT_BRIGHTNESS`, `DEFAULT_MESH_DISPLAY`, `MIN_COMPARE_THRESHOLD_PERMILLE`, `MAX_COMPARE_THRESHOLD_PERMILLE`, `DEFAULT_COMPARE_THRESHOLD_PERMILLE`, `COMPARE_THRESHOLD_STEP_PERMILLE`, `isCompareThresholdPermille`, `DEFAULT_MESH_COMPARE`, `DEFAULT_JOINT_DISPLAY`
- types の入力スキーマ: `IdSchema`, `FileNameSchema`
- camera: `DEFAULT_CAMERA`, `vec3Equals`, `lerpVec3`, `cameraEquals`, `lerpCamera`, `cloneCamera`, `clampFocalLength`
- stroke: `SIMPLIFY_TOLERANCE_RATIO`, `simplifyTolerance`, `simplify`, `isSendableStroke`
- compare: `COMPARE_THRESHOLD_STEPS_PERMILLE`, `nearestCompareThresholdIndex`, `isMeshCompareActive`, `meshCompareEquals`, `cloneMeshCompare`
- joint: `jointDisplayEquals`, `cloneJointDisplay`
- trail: `DEFAULT_MOTION_TRAIL`, `motionTrailEquals`, `cloneMotionTrail`
- object-part: `objectPathIndices`, `joinObjectPath`, `objectPartKey`, `isSameObjectPart`
- `shared/src/index.ts` は types.ts/api.ts/protocol.ts/camera.ts/stroke.ts/compare.ts/object-part.ts/joint.ts/trail.ts の公開インターフェイスだけを再エクスポートする。

## 他機能との関係
コメントの `CommentPlayback.versionId` は投稿時の再生対象を指し、古いコメントでは省略される。server は playback を JSON のまま保存・返却し、web がこの値を使って再生対象を切り替える。Project は版が無い場合も `latestVersion: null` と `versions: []` で表す。
server の DB・ルート、web の状態管理・表示が本モジュールの型とスキーマを import する。部位の共有鍵は three.js の uuid ではなく、版の scene ルートからの子インデックスの `ObjectPath`(設計書 §13.5) とする。`focalLength` は PresenceUser と camera メッセージだけに存在する Presence 専用の値で、`CameraState` とコメント保存スキーマには含まれない。`light` は ClientMessage と ServerMessage に存在するルーム共有値で、welcome では任意、通常イベントでは userId と角度を持つ。`mesh:display` もルーム共有値として mode を扱い、welcome では任意の `meshDisplay` として表現する。`mesh:compare` は baseId / targetId / thresholdPermille 全体と任意の baseVisible(比較中も基準を描くか)をルーム共有値として扱い、thresholdPermille は 0.1‰ 刻みの小数で、welcome では任意の `meshCompare` として表現する。`joint:display` は visible / xray 全体をルーム共有値として扱い、welcome では任意の `jointDisplay` として表現する。`object:part-visibility` は版内の部位の可視性切り替えを中継し、welcome の `hiddenObjectParts` は非表示状態の復元に使う。
api.ts は REST のサーバ受信入力とクライアント利用型を、protocol.ts は WS のサーバ受信・クライアント受信を同じ zod スキーマで検証する。Project の `versions` は版番号順の全モデル版で、`latestVersion` はその末尾と一致する(空配列では null)。オブジェクト可視性は `versionId` の集合を扱い、`object:added` / `object:removed` は REST の版変更を通知する。
camera.ts は Follow Camera とコメント再現の補間・比較を、stroke.ts は Annotation 送信前の点列間引きを、compare.ts はメッシュ比較設定の判定・比較・複製としきい値目盛を提供する。いずれも three.js に依存しない。trail.ts は ObjectPartRef を対象とする軌跡表示設定を比較・複製を含めて提供し、protocol の `trail:display` と welcome の `motionTrail` で送受信する。
