---
id: 091
title: web ビューアのモデル読み込み失敗アラートをビューア中央に出す
feature: web
depends_on: []
owns: [web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/app/app_Summary.md, web/tests/review-styles.test.ts]
reads: [web/src/app/ErrorBoundary.tsx, web/src/app/review-labels.ts, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/tests/pick.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
モデルの読み込みに失敗したとき、`ErrorBoundary` のフォールバックが `.review-stage` の通常フローに
置かれるため、`position: absolute; inset: 0; z-index: 1` の `.review-hud` に覆われて左上の
「表示 (P)」「ライト (C)」ボタンの下に隠れる。ビューア領域の中央へ、HUD より上に出す。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `ErrorCard({ message, onRetry })` は `<div className="alert review-error" role="alert">` に
  メッセージと再読み込みボタンを描く。web/src/app/ReviewPage.tsx:52-60
- `ErrorCard` は 2 箇所で使われている。web/src/app/ReviewPage.tsx
  1. `state.status === "error"`(プロジェクト取得失敗)のとき `<main className="review-page review-page--message">` の
     直下。**こちらは何にも覆われていないので触らない**
  2. `<ErrorBoundary key={projectId} fallback={...}>`(モデル読み込み失敗)。**隠れているのはこちら**
- `.review-stage` は `position: relative` だが `z-index` を持たないため、**独立した重ね合わせ文脈を作らない**。
  つまり `.review-stage` の子孫の `z-index` は `.review-viewer` の中で `.review-backdrop` と直接比較される。
  web/src/app/review.css:99-103
- `.review-hud` は `position: absolute; inset: 0; z-index: 1; pointer-events: none` で、
  `.review-hud :is(.btn, [role="toolbar"], [role="group"], [role="status"], [role="alert"])` にだけ
  `pointer-events: auto` を戻している。web/src/app/review.css:104-117
- `.review-backdrop`(入室ダイアログとショートカット設定が使う覆い)は
  `position: absolute; inset: 0; z-index: 2; display: grid; place-items: center` と半透明背景。
  web/src/app/review.css:119-127
- `JoinDialog` は `.review-stage` の**外**、`.review-viewer` の中で `.review-stage` より後ろに置かれる。
  web/src/app/ReviewPage.tsx:167-170
- `.review-error` は `display: grid; gap; max-width: 28rem; padding; text-align: center` だけを持ち、
  枠・背景色は `controls.css` の `.alert`(`--color-danger-subtle` / `--color-danger-border`)から来る。
  web/src/app/review.css:160-166、web/src/styles/controls.css:63-69
- 使えるトークン: `--shadow-overlay`、`--radius-lg`、`--space-4`。web/src/styles/tokens.css:41、:38 付近
- `web/tests/styles-rules.test.ts` が全 CSS に対して次を機械検査している。**破らないこと**
  - `tokens.css` 以外で生の色(`#rrggbb` / `rgb(` / `rgba(` / `hsl(`)を書かない
  - `base.css` 以外で `!important` を書かない、`@import` を書かない
  - `var(--x)` の参照先はどこかで宣言されているか、フォールバックを持つこと
- `web/tests/summary-coverage.test.ts` は「src の全ファイルが最寄りの `_Summary.md` に載っている」
  「`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っている」を検査する。
  **新しいテストファイルは `app_Summary.md` の「## テスト」節に足すこと**
- web のテストは jsdom で `@testing-library` が無い。ReviewPage はレンダリングできないため、
  **本タスクのテストはソース検査と CSS テキスト検査で行う**

### 本タスクの変更で落ちない既存テスト(確認済み。変更しないこと)
- `web/tests/pick.test.ts:166-175` が `ReviewPage.tsx` に対して
  `/<ErrorBoundary[\s\S]*?key=\{projectId\}/`、`not.toContain("modelSrc=")`、`not.toContain("modelUrl")`
  を検査している。`fallback` の中身だけを包む変更なので通ったままである。**pick.test.ts は owns に無い**

## インターフェイス契約

### 変更 web/src/app/ReviewPage.tsx

`ErrorBoundary` の `fallback` を、ステージ全面の中央寄せオーバーレイで包む。**この 1 箇所だけ**を変える。

```tsx
            <ErrorBoundary
              key={projectId}
              fallback={(
                <div className="review-stage__error">
                  <ErrorCard
                    message={MODEL_LOAD_FAILED}
                    onRetry={() => window.location.reload()}
                  />
                </div>
              )}
            >
```

`ErrorCard` のシグネチャ、`state.status === "error"` 側の `ErrorCard` 呼び出し、`lastError` の
`<p className="alert review-page__alert">` は**いずれも変更しない**。

### 変更 web/src/app/review.css

`.review-error` の**直前**に 2 つのルールを足す。`.review-error` 本体は変更しない。

```css
.review-stage__error {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  pointer-events: none;
}

.review-stage__error .review-error {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-overlay);
  pointer-events: auto;
}
```

- `z-index: 2` は `.review-hud` の 1 より上、`.review-backdrop` と同値にするための値である。
  3 以上にしないこと(入室ダイアログより手前に出てしまう。下の振る舞い表を見ること)
- `pointer-events: none` はオーバーレイが `inset: 0` で HUD 全面を覆うため必須である。
  カード自身にだけ `auto` を戻し、再読み込みボタンを押せるようにする
- 背景の覆い(`.review-backdrop` のような半透明塗り)は**付けない**。`.alert` の背景色で足りる

## 振る舞い

### 新規 web/tests/review-styles.test.ts

`web/tests/viewer-styles.test.ts:1-24` の `srcUrl` / `urlPath` / `srcDir` / `ruleBody` を
**そのまま真似る**(`ruleBody` は「セレクタ完全一致のルール本文を返す」ヘルパ)。
読むのは `app/review.css` と `app/ReviewPage.tsx` の 2 ファイルだけでよい。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `review.css` の `.review-stage__error` | `position: absolute`、`inset: 0`、`place-items: center`、`pointer-events: none` を含む |
| `review.css` の `.review-stage__error` と `.review-hud` の `z-index` | 前者が後者より大きい |
| `review.css` の `.review-stage__error .review-error` | `pointer-events: auto` を含む |
| `ReviewPage.tsx` | `<div className="review-stage__error">` の直後に `<ErrorCard` が来る |
| `ReviewPage.tsx` | `review-stage__error` の出現がちょうど 1 回(プロジェクト取得失敗側を包んでいない) |

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| 読み込めないモデルのレビュー画面に**入室済みで**入る | 「モデルの読み込みに失敗しました。」がビューア領域の中央に、影付きで HUD より手前に出る |
| そのとき左上の「表示 (P)」「ライト (C)」や右上のカメラメニュー | アラートに覆われず、クリックもできる(オーバーレイが `pointer-events: none` のため) |
| アラートの「再読み込み」ボタン | 押せて `window.location.reload()` が走る |
| **入室前**(入室ダイアログが出ている状態) | 入室ダイアログが手前、アラートはその裏に隠れる。入室するとアラートが見える。**これは仕様として受け入れる**(どちらも `z-index: 2` で、DOM 順が後の入室ダイアログが勝つ) |
| プロジェクト取得に失敗したとき | 従来どおり画面全体のエラーカード。見た目は変わらない |
| WebSocket の `error` などによる `lastError` | 従来どおりヘッダ直下の帯。見た目は変わらない |

## やらないこと
- `state.status === "error"` 側の `ErrorCard`、`lastError` の `.review-page__alert` の見た目・位置の変更
- `ErrorCard` / `ErrorBoundary` のシグネチャ変更、エラー内容(ファイル名など)を足すこと
- `.review-error` / `.alert` 本体のスタイル変更(角丸と影は `.review-stage__error .review-error` でだけ足す)
- 入室ダイアログやショートカット設定 (`.review-backdrop`) の変更
- モデル読み込み失敗時に HUD を隠す・無効化する
- 版ごとの `ErrorBoundary` 分割(1 つのモデルの失敗でビューア全体が落ちる構造の変更)
- `web/tests/pick.test.ts` の変更
- `web/src/features/` 以下の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの JSX と CSS になっている
- [ ] 振る舞い表(自動テストの行)の全行に対応するテストがあり、通る
- [ ] `web/tests/pick.test.ts` と `web/tests/styles-rules.test.ts` が未変更のまま通る
- [ ] app_Summary.md を更新している。具体的には
      `ReviewPage.tsx` の役割行に「モデル読み込み失敗のエラーカードを `.review-stage` 全面の
      中央寄せオーバーレイ (`.review-stage__error`) で HUD より前に出す」旨を足し、
      `review.css` の役割行に `.review-stage__error` を足し、
      「## テスト」節に `tests/review-styles.test.ts` の行を足す
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
