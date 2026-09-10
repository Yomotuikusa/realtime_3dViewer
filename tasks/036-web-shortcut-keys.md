---
id: 036
title: web モード切替のキーボードショートカット(既定キー P / C / Esc / R / F)
feature: web
depends_on: [035]
owns: [web/src/features/shortcuts/keymap.ts, web/src/features/shortcuts/keymap-storage.ts, web/src/features/shortcuts/useShortcuts.ts, web/src/store/shortcuts.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/ViewerHud.tsx, web/src/app/ReviewPage.tsx, web/tests/keymap.test.ts, web/tests/keymap-storage.test.ts, web/tests/store-shortcuts.test.ts, web/tests/hud-labels.test.ts, web/web_Summary.md]
reads: [web/src/store/annotation.ts, web/src/store/camera.ts, web/src/app/display-name.ts, web/src/app/review-stores.ts, web/src/app/JoinDialog.tsx, web/src/features/comments/CommentComposer.tsx, web/src/features/annotation/AnnotationLayer.tsx, web/src/features/comments/CommentPickLayer.tsx, web/src/features/viewer/viewer-pointer.ts, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
ペン / コメントの切替が HUD のボタンクリックしかなく、描画中にマウスを HUD へ往復させる必要がある。
`P` でペン、`C` でコメントに切り替わるキーボードショートカットを入れる。
併せて解除(`Esc`)と視点操作(`R` / `F`)も同じ仕組みに載せる。
キー割り当てはユーザーが変更できる前提のデータ構造(`Keymap`)として持ち、
localStorage に永続化する。**変更するための設定画面は 037 で作る。**
このタスクの時点では既定キーが効くところまでとする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 操作モードは annotation ストアの `mode: "none" | "pen" | "comment"` で表される。
  `setMode(mode)` は同値なら state をそのまま返し、値が変わるときだけ `drafting` を破棄する。
  web/src/store/annotation.ts:5, web/src/store/annotation.ts:98-100
- HUD のモードボタンは `onClick={() => setMode(mode === modeValue ? "none" : modeValue)}` の
  **トグル**である。押されているモードをもう一度押すと `"none"` に戻る。
  web/src/features/viewer/ViewerHud.tsx:43
- 視点操作は camera ストアの `requestReset()` / `requestFit()` で、それぞれ `resetSeq` / `fitSeq` を
  1 増やすだけの action。HUD の「視点を戻す」「全体を表示」ボタンがこれを直接呼んでいる。
  web/src/store/camera.ts:61-67, web/src/features/viewer/ViewerHud.tsx:51-52
- `MODE_LABELS` は `{ pen: "ペン", comment: "コメント" }`、`MODE_ORDER` は `["pen", "comment"]`、
  `RESET_LABEL` は `"視点を戻す"`、`FIT_LABEL` は `"全体を表示"`。
  web/src/features/viewer/hud-labels.ts:6-13
- `ReviewPage` は `joinName` を `useState` で持ち、`null` の間は `JoinDialog`(`aria-modal` の
  入室フォーム)をビューアに重ねている。`useCommentReplay()` / `useRealtime()` /
  `useCameraBroadcast()` は早期 return より前で呼ばれている。
  web/src/app/ReviewPage.tsx:42-49, web/src/app/ReviewPage.tsx:130
- `JoinDialog` の表示名入力は `autoFocus` される。web/src/app/JoinDialog.tsx:36
- コメント本文は `CommentComposer` の入力欄で、アンカー選択後に自動フォーカスされる。
  日本語入力(IME)がそのまま使われる。web/src/features/comments/CommentComposer.tsx
- `Alt` はカメラ操作(033)に予約済み。`AnnotationLayer` と `CommentPickLayer` は
  pointerdown で `event.altKey` を弾き、`viewer-pointer.ts` が Alt 付きドラッグを
  回転 / ズーム / パンに割り当てている。
  web/src/features/annotation/AnnotationLayer.tsx:24-58, web/src/features/viewer/viewer-pointer.ts
- localStorage を使うときは `display-name.ts` と同じく try/catch で囲み、
  利用不可(プライベートブラウジング等)でも例外を投げない。
  web/src/app/display-name.ts:5-23
- `resetReviewStores()` は session / presence / annotation / comments / camera の 5 ストアを
  レビュー画面のアンマウント時に初期化する。web/src/app/review-stores.ts:8-14
- web のテストは jsdom 環境で、`@testing-library` は導入されていない。**React コンポーネントの
  レンダリングテストは書けない**。検証対象は純粋関数とストアに限られる。web/vitest.config.ts
- **jsdom は `contentEditable` を実装していない。** `element.contentEditable = "true"` は
  属性を書かず、`element.isContentEditable` は `undefined` を返す。
  この事実は実測で確認済みであり、`isTypingTarget` の実装方針を決める(実装メモ参照)。

## インターフェイス契約

### 新規 web/src/features/shortcuts/keymap.ts

```ts
/** ショートカットを割り当てられる操作。 */
export type ShortcutAction = "pen" | "comment" | "clearMode" | "viewReset" | "viewFit";

/** 正規化したキー割り当て。`"KeyP"` または `"Shift+KeyP"` の形だけを取る。 */
export type Binding = string;

/** action -> binding。null は未割り当て。 */
export type Keymap = Readonly<Record<ShortcutAction, Binding | null>>;

/** 設定画面の表示順であり、重複割り当てが残っていたときの優先順でもある。 */
export const ACTION_ORDER: readonly ShortcutAction[] = [
  "pen",
  "comment",
  "clearMode",
  "viewReset",
  "viewFit",
];

export const DEFAULT_KEYMAP: Keymap = {
  pen: "KeyP",
  comment: "KeyC",
  clearMode: "Escape",
  viewReset: "KeyR",
  viewFit: "KeyF",
};

/** KeyboardEvent から割り当て判定に使う部分だけを取り出した形。 */
export interface KeyChord {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** 発火判定に使う入力。KeyboardEvent をそのまま渡せる。 */
export interface ShortcutEventLike extends KeyChord {
  repeat: boolean;
  isComposing: boolean;
}

/** Shift / Control / Alt / Meta それ自体の code か。 */
export function isModifierCode(code: string): boolean;

/** 割り当てを許可する code か。 */
export function isAssignableCode(code: string): boolean;

/**
 * chord を binding 文字列にする。次のときは null。
 *  - ctrlKey / metaKey / altKey のいずれかが true(ブラウザ標準と Alt のカメラ操作を避けるため)
 *  - isAssignableCode(code) が false(修飾キー単独もここで false になる)
 */
export function bindingFromChord(chord: KeyChord): Binding | null;

/** binding 文字列として正しいか。`"KeyP"` と `"Shift+KeyP"` の形だけを許す。 */
export function isValidBinding(value: unknown): value is Binding;

/**
 * 発火すべきアクションを返す。該当なしは null。
 * repeat または isComposing が true のときは常に null。
 * 同じ binding が複数のアクションに残っている場合は ACTION_ORDER の先頭を返す。
 */
export function resolveAction(keymap: Keymap, event: ShortcutEventLike): ShortcutAction | null;

/**
 * action に binding を割り当てた新しい keymap を返す。引数の keymap は変更しない。
 * 同じ binding を持つ他のアクションは null(未割り当て)になる。
 * binding が null なら action だけを null にする。
 */
export function applyBinding(
  keymap: Keymap,
  action: ShortcutAction,
  binding: Binding | null,
): Keymap;

/** 表示用の文字列。null は `"未割り当て"`。 */
export function formatBinding(binding: Binding | null): string;

/** キー入力を横取りしてはいけない要素か(入力欄・選択欄・編集可能領域)。 */
export function isTypingTarget(target: EventTarget | null): boolean;
```

### 新規 web/src/features/shortcuts/keymap-storage.ts

```ts
import { type Keymap } from "./keymap";

export const KEYMAP_STORAGE_KEY = "3dreviewer:keymap";

/**
 * localStorage から keymap を読む。
 * 読めない・JSON が壊れている・オブジェクトでない場合は DEFAULT_KEYMAP を返す。
 * アクションごとに、値が null または isValidBinding を満たす文字列ならその値を採用し、
 * それ以外(欠落・型違い・不正な binding)は DEFAULT_KEYMAP の値で埋める。
 * ShortcutAction にない余分なキーは無視する。
 */
export function loadKeymap(): Keymap;

/** localStorage へ保存する。利用不可でも例外を投げない。 */
export function saveKeymap(keymap: Keymap): void;
```

### 新規 web/src/store/shortcuts.ts

```ts
import { type Binding, type Keymap, type ShortcutAction } from "../features/shortcuts/keymap";

export interface ShortcutsStoreState {
  keymap: Keymap;
  /** applyBinding の規則で割り当て、結果を localStorage へ保存する */
  setBinding(action: ShortcutAction, binding: Binding | null): void;
  /** DEFAULT_KEYMAP へ戻し、localStorage へ保存する */
  resetKeymap(): void;
}

export const useShortcutsStore: /* zustand の create<ShortcutsStoreState>(...) */;
```

初期値の `keymap` は `loadKeymap()` の結果とする。

### 新規 web/src/features/shortcuts/useShortcuts.ts

```ts
/**
 * window の keydown を購読し、keymap に一致したアクションを実行する。
 * enabled が false の間は購読しない。
 */
export function useShortcuts(enabled: boolean): void;
```

### 変更 web/src/features/viewer/hud-labels.ts

既存の export はすべて変更しない。次を追加する。

```ts
import { formatBinding, type Binding } from "../shortcuts/keymap";

/** ボタン名にショートカットキーを併記する。未割り当てなら name をそのまま返す。 */
export function withShortcut(name: string, binding: Binding | null): string;
```

### 変更 web/src/features/viewer/ViewerHud.tsx / web/src/app/ReviewPage.tsx

どちらも props のシグネチャは変更しない。

```tsx
export function ViewerHud({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
export function ReviewPage({ projectId }: { projectId: string }): ReactElement;
```

## 振る舞い

### isModifierCode

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `"ShiftLeft"` / `"ShiftRight"` | `true` |
| `"ControlLeft"` / `"ControlRight"` | `true` |
| `"AltLeft"` / `"AltRight"` | `true` |
| `"MetaLeft"` / `"MetaRight"` | `true` |
| `"KeyP"` / `"Escape"` / `""` | `false` |

### isAssignableCode

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `"KeyA"` / `"KeyP"` / `"KeyZ"` | `true` |
| `"Digit0"` / `"Digit9"` | `true` |
| `"F1"` / `"F9"` / `"F12"` | `true` |
| `"Escape"` / `"Space"` / `"Backspace"` / `"Delete"` | `true` |
| `"Home"` / `"End"` / `"PageUp"` / `"PageDown"` | `true` |
| `"ArrowUp"` / `"ArrowDown"` / `"ArrowLeft"` / `"ArrowRight"` | `true` |
| `"Minus"` / `"Equal"` / `"BracketLeft"` / `"BracketRight"` / `"Backslash"` | `true` |
| `"Semicolon"` / `"Quote"` / `"Comma"` / `"Period"` / `"Slash"` / `"Backquote"` | `true` |
| `"Tab"` | `false`(フォーカス移動を壊さないため) |
| `"Enter"` / `"NumpadEnter"` | `false`(フォーカス中のボタン確定を壊さないため) |
| `"F13"` | `false` |
| `"ShiftLeft"` などの修飾キー | `false` |
| `""` / `"Unidentified"` / `"Numpad1"` | `false` |

### bindingFromChord

明記しない修飾キーはすべて `false` とする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ code: "KeyP" }` | `"KeyP"` |
| `{ code: "KeyP", shiftKey: true }` | `"Shift+KeyP"` |
| `{ code: "Escape" }` | `"Escape"` |
| `{ code: "F12", shiftKey: true }` | `"Shift+F12"` |
| `{ code: "KeyP", ctrlKey: true }` | `null` |
| `{ code: "KeyP", metaKey: true }` | `null` |
| `{ code: "KeyP", altKey: true }` | `null` |
| `{ code: "KeyP", shiftKey: true, ctrlKey: true }` | `null` |
| `{ code: "Tab" }` / `{ code: "Enter" }` | `null` |
| `{ code: "ShiftLeft", shiftKey: true }` | `null` |
| `{ code: "" }` | `null` |

### isValidBinding

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `"KeyP"` / `"Escape"` / `"Digit1"` / `"ArrowUp"` / `"F12"` | `true` |
| `"Shift+KeyP"` / `"Shift+Escape"` / `"Shift+F12"` | `true` |
| `"Ctrl+KeyP"` / `"Alt+KeyP"` / `"Meta+KeyP"` | `false` |
| `"Shift+Shift+KeyP"` | `false` |
| `"shift+KeyP"`(小文字) | `false` |
| `"Tab"` / `"Enter"` | `false` |
| `"NotACode"` / `""` / `"+KeyP"` / `"KeyP+"` | `false` |
| `null` / `undefined` / `123` / `{}` / `["KeyP"]` | `false` |

### resolveAction

明記しないフィールドは修飾キー・`repeat`・`isComposing` すべて `false` とする。
keymap は明記がなければ `DEFAULT_KEYMAP`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ code: "KeyP" }` | `"pen"` |
| `{ code: "KeyC" }` | `"comment"` |
| `{ code: "Escape" }` | `"clearMode"` |
| `{ code: "KeyR" }` | `"viewReset"` |
| `{ code: "KeyF" }` | `"viewFit"` |
| `{ code: "KeyP", shiftKey: true }` | `null`(既定は Shift なしの割り当て) |
| `{ code: "KeyP", altKey: true }` | `null`(Alt はカメラ操作) |
| `{ code: "KeyP", ctrlKey: true }` / `{ code: "KeyP", metaKey: true }` | `null` |
| `{ code: "KeyX" }` | `null` |
| `{ code: "KeyP", repeat: true }` | `null`(押しっぱなしで連続発火させない) |
| `{ code: "KeyP", isComposing: true }` | `null`(IME 変換中) |
| `{ code: "Tab" }` | `null` |
| keymap の `pen` が `null` のとき `{ code: "KeyP" }` | `null` |
| `{ ...DEFAULT_KEYMAP, comment: "KeyP" }` に `{ code: "KeyP" }` | `"pen"`(ACTION_ORDER の先頭) |
| `{ ...DEFAULT_KEYMAP, pen: null, comment: "KeyP" }` に `{ code: "KeyP" }` | `"comment"` |
| `{ ...DEFAULT_KEYMAP, pen: "Shift+KeyP" }` に `{ code: "KeyP", shiftKey: true }` | `"pen"` |

