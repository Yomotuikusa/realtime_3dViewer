# objects

## 目的

レビュー右ドックにシーンのオブジェクト一覧を表示し、各版の 3D ビュー表示・非表示をルームへ共有する。ファイル追加ではモデル版を順番に REST へ送信し、成功した版を一覧とシーンへ追加する。

## ファイル一覧と役割

- ObjectList.tsx: `useObjectsStore` の版一覧と可視性を表示し、表示切替の WebSocket 共有と、検証済みモデルファイルの順次版追加を提供する。末尾に比較コントロールを配置する
- CompareControls.tsx: 基準・対象の版と比較しきい値を表示・更新し、`mesh:compare` を WebSocket 共有する
- objects-labels.ts: オブジェクト見出し、可視性、ファイル追加、比較の文言と表示用 helper
- objects.css: オブジェクト一覧、可視性状態、ファイル追加、比較コントロールのトークン CSS

## 公開インターフェイス

- ObjectList.tsx: `ObjectList({ projectId, send })`
- CompareControls.tsx: `CompareControls({ send })`
- objects-labels.ts: `OBJECTS_HEADING`、`VISIBLE_LABEL`、`HIDDEN_LABEL`、`ADD_FILES_LABEL`、`ADDING_LABEL`、`ADD_FAILED`、`COMPARE_HEADING`、比較ラベル群、`objectsHeading`、`versionTag`、`toggleAriaLabel`、`compareOptionLabel`、`thresholdPermilleText`

## 他機能との関係

`useObjectsStore` を一覧の状態と可視性更新、比較版の選択肢に使う。`useDisplayStore` の `meshCompare` を比較コントロールの表示値として読み、更新時にローカルへ反映して `ClientMessage` の `mesh:compare` を送る。`addModelVersion` と `validateModelFiles` でファイル追加を行い、`ClientMessage` の `object:visibility` を `ReviewPage` から渡された realtime の `send` へ送る。`ReviewPage` の右ドックでは `PresenceList` とコメント領域の間に配置される。

## テスト

- tests/objects-labels.test.ts: オブジェクト表示文言、比較文言、見出し・版タグ・可視性 aria ラベル、比較表示 helper のテスト
- tests/objects-styles.test.ts: オブジェクト CSS、比較コントロール、右ドックの行構成、Summary 索引の契約テスト
