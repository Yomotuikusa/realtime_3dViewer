---
id: 037
title: web ショートカットキーの設定ダイアログ(再割り当て・解除・既定に戻す)
feature: web
depends_on: [036]
owns: [web/src/features/shortcuts/capture.ts, web/src/features/shortcuts/shortcut-labels.ts, web/src/features/shortcuts/ShortcutSettings.tsx, web/src/features/shortcuts/shortcuts.css, web/src/app/ReviewHeader.tsx, web/src/app/ReviewPage.tsx, web/tests/capture.test.ts, web/tests/shortcut-labels.test.ts, web/web_Summary.md]
reads: [web/src/features/shortcuts/keymap.ts, web/src/features/shortcuts/keymap-storage.ts, web/src/features/shortcuts/useShortcuts.ts, web/src/store/shortcuts.ts, web/src/features/viewer/hud-labels.ts, web/src/app/JoinDialog.tsx, web/src/app/review.css, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/styles-rules.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
036 で入れたショートカットは既定キーが固定で、ユーザーが変更できない。
ヘッダの「設定」から開くダイアログで、各アクションのキーを押し直して再割り当てできるようにする。
解除(未割り当て)と、まとめて既定に戻す操作も提供する。
変更は 036 のストア経由で即座に localStorage へ保存される。

## 前提
036 の成果物はすべて完成しており、このタスクでは **`keymap.ts` / `keymap-storage.ts` /
`useShortcuts.ts` / `store/shortcuts.ts` を変更しない**。それらから読める事実は次のとおり。

- `ShortcutAction` は `"pen" | "comment" | "clearMode" | "viewReset" | "viewFit"` の 5 つ。
  `ACTION_ORDER` がそのまま設定画面の表示順である。web/src/features/shortcuts/keymap.ts
- `Keymap` は `Readonly<Record<ShortcutAction, Binding | null>>`。`null` は未割り当て。
  `Binding` は `"KeyP"` または `"Shift+KeyP"` の形の文字列。
- `isModifierCode(code)` は Shift / Control / Alt / Meta それ自体の code に `true` を返す。
- `isAssignableCode(code)` は割り当てを許可する code に `true` を返す。`Tab` と `Enter` は `false`。
- `bindingFromChord(chord)` は `ctrlKey` / `metaKey` / `altKey` のいずれかが `true`、または
  `isAssignableCode(code)` が `false` のとき `null` を返す。
- `formatBinding(binding)` は表示用文字列を返す。`null` は `"未割り当て"`。
- `useShortcutsStore` は `keymap` と `setBinding(action, binding)` / `resetKeymap()` を持ち、
  どちらも変更結果を localStorage へ保存する。`setBinding` は同じ binding を持つ他のアクションを
  `null` にする(`applyBinding` の規則)。web/src/store/shortcuts.ts
- `useShortcuts(enabled)` は `enabled` が `false` の間 `window` の keydown を購読しない。
  `ReviewPage` は現在 `useShortcuts(joinName !== null)` を呼んでいる。
  web/src/features/shortcuts/useShortcuts.ts, web/src/app/ReviewPage.tsx
- `MODE_LABELS` は `{ pen: "ペン", comment: "コメント" }`、`RESET_LABEL` は `"視点を戻す"`、
  `FIT_LABEL` は `"全体を表示"`。web/src/features/viewer/hud-labels.ts:6-13

036 の外側で既に決まっている事実。

- `.review-backdrop` は `position: absolute; inset: 0; z-index: 2` で、`position: relative` の
  `.review-viewer` を覆う。`.review-dialog` は `display: grid; gap: var(--space-3);
  width: min(24rem, 90%)` のカード。`.review-dialog__help` は薄い小さめの文字。
  web/src/app/review.css:106-127
- `JoinDialog` は `.review-backdrop` > `.review-dialog`(`role="dialog"` / `aria-modal="true"` /
  `aria-labelledby`)の構造で、`ReviewPage` が `.review-viewer` の中に条件付きで描画している。
  web/src/app/JoinDialog.tsx:16-24, web/src/app/ReviewPage.tsx:130
- `ReviewHeader` は `{ projectName, joined }` を受け取り、`.review-header__actions` の中に
  接続バッジ・自分の表示名(`joined` のときだけ)・URL コピーボタン・コピー失敗時の URL 入力欄を
  並べている。web/src/app/ReviewHeader.tsx:11, web/src/app/ReviewHeader.tsx:34-60
- `.btn` / `.btn--quiet` / `.btn--primary` / `.input` / `.field` は `styles/controls.css` の共通クラス。
- **CSS には機械検査がある。** 生の色(`#rrggbb`、`rgb()`、`hsl()`)は `styles/tokens.css` にしか
  書けない。`var(--x)` は宣言済みトークンか fallback 付きでなければならない。`!important` は
  `styles/base.css` 以外で禁止。`@import` も禁止。web/tests/styles-rules.test.ts:106-130
- web のテストは jsdom 環境で `@testing-library` は未導入。**React コンポーネントの
  レンダリングテストは書けない**。検証対象は純粋関数とストアに限られる。web/vitest.config.ts

## インターフェイス契約

### 新規 web/src/features/shortcuts/capture.ts

```ts
import { type Binding, type KeyChord } from "./keymap";

/** キャプチャを拒否した理由。 */
export type CaptureRejection = "modifier" | "unsupported";

export type CaptureResult =
  | { status: "ignored" }
  | { status: "cancelled" }
  | { status: "rejected"; reason: CaptureRejection }
  | { status: "assigned"; binding: Binding };

/**
 * キー待機中に押されたキーをどう扱うかを決める。判定順は次のとおり。
 *  1. 修飾キーそのものの押下            -> { status: "ignored" }(待機を続ける)
 *  2. 修飾なしの Escape                 -> { status: "cancelled" }(待機をやめる)
 *  3. ctrlKey / metaKey / altKey を伴う -> { status: "rejected", reason: "modifier" }
 *  4. 割り当てできない code             -> { status: "rejected", reason: "unsupported" }
 *  5. それ以外                          -> { status: "assigned", binding }
 */
export function captureBinding(chord: KeyChord): CaptureResult;
```

### 新規 web/src/features/shortcuts/shortcut-labels.ts

```ts
import { type ShortcutAction } from "./keymap";
import { type CaptureRejection } from "./capture";

/** 設定画面に出すアクション名。pen / comment / viewReset / viewFit は hud-labels の定数を再利用する。 */
export const ACTION_LABELS: Readonly<Record<ShortcutAction, string>>;

export const SETTINGS_OPEN_LABEL = "ショートカット設定";
export const SETTINGS_TITLE = "ショートカットキー";
export const SETTINGS_HELP =
  "「変更」を押してから割り当てたいキーを押してください。Shift との組み合わせだけが使えます。Esc で中止します。";
export const CHANGE_LABEL = "変更";
export const CANCEL_CAPTURE_LABEL = "やめる";
export const CAPTURING_MESSAGE = "キーを押してください";
export const UNBIND_LABEL = "解除";
export const RESET_KEYMAP_LABEL = "既定に戻す";
export const CLOSE_LABEL = "閉じる";

/** キャプチャを拒否した理由の説明文。 */
export function rejectionMessage(reason: CaptureRejection): string;
```

### 新規 web/src/features/shortcuts/ShortcutSettings.tsx

```tsx
export function ShortcutSettings({ onClose }: { onClose: () => void }): ReactElement;
```

### 変更 web/src/app/ReviewHeader.tsx

```tsx
export function ReviewHeader({ projectName, joined, onOpenSettings }: {
  projectName: string;
  joined: boolean;
  onOpenSettings: () => void;
}): ReactElement;
```

### 変更 web/src/app/ReviewPage.tsx

props のシグネチャは変更しない。

```tsx
export function ReviewPage({ projectId }: { projectId: string }): ReactElement;
```

## 振る舞い

### captureBinding

明記しない修飾キーはすべて `false` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ code: "KeyQ" }` | `{ status: "assigned", binding: "KeyQ" }` |
| `{ code: "KeyQ", shiftKey: true }` | `{ status: "assigned", binding: "Shift+KeyQ" }` |
| `{ code: "F5" }` | `{ status: "assigned", binding: "F5" }` |
| `{ code: "Escape", shiftKey: true }` | `{ status: "assigned", binding: "Shift+Escape" }` |
| `{ code: "ShiftLeft", shiftKey: true }` | `{ status: "ignored" }` |
| `{ code: "ControlRight", ctrlKey: true }` | `{ status: "ignored" }` |
| `{ code: "AltLeft", altKey: true }` / `{ code: "MetaLeft", metaKey: true }` | `{ status: "ignored" }` |
| `{ code: "Escape" }` | `{ status: "cancelled" }` |
| `{ code: "KeyQ", ctrlKey: true }` | `{ status: "rejected", reason: "modifier" }` |
| `{ code: "KeyQ", metaKey: true }` | `{ status: "rejected", reason: "modifier" }` |
| `{ code: "KeyQ", altKey: true }` | `{ status: "rejected", reason: "modifier" }` |
| `{ code: "KeyQ", shiftKey: true, ctrlKey: true }` | `{ status: "rejected", reason: "modifier" }` |
| `{ code: "Escape", ctrlKey: true }` | `{ status: "rejected", reason: "modifier" }`(cancelled より後の判定) |
| `{ code: "Tab" }` | `{ status: "rejected", reason: "unsupported" }` |
| `{ code: "Enter" }` / `{ code: "NumpadEnter" }` | `{ status: "rejected", reason: "unsupported" }` |
| `{ code: "F13" }` / `{ code: "Numpad1" }` / `{ code: "" }` | `{ status: "rejected", reason: "unsupported" }` |
| `{ code: "Tab", ctrlKey: true }` | `{ status: "rejected", reason: "modifier" }`(修飾の判定が先) |

### ACTION_LABELS / rejectionMessage

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ACTION_LABELS` のキー | `ACTION_ORDER` の 5 つと過不足なく一致する |
| `ACTION_LABELS.pen` / `ACTION_LABELS.comment` | `MODE_LABELS.pen` / `MODE_LABELS.comment` と等しい |
| `ACTION_LABELS.viewReset` / `ACTION_LABELS.viewFit` | `RESET_LABEL` / `FIT_LABEL` と等しい |
| `ACTION_LABELS.clearMode` | `"モード解除"` |
| `rejectionMessage("modifier")` | `"Ctrl / Cmd / Alt との組み合わせは使えません"` |
| `rejectionMessage("unsupported")` | `"このキーは割り当てられません"` |
| 各ラベル定数 | 空文字列でない |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| 入室前(`JoinDialog` 表示中) | ヘッダに「ショートカット設定」ボタンが出ない |
| 入室後、ヘッダの「ショートカット設定」を押す | ビューアを覆う設定ダイアログが開く |
| ダイアログの中身 | `ACTION_ORDER` の順に 5 行。各行は アクション名 / 現在のキー / 「変更」/ 「解除」 |
| 各行のキー表示 | `formatBinding(keymap[action])`。未割り当ては `"未割り当て"` |
| ダイアログが開いている間 | `P` や `C` を押してもモードが変わらない(`useShortcuts` が無効) |
| ある行の「変更」を押す | その行のキー表示が `CAPTURING_MESSAGE` になり、ボタンが `CANCEL_CAPTURE_LABEL` に変わる |
| 待機中に `Q` を押す | その行が `"Q"` になり、待機が終わる。localStorage へ即保存される |
| 待機中に `Shift+Q` を押す | その行が `"Shift+Q"` になる |
| 待機中に Shift だけを押す | 何も起きず待機が続く |
| 待機中に `Ctrl+Q` を押す | 待機が続き、`rejectionMessage("modifier")` が表示される |
| 待機中に `Tab` を押す | 待機が続き、`rejectionMessage("unsupported")` が表示される。フォーカスは移動しない |
| 待機中に `Esc` を押す | 待機をやめる。割り当ては変わらない |
| 待機中に「やめる」を押す | 待機をやめる。割り当ては変わらない |
| 待機中に別の行の「変更」を押す | 前の行の待機が終わり、押した行が待機になる |
| ペンに `C`(コメントの割り当て)を割り当てる | ペンが `"C"`、コメントが `"未割り当て"` になる |
| 未割り当ての行の「解除」ボタン | `disabled` になっている |
| ある行の「解除」を押す | その行が `"未割り当て"` になり、そのキーでは何も起きなくなる |
| 「既定に戻す」を押す | 5 行すべてが既定(P / C / Esc / R / F)に戻り、localStorage も既定になる |
| 「閉じる」を押す | ダイアログが閉じ、ショートカットが再び有効になる |
| ダイアログを閉じたあと HUD のボタン | 新しいキーが併記される(`"ペン (Q)"` など) |
| ダイアログを閉じずにキーを変えた直後 | 待機の終了と同時に反映される。「閉じる」を押すまで待たない |
| 待機中にダイアログを閉じる | 待機は破棄される。次に開いたときは待機していない |
| ブラウザを再読み込みする | 変更したキーが復元される |
| 画面幅が狭いとき | ダイアログが横にはみ出さない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **キー待機中のイベントは `window` の keydown を capture フェーズで購読し、
  受け取ったら必ず `event.preventDefault()` と `event.stopPropagation()` を呼ぶ。**
  待機中は `Tab` のフォーカス移動も `Space` / `Enter` のボタン確定も起こしてはならない