### applyBinding

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyBinding(DEFAULT_KEYMAP, "pen", "KeyQ")` | `pen` が `"KeyQ"`、他の 4 つは既定のまま |
| `applyBinding(DEFAULT_KEYMAP, "pen", "KeyC")` | `pen` が `"KeyC"`、`comment` が `null`、他は既定のまま |
| `applyBinding(DEFAULT_KEYMAP, "pen", null)` | `pen` が `null`、他は既定のまま |
| `applyBinding(DEFAULT_KEYMAP, "pen", "KeyP")`(同じ値の再割り当て) | `DEFAULT_KEYMAP` と等しい。`pen` が `null` にならない |
| `applyBinding(DEFAULT_KEYMAP, "pen", "Shift+KeyC")` | `comment` は `"KeyC"` のまま(Shift 違いは別の binding) |
| 既に 2 つのアクションが同じ binding を持つ keymap に、その binding を第 3 のアクションへ割り当てる | 元の 2 つがどちらも `null` になる |
| 返り値 | 引数とは別の新しいオブジェクト |
| 呼び出しの前後で引数の keymap | 変化しない |

### formatBinding

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `"KeyP"` | `"P"` |
| `"Shift+KeyP"` | `"Shift+P"` |
| `"Digit1"` | `"1"` |
| `"Escape"` | `"Esc"` |
| `"Space"` | `"Space"` |
| `"ArrowUp"` / `"ArrowDown"` / `"ArrowLeft"` / `"ArrowRight"` | `"↑"` / `"↓"` / `"←"` / `"→"` |
| `"Minus"` / `"Equal"` / `"Slash"` / `"Comma"` / `"Period"` | `"-"` / `"="` / `"/"` / `","` / `"."` |
| `"Semicolon"` / `"Quote"` / `"Backquote"` / `"Backslash"` | `";"` / `"'"` / `` "`" `` / `"\\"` |
| `"BracketLeft"` / `"BracketRight"` | `"["` / `"]"` |
| `"Backspace"` / `"Delete"` / `"Home"` / `"End"` / `"PageUp"` / `"PageDown"` | 同じ文字列をそのまま |
| `"F12"` | `"F12"` |
| `"Shift+ArrowUp"` | `"Shift+↑"` |
| `null` | `"未割り当て"` |
| 未知の code `"XYZ"` | `"XYZ"`(そのまま返す) |

