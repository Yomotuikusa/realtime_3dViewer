# objects

## 目的

レビュー右ドックにシーンのオブジェクト一覧を表示し、各版の 3D ビュー表示・非表示をルームへ共有する。ファイル追加ではモデル版を順番に REST へ送信し、成功した版を一覧とシーンへ追加する。

## ファイル一覧と役割

- ObjectList.tsx: `useObjectsStore` の版一覧と可視性を表示し、表示切替の WebSocket 共有と、検証済みモデルファイルの順次版追加を提供する
- objects-labels.ts: オブジェクト見出し、可視性、ファイル追加の文言と表示用 helper
- objects.css: オブジェクト一覧、可視性状態、ファイル追加コントロールのトークン CSS

## 公開インターフェイス

- ObjectList.tsx: `ObjectList({ projectId, send })`
- objects-labels.ts: `OBJECTS_HEADING`、`VISIBLE_LABEL`、`HIDDEN_LABEL`、`ADD_FILES_LABEL`、`ADDING_LABEL`、`ADD_FAILED`、`objectsHeading`、`versionTag`、`toggleAriaLabel`

## 他機能との関係

`useObjectsStore` を一覧の状態と可視性更新に使う。`addModelVersion` と `validateModelFiles` でファイル追加を行い、`ClientMessage` の `object:visibility` を `ReviewPage` から渡された realtime の `send` へ送る。`ReviewPage` の右ドックでは `PresenceList` とコメント領域の間に配置される。

## テスト

- tests/objects-labels.test.ts: オブジェクト表示文言、定数、見出し・版タグ・可視性 aria ラベルのテスト
- tests/objects-styles.test.ts: オブジェクト CSS、右ドックの行構成、Summary 索引の契約テスト
