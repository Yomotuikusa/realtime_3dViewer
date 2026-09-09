#!/bin/sh
# orch run の前に一度だけ、verifyと同じsandbox内で実行される環境確認。
# exit 0 で合格。非0ならタスクを1件も起動せずに終了し、この出力がそのまま表示される。
#
# 実装役のcodexはsudoを持たない。システムパッケージのように人間しか入れられない
# ものは、長いcodexループの末にverifyで倒れるより、ここで先に検出したほうがよい。
# 逆に確認することが無ければ、このファイルは削除してよい(無ければ何も実行されない)。
#
# 例) verifyが使うコマンドが揃っているか
# command -v python3 >/dev/null || { echo "python3 がありません: sudo apt install python3"; exit 1; }
#
# 例) ビルドに要るシステムライブラリ(codexには導入できない)
# ls /usr/lib/*/libclang.so* >/dev/null 2>&1 || {
#   echo "libclang がありません。ホスト側で: sudo apt install libclang-dev"
#   exit 1
# }