### isTypingTarget

jsdom で `document.createElement` した要素を渡して検証する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `input` 要素 | `true` |
| `textarea` 要素 | `true` |
| `select` 要素 | `true` |
| `setAttribute("contenteditable", "true")` した `div` | `true` |
| `setAttribute("contenteditable", "")` した `div` | `true` |
| 上の `div` の子孫要素(`span` を `append` したもの) | `true` |
| `setAttribute("contenteditable", "false")` した `div` | `false` |
| `button` / `div` / `canvas` 要素 | `false` |
| `document.body` | `false` |
| `null` | `false` |
| `new EventTarget()`(Element でないもの) | `false` |

### loadKeymap / saveKeymap

`beforeEach` で `localStorage.clear()` する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| localStorage が空 | `DEFAULT_KEYMAP` と等しい |
| `saveKeymap(k)` のあと `loadKeymap()` | `k` と等しい |
| 保存値が `"{"`(壊れた JSON) | `DEFAULT_KEYMAP` と等しい |
| 保存値が `"null"` / `"[]"` / `"5"` / `'"x"'` | `DEFAULT_KEYMAP` と等しい |
| 保存値が `'{"pen":"KeyQ"}'`(他のキーが欠落) | `pen` が `"KeyQ"`、他の 4 つは既定 |
| 保存値が `'{"pen":null}'` | `pen` が `null`、他の 4 つは既定 |
| 保存値が `'{"pen":"Tab"}'`(不正な binding) | `pen` が既定の `"KeyP"` |
| 保存値が `'{"pen":123}'`(型違い) | `pen` が既定の `"KeyP"` |
| 保存値が `'{"pen":"KeyQ","zzz":"KeyZ"}'`(未知のキー) | `pen` が `"KeyQ"`、返り値に `zzz` が含まれない |
| `saveKeymap` の保存先キー | `KEYMAP_STORAGE_KEY` が `"3dreviewer:keymap"` |
| 返り値 | `DEFAULT_KEYMAP` と同一オブジェクトではない(呼び出し側が書き換えても既定が壊れない) |

