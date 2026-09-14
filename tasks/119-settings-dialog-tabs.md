---
id: 119
title: 設定ダイアログをタブ化してキー操作と表示色を 1 つの入口にまとめる
feature: app
depends_on: [118]
owns: [web/src/app/SettingsDialog.tsx, web/src/app/ReviewPage.tsx, web/src/app/ReviewHeader.tsx, web/src/app/review-labels.ts, web/src/app/review.css, web/src/app/app_Summary.md, web/src/features/shortcuts/ShortcutSettings.tsx, web/src/features/shortcuts/shortcut-labels.ts, web/src/features/shortcuts/shortcuts.css, web/src/features/shortcuts/shortcuts_Summary.md, web/tests/settings-dialog.test.ts, web/tests/shortcut-labels.test.ts, web/tests/review-labels.test.ts]
reads: [web/src/features/theme/ThemeSettings.tsx, web/src/features/theme/theme-labels.ts, web/src/features/theme/theme.css, web/src/features/shortcuts/keymap.ts, web/src/features/shortcuts/capture.ts, web/src/store/shortcuts.ts, web/src/features/shortcuts/useShortcuts.ts, web/src/styles/controls.css, web/tests/trail-bar.test.ts, web/tests/review-styles.test.ts, web/tests/capture.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
今はヘッダの「ショートカット設定」からキー割り当てのダイアログだけが開く。
これを「設定」1 つの入口にまとめ、`キー操作` と `表示色`(118 の `ThemeSettings`)を
タブで切り替えられるようにする。これで 115〜118 で作った表示色の設定が
実際に画面から使えるようになる。

## 前提
- 118 の `web/src/features/theme/ThemeSettings.tsx` に
  `export function ThemeSettings(): ReactElement` があり、
  **ダイアログの枠(`review-backdrop` / `review-dialog` / 見出し / 閉じるボタン)を持たない**
  中身だけの部品になっている。`theme.css` は `ThemeSettings.tsx` が自分で import している
- 118 の `web/src/features/theme/theme-labels.ts` の `THEME_SETTINGS_TITLE` が `"表示色"`。
  **タブ名にはこれを使う**(文言を二重に持たない)
- 現在の `web/src/features/shortcuts/ShortcutSettings.tsx` は自分でダイアログの枠を持っている。
  - `<div className="review-backdrop">` > `<div className="review-dialog shortcut-dialog" role="dialog"
    aria-modal="true" aria-labelledby={titleId}>` の構造
  - 中に `<h2 id={titleId}>{SETTINGS_TITLE}</h2>`、`<p className="review-dialog__help">`、
    拒否メッセージの `<p className="alert" role="alert">`、行の `<div role="group">`、
    `<div className="shortcut-dialog__footer">` に `[既定に戻す][閉じる]`
  - props は `{ onClose }`
  - キー待機中は `window.addEventListener("keydown", handleKeyDown, true)` を capture phase で購読する
    (この仕組みは**そのまま残す**)
- `web/src/app/ReviewPage.tsx:212` が `{settingsOpen && <ShortcutSettings onClose={...} />}`、
  `:92` が `useShortcuts(joinName !== null && !settingsOpen)`。
  **`useShortcuts` の無効化条件は変えない**(ダイアログが開いている間はショートカットを止める)
- `web/src/app/ReviewHeader.tsx:10` が `SETTINGS_OPEN_LABEL` を
  `../features/shortcuts/shortcut-labels` から import している
- 移動する識別子の参照はこれで全部である(grep 済み)。
  - `SETTINGS_OPEN_LABEL`: `shortcut-labels.ts`(定義)、`ReviewHeader.tsx`、`shortcut-labels.test.ts`
  - `CLOSE_LABEL`: `shortcut-labels.ts`(定義)、`ShortcutSettings.tsx`、`shortcut-labels.test.ts`
  - `SETTINGS_TITLE` / `SETTINGS_HELP` / `RESET_KEYMAP_LABEL` は `shortcut-labels.ts` に**残す**
- `web/src/app/review.css` に `.review-backdrop`(`:134` 付近)と `.review-dialog`(`:143`)、
  `.review-dialog__help`(`:154`)がある。`.review-dialog` の幅は `min(24rem, 90%)`
- `web/src/features/shortcuts/shortcuts.css:1` の `.review-dialog.shortcut-dialog { width: min(30rem, 92%); }`
  がダイアログの幅を上書きしている。タブ化で枠が `SettingsDialog` へ移るので、
  **幅の指定も `review.css` 側へ移す**
- **D35**: 状態はクラスの付け替えではなく `aria-pressed` / `aria-expanded` / `disabled` / `data-*` の
  属性セレクタで表現する。**このタスクでは `role="tablist"` / `role="tab"` を使わない**。
  `role="tab"` は矢印キーでの移動が期待される仕組みで、既存のどの部品もそれを実装していないため、
  既存の流儀に合わせて `role="group"` + `aria-pressed` のボタンで表す(見た目はタブでよい)
- **D36**: 文言は `*-labels.ts` に定数・純粋関数として置き、JSX に直書きしない
- コンポーネントのテストは `createRoot` + `act` で jsdom へ描く流儀(`web/tests/trail-bar.test.ts:1-60`)

## インターフェイス契約

### `web/src/app/review-labels.ts` への追加

`shortcut-labels.ts` から移してくる 2 つと、ダイアログ用の 3 つを足す。

```ts
/** ヘッダの設定ボタン。移動元: shortcut-labels.ts の "ショートカット設定" から改名 */
export const SETTINGS_OPEN_LABEL = "設定";
/** ダイアログのフッタ。移動元: shortcut-labels.ts */
export const CLOSE_LABEL = "閉じる";
/** ダイアログの見出し */
export const SETTINGS_DIALOG_TITLE = "設定";
/** タブの並びの role="group" の aria-label */
export const SETTINGS_TABS_LABEL = "設定の分類";

/** タブの識別子。並べる順 */
export type SettingsTab = "shortcuts" | "theme";
export const SETTINGS_TAB_ORDER: readonly SettingsTab[] = ["shortcuts", "theme"];
```

タブ名は定数表を作らず、`SettingsDialog` が
`shortcuts` には `shortcut-labels.ts` の `SETTINGS_TITLE`、
`theme` には `theme-labels.ts` の `THEME_SETTINGS_TITLE` を使う
(各機能が自分の名前を持つ形にして、文言の重複を作らない)。

### `web/src/features/shortcuts/shortcut-labels.ts` の変更

- `SETTINGS_OPEN_LABEL` と `CLOSE_LABEL` の**定義を削除**する(`review-labels.ts` へ移動)
- `SETTINGS_TITLE` / `SETTINGS_HELP` / `CHANGE_LABEL` / `CANCEL_CAPTURE_LABEL` /
  `CAPTURING_MESSAGE` / `UNBIND_LABEL` / `RESET_KEYMAP_LABEL` / `ACTION_LABELS` /
  `rejectionMessage` はそのまま残す(値も変えない)

### `web/src/features/shortcuts/ShortcutSettings.tsx` の変更

ダイアログの枠を捨て、中身だけを返す部品にする。

```ts
/** 設定ダイアログの「キー操作」タブの中身。ダイアログの枠は持たない */
export function ShortcutSettings(): ReactElement;
```

- props を取らない(`onClose` を削除)
- `useId` と `titleId`、`<h2>`、`<div className="review-backdrop">`、
  `<div className="review-dialog shortcut-dialog" role="dialog" ...>`、
  閉じるボタンを**削除**する
- 返す要素は `<div className="shortcut-settings">` とし、中身は今の順序を保つ。
  1. `<p className="review-dialog__help">{SETTINGS_HELP}</p>`
  2. 拒否メッセージの `<p className="alert" role="alert">`(条件つき、今のまま)
  3. `<div role="group" aria-label={SETTINGS_TITLE}>` の行の並び(今のまま)
  4. `<div className="shortcut-settings__footer">` に `[既定に戻す]` だけを置く
     (`.shortcut-dialog__footer` から改名)
- キー待機の `useEffect`、`changeBinding`、`resetKeymap`、行の描画は**一切変えない**

### `web/src/features/shortcuts/shortcuts.css` の変更

- `.review-dialog.shortcut-dialog { width: ... }` の規則を**削除**する(幅は `review.css` が持つ)
- `.shortcut-dialog__footer` を `.shortcut-settings__footer` に改名する
- `@media (max-width: 24rem)` の中の `.review-dialog.shortcut-dialog { padding: ... }` を削除し、
  `.shortcut-row` と `.shortcut-row__key` と `.shortcut-row .btn` の調整は残す
- `.shortcut-settings`(縦並び、`display: grid`、`gap: var(--space-3)`)を足す
- 他の規則(`.shortcut-row` 系)は変えない

### 新規 `web/src/app/SettingsDialog.tsx`

```ts
export function SettingsDialog({ onClose }: { onClose: () => void }): ReactElement;
```

```
<div className="review-backdrop">
  <div className="review-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <h2 id={titleId}>{SETTINGS_DIALOG_TITLE}</h2>
    <div className="settings-tabs" role="group" aria-label={SETTINGS_TABS_LABEL}>
      {SETTINGS_TAB_ORDER.map(tab => (
        <button
          key={tab}
          className="btn btn--quiet settings-tab"
          type="button"
          aria-pressed={tab === active}
          onClick={() => setActive(tab)}
        >
          {tab === "shortcuts" ? SETTINGS_TITLE : THEME_SETTINGS_TITLE}
        </button>
      ))}
    </div>
    {active === "shortcuts" ? <ShortcutSettings /> : <ThemeSettings />}
    <div className="settings-dialog__footer">
      <button className="btn btn--primary" type="button" onClick={onClose} autoFocus>{CLOSE_LABEL}</button>
    </div>
  </div>
</div>
```

- `active` は `useState<SettingsTab>("shortcuts")`(開いた直後はキー操作)
- `titleId` は `useId()`
- 選ばれていないタブの中身は**描かない**(`ShortcutSettings` のキー待機が裏で動かないようにする)

### `web/src/app/ReviewPage.tsx` の変更

- `import { ShortcutSettings } from "../features/shortcuts/ShortcutSettings";` を
  `import { SettingsDialog } from "./SettingsDialog";` に差し替える
- `{settingsOpen && <ShortcutSettings onClose={() => setSettingsOpen(false)} />}` を
  `{settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}` にする
- 他は変えない(`useShortcuts(joinName !== null && !settingsOpen)` もそのまま)

### `web/src/app/ReviewHeader.tsx` の変更

`SETTINGS_OPEN_LABEL` の import 元を `./review-labels` に変える
(同ファイルの既存 import にまとめる)。他は変えない。

### `web/src/app/review.css` への追加

```css
.review-dialog.settings-dialog { width: min(32rem, 92%); }
.settings-tabs { display: flex; gap: var(--space-2); border-bottom: 1px solid var(--color-border); }
.settings-tab[aria-pressed="true"] { ... 選択中を下線などで示す ... }
.settings-dialog__footer { display: flex; justify-content: flex-end; }
```

幅を `24rem` から広げるのは、表示色タブに 176px のカラーホイールと 9 列のパレットが入るため。
狭い画面向けの `@media (max-width: 24rem)` で `padding: var(--space-3)` にする規則も足す
(`shortcuts.css` から移してきた分)。

**生の 16 進色・`rgb()` / `rgba()` / `hsl()` を書かない。`!important` を書かない。**

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `SETTINGS_OPEN_LABEL` | `"設定"`(`review-labels.ts` から export される) |
| `CLOSE_LABEL` / `SETTINGS_DIALOG_TITLE` / `SETTINGS_TABS_LABEL` | 空でない日本語(`review-labels.ts` から export される) |
| `SETTINGS_TAB_ORDER` | `["shortcuts", "theme"]` |
| `shortcut-labels.ts` | `SETTINGS_OPEN_LABEL` と `CLOSE_LABEL` を export しない |
| `shortcut-labels.ts` | `SETTINGS_TITLE` は `"ショートカットキー"` のまま、`SETTINGS_HELP` / `RESET_KEYMAP_LABEL` も値が変わらない |
| `SettingsDialog` を描画 | `.review-backdrop` > `.review-dialog.settings-dialog[role="dialog"][aria-modal="true"]` の構造で、`aria-labelledby` が見出しの id を指す |
| 見出し | `SETTINGS_DIALOG_TITLE` |
| タブのボタン | 2 個。1 つ目が `SETTINGS_TITLE`、2 つ目が `THEME_SETTINGS_TITLE` |
| 開いた直後 | 1 つ目のタブが `aria-pressed="true"`、2 つ目が `"false"` |
| 開いた直後の中身 | `.shortcut-settings` があり、`.theme-settings` が無い |
| 表示色タブを click | `.theme-settings` が現れ、`.shortcut-settings` が消える。`aria-pressed` が入れ替わる |
| キー操作タブに戻す | `.shortcut-settings` が戻る |
| フッタ | `.btn--primary` の閉じるボタンが 1 つだけ(`CLOSE_LABEL`)、`autoFocus` が付く |
| 閉じるボタンを click | `onClose` が 1 回呼ばれる |
| `SettingsDialog` の中 | 閉じるボタンは 1 つだけ(`ShortcutSettings` 側に残っていない) |
| `ShortcutSettings` を単体で描画 | props なしで描ける。`.shortcut-settings` を返し、`review-backdrop` / `role="dialog"` / `<h2>` を含まない |
| `ShortcutSettings` の中身 | `review-dialog__help` の説明、11 個ではなく `ACTION_ORDER` の数だけの `.shortcut-row`、`.shortcut-settings__footer` の「既定に戻す」 |
| `ShortcutSettings` の「変更」を click → キーを押す | 従来どおり keymap が変わる(既存の振る舞いが壊れていない) |
| `ShortcutSettings` の拒否メッセージ | 従来どおり `.alert[role="alert"]` に出る |
| `ShortcutSettings` の「既定に戻す」 | 従来どおり keymap が既定へ戻る |
| 表示色タブを開いている間にキーを押す | keymap が変わらない(`ShortcutSettings` が描かれていないので待機していない) |
| `ReviewPage.tsx` のソース | `<SettingsDialog onClose=` をちょうど 1 つ含み、`ShortcutSettings` を import しない |
| `ReviewPage.tsx` のソース | `useShortcuts(joinName !== null && !settingsOpen)` が残っている |
| `ReviewHeader.tsx` のソース | `SETTINGS_OPEN_LABEL` を `./review-labels` から import している |
| `review.css` | `.review-dialog.settings-dialog` / `.settings-tabs` / `.settings-tab[aria-pressed="true"]` / `.settings-dialog__footer` を含む |
| `shortcuts.css` | `.shortcut-dialog` を含まず、`.shortcut-settings` と `.shortcut-settings__footer` を含む |
| `shortcuts.css` / `review.css` | 生の 16 進色・`rgb(` / `rgba(` / `hsl(` / `!important` を含まない(既存テスト) |

## やらないこと
- **Escape での閉じる、フォーカストラップ、タブの矢印キー移動**。既存のダイアログ
  (`JoinDialog` / 改修前の `ShortcutSettings`)がどれも持っておらず、このタスクの範囲を超える。
  必要になったら別タスクで全ダイアログに対してまとめて行う
- `ThemeSettings` / `ColorPicker` / `ColorWheel` / `theme.css` / `theme-labels.ts` の変更
  (118 / 117 の成果物)。`ThemeSettings` は props なしで描くだけ
- `web/src/features/shortcuts/keymap.ts` / `capture.ts` / `useShortcuts.ts` / `web/src/store/shortcuts.ts` の変更。
  キー割り当ての仕組みには触らない
- `ShortcutSettings` の行の中身・キー待機処理の作り替え。**枠を外す以外の変更をしない**
- 3D への色の適用(120〜122 の担当)。このタスクが終わった時点で、表示色タブから
  変えられるのは**テーマ(UI 全体の明暗)と、ストアに保存される 11 色の値**である。
  3D ビューの見た目が実際に変わるのは 120〜122 のマージ後になる
- アップロード画面(`UploadPage.tsx`)への設定入口の追加

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `app_Summary.md` に `SettingsDialog.tsx` を相対パスで、`tests/settings-dialog.test.ts` を
      ファイル名で追記し、`review-labels.ts` の公開インターフェイスに移してきた定数を書いている
- [ ] `shortcuts_Summary.md` の `ShortcutSettings.tsx` の記述を「ダイアログの枠を持たないタブの中身」に更新し、
      `shortcut-labels.ts` から 2 定数が `app/review-labels.ts` へ移ったことを書いている
- [ ] すべてのファイルが300行以内(`ReviewPage.tsx` は現在 235 行、`review.css` は 196 行、
      `app_Summary.md` は 59 行)
- [ ] verify: に書いたコマンドが成功する
