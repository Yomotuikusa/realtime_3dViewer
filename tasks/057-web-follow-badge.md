---
id: 057
title: web Follow 中バッジを拡大し色ドットを縦帯に、追従解除ボタンをカメラボタンと同じ見た目にする
feature: web
depends_on: []
owns: [web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/viewer.css, web/tests/viewer-styles.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/styles/controls.css, web/src/styles/tokens.css, web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/hud-labels.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
Follow 中に上辺へ出るバッジ(`[名前] の視点を追従中` + `追従を解除`)が、半透明の白い面のため
背景のモデルに溶け込んで見つけにくい。バッジを少し大きくし、参加者色の丸を縦の帯に変え、
面を不透明にし、解除ボタンをカメラメニューの `[全体]` などと同じ枠線付きの見た目にする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- バッジは `followingUserId !== null` のときだけ描かれる。`.hud-following` が `display: contents` の
  ラッパで `--user-color` を 1 回だけ与え、その中に `.hud-follow-frame`(画面全周の参加者色枠)と
  `.hud-follow`(上辺のタブ)が並ぶ。web/src/features/viewer/ViewerHud.tsx:70-77
- `.hud-follow` は `position: absolute; top: var(--follow-frame-width); left: 50%; translate: -50% 0` で
  枠の上辺に接して中央に置かれ、`display: inline-flex; align-items: center` である。
  web/src/features/viewer/viewer.css:146-166
- 本文の既定フォントは `--text-md`(0.875rem)で、`button` は `font: inherit`。
  トークンは `--text-lg: 1rem`、`--space-1: 4px` / `--space-2: 8px` / `--space-3: 12px`、
  `--shadow-control: 1px 2px 3px rgba(16, 24, 40, 0.14)`。web/src/styles/tokens.css, web/src/styles/base.css:13-18
- `.btn` は既定で `border: 1px solid var(--color-border); background: var(--color-surface)` を持ち、
  `.btn--quiet` はそれを透明化するだけの修飾子である。web/src/styles/controls.css:1-33
- カメラメニューの `[全体]` などは `btn hud-menu__item hud-view` で、`.hud-menu__item` が
  `box-shadow: var(--shadow-control)` を足している。web/src/features/viewer/viewer.css:83-87, CameraMenu.tsx:38-63
- ラベル文言 `followingLabel` / `UNFOLLOW_LABEL` は hud-labels.ts にあり、このタスクでは変更しない。
- 既存テスト web/tests/viewer-styles.test.ts は `ruleBody()` で CSS のルール本文を取り出して検査する。
  `.hud-follow` について `top: var(--follow-frame-width)` / `background: var(--color-surface-translucent)` /
  `translate: -50% 0` / `border-left` を含まないこと、および子ブロック名(`hud-follow__dot` など)を
  含まないことを検査している。web/tests/viewer-styles.test.ts:59-73

## インターフェイス契約

### 変更 web/src/features/viewer/ViewerHud.tsx

Follow ブロックのみを次に置き換える。`--user-color` の与え方・要素の並び順・`role="status"` は変えない。

```tsx
{followingUserId !== null && (
  <div className="hud-following" style={{ "--user-color": followingUser?.color } as CSSProperties}>
    <div className="hud-follow-frame" aria-hidden="true" />
    <div className="hud-follow" role="status">
      <i className="hud-follow__bar" aria-hidden="true" />
      {followingLabel(followingUser?.name ?? "")}
      <button className="btn hud-follow__unfollow" type="button" onClick={unfollow}>{UNFOLLOW_LABEL}</button>
    </div>
  </div>
)}
```

### 変更 web/src/features/viewer/viewer.css

`.hud-follow` は既存宣言を保ったまま、フォント・padding・gap・background だけ変える。
`.hud-follow__dot` は `.hud-follow__bar` に置き換える(円のルールは残さない)。

```css
.hud-follow {
  position: absolute;
  top: var(--follow-frame-width);
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
  font-size: var(--text-lg);
  translate: -50% 0;
}

.hud-follow__bar {
  width: 4px;
  flex: 0 0 auto;
  align-self: stretch;
  border-radius: 1px;
  background: var(--user-color, var(--color-accent));
}

.hud-follow__unfollow {
  box-shadow: var(--shadow-control);
}
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `followingUserId === null` | バッジも枠も描かない(現状どおり) |
| `followingUserId !== null` | `.hud-following` > `.hud-follow-frame` > `.hud-follow` の順は現状のまま。`.hud-follow` の先頭子要素が `hud-follow__bar` |
| `ViewerHud.tsx` 内の `"--user-color"` の出現回数 | 1 |
| `ViewerHud.tsx` 内の `hud-follow__dot` / `btn--quiet` | 出現しない |
| 解除ボタンの className | `btn` を含み `btn--quiet` を含まない |
| `.hud-follow` のルール本文 | `background: var(--color-surface)` を含み `--color-surface-translucent` を含まない。`font-size: var(--text-lg)`、`padding: var(--space-2) var(--space-3)` を含む。`top: var(--follow-frame-width)` と `translate: -50% 0` は残る。`border-left` を含まない |
| `.hud-follow` のルール本文 | 子ブロック名 `hud-follow__bar` / `hud-follow__unfollow` / `hud-follow-frame` / `hud-following` を含まない(ルール抽出が子に食い込んでいないこと) |
| `.hud-follow__bar` のルール本文 | `align-self: stretch` と `var(--user-color` を含み、`border-radius: 50%` を含まない |
| `.hud-follow__unfollow` のルール本文 | `box-shadow: var(--shadow-control)` を含む |
| viewer.css 全体 | `.hud-follow__dot` のルールが存在しない |
| `.hud-follow-frame` / `.hud-following` の既存検査 | そのまま通る |

## 実装メモ
- `align-self: stretch` により帯はバッジの内容ボックス(テキストと解除ボタンの高さ)いっぱいに伸びる。
  padding の外まで伸ばす負マージンは入れない
- 既存テスト `docks the follow badge to the frame's top edge` の
  `background: var(--color-surface-translucent)` 検査は `background: var(--color-surface)` に書き換える。
  同テストの他の検査行は消さない
- 既存テスト `matches the follow badge selector without matching its child blocks` の
  `hud-follow__dot` を `hud-follow__bar` に置き換え、`hud-follow__unfollow` の行を足す
- `viewer_Summary.md` の 15 行目(ViewerHud.tsx の説明)と 33 行目(viewer.css の説明)にある
  「上辺タブ」の記述に、参加者色の縦帯と不透明な面である旨を加える。それ以外の文は変えない

## やらないこと
- `hud-labels.ts` の文言(`followingLabel` / `UNFOLLOW_LABEL`)を変えない
- `.hud-follow-frame` の太さ・色・`--follow-frame-width` を変えない
- `styles/controls.css` / `styles/tokens.css` を変更しない(新トークンを足さない)
- `features/presence/` の PresenceList 側の追従解除ボタンには手を入れない
- バッジの位置(上辺中央)やアニメーション、ドラッグ移動などの新機能を足さない
- `shared/` と `server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] 振る舞い表の全行に対応するテストが `web/tests/viewer-styles.test.ts` にあり、通る
- [ ] `viewer_Summary.md` の記述が実装と一致している
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
