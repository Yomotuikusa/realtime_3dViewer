# 改善提案 (タスク 029 の失敗より)

- 分類: orchestrator
- 確度: high
- 要約: 実装役が実ソケットテストを実行できず盲目修正、orchが正解レビュー直後に中断
- 診断: /home/tom/projects/realtime_3dViewer/logs/029/diagnosis.md

## 何が起きたか

verify は loop1・loop2 とも**まったく同じ 1 件**だけ失敗しています。

- `logs/029/loop1-verify.log` / `loop2-verify.log`: `Tests 1 failed | 95 passed (96)`。落ちているのは `tests/realtime-guards.test.ts > allows a same-host Origin and rejects foreign or malformed Origins` のみで、`AssertionError: expected 'error' to be 'welcome'`(`realtime-guards.test.ts:65`)。typecheck は両ループとも成功しています。
- loop1 と loop2 の差分は Origin 文字列の作り方だけです(loop1: `new URL(value.url…`、loop2: `` `http://${new URL(…` ``)。エラー行・メッセージ・件数は 1 文字も変わっていません。
- フェーズ構成は loop1 が implement→verify→review→fix、loop2 が implement→verify→review で**打ち切り**です(`logs/029/` に `loop2-3-fix.log` が存在しない)。`max_loops = 3` は消化されていません。

## 根本原因

**(1) 直接原因は owns 内のテストのバグで、1 行で直せる**

`server/tests/helpers/ws.ts:70` の `url` は `ws://127.0.0.1:<port>/ws` で、クエリを含みません。テストはこれをそのまま渡しています(`realtime-guards.test.ts:63` の `openWithOrigin(value.url, …)`)。一方 `server/src/realtime/ws.ts:81-90` は Origin 判定(:92)より**先に** projectId 不在を弾き、`error BAD_REQUEST "projectId query parameter is required"` + close 1008 を返します。よって最初の受信メッセージは必ず `error` になり、`welcome` にはなりません。タスクmdの判定順(029-server-realtime-guards.md:73-77)どおりの正しい実装で、テスト側だけが誤っています。

`realtime-guards.test.ts` は owns に入っています(タスクmd:6)。**orch が疑った「verify に必要なファイルが owns に無い」は成立しません。** タスクmdの分割・契約・verify コマンドはいずれも妥当です。

**(2) 振動した原因は、実装役・レビュー役が失敗を再現できないこと**

実装・修正・レビューの各フェーズの sandbox は `127.0.0.1` への listen を拒否します。

- `logs/029/loop1-1-implement.log:1583` 付近 / `loop1-3-fix.log` / `loop2-1-implement.log:1583`: `Error: listen EPERM: operation not permitted 127.0.0.1`
- `loop1-2-review.log:1859`、`loop2-2-review.log:1357` でもレビュー役が同じ EPERM を踏んでいます
- `loop1-2-review.log:2957`「指定の verify は権限制約でのローカル実行では listen が `EPERM` になりましたが、提示された verify 実測…を採用します」

verify sandbox は実ソケットテストを問題なく走らせています(`realtime-ws.test.ts` が 4084ms で 7 件 pass)。つまり **verify sandbox は listen できるが、実装/レビュー sandbox はできない**という非対称があります。結果として実装役は verify ログの散文から当て推量で直すしかなく、loop1 のレビュー役は `ws://` と `http://` の違いという誤った仮説を出しました。しかもレビュー役は `loop1-2-review.log:2938-2940` で自ら `node -e` を実行し、`new URL("ws://…").origin` 経由でも host は `127.0.0.1:1234` で一致すると確認済みでした。反証を得ながらその修正案を出し(`loop1-2-review.md`)、loop1-3-fix はそれを忠実に適用して**何も変えなかった**——これが振動の実体です。

**(3) 決定打は、正解が出た直後に orch が止めたこと**

