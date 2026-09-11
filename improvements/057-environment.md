# 改善提案 (タスク 057 の失敗より)

- 分類: environment
- 確度: high
- 要約: worktree の node_modules シンボリックリンクが旧パス /home/tom/… を指し依存解決不能
- 診断: /home/ojin/projects/3dreviewer/logs/057/diagnosis.md

## 何が起きたか
実装・レビュー・修正のすべてのフェーズは成功しており、落ちたのは verify だけです。

- loop1 実装後の verify: `exit code: Some(2)`、`error TS2688: Cannot find type definition file for 'node'`(`logs/057/loop1-verify.log:6,11`)。所要 2 秒で、`tsc -p shared/tsconfig.json` の時点で即死しています。
- レビュー役は owns 内 4 ファイルの実装を契約どおりと判定し `VERDICT: PASS`(`logs/057/loop1-2-review.md:18`)。ただし申し送りとして `TS2688` と `vitest: not found` を報告(`logs/057/loop1-2-review.md:14-15`)。
- 修正フェーズも「追加修正は不要」とし、`存在しない /home/tom/.../node_modules リンクにより依存解決前に失敗` と特定したうえで BLOCKED を申告(`logs/057/loop1-3-fix.md:6-8`)。
- 修正後の再 verify も同一エラーで失敗(`logs/057/loop1-3-blocked-verify.log:6,11`)。

実装役・レビュー役の申し送りは verify ログの一次証拠と完全に一致しており、伝聞ではなく正しい診断です。

## 根本原因
`workspace/node_modules` は **git に追跡されたシンボリックリンク**(`git ls-files -s` → mode `120000`, blob `867ed5b`)で、その **コミット済みの中身が `/home/tom/projects/realtime_3dViewer/.deps/node_modules`** です。プロジェクトが `/home/ojin/projects/3dreviewer` へ移設された際、このリンク先が古いままコミットに残りました。

- 現在のチェックアウト先である `.worktrees/057/workspace/node_modules` は、まさにその `/home/tom/...` を指しており(存在しないため dangling)、`@types/node` も `vitest` も解決できません。
- 一方、main の作業ツリーでは誰かが `../.deps/node_modules`(相対パス)に書き換えており、これが git status の ` M workspace/node_modules` の正体です。**この修正は未コミット**なので、orch が HEAD から作る worktree には一切反映されません。
- さらに重要な点として、**この相対パスによる修正はそもそも worktree では機能しません**。worktree 内で `../.deps` は `.worktrees/057/.deps` を指し、そこは存在しません(確認済み)。`workspace/AGENTS.md:51` が「絶対パスのシンボリックリンク」と規定しているのはこのためです。

依存の実体自体は健在です(`.deps/node_modules/@types/node` と `.deps/node_modules/.bin/vitest` の存在を確認)。`config/orch.toml:38` の `ro_binds` も正しく `/home/ojin/projects/3dreviewer/.deps/node_modules` を指しており、verify サンドボックスに実体は持ち込まれています。**壊れているのはリンクの向きだけ**で、依存の欠落でもネットワーク不通でもありません。

実装役の挙動は規約どおりで非がありません。`AGENTS.md:54-62` は `npm install` を絶対禁止とし、「モジュールが見つからない」失敗は環境問題として申し送れと明記しています。実装役はその通りに BLOCKED を申告しました。

なお、タスク md 自体には欠陥は見当たりません。契約は具体的で、レビュー役も契約どおりと判定しています(私は worktree の diff 本体を直接検分していないため、実装内容の正しさは未確認です)。リンクを直せば同じ成果物のまま verify が通る可能性が高いと見ます。

## 推奨する対応
1. `workspace/node_modules` を **絶対パスで正しい先に向けてコミット**する。main の相対パス修正は worktree で機能しないため、そのままコミットしてはいけません。
   ```
   cd /home/ojin/projects/3dreviewer/workspace
   ln -sfn /home/ojin/projects/3dreviewer/.deps/node_modules node_modules
   git add node_modules && git commit -m "fix: node_modules シンボリックリンクを現行パスへ更新"
   ```
2. コミット後、`tasks/057-web-follow-badge.md` の `status:` を `pending` に戻して 057 を再実行する。実装成果物は worktree に残っているので、そのまま通る見込みです。
3. 移設時の取り残しが他にもないか確認する。`grep -rn "/home/tom" config/ workspace/ tools/ docs/ --exclude-dir=node_modules` で旧パス参照を洗い、`config/sync-deps.sh` が書き込むリンク先も絶対パスの現行値になっているか点検してください。

## オーケストレータ側の改善
### 理由
設定値の変更では防げません。`ro_binds` は既に正しく、worktree 内のリンク向きを補正するキーは orch に存在しないため、`orch_fix: code` としました。

提案する改修は、**worktree 作成直後に verify の前提が成立するかを検査するプリフライト**です。具体的には次のいずれかです。

- (a) worktree セットアップ時に、`ro_binds` に列挙された実体へ向くよう `workspace/node_modules` のシンボリックリンクを張り直す。orch は worktree の作成主体であり、依存実体の絶対パスを設定から既に知っているため、リンクの整合を取るのは orch の責務として自然です。これなら 057 は失敗せずに完走していました。
- (b) より保守的には、worktree 内の dangling シンボリックリンクを検出したら、実装フェーズを起動する前に「環境エラー」として即座に失敗させる。

現状では、環境起因と確定している失敗のために実装・レビュー・修正の 3 フェーズ分(codex 呼び出し 3 回)を丸ごと消費し、しかも 2 名のエージェントが正しく原因を突き止めていたにもかかわらずループを回し切っています。プリフライトがあれば数秒で人間に返せます。

副作用の見立て: (a) は orch が worktree 内のファイルを書き換えることになるため、リンクが git 追跡下にある本プロジェクトでは worktree に意図しない差分が生じ、「owns 外の変更」検査やコミット対象に混入する恐れがあります。追跡対象のパスは書き換えない、または書き換え後に `git update-index --skip-worktree` 相当で差分を抑える配慮が要ります。(b) は副作用がほぼなく、実装コストも小さいので、まず (b) から入れるのが安全です。