### shortcuts ストア

`beforeEach` で `localStorage.clear()` と `useShortcutsStore.getState().resetKeymap()` を行う。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `resetKeymap()` 直後の `keymap` | `DEFAULT_KEYMAP` と等しい |
| `setBinding("pen", "KeyQ")` | `keymap.pen` が `"KeyQ"`、他は既定 |
| `setBinding("pen", "KeyC")` | `keymap.pen` が `"KeyC"`、`keymap.comment` が `null` |
| `setBinding("pen", null)` | `keymap.pen` が `null` |
| `setBinding("pen", "KeyQ")` のあと `loadKeymap()` | `pen` が `"KeyQ"` (localStorage へ保存されている) |
| `setBinding("pen", "KeyQ")` のあと `resetKeymap()` | `keymap` が `DEFAULT_KEYMAP` と等しく、`loadKeymap()` も既定を返す |
| `setBinding` 前後の `keymap` オブジェクト | 別のオブジェクトになる(引数を破壊的に変更しない) |
| `resetReviewStores()` を呼ぶ | `keymap` が変化しない(退室してもキー設定は残る) |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| 入室後、ビューア上で `P` | ペンモードになる。もう一度 `P` で `"none"` に戻る |
| ペンモード中に `C` | コメントモードになる(いったん `"none"` を経由しない) |
| 任意のモードで `Esc` | `"none"` になる |
| `R` / `F` | `requestReset()` / `requestFit()` が呼ばれる |
| 入室前(`JoinDialog` 表示中) | どのキーも効かない |
| 表示名入力欄・コメント本文入力欄にフォーカスがある | どのキーも効かない。`p` や `c` がそのまま入力される |
| コメント本文で日本語を IME 変換中 | どのキーも効かない |
| `P` を押しっぱなしにする | 1 回だけ発火する(`repeat` を無視) |
| `Ctrl+P`(印刷) / `Cmd+C`(コピー) | ショートカットは発火せず、ブラウザ標準の動作が残る |
| `Alt+P` | ショートカットは発火しない(Alt はカメラ操作) |
| キーが発火したとき | `preventDefault()` する。発火しなかったキーでは呼ばない |
| HUD のモードボタンのラベル | `"ペン (P)"` / `"コメント (C)"` |
| HUD の視点ボタンのラベル | `"視点を戻す (R)"` / `"全体を表示 (F)"` |
| 未割り当てのアクション | ラベルにキーが併記されない(`"ペン"` のまま) |
| ブラウザを再読み込みする | localStorage の keymap が復元される |
| レビュー画面を離れて別のプロジェクトへ入る | keymap は保持される |
| `Esc` を押したとき | モードは `"none"` になるが、コメント投稿位置(`composerAnchor`)は消えない |
| ペン描画のドラッグ中にキーを押す | 描画は継続する。モード切替はキーの規則どおり起きる |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **binding は `KeyboardEvent.code` を使う。`key` は使わない。** `key` は配列(JIS/US)と Shift の
  状態で値が変わり、割り当ての同一性が保てないため