- 待機の購読は `useEffect` で行い、依存配列は待機中のアクション(`capturing`)だけにする。
  `capturing === null` の間はリスナーを張らない
- `captureBinding` の結果ごとの処理
  - `ignored`: 何もしない(拒否メッセージも消さない)
  - `cancelled`: `capturing` を `null` に、拒否メッセージを `null` にする
  - `rejected`: 拒否メッセージを更新する。`capturing` は保つ
  - `assigned`: `useShortcutsStore.getState().setBinding(capturing, binding)` を呼び、
    `capturing` と拒否メッセージを `null` にする
- ダイアログの内部状態は `useState` 2 つだけとする。
  `capturing: ShortcutAction | null` と `rejection: CaptureRejection | null`。
  **shortcuts ストアに待機状態を持たせない**
- ダイアログの開閉状態は `ReviewPage` の `useState<boolean>` が持つ。
  ストアにもコンテキストにも置かない。`ReviewHeader` へは `onOpenSettings` コールバックだけを渡す
- `ReviewPage` の `useShortcuts` 呼び出しを `useShortcuts(joinName !== null && !settingsOpen)` に
  書き換える。これがダイアログ表示中に `P` / `C` が効かない仕組みであり、
  待機中の二重発火も同時に防いでいる
- `ShortcutSettings` は `JoinDialog` と同じく `.review-viewer` の中に描画する。
  `ReviewPage` の `{joinName === null && <JoinDialog .../>}` の**次の行**に
  `{settingsOpen && <ShortcutSettings onClose={() => setSettingsOpen(false)} />}` を置く
