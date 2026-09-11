---
id: 059
title: web Follow 中バッジの参加者色の縦帯の角丸を右下から左下へ直し、母体カードの角丸に沿わせる
feature: web
depends_on: []
owns: [web/src/features/viewer/viewer.css, web/tests/viewer-styles.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/styles/tokens.css, web/src/features/viewer/ViewerHud.tsx]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
Follow 中に上辺へ出るバッジ(`[名前] の視点を追従中` + `追従を解除`)の左端にある参加者色の縦帯は、
タスク 058 で「左下だけ丸める」つもりだったが、`border-radius` の 4 値の位置を誤り右下が丸まっている。
右下の丸みを消し、左下を母体カード(`.hud-follow`)の左下角丸に沿う半径で丸める。CSS 1 行の修正で、
マークアップは変えない。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- バッジの DOM は `.hud-following` > `.hud-follow-frame` + `.hud-follow` で、`.hud-follow` の先頭子要素が
  `<i className="hud-follow__bar">`。web/src/features/viewer/ViewerHud.tsx:69-78。このタスクでは
  ViewerHud.tsx を変更しない
- `.hud-follow` は `padding: var(--space-2) var(--space-3) var(--space-2) 0; border: 1px solid var(--color-border);
  border-top: 0; border-radius: 0 0 var(--radius-md) var(--radius-md)` で、左下・右下が丸いカードである。
  web/src/features/viewer/viewer.css:146-161
- `.hud-follow__bar` の現状は次のとおり。web/src/features/viewer/viewer.css:163-170

  ```css
  .hud-follow__bar {
    width: 16px;
    flex: 0 0 auto;
    align-self: stretch;
    margin-block: calc(var(--space-2) * -1);
    border-radius: 0 0 calc(var(--radius-md) - 1px) 0;
    background: var(--user-color, var(--color-accent));
  }
  ```

  CSS の `border-radius` 4 値は「左上 右上 右下 左下」の順なので、現状は右下だけが丸い
- トークンは `--radius-md: 6px`。web/src/styles/tokens.css。カードの 1px ボーダーの内側に沿う半径は
  `calc(var(--radius-md) - 1px)`(= 5px)である
- 既存テスト web/tests/viewer-styles.test.ts は `ruleBody(text, selector)` でセレクタ完全一致のルール本文を
  取り出して文字列検査する。`.hud-follow__bar` について `width: 16px` / `align-self: stretch` /
  `margin-block: calc(var(--space-2) * -1)` / `border-radius: 0 0 calc(var(--radius-md) - 1px) 0` /
  `var(--user-color` を含み、`border-radius: 1px` / `border-radius: 50%` / `position:` を含まないことを
  検査している(web/tests/viewer-styles.test.ts:81-92)

## インターフェイス契約

### 変更 web/src/features/viewer/viewer.css

`.hud-follow__bar` の `border-radius` の 1 行だけを次に置き換える。他の宣言は現状のまま残す。

```css
.hud-follow__bar {
  /* 他の宣言は現状維持 */
  border-radius: 0 0 0 calc(var(--radius-md) - 1px);
}
```

- 左下だけ `calc(var(--radius-md) - 1px)` で丸め、カードの左下角丸の内側に沿わせる
- 左上・右上・右下は角丸なし

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `.hud-follow__bar` のルール本文 | `border-radius: 0 0 0 calc(var(--radius-md) - 1px)` を含む |
| `.hud-follow__bar` のルール本文 | `border-radius: 0 0 calc(var(--radius-md) - 1px) 0` を含まない |
| `.hud-follow__bar` のルール本文 | `width: 16px` / `align-self: stretch` / `margin-block: calc(var(--space-2) * -1)` / `var(--user-color` を引き続き含む |
| `.hud-follow__bar` のルール本文 | `border-radius: 1px` / `border-radius: 50%` / `position:` を含まない(既存検査のまま) |
| `.hud-follow` のルール本文 | 変更しない。`border-radius: 0 0 var(--radius-md) var(--radius-md)` のまま |
| `ViewerHud.tsx` | 変更しない。`className="hud-follow__bar"` が先頭子要素として残る(既存検査のまま) |
| `.hud-follow-frame` / `.hud-following` / `.hud-follow__unfollow` の既存検査 | そのまま通る |

## 実装メモ
- 既存テスト `uses a vertical participant-color bar in the follow badge` の
  `expect(body).toContain("border-radius: 0 0 calc(var(--radius-md) - 1px) 0")` を
  `expect(body).toContain("border-radius: 0 0 0 calc(var(--radius-md) - 1px)")` に書き換え、
  `expect(body).not.toContain("border-radius: 0 0 calc(var(--radius-md) - 1px) 0")` を足す。
  既存の他の検査行は消さない
- `viewer_Summary.md` の 15 行目(ViewerHud.tsx の説明)と 33 行目(viewer.css の説明)にある
  「左端に接して面の全高を占める参加者色の縦帯」を「左端に接して面の全高を占め左下だけ角丸の参加者色の縦帯」
  に置き換える。それ以外の文は変えない

## やらないこと
- `ViewerHud.tsx` のマークアップ・className・`--user-color` の与え方を変えない
- 帯の幅(16px)、`margin-block`、色の決め方(`var(--user-color, var(--color-accent))`)を変えない
- `.hud-follow` / `.hud-follow-frame` / `.hud-follow__unfollow` / `hud-labels.ts` に手を入れない
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
