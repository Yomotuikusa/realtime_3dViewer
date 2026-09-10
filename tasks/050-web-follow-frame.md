---
id: 050
title: web 追従中に 3D ビュー全体をユーザー色の枠で囲む
feature: web
depends_on: [049]
owns: [web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/viewer.css, web/src/styles/tokens.css, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/hud-labels.ts, web/src/store/presence.ts, web/src/app/review.css, web/src/styles/controls.css, web/tests/summary-coverage.test.ts, web/web_Summary.md, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
他の参加者の視点を追従しているとき、いまは上中央に「○○ の視点を追従中」のバッジが出るだけで、
追従中だと一目で分からない。会議ツールの画面共有中と同じように、3D ビューの外周全体を
その参加者の色の枠で囲み、既存バッジは枠の上辺に接するタブとして残す。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 追従中の描画は `ViewerHud.tsx` の `followingUserId !== null && (<div className="hud-follow" role="status"
  style={{ "--user-color": followingUser?.color }}> … </div>)`。中身は `.hud-follow__dot`、
  `followingLabel(...)`、「追従を解除」ボタン(`unfollow`)の3つ。web/src/features/viewer/ViewerHud.tsx:81-91
  (task 049 で `useEffect` / `useRef` が消え、行番号は数行ずれる)
- `followingUser?.color` は `PresenceUser.color` の `#rrggbb` 文字列。web/src/store/presence.ts:3
- `.hud` は `display: contents` なので、`.hud` の子の `position: absolute` は `.review-hud`
  (`position: absolute; inset: 0; padding: var(--space-3); pointer-events: none`)を基準に置かれる。
  web/src/features/viewer/viewer.css:1-3, web/src/app/review.css:92-101
- `.review-hud` の子孫は `.btn` / `[role="toolbar"]` / `[role="group"]` / `[role="status"]` / `[role="alert"]`
  だけが `pointer-events: auto`。role を持たない `div` は `pointer-events: none` を継承する。
  web/src/app/review.css:103-105
- 入室前の `.review-backdrop` は `z-index: 2` で `.review-hud`(`z-index: 1`)を覆う。web/src/app/review.css:107-115
- 現在の `.hud-follow` は `position: absolute; top: var(--space-3); left: 50%; translate: -50% 0;
  border-left: 4px solid var(--user-color, var(--color-accent)); border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-overlay)`。web/src/features/viewer/viewer.css:121-134
- task 049 で `tokens.css` に `--color-surface-translucent`(半透明サーフェス)が追加されている
- CSS の生の色値は `styles/tokens.css` にしか書けない。`var(--user-color, …)` のように CSS で宣言していない
  変数を参照するときはフォールバックが必須(`tests/styles-rules.test.ts:114-125`)。`!important` / `@import` は禁止
- `tests/styles-rules.test.ts:20-60` の `tokenNames` に載せた変数は `:root` 内の定義が検査される
- `tests/viewer-styles.test.ts` は CSS / TSX をテキストで読み、`ruleBody(text, selector)` でセレクタ完全一致の
  ルール本文を、`rootBody(text)` で `:root` の本文を取り出す。web/tests/viewer-styles.test.ts:15-26
- `followingLabel` / `UNFOLLOW_LABEL` / `hint()` の「操作すると追従が解除されます」は変更しない

## インターフェイス契約

```tsx
// web/src/features/viewer/ViewerHud.tsx: 追従中の描画をこの構造に置き換える
{followingUserId !== null && (
  <div className="hud-following" style={{ "--user-color": followingUser?.color } as CSSProperties}>
    <div className="hud-follow-frame" aria-hidden="true" />
    <div className="hud-follow" role="status">
      <i className="hud-follow__dot" aria-hidden="true" />
      {followingLabel(followingUser?.name ?? "")}
      <button className="btn btn--quiet" type="button" onClick={unfollow}>{UNFOLLOW_LABEL}</button>
    </div>
  </div>
)}
```

```css
/* web/src/styles/tokens.css の :root に追記(--header-height の直後) */
--follow-frame-width: 4px;
```

```ts
// web/tests/styles-rules.test.ts: tokenNames の "--header-height" の直後に追加
"--follow-frame-width",
```

```css
/* web/src/features/viewer/viewer.css: .hud-follow の直前に追加 */
.hud-following {
  display: contents;
}

.hud-follow-frame {
  position: absolute;
  inset: 0;
  border: var(--follow-frame-width) solid var(--user-color, var(--color-accent));
  pointer-events: none;
}

/* .hud-follow は既存ルールをこの内容に置き換える */
.hud-follow {
  position: absolute;
  top: var(--follow-frame-width);
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-top: 0;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--color-surface-translucent);
  box-shadow: var(--shadow-overlay);
  translate: -50% 0;
}
```

`.hud-follow__dot` は変更しない。

## 振る舞い
`tests/viewer-styles.test.ts` の各 it がこの表の1行に対応する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| tokens.css の `:root` | `--follow-frame-width` が定義され、値が正の px |
| `ruleBody(viewer.css, ".hud-following")` | `display: contents` を含む |
| `ruleBody(viewer.css, ".hud-follow-frame")` | `position: absolute`、`inset: 0`、`pointer-events: none` を含み、`border` 宣言に `var(--follow-frame-width)` と `var(--user-color` の両方を含む |
| `ruleBody(viewer.css, ".hud-follow")` | `top: var(--follow-frame-width)`、`background: var(--color-surface-translucent)`、`translate: -50% 0` を含み、`border-left` を含まない |
| `ruleBody(viewer.css, ".hud-follow")` の一致判定 | `.hud-follow__dot` / `.hud-follow-frame` / `.hud-following` のブロックを拾わない |
| ViewerHud.tsx の全文 | `className="hud-following"`、`className="hud-follow-frame"`、`className="hud-follow"` を含み、この順に現れる |
| ViewerHud.tsx の全文 | `"--user-color"` の出現は1回(親 `.hud-following` にだけ与える) |
| 追従を開始する(`followingUserId` が非 null) | ビュー全体の外周にその参加者の色の枠が出る。枠はクリックを妨げない |
| 追従中のバッジ | 枠の上辺に接して上中央に出る。上角は角丸なし、下角は角丸。「追従を解除」ボタンは従来どおり押せる |
| `followingUser` が未取得(`color` が undefined) | 枠とバッジはアクセント色のフォールバックで出る |
| 追従を解除する | 枠とバッジが両方消える |
| 既存 `tests/styles-rules.test.ts` | 追加後も全件通る |

## やらないこと
- `.hud-follow__dot` は変更しない(ドットは残す)
- `hud-labels.ts` の文言、`presence` ストア、`PresenceList` は変更しない
- 枠の幅を画面サイズで変えない。アニメーション・点滅は付けない
- `.hud-menu*`、`.hud-hint`、`.light-gizmo*`、`.hud-modes` は変更しない
- `review.css` の `.review-hud` は変更しない(`pointer-events` の仕組みはそのまま使う)
- `web_Summary.md` は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md の「ファイル一覧と役割」(ViewerHud.tsx / viewer.css の Follow の説明)と「テスト」(tests/viewer-styles.test.ts)が更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