- ヘッダの設定ボタンは `joined` が `true` のときだけ描画する。位置は
  「レビュー URL をコピー」ボタンの直後、コピー失敗時の URL 入力欄より前。
  `className="btn btn--quiet"` / `type="button"`
- マークアップは `JoinDialog` に合わせる。
  `<div className="review-backdrop">` >
  `<div className="review-dialog shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby={useId()}>`。
  中身は `<h2 id={titleId}>{SETTINGS_TITLE}</h2>`、
  `<p className="review-dialog__help">{SETTINGS_HELP}</p>`、
  拒否メッセージ(`rejection !== null` のとき `<p className="alert" role="alert">`)、
  行のリスト、末尾に `RESET_KEYMAP_LABEL`(`.btn.btn--quiet`)と
  `CLOSE_LABEL`(`.btn.btn--primary`、`autoFocus`)を並べたフッタ
- 1 行のマークアップ

  ```tsx
  <div className="shortcut-row" key={action}>
    <span className="shortcut-row__name">{ACTION_LABELS[action]}</span>
    <span className="shortcut-row__key">
      {capturing === action ? CAPTURING_MESSAGE : formatBinding(keymap[action])}
    </span>
    <button className="btn btn--quiet" type="button" onClick={...}>
      {capturing === action ? CANCEL_CAPTURE_LABEL : CHANGE_LABEL}
    </button>
    <button className="btn btn--quiet" type="button"
      onClick={() => useShortcutsStore.getState().setBinding(action, null)}
      disabled={keymap[action] === null}>
      {UNBIND_LABEL}
    </button>
  </div>
  ```

  「変更」ボタンの `onClick` は待機中なら `setCapturing(null)`、そうでなければ
  `setCapturing(action)` とし、どちらの場合も `setRejection(null)` する
