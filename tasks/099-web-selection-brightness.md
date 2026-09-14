---
id: 099
title: web アウトライナ選択ハイライトの色を明るくして見つけやすくする
feature: web
depends_on: []
owns: [web/src/features/outliner/selection-highlight.ts, web/tests/outliner-highlight.test.ts, web/src/features/outliner/outliner_Summary.md]
reads: [web/src/features/outliner/SelectionRig.tsx, web/src/features/viewer/mesh-display.ts, web/src/styles/tokens.css]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
現在の選択ハイライトは accent と同じ濃い青(0x175cd3)を不透明度 0.35 で重ねるため、灰色の
モデルに重なると暗くくすみ、どれを選択したか分かりにくい。明るい青と高い不透明度に変えて
一目で分かるようにする。

## 前提
- 定数は `web/src/features/outliner/selection-highlight.ts:17-21` の `SELECTION_COLOR` / `SELECTION_MESH_OPACITY`。
  Mesh・Line・Points の重ね描きはすべて `SELECTION_COLOR` を使い、`SELECTION_MESH_OPACITY` は Mesh だけが使う
- `web/tests/outliner-highlight.test.ts:53-54` が `0x175cd3` と `0.35` を直値で断言している。他のテストは定数経由で比較する
- TS 側の色は数値リテラルで書く(CSS の生色禁止は `.css` だけが対象)。tokens.css は変更しない
- material の他の設定(`transparent`、`depthWrite: false`、`polygonOffset`、`toneMapped: false`、Line / Points の `depthTest: false`)は変えない

## インターフェイス契約

### 変更 web/src/features/outliner/selection-highlight.ts(定数の値とコメントだけ)

```ts
/** 選択重ね描きの色。灰色のモデルに重ねても明るく見える淡い青(accent より明度が高い) */
export const SELECTION_COLOR = 0x60a5fa;
/** Mesh 重ね描きの不透明度 */
export const SELECTION_MESH_OPACITY = 0.6;
```

シグネチャ・関数の振る舞い・`SELECTION_OVERLAY_KEY` は変えない。

## 振る舞い

### web/tests/outliner-highlight.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 定数 | `SELECTION_COLOR === 0x60a5fa`、`SELECTION_MESH_OPACITY === 0.6`、`SELECTION_OVERLAY_KEY` は従来どおり |
| `createSelectionOverlay(mesh)` の material | `color.getHex() === 0x60a5fa`、`opacity === 0.6`、`transparent === true`、`depthWrite === false`(既存 it の期待値を定数経由のまま通す) |
| Line / Points 重ね描きの `color.getHex()` | `0x60a5fa` |
| それ以外の既存 it | 変更なしで通る |

### 目視確認(マージ後に人間が行う)

| 操作 | 期待する結果 |
| --- | --- |
| メッシュの行を選択 | 灰色のモデルでも明るい水色で覆われ、選択対象が一目で分かる |
| カーブ・ポイントの行を選択 | 線・点が明るい水色で描かれる |

## やらないこと
- アウトライナ行の選択スタイル(`.outliner__select[aria-pressed="true"]`)の変更
- 輪郭線(アウトライン)描画やポストプロセスの導入
- tokens.css へのトークン追加

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] 定数が契約どおりの値になっている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] outliner_Summary.md の selection-highlight.ts の説明を「明るい青(0x60a5fa、不透明度 0.6)」に更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