`logs/029/loop2-2-review.md:5-6` でレビュー役はついに正確な原因に到達しています:「`openWithOrigin(value.url, ...)` に `projectId` クエリがありません。Origin 判定前に projectId 必須エラーとなり…修正案: `${value.url}?projectId=p1` を渡す」。これは上記(1)と完全に一致する、そのまま適用可能な指示です。ところが orch の「同じ状態に戻った」検出は verify 結果を突き合わせて**このレビューの後・fix フェーズの前**で run を中断しました。max_loops の残りもあったのに、唯一の正解を捨てて失敗扱いにしています。

補足(未確認): orch 本体の Rust 実装と README はこのリポジトリに存在せず(リポジトリ直下は config/docs/improvements/logs/tasks/tools/workspace のみ、`*.rs` は 0 件)、中断判定と sandbox 生成の実コードは読めていません。上記(3)の挙動はログのフェーズ構成からの推定です。

## 推奨する対応

1. **タスク 029 を書き直さずに再開する。** ワークツリー `.worktrees/029/workspace` で `server/tests/realtime-guards.test.ts:63` を `openWithOrigin(`${value.url}?projectId=p1`, …)` に直し、同ファイル :70 のループ(`http://evil.example` / `"null"` / `"not a URL"`)にも同じクエリを付ける。この 2 箇所以外に手を入れる必要はなく、いずれも owns 内。その上で `npm run typecheck && npm run test:server` を手元で実行して 96/96 を確認する。
2. **実装/レビュー sandbox にループバック listen を許可する**(下記「オーケストレータ側の改善」)。ここを直さない限り、WebSocket や HTTP サーバを立てるタスクは今後も同じ振動を繰り返す。
3. **1 を先に手動で通してからマージし**、029 に依存する後続タスク(030 は `depends_on` に 029 を含む可能性があるため要確認)のブロックを解除する。

## オーケストレータ側の改善

`config/orch.toml` の `[sandbox]` は `ro_binds` しか持たず、ネットワーク/listen 権限を制御するキーが存在しないため、設定変更では防げません。orch 本体の改修が 2 点必要です。

- **A: 実装/修正/レビューのフェーズ sandbox を verify sandbox と同じ能力に揃える。** 少なくとも `127.0.0.1` の ephemeral listen を許可する(外向き通信は禁止のままでよい)。あわせて `[sandbox]` に `allow_loopback_listen = true` 相当のキーを追加し、プロジェクト側で選べるようにする。
- **B: 「進展なし」判定を、直近のレビューを消化してから下す。** verify 結果が前ループと同一でも、そのループの review が**新規の**指摘(前ループと異なる対象行・異なる原因)を出している場合は fix フェーズを実行してからもう一度 verify する。判定キーを「verify 出力のハッシュ」だけでなく「verify 出力 + 未適用レビュー指摘の有無」にする。

### 理由

A が根本です。実装役が失敗テストを 1 度でも実行できていれば、`projectId` クエリ欠落は最初のループで数十秒で判明しました。verify だけが実ソケットを張れる現状は、実装役に「verify ログの日本語散文から原因を推理する」という不可能な仕事を強いており、ソケットを使うタスクでは構造的に振動します。副作用として sandbox の隔離はわずかに緩みますが、ループバック listen は外部への到達性を持たず、verify sandbox が既に同じ権限で動いている以上、実質的な攻撃面の増加はありません。

B は保険です。A を入れても誤診は起こりえますが、今回のように「正解のレビューが出た直後に中断」という最悪の打ち切りは防げます。副作用は失敗確定タスクで 1 フェーズ分(最大 `phase_timeout_secs` = 3600 秒)余計に回る可能性ですが、新規指摘があるループに限定すれば無限ループにはなりません。

なお、`max_file_lines = 300` と `require_summary = true` は今回の失敗に無関係です。機械検証違反は両ループとも 0 件で、`realtime-guards.test.ts` は 162 行、`server_Summary.md` も更新済みでした。
