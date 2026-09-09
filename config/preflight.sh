#!/bin/sh
# orch run の前に一度だけ、verifyと同じsandbox内で実行される環境確認。
# exit 0 で合格。非0ならタスクを1件も起動せずに終了し、この出力がそのまま表示される。
#
# このプロジェクトは verify 内で npm install できない(ネットワーク遮断)ため、
# 依存の実体は .deps/node_modules に置き、workspace/node_modules のシンボリックリンクと
# [sandbox] ro_binds で持ち込む。ここではその前提が崩れていないことを検査する。
# 詳細: docs/3dreviewer-plan-and-architecture.md §23

# preflight は verify と同じ cwd (workspace/) で実行されるため、
# リポジトリ内のパスは cwd ではなくこのスクリプトの位置から解決する。
root=$(cd "$(dirname "$0")/.." && pwd)

command -v node >/dev/null || { echo "node がありません(~/.nvm が見えていません)"; exit 1; }

deps=$root/.deps
[ -d "$deps/node_modules" ] || {
  echo "依存の実体 $deps/node_modules がありません。ホスト側で: sh config/sync-deps.sh"; exit 1
}
[ -f "$deps/node_modules/typescript/package.json" ] || {
  echo "$deps/node_modules が不完全です。ホスト側で: sh config/sync-deps.sh"; exit 1
}
if ! cmp -s "$root/workspace/package-lock.json" "$deps/node_modules/.synced-package-lock.json"; then
  echo "workspace/package-lock.json と .deps/node_modules/.synced-package-lock.json が一致しません。"
  echo "依存を変更した後は、ホスト側で: sh config/sync-deps.sh"
  exit 1
fi