- `isAssignableCode` は許可リストの正規表現ひとつで実装する。除外リストにしない。
  `F` 系は `F(?:[1-9]|1[0-2])` の形で書き、`F13` 以降が通らないようにする
- `bindingFromChord` は `isModifierCode` を個別に呼ばなくてよい。修飾キーの code は
  `isAssignableCode` の許可リストに入っていないので自然に `null` になる。
  `isModifierCode` は 037 のキャプチャ UI が「修飾キー単独の押下は無視して待機を続ける」ために
  必要なので、このタスクで export しておく
- `isValidBinding` は `bindingFromChord` の逆写像として実装する。
  `"Shift+"` で始まればそれを剥がして残りを `isAssignableCode` に通す。
  `"+"` が 2 つ以上ある文字列や `"shift+"`(小文字)は弾く
- **`isTypingTarget` は `isContentEditable` を使わない。** jsdom が未実装のためテストできない。
  `target instanceof Element` を確かめたうえで `tagName` が `INPUT` / `TEXTAREA` / `SELECT` か、
  または `target.closest("[contenteditable]:not([contenteditable='false'])") !== null` で判定する。
  `closest` を使うのは編集可能領域の子孫要素にフォーカスがある場合も拾うため
- `resolveAction` は `repeat` / `isComposing` を最初に弾き、次に `bindingFromChord` で binding を作り、
  `ACTION_ORDER` を順に走査して最初に一致したアクションを返す。`null` の binding は一致させない
