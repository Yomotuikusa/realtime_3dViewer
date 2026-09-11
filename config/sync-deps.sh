#!/bin/sh
# workspace/package.json と lockfile を依存の置き場へ写し、node_modules を更新する。
# 依存を追加・更新したら人間がこれを実行する(codex はネットワークが無いので実行できない)。
# 使い方:  sh config/sync-deps.sh
#
# リンクの構造 (docs/3dreviewer-plan-and-architecture.md §23.2):
#   /opt/3dreviewer/deps/            # 依存の実体。リポジトリ外・非追跡。各マシンでここが作る
#   workspace/node_modules -> /opt/3dreviewer/deps/node_modules   # git 追跡。全マシンで同一
# workspace/node_modules は git worktree にも複製される必要があるため追跡必須で、
# worktree とメインでは階層が違うので相対パスにできない。よって絶対パスだが、
# その絶対パスをマシン非依存の固定値にすることで、コミット内容がマシン間で一致する。
#
# 置き場は「実ディレクトリ」でなければならない。bwrap は ro_binds の宛先パスの途中に
# あるシンボリックリンクを辿らず、マウントポイントを作れずに落ちる(下の check も参照)。
# よってリポジトリ内へ置いて /opt から張る二段リンクにはできず、実体をここに置く。
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
stable_dir=/opt/3dreviewer
stable=$stable_dir/deps

if [ ! -d "$stable_dir" ] || [ ! -w "$stable_dir" ]; then
  echo "このマシンでは初回のみ、依存の置き場を作る必要があります:" >&2
  echo "  sudo mkdir -p $stable_dir && sudo chown $(id -u):$(id -g) $stable_dir" >&2
  echo "そのうえで再度 sh config/sync-deps.sh を実行してください。" >&2
  exit 1
fi

if [ -L "$stable" ]; then
  echo "$stable がシンボリックリンクです。bwrap は宛先パス途中のリンクを辿れないため" >&2
  echo "verify が起動しません。実ディレクトリに置き換えてください:" >&2
  echo "  rm $stable && mkdir $stable && sh config/sync-deps.sh" >&2
  exit 1
fi

mkdir -p "$stable"
cp "$root/workspace/package.json" "$root/workspace/package-lock.json" "$stable/"
cd "$stable" && npm ci --no-audit --no-fund
# サンドボックスからは node_modules しか見えないため、照合用に lockfile を中へ写す
cp "$stable/package-lock.json" "$stable/node_modules/.synced-package-lock.json"

# 追跡されるリンク -> 安定パス (全マシンで同一の文字列)
ln -sfn "$stable/node_modules" "$root/workspace/node_modules"

echo "ok: $root/workspace/node_modules -> $stable/node_modules"
