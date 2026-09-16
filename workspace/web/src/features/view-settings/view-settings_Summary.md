# view-settings

## 目的

ディスプレイや入力機器ごとに異なる、表示と操作に関する端末ローカル設定を定義し、zustand と localStorage で保持する。

## ファイル一覧と役割

- view-settings.ts: 8 個の設定キー、4 グループ、3 単位(px / ratio / scale)、既定値、範囲、順序、HUD／ダイアログ面の分類、値の clamp を定義する
- view-settings-storage.ts: `3dreviewer:view-settings` の読み書きと保存値の検証を担当する
- view-settings-labels.ts: HUD と設定ダイアログの日本語ラベル、ヘルプ、単位付き表示値を定義する
- ViewSettings.tsx: 設定ダイアログ内の操作グループのスライダー、個別／操作面全体リセットを表示する
- ViewSettingsMenu.tsx: HUD の「表示」メニュー内に表示系 3 グループ・6 スライダーと HUD 面全体リセットを表示する
- view-settings.css: 設定ダイアログ側のレイアウトと変更状態を定義する
- view-settings-menu.css: HUD の表示設定グループ、行、スライダーのレイアウトと変更状態を定義する

## 公開インターフェイス

- view-settings.ts: `ViewSettingKey`、`ViewSettingGroup`、`ViewSettingUnit`、`ViewSettingSurface`、`ViewSettingSpec`、`ViewSettings`、`VIEW_SETTING_ORDER`、`VIEW_SETTING_GROUP_ORDER`、`VIEW_SETTING_GROUP_SURFACE`、`HUD_VIEW_SETTING_GROUP_ORDER`、`DIALOG_VIEW_SETTING_GROUP_ORDER`、`VIEW_SETTING_SPECS`、`DEFAULT_VIEW_SETTINGS`、`isViewSettingKey`、`clampViewSetting`、`viewSettingKeysInGroup`、`viewSettingKeysOnSurface`
- view-settings-storage.ts: `VIEW_SETTINGS_STORAGE_KEY`、`loadViewSettings`、`saveViewSettings`
- view-settings-labels.ts: 設定タイトル、ヘルプ、全キー／グループのラベル、リセットラベル、`formatViewSetting`
- ViewSettings.tsx: `ViewSettings()`。ダイアログの `input` 面だけを描画する
- ViewSettingsMenu.tsx: `ViewSettingsMenu()`。HUD の `hud` 面だけを描画する

## 他フォルダとの関係

`../../store/view-settings.ts` が設定状態を zustand で保持し、設定ダイアログの第 3 タブから `ViewSettings`、viewer HUD から `ViewSettingsMenu` を表示する。端末ローカル設定のため `../../app/review-stores.ts` の reset 対象外である。現時点では注釈の線幅と透過線の比だけが `../annotation/StrokeLines.tsx` へ結線され、残りのキーは各後続 viewer 機能が消費する。

## テスト

- tests/view-settings.test.ts: キー、グループ順、既定値、仕様範囲、clamp、キー判定のテスト
- tests/view-settings-storage.test.ts: localStorage の空値、不正値、部分値、範囲外、未知キー、例外、往復保存のテスト
- tests/store-view-settings.test.ts: ストアの更新、保存、同値更新抑止、個別／全体 reset、レビュー reset 非対象のテスト
- tests/view-settings-components.test.ts: 設定ダイアログの input 面 DOM、スライダー、ラベル、単位表示、個別／面内全体 reset のテスト
- tests/view-settings-menu.test.ts: HUD の 3 グループ・6 行、値表示、変更状態、操作、HUD 面内全体 reset、専用 CSS のテスト