- `applyBinding` は「先に他アクションの同値を `null` にしてから、対象アクションへ代入する」順で書く。
  逆順にすると自分自身を `null` にしてしまう
- `formatBinding` は code -> 表示名の `Record<string, string>` を持ち、
  `Key[A-Z]` と `Digit[0-9]` だけ接頭辞を剥がす分岐にする。表に載っていない code はそのまま返す
- ストアは `create<ShortcutsStoreState>((set, get) => ...)` で作り、`setBinding` は
  `applyBinding(get().keymap, ...)` の結果を `set` してから `saveKeymap` に渡す
- **shortcuts ストアは `resetReviewStores()` に加えない。** キー設定は退室しても保持する。
  `review-stores.ts` は変更しない
- `useShortcuts(enabled)` は `useEffect` で `enabled` が `true` のときだけ
  `window.addEventListener("keydown", handler)` を張り、cleanup で外す。
  ハンドラの中は `useShortcutsStore.getState().keymap` で読む(依存配列に keymap を入れない。
  設定変更のたびにリスナーを張り直す必要はない)
- ハンドラの順序は「`isTypingTarget(event.target)` なら return」→「`resolveAction` が `null` なら
  return」→「`event.preventDefault()`」→「アクション実行」とする
- アクションの実行は `switch` で書く。React の再レンダリングに依存しないよう、
  すべて `getState()` 経由で呼ぶ
  - `pen` / `comment`: `const annotation = useAnnotationStore.getState();`
    `annotation.setMode(annotation.mode === action ? "none" : action);`(HUD ボタンと同じトグル)
  - `clearMode`: `useAnnotationStore.getState().setMode("none");`
  - `viewReset`: `useCameraStore.getState().requestReset();`
  - `viewFit`: `useCameraStore.getState().requestFit();`
