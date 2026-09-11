#!/bin/sh
# orch run の前に一度だけ、verifyと同じsandbox内で実行される環境確認。
# exit 0 で合格。非0ならタスクを1件も起動せずに終了し、この出力がそのまま表示される。
#
# このプロジェクトは verify 内で npm install できない(ネットワーク遮断)ため、
# 依存の実体は /opt/3dreviewer/deps/node_modules に置き、workspace/node_modules のリンクと
# [sandbox] ro_binds で持ち込む。ここではその前提が崩れていないことを検査する。
# 詳細: docs/3dreviewer-plan-and-architecture.md §23
#
# このスクリプトはファイルとして実行されるのではなく、中身が読み込まれて
# `sh -c "<中身>"` としてsandboxへ渡される。したがって $0 は /bin/sh であり、
# スクリプト位置は参照できない。基準にできるのは cwd (= workspace/) だけである。
# また sandbox に持ち込まれるのは workspace/ と ro_binds の
# /opt/3dreviewer/deps/node_modules だけで、リポジトリのルートは見えない。よってリポジトリ内の
# パスは cwd からの相対で、依存は workspace/node_modules 経由で確かめる。

command -v node >/dev/null || { echo "node がありません(~/.nvm が見えていません)"; exit 1; }

deps=node_modules   # workspace/node_modules -> /opt/3dreviewer/deps/node_modules のリンク
[ -d "$deps" ] || {
  echo "依存 workspace/node_modules がありません。ホスト側で: sh config/sync-deps.sh"; exit 1
}
[ -f "$deps/typescript/package.json" ] || {
  echo "workspace/node_modules (/opt/3dreviewer/deps/node_modules) が不完全です。ホスト側で: sh config/sync-deps.sh"; exit 1
}
if ! cmp -s package-lock.json "$deps/.synced-package-lock.json"; then
  echo "workspace/package-lock.json と node_modules/.synced-package-lock.json が一致しません。"
  echo "依存を変更した後は、ホスト側で: sh config/sync-deps.sh"
  exit 1
fi
