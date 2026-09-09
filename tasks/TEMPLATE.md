---
id: 000
title: タスク名
feature: 機能フォルダ名
depends_on: []
owns: [<feature>/xxx.py, <feature>/tests/test_xxx.py]
reads: [<other>/<other>_Summary.md]
verify: cd <feature> && python -m pytest tests/test_xxx.py -q
status: todo
---

## 目的
(なぜこのタスクが必要か。1〜2文)

## 前提
(実装者が知らない、このタスクの外側で既に決まっている事実だけを書く。
 推測や「〜のはず」は書かない。参照先は reads: のパスとファイル名:行番号で示す)
- 例) Core.Store.get(key) は dict を返す。Core/store.py:42

## インターフェイス契約
(実装すべき公開インターフェイスをコードとしてそのまま書く。
 ここをコードで書けない場合、まだタスクが分割・具体化できていない)

```python
def load_session(path: Path) -> Session | None:
    """存在しなければ None。壊れたJSONは SessionError を送出する。"""
```

## 振る舞い
(エッジケース・異常系を含めて表で列挙する。この表がそのままテストケースになる)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
|  |  |

## やらないこと
(先回りされがちな範囲を具体的に禁止する)
- 例) 呼び出し元(UI/front.py)への結線は別タスク。ここでは行わない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] <feature>_Summary.md が作成・更新されている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する(設定した場合)