- `ReviewPage` では既存のフック呼び出しの並び(早期 return より前)に
  `useShortcuts(joinName !== null);` を足す。**037 でこの引数に設定ダイアログの開閉が加わるので、
  引数は式のまま書き、フックの外へ切り出さない**
- `ViewerHud` は `useShortcutsStore((state) => state.keymap)` を購読し、
  モードボタンを `{withShortcut(MODE_LABELS[modeValue], keymap[modeValue])}`、
  視点ボタンを `{withShortcut(RESET_LABEL, keymap.viewReset)}` /
  `{withShortcut(FIT_LABEL, keymap.viewFit)}` にする。
  `MODE_ORDER` の値(`"pen"` / `"comment"`)はそのまま `ShortcutAction` のキーとして使える
- `withShortcut` は `binding` が `null` なら `name` をそのまま返す。
  `formatBinding` の `"未割り当て"` を括弧に入れてはならない
- HUD のレイアウト・`aria-label`・`aria-pressed`・CSS は変更しない。ボタンの表示文字列だけが変わる
- `hint()` の文言は変更しない。ショートカットの案内はボタンラベルの併記だけで行う

## やらないこと
- **キー割り当てを変更する設定画面は作らない。** 037 の仕事である。
  ストアの `setBinding` / `resetKeymap` は用意するが、このタスクで UI からは呼ばない
- `Ctrl` / `Cmd` / `Alt` 付きの割り当てに対応しない。`Shift` だけを許す
- 連続キー(`g` のあと `g` など)や長押しに対応しない
- `keyup` / `keypress` を購読しない。`keydown` だけを使う
- 「1本戻す」「自分の線を消す」「透過表示」「表面 / 空間」にショートカットを割り当てない
  (`ShortcutAction` にこれらを足さない)
- `Esc` で `composerAnchor` を消さない。`CommentComposer` / `CommentPickLayer` /
  comments ストアは変更しない
- `hint()` の文言、HUD の CSS、`viewer.css` / `annotation.css` を変更しない
- `resetReviewStores()` と `review-stores.ts` を変更しない
- ペン描画・カメラ操作(033)・透過表示(034)・空間描画(035)の挙動を変更しない
- キー設定を WebSocket で他の参加者へ送らない
- `shared/` と `server/` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`keymap.test.ts` に `isModifierCode` / `isAssignableCode` / `bindingFromChord` /
      `isValidBinding` / `resolveAction` / `applyBinding` / `formatBinding` / `isTypingTarget` の系列、
      `keymap-storage.test.ts` に `loadKeymap` / `saveKeymap` の系列、
      `store-shortcuts.test.ts` にストアの系列を新規に追加し、
      `hud-labels.test.ts` に `withShortcut` の系列を足す)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`features/shortcuts/` の 3 ファイルと `store/shortcuts.ts` の追加、
      `ShortcutAction` / `Binding` / `Keymap` / `DEFAULT_KEYMAP` / `ACTION_ORDER` /
      `KEYMAP_STORAGE_KEY` / `useShortcutsStore` / `useShortcuts` / `withShortcut`、
      shortcuts ストアが `resetReviewStores` の対象外であることを含む)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
