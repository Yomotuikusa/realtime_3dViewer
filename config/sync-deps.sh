#!/bin/sh
# workspace/package.json と lockfile を .deps/ に写し、実体の node_modules を更新する。
# 依存を追加・更新したら人間がこれを実行する(codex はネットワークが無いので実行できない)。
# 使い方:  sh config/sync-deps.sh
#
# リンクの構造 (docs/3dreviewer-plan-and-architecture.md §23.2):
#   workspace/node_modules -> /opt/3dreviewer/deps/node_modules   # git 追跡。全マシンで同一
#   /opt/3dreviewer/deps   -> <このPCのリポジトリ>/.deps          # 非追跡。各マシンでここが作る
# workspace/node_modules は git worktree にも複製される必要があるため追跡必須で、
# worktree とメインでは階層が違うので相対パスにできない。よって絶対パスだが、
# その絶対パスをマシン非依存の固定値にすることで、コミット内容がマシン間で一致する。
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
stable_dir=/opt/3dreviewer
stable=$stable_dir/deps

if [ ! -d "$stable_dir" ] || [ ! -w "$stable_dir" ]; then
  echo "このマシンでは初回のみ、安定パスの置き場を作る必要があります:" >&2
  echo "  sudo mkdir -p $stable_dir && sudo chown $(id -u):$(id -g) $stable_dir" >&2
  echo "そのうえで再度 sh config/sync-deps.sh を実行してください。" >&2
  exit 1
fi

mkdir -p "$root/.deps"
cp "$root/workspace/package.json" "$root/workspace/package-lock.json" "$root/.deps/"
cd "$root/.deps" && npm ci --no-audit --no-fund
# サンドボックスからは .deps/node_modules しか見えないため、照合用に lockfile を中へ写す
cp "$root/.deps/package-lock.json" "$root/.deps/node_modules/.synced-package-lock.json"

# 安定パス -> このPCの .deps
ln -sfn "$root/.deps" "$stable"
# 追跡されるリンク -> 安定パス (全マシンで同一の文字列)
ln -sfn "$stable/node_modules" "$root/workspace/node_modules"

echo "ok: $stable/node_modules -> $(readlink -f "$stable/node_modules")"