- 行のリストは `<div role="group" aria-label={SETTINGS_TITLE}>` で囲む。
  各行のボタンには `aria-label` を付けず、テキストで区別されることを許容する
  (アクション名は同じ行の `.shortcut-row__name` に出ている)
- `keymap` は `useShortcutsStore((state) => state.keymap)` で購読し、
  更新系は `useShortcutsStore.getState()` 経由で呼ぶ
- **`shortcuts.css` の制約**。生の色を書かない(`--color-*` トークンだけを使う)。
  `!important` と `@import` を使わない。宣言のないカスタムプロパティを参照しない。
  `styles-rules.test.ts` がこれを検査する
- ダイアログの幅は `.review-dialog` の `min(24rem, 90%)` では 4 列に足りない。
  `shortcuts.css` に **`.review-dialog.shortcut-dialog { width: min(30rem, 92%); }`** と
  クラス 2 つの詳細度で書いて上書きする(`!important` は使えず、
  CSS の読み込み順に依存させないため)。`review.css` は変更しない
- `.shortcut-row` は `display: grid; grid-template-columns: 1fr auto auto auto;
  align-items: center; gap: var(--space-2);` とする。`.shortcut-row__key` は
  `var(--color-surface-subtle)` の背景・`var(--radius-sm)`・`var(--text-sm)` の
  キーキャップ風表示にし、`min-width` を持たせて待機中の文言でレイアウトが跳ねないようにする
