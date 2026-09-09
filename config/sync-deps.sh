#!/bin/sh
# workspace/package.json と lockfile を .deps/ に写し、実体の node_modules を更新する。
# 依存を追加・更新したら人間がこれを実行する(codex はネットワークが無いので実行できない)。
# 使い方:  sh config/sync-deps.sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$root/.deps"
cp "$root/workspace/package.json" "$root/workspace/package-lock.json" "$root/.deps/"
cd "$root/.deps" && npm ci --no-audit --no-fund
# サンドボックスからは .deps/node_modules しか見えないため、照合用に lockfile を中へ写す
cp "$root/.deps/package-lock.json" "$root/.deps/node_modules/.synced-package-lock.json"
link="$root/workspace/node_modules"
target="$root/.deps/node_modules"
if [ ! -L "$link" ] || [ "$(readlink "$link")" != "$target" ]; then
  rm -rf "$link"
  ln -s "$target" "$link"
fi
echo "ok: $target"
