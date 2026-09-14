---
id: 104
title: web 選択ハイライトの色をオレンジに変える
feature: web
depends_on: []
owns: [web/src/features/outliner/selection-highlight.ts, web/tests/outliner-highlight.test.ts, web/src/features/outliner/outliner_Summary.md]
reads: [web/src/features/outliner/SelectionRig.tsx, web/src/features/viewer/mesh-display.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
選択ハイライトは現在明るい青(0x60a5fa)で、UI の accent 色(青)や比較の重ね描きと紛れやすい。
人間の要望により、選択した対象はオレンジで覆って一目で区別できるようにする。

## 前提
- 定数は `web/src/features/outliner/selection-highlight.ts:17-21` の `SELECTION_COLOR` / `SELECTION_MESH_OPACITY`。
  Mesh・Line・Points の重ね描きはすべて `SELECTION_COLOR` を使い、`SELECTION_MESH_OPACITY` は Mesh だけが使う
- `web/tests/outliner-highlight.test.ts:53-54` が `0x60a5fa` と `0.6` を直値で断言している。他の it は定数経由で比較する
- TS 側の色は数値リテラルで書く(CSS の生色禁止は `.css` だけが対象)。tokens.css は変更しない
- material の他の設定(`transparent`、`depthWrite: false`、`polygonOffset`、`toneMapped: false`、Line / Points の `depthTest: false`)は変えない

## インターフェイス契約

### 変更 web/src/features/outliner/selection-highlight.ts(定数の値とコメントだけ)

```ts
/** 選択重ね描きの色。UI の accent(青)や比較の重ね描きと区別できるオレンジ */
export const SELECTION_COLOR = 0xf97316;
/** Mesh 重ね描きの不透明度 */
export const SELECTION_MESH_OPACITY = 0.6;
```

シグネチャ・関数の振る舞い・`SELECTION_OVERLAY_KEY` は変えない。

## 振る舞い

### web/tests/outliner-highlight.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 定数 | `SELECTION_COLOR === 0xf97316`、`SELECTION_MESH_OPACITY === 0.6`、`SELECTION_OVERLAY_KEY` は従来どおり |
| `createSelectionOverlay(mesh)` の material | `color.getHex() === 0xf97316`、`opacity === 0.6`、`transparent === true`、`depthWrite === false`(既存 it の期待値を定数経由のまま通す) |
| Line / Points 重ね描きの `color.getHex()` | `0xf97316` |
| それ以外の既存 it | 変更なしで通る |

### 目視確認(マージ後に人間が行う)

| 操作 | 期待する結果 |
| --- | --- |
| メッシュの行を選択 | 灰色のモデルがオレンジで覆われ、選択対象が一目で分かる |
| カーブ・ポイントの行を選択 | 線・点がオレンジで描かれる |

## やらないこと
- アウトライナ行の選択スタイル(`.outliner__select[aria-pressed="true"]`)の変更。青のまま
- tokens.css へのトークン追加
- 3D ビューからの選択入力(105 で行う)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] 定数が契約どおりの値になっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md の selection-highlight.ts の説明を「オレンジ(0xf97316、不透明度 0.6)」に更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
