#!/bin/sh
# orch run の前にホスト側で実行する環境ガード。
#   sh config/check-env.sh && orch run
#
# config/preflight.sh との違い:
#   preflight は run 開始前に「サンドボックス内」で「main の作業ツリー」を1度だけ見る。
#   そのため「作業ツリーのリンクは正しいが、コミット済みの中身が古い」状態を検知できない。
#   git worktree に複製されるのはコミット済みの中身の方なので、それを見るのがここの役目。
#   (タスク 057 はこの穴に落ち、環境起因と分かるまで3フェーズを空転した)
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
stable=/opt/3dreviewer/deps/node_modules
fail=0

err() { echo "NG: $1" >&2; fail=1; }

# 1. コミット済みリンク。worktree に現れるのは HEAD の内容であり、
#    インデックス(git add 済み)でも作業ツリーでもない。必ず HEAD を見る
blob=$(git -C "$root" rev-parse --quiet --verify HEAD:workspace/node_modules 2>/dev/null || true)
if [ -z "$blob" ]; then
  err "workspace/node_modules が HEAD に存在しません(未追跡か未コミット)。worktree に依存が現れません。
    直し方: sh config/sync-deps.sh && git add -f workspace/node_modules && git commit"
else
  committed=$(git -C "$root" cat-file -p "$blob")
  if [ "$committed" != "$stable" ]; then
    err "HEAD の workspace/node_modules が安定パスを指していません(未コミットの修正は worktree に届きません)。
    現在: $committed
    期待: $stable
    直し方: sh config/sync-deps.sh && git add workspace/node_modules && git commit"
  fi
fi

# 2. 作業ツリーのリンク
if [ "$(readlink "$root/workspace/node_modules" 2>/dev/null || true)" != "$stable" ]; then
  err "作業ツリーの workspace/node_modules が $stable を指していません。
    直し方: sh config/sync-deps.sh"
fi

# 3. 置き場が実ディレクトリか。
#    bwrap は ro_binds の「宛先」パス途中のシンボリックリンクを辿らないため、
#    /opt/3dreviewer/deps がリンクだとマウントポイントを作れず
#    `bwrap: Can't mkdir .../node_modules` で run 全体が起動しない。
#    ホスト側では解決できてしまうので、この検査でしか捕まえられない
if [ -L /opt/3dreviewer/deps ]; then
  err "/opt/3dreviewer/deps がシンボリックリンクです(bwrap は宛先パス途中のリンクを辿れません)。
    実体をここへ置いてください。直し方:
      rm /opt/3dreviewer/deps && mkdir /opt/3dreviewer/deps && sh config/sync-deps.sh"
fi

# 4. 安定パスがこのマシンで解決できるか
if [ ! -d "$stable" ]; then
  err "$stable を解決できません(このマシンの初期設定が未了です)。
    直し方: sudo mkdir -p /opt/3dreviewer && sudo chown $(id -u):$(id -g) /opt/3dreviewer
            sh config/sync-deps.sh"
elif [ ! -f "$stable/typescript/package.json" ]; then
  err "$stable が不完全です。  直し方: sh config/sync-deps.sh"
fi

# 5. orch.toml の ro_binds が安定パスと一致しているか
if ! grep -q "^ro_binds = \[\"$stable\"\]" "$root/config/orch.toml"; then
  err "config/orch.toml の ro_binds が $stable と一致しません。
    現在: $(grep '^ro_binds' "$root/config/orch.toml" || echo '(未設定)')"
fi

# 6. lockfile の同期 (preflight と同じ検査をホスト側でも先取りする)
if [ -d "$stable" ] && ! cmp -s "$root/workspace/package-lock.json" "$stable/.synced-package-lock.json"; then
  err "package-lock.json と .synced-package-lock.json が不一致です。
    直し方: sh config/sync-deps.sh"
fi

[ "$fail" -eq 0 ] || { echo "" >&2; echo "環境ガード不合格。orch run は実行しないでください。" >&2; exit 1; }
echo "ok: 依存の安定パス $stable、コミット済みリンク、ro_binds はすべて整合しています。"
