# presence

## 目的
参加者一覧、他者のカメラ位置、色付きの名前ラベル、視点に入る・追従を解除する操作を表示する。

## ファイル一覧と役割
- PresenceList.tsx: 参加者を自分先頭・名前順で表示し、色ドット、あなたバッジ、視点に入る / 追従を解除ボタンを提供
- RemoteCameras.tsx: 他者のカメラ位置・向きと名前ラベルを Canvas 内に表示
- remote-camera-size.ts: モデル最大辺長に比例した他者カメラ錐体・名札オフセットのサイズ計算を提供
- presence-labels.ts: 参加者見出し、本人/追従操作の日本語ラベルと件数見出し関数
- presence.css: 参加者行、追従中の背景、色ドット、3D カメラ名札のトークン CSS

## 公開インターフェイス
- PresenceList.tsx: `PresenceList()`
- RemoteCameras.tsx: `RemoteCameras()`
- remote-camera-size.ts: `REMOTE_CAMERA_RADIUS_RATIO`、`REMOTE_CAMERA_HEIGHT_RATIO`、`REMOTE_CAMERA_TAG_OFFSET_RATIO`、`REMOTE_CAMERA_SEGMENTS`、`RemoteCameraSize`、`remoteCameraSize(modelSize)`
- presence-labels.ts: `PRESENCE_HEADING`、`SELF_SUFFIX`、`FOLLOW_LABEL`、`UNFOLLOW_LABEL`、`presenceHeading(count)`

## 他フォルダとの関係
`useCameraBroadcast` が送信成功時に自分の presence カメラと焦点距離を更新する処理は viewer_Summary.md を参照。

## テスト
- tests/presence-labels.test.ts: 参加者見出し、本人/追従操作ラベル、件数見出しのテスト
- tests/remote-camera-size.test.ts: 他者カメラのサイズ計算と `RemoteCameras.tsx` のソース契約のテスト
