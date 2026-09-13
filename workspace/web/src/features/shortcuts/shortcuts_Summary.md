# shortcuts

## 目的
入室後のキーボードショートカットを annotation / camera ストアへ接続し、キー設定の再割り当てを提供する。

## ファイル一覧と役割
- keymap.ts: `ShortcutAction` / `Binding` / `Keymap` / `DEFAULT_KEYMAP` / `ACTION_ORDER` とキーコードの正規化、割り当て、表示、入力対象判定
- keymap-storage.ts: `KEYMAP_STORAGE_KEY` による keymap の localStorage 読み書きと不正値の既定値補完
- useShortcuts.ts: 入室中だけ keydown を購読し、ショートカットを annotation / camera ストアの action へ接続するフック
- capture.ts: 設定ダイアログのキー待機における modifier / Escape / 対応可否の判定。`CaptureResult`、`CaptureRejection`、`captureBinding` を公開する
- shortcut-labels.ts: 設定ダイアログのキー操作タブに出すアクション名・操作文言と拒否メッセージ。`ACTION_LABELS`、各ラベル定数、`rejectionMessage` を公開する（入口と閉じるラベルは `app/review-labels.ts` へ移動）
- ShortcutSettings.tsx: ダイアログの枠を持たないキー操作タブの中身。keymap の再割り当て・解除・既定値復元を行い、待機中は capture-phase のキー入力を処理して shortcuts ストアへ即時保存する
- shortcuts.css: キー操作タブの縦並び、4列の行、キーキャップ、フッタ、狭い画面向け調整

## 公開インターフェイス
- keymap.ts: `ShortcutAction`、`Binding`、`Keymap`、`ACTION_ORDER`、`DEFAULT_KEYMAP`、`KeyChord`、`ShortcutEventLike`、`isModifierCode`、`isAssignableCode`、`bindingFromChord`、`isValidBinding`、`resolveAction`、`applyBinding`、`formatBinding`、`isTypingTarget`
- keymap-storage.ts: `KEYMAP_STORAGE_KEY`、`loadKeymap`、`saveKeymap`
- useShortcuts.ts: `useShortcuts(enabled)`
- capture.ts: `CaptureRejection`、`CaptureResult`、`captureBinding(chord)`
- shortcut-labels.ts: `ACTION_LABELS`、設定画面の各ラベル定数、`rejectionMessage(reason)`
- ShortcutSettings.tsx: `ShortcutSettings()`。ダイアログの枠を持たないキー操作タブの中身を返す

## 他フォルダとの関係
ショートカットは入室後の `ReviewPage` で有効になり、HUD のモード／視点ボタンにも現在の keymap を表示する。キー設定は `resetReviewStores()` の6ストア初期化から独立して localStorage に保持する。
viewer_Summary.md と app_Summary.md を参照。

## テスト
- tests/keymap.test.ts: キーコード、binding、アクション解決、割り当て、表示、入力対象判定のテスト
- tests/keymap-storage.test.ts: keymap の localStorage 読み書き、不正値補完、例外耐性のテスト
- tests/capture.test.ts: 設定ダイアログのキーキャプチャにおける割り当て、待機継続、キャンセル、拒否のテスト
- tests/shortcut-labels.test.ts: 設定画面のアクション名、拒否メッセージ、各ラベル定数のテスト

`SETTINGS_OPEN_LABEL` と `CLOSE_LABEL` は `shortcut-labels.ts` から `app/review-labels.ts` へ移動した。