- `shortcut-labels.ts` は `hud-labels.ts` から `MODE_LABELS` / `RESET_LABEL` / `FIT_LABEL` を
  import して `ACTION_LABELS` を組み立てる。**同じ日本語文字列を書き写さない**

## やらないこと
- `keymap.ts` / `keymap-storage.ts` / `useShortcuts.ts` / `store/shortcuts.ts` を変更しない。
  036 のインターフェイスをそのまま使う
- `ShortcutAction` にアクションを追加しない(「1本戻す」「透過表示」「表面 / 空間」など)
- `Ctrl` / `Cmd` / `Alt` 付きの割り当てに対応しない
- 連続キー(chord / sequence)や、アクションごとに複数のキーを割り当てる機能を作らない
- 割り当ての衝突をダイアログ上で警告・確認しない。`setBinding` の規則どおり相手を静かに
  未割り当てにし、その行の表示が `"未割り当て"` に変わることで伝える
- OK / キャンセルによる一括確定を作らない。変更は 1 操作ごとに即保存する
- backdrop のクリックや `Esc` でダイアログを閉じない。閉じるのは「閉じる」ボタンだけ
  (待機中の `Esc` は待機の中止に使う)
- フォーカストラップやフォーカスの復元を実装しない(`JoinDialog` も持っていない)
- 設定内容をエクスポート / インポートする機能を作らない
- キー設定を WebSocket で他の参加者へ送らない
- `review.css` / `viewer.css` / `annotation.css` / `styles/` 配下を変更しない
- `hud-labels.ts` / `ViewerHud.tsx` を変更しない(036 で併記済み)
- `JoinDialog` / `review-stores.ts` / `resetReviewStores()` を変更しない
- `shared/` と `server/` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`capture.test.ts` に `captureBinding` の系列、`shortcut-labels.test.ts` に
      `ACTION_LABELS` / `rejectionMessage` / 各ラベル定数の系列を新規に追加する)
- [ ] `styles-rules.test.ts` が `shortcuts.css` を含めて通る
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`capture.ts` / `shortcut-labels.ts` / `ShortcutSettings.tsx` / `shortcuts.css` の追加、
      `CaptureResult` / `captureBinding` / `ACTION_LABELS` / `ShortcutSettings`、
      `ReviewHeader` の props に `onOpenSettings` が増えたこと、
      設定ダイアログ表示中はショートカットが無効になることを含む)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
