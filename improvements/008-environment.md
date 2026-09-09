# 改善提案 (タスク 008 の失敗より)

- 分類: environment
- 確度: high
- 要約: workspace/node_modules の symlink が未追跡でワークツリーに無く verify が常に落ちる
- 診断: /home/ojin/projects/3dreviewer/logs/008/diagnosis.md

## 何が起きたか

loop1 / loop2 とも **verify フェーズ**が同一のエラーで即座(1秒)に失敗しています。

- `logs/008/loop1-verify.log:10` / `logs/008/loop2-verify.log:10`
  `error TS2688: Cannot find type definition file for 'node'` (exit code 2)
  → `npm run typecheck` の最初の `tsc -p shared/tsconfig.json` で停止。`test:server` は未実行。

一次証拠のとおり、これは実装コードのエラーではなく**依存が1つも解決できていない**状態です。実際、失敗時ワークツリー `.worktrees/008/workspace/` に `node_modules` が存在しません(`ls` で確認済み。main チェックアウトの `workspace/node_modules` は `.deps/node_modules` へのシンボリックリンクとして存在)。

実装役はこの制約を正しく把握していて、`logs/008/loop1-1-implement.log:4815, 6085, 8455` で毎回

```
ln -s /home/ojin/projects/3dreviewer/.deps/node_modules node_modules && npm run typecheck && npm run test:server; code=$?; rm node_modules; exit $code
```

と**自分でリンクを張って検証し、後始末で消して**います(`:7140-7142` で「workspace node_modules absent」と確認)。そのため実装役の報告(`loop1-1-implement.md`: typecheck 成功 / 53 tests 成功)は正しく、verify の失敗と矛盾しません。レビュー役も両ループで「owns 外の環境問題」として判定から除外しており(`loop1-2-review.md`, `loop2-2-review.md`)、verify は誰も直せないまま固定で失敗し続けました。

なお、レビューが FAIL を出した実体は別件です。テスト `server/tests/routes-comments.test.ts` の「別 project のコメント」ケースで、loop1-3 の修正が `p1`/`p2` に同じ `id: "c1"` を割り当てたため主キー重複になるという指摘(`loop2-2-review.md`)。**テストを実行できないので誰も裏取りできず**、コード読みだけの指摘 → 盲目的な書き換え、という振動になっています。

## 根本原因

このプロジェクトの依存解決方式(`docs/3dreviewer-plan-and-architecture.md` §23)は
「依存の実体を `.deps/node_modules` に置き、`workspace/node_modules` の**シンボリックリンク**と `[sandbox] ro_binds` でサンドボックスへ持ち込む」というものです。§23 は当該リンクを `docs/3dreviewer-plan-and-architecture.md:579` で「**git add -f で追跡**」すると明記しています。

ところが実際のリポジトリでは追跡されていません。

- `.gitignore:18` `/workspace/node_modules`(コメントは「sync-deps.sh が生成するマシン固有の symlink」)
- `git ls-files | grep node_modules` → 該当なし

つまり **設計文書(追跡する)と実リポジトリ(無視する)が食い違ったまま運用されている**。リンクは `config/sync-deps.sh` の末尾で main チェックアウトの `workspace/` にのみ作られるため、orch が新規に切る git worktree には複製されません。結果、各タスクのワークツリーは常に依存ゼロで verify に入ります。

これを検知するはずの `config/preflight.sh` は、`orch run` の前に**一度だけ** main の `workspace/` を cwd として走ります。そこにはリンクがあるので合格し、実際に verify が走るワークツリーには存在しない、という取りこぼしが起きています(preflight のグリーンが偽陽性)。

タスク md も orch のループ設定も、この失敗には無関係です(実装役の手元では typecheck と 53 テストが通っている)。

補足: 同じ失敗は task 007 loop1 でも起きており(`logs/007/loop1-verify.log`)、そのときは修正役が `npm ci --ignore-scripts` でワークツリー内に**実体の** `node_modules` を作ったため loop2 で偶然合格しました(`logs/007/loop1-3-fix.log:533`)。恒久的な解決ではなく、たまたま回避できただけです。

## 推奨する対応

1. リンクを git 追跡に切り替え、全ワークツリーへ伝播させる(§23 の本来の設計に戻す):
   `.gitignore:18` の `/workspace/node_modules` 行を削除し、`git add -f workspace/node_modules` してコミット。以後、新規ワークツリーにはリンクが自動で入ります。
   ※リンク先は絶対パス `/home/ojin/projects/3dreviewer/.deps/node_modules` で、別マシンへ持っていくと壊れます。単一マシン運用なら §23 の想定どおり。他マシンも使うなら 2 の方式を選んでください。
2. あるいは追跡せず、orch がワークツリー作成後に毎回リンクを張る方式にする(下記「オーケストレータ側の改善」)。どちらか一方でよく、両方は不要です。
3. 依存が入った状態で task 008 を再実行する。実装役の手元では 53 テストが通っており、実装の中身は概ね出来ています。残るレビュー指摘(`p1`/`p2` の `id: "c1"` 重複)は、テストが実際に走れば真偽が即座に判明します — **未確認**: この指摘が正しいかは、テスト未実行のためログからは裏が取れていません。

## オーケストレータ側の改善

`orch_fix: code`。既存の `config/orch.toml` に、この穴を塞げるキーはありません(`[sandbox] ro_binds` はサンドボックスへのマウントを与えるだけで、ワークツリー内にリンクを作りません)。未知キーはエラーになるため、設定差分では対応できません。

改善案は 2 つ、どちらも orch 本体(`src/*.rs`)の改修が必要です。

- **preflight を各ワークツリーで実行する**(推奨)。現状 preflight は run 開始前に1度だけ走り、しかも verify が実際に走るワークツリーではなく main を見ています。ワークツリー作成直後(初回 verify の直前)に同じ preflight を走らせれば、`config/preflight.sh` の「依存 workspace/node_modules がありません」というメッセージが**実際に効く場所で**出て、3ループを空転させる代わりに 1 秒で「環境不備」として明確に落とせます。副作用: preflight の実行回数がタスク数ぶん増える(1回あたり数百 ms 程度)。preflight がタスク非依存であることを前提にしているスクリプトなら影響なし。
- **ワークツリーのブートストラップ用フックを設ける**(例: `[sandbox] worktree_setup` として、ワークツリー作成後・ホスト側で実行するコマンドを持てるようにする)。そこに `ln -sfn ...` を書けば、追跡・非追跡どちらの運用でもリンクを再現できます。ただしフックはホスト権限で走るため、実行範囲の明示など設計上の注意が要ります。

いずれにせよ、**verify が「実装役が到達できない前提」で落ち続けたとき、同じループを最大回数まで回す**のは無駄です。verify の出力が2ループ連続で完全一致した時点で早期に打ち切って診断へ回す、という一般化した改善も併せて検討する価値があります(今回は max_loops=3 のうち 2 ループぶんの実装・レビューが丸ごと無駄になりました)。
