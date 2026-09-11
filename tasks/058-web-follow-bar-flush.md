---
id: 058
title: web Follow 中バッジの参加者色の縦帯を左端に接して面の全高いっぱいに広げる
feature: web
depends_on: []
owns: [web/src/features/viewer/viewer.css, web/tests/viewer-styles.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/styles/tokens.css, web/src/features/viewer/ViewerHud.tsx]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
Follow 中に上辺へ出るバッジ(`[名前] の視点を追従中` + `追従を解除`)の左にある参加者色の縦帯が、
バッジの上下 padding の内側にしか伸びず、左にも 12px の余白がある。縦帯を面の上端から下端まで広げ、
左の余白を消して、カードの左辺と一体化した見た目にする。CSS だけの変更で、マークアップは変えない。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- バッジの DOM は `.hud-following` > `.hud-follow-frame` + `.hud-follow` で、`.hud-follow` の先頭子要素が
  `<i className="hud-follow__bar">`、その後にテキストと `button.btn.hud-follow__unfollow` が並ぶ。
  web/src/features/viewer/ViewerHud.tsx:69-78。このタスクでは ViewerHud.tsx を変更しない
- `.hud-follow` は `position: absolute; display: inline-flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md); background: var(--color-surface)` である。
  web/src/features/viewer/viewer.css:146-160
- `.hud-follow__bar` は `width: 4px; flex: 0 0 auto; align-self: stretch; border-radius: 1px;
  background: var(--user-color, var(--color-accent))` である。web/src/features/viewer/viewer.css:162-168
- トークンは `--space-2: 8px`、`--space-3: 12px`、`--radius-md: 6px`。web/src/styles/tokens.css:11-18
- 既存テスト web/tests/viewer-styles.test.ts は `ruleBody(text, selector)` でセレクタ完全一致のルール本文
  (`[^{}]*`)を取り出して文字列検査する。`.hud-follow` について `padding: var(--space-2) var(--space-3)` を
  `toContain` で検査している(web/tests/viewer-styles.test.ts:59-68)。`.hud-follow__bar` について
  `width: 4px` / `align-self: stretch` / `var(--user-color` を含み `border-radius: 50%` を含まないことを
  検査している(web/tests/viewer-styles.test.ts:80-87)
- タスク 057 の実装メモにあった「padding の外まで伸ばす負マージンは入れない」という方針は、
  このタスクの要望により反転する。負マージンで上下 padding を打ち消してよい

## インターフェイス契約

### 変更 web/src/features/viewer/viewer.css

`.hud-follow` は `padding` の 1 行だけ変え、他の宣言は現状のまま残す。
`.hud-follow__bar` は次に置き換える。

```css
.hud-follow {
  /* 他の宣言は現状維持 */
  padding: var(--space-2) var(--space-3) var(--space-2) 0;
}

.hud-follow__bar {
  width: 4px;
  flex: 0 0 auto;
  align-self: stretch;
  margin-block: calc(var(--space-2) * -1);
  border-radius: 0 0 calc(var(--radius-md) - 1px) 0;
  background: var(--user-color, var(--color-accent));
}
```

- `padding-left: 0` で帯が 1px の左ボーダーに接する
- `align-self: stretch` + 上下の負マージンで、帯の高さが面の padding ボックス全高(上端から下端まで)になる
- 左下だけ `calc(var(--radius-md) - 1px)` で丸め、カードの内側角丸に沿わせる。他の角は角丸なし
- 帯とテキストの間隔は既存の `gap: var(--space-3)` のまま

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `.hud-follow` のルール本文 | `padding: var(--space-2) var(--space-3) var(--space-2) 0` を含む。旧形式 `padding: var(--space-2) var(--space-3);`(セミコロン付き)は含まない |
| `.hud-follow` のルール本文 | `top: var(--follow-frame-width)` / `background: var(--color-surface)` / `font-size: var(--text-lg)` / `translate: -50% 0` / `gap: var(--space-3)` を引き続き含み、`border-left` を含まない |
| `.hud-follow` のルール本文 | 子ブロック名 `hud-follow__bar` / `hud-follow__unfollow` / `hud-follow-frame` / `hud-following` を含まない(既存検査のまま) |
| `.hud-follow__bar` のルール本文 | `width: 4px` / `align-self: stretch` / `margin-block: calc(var(--space-2) * -1)` / `border-radius: 0 0 calc(var(--radius-md) - 1px) 0` / `var(--user-color` を含む |
| `.hud-follow__bar` のルール本文 | `border-radius: 1px` / `border-radius: 50%` / `position:` を含まない |
| `ViewerHud.tsx` | 変更しない。`className="hud-follow__bar"` が先頭子要素として残る(既存検査のまま) |
| `.hud-follow-frame` / `.hud-following` / `.hud-follow__unfollow` の既存検査 | そのまま通る |

## 実装メモ
- 既存テスト `docks the follow badge to the frame's top edge` の
  `expect(body).toContain("padding: var(--space-2) var(--space-3)")` を 4 値形式の検査に書き換え、
  `expect(body).not.toContain("padding: var(--space-2) var(--space-3);")` を足す
  (2 値形式は 4 値形式の部分文字列なので、セミコロン付きで排除する)
- 既存テスト `uses a vertical participant-color bar in the follow badge` に `margin-block` と
  `border-radius: 0 0 calc(var(--radius-md) - 1px) 0` の検査、`border-radius: 1px` と `position:` の
  不在検査を足す。既存の検査行は消さない
- `viewer_Summary.md` の 15 行目(ViewerHud.tsx の説明)と 33 行目(viewer.css の説明)にある
  「参加者色の縦帯」を「左端に接して面の全高を占める参加者色の縦帯」に置き換える。それ以外の文は変えない

## やらないこと
- `ViewerHud.tsx` のマークアップ・className・`--user-color` の与え方を変えない
- 帯の幅(4px)や色の決め方(`var(--user-color, var(--color-accent))`)を変えない
- `.hud-follow` の position / top / left / translate / border / border-radius / background / box-shadow /
  font-size / gap を変えない
- `.hud-follow-frame` / `.hud-follow__unfollow` / `hud-labels.ts` に手を入れない
- `styles/controls.css` / `styles/tokens.css` を変更しない(新トークンを足さない)
- `features/presence/` 側の追従解除ボタンには手を入れない
- `shared/` と `server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの CSS になっている
- [ ] 振る舞い表の全行に対応するテストが `web/tests/viewer-styles.test.ts` にあり、通る
- [ ] `viewer_Summary.md` の記述が実装と一致している
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
