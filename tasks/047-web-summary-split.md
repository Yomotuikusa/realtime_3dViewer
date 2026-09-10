---
id: 047
title: web_Summary.md をフォルダ別の Summary に分割し、網羅性をテストで守る
feature: web
depends_on: [046]
owns: [web/web_Summary.md, web/src/app/app_Summary.md, web/src/store/store_Summary.md, web/src/features/viewer/viewer_Summary.md, web/src/features/annotation/annotation_Summary.md, web/src/features/comments/comments_Summary.md, web/src/features/presence/presence_Summary.md, web/src/features/shortcuts/shortcuts_Summary.md, web/tests/summary-coverage.test.ts]
reads: [web/tests/styles-rules.test.ts, web/vitest.config.ts, web/tsconfig.json, shared/shared_Summary.md, server/server_Summary.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
`web/web_Summary.md` は web のタスクが増えるたびに伸び、task 046 完了時点で 280 行前後と
1ファイル 300 行の上限に迫っている。web 全体を1枚で説明する構造を、フォルダごとの
Summary に分け、`web_Summary.md` は目的・構成・索引・他機能フォルダとの関係だけを持つ
索引にする。あわせて「全ソース・全テストがどこかの Summary に載っている」ことを
機械検証するテストを足し、今後の web タスクが Summary の更新を漏らさないようにする。

**コード(`.ts` / `.tsx` / `.css`)は一切変更しない。ドキュメントの再配置とテスト追加だけのタスクである。**

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `web/web_Summary.md` の見出しは `# web` / `## 目的` / `## ファイル一覧と役割` /
  `## 公開インターフェイス` / `## 他機能との関係` の4節。「ファイル一覧と役割」は
  `- src/features/viewer/ViewerHud.tsx: …` のように `src/` からの相対パス、「公開インターフェイス」は
  `- features/viewer/ViewerHud.tsx: …` のように `src/` を省いたパスで始まる箇条書きである。
  「他機能との関係」は段落と表(CameraRig の毎フレーム処理)から成る散文で、viewer /
  app(realtime)/ annotation / presence / comments の順に内容が混在している
- task 046 完了時点のファイル数は `src/features/viewer` 25、`src/app` 16、`src/features/comments` 10、
  `src/features/annotation` 8、`src/store` 7、`src/features/shortcuts` 7、`src/features/presence` 5、
  `src/styles` 3、`src/api` 2、ほか `src/main.tsx`、`tsconfig.json`、`vitest.config.ts`。
  `tests/` は平らに `*.test.ts` が 30 本強あり、各テストは 1 つのソースに対応する
  (例: `tests/hud-menu.test.ts` ↔ `src/features/viewer/hud-menu.ts`)
- 既存テスト `tests/styles-rules.test.ts:8-10` は `import.meta.url` から `web/src` を解決し、
  解決できなければ `process.cwd()/web/src` へフォールバックする。`readdirSync(dir, { recursive: true })`
  で再帰列挙している。新テストもこのパス解決を踏襲する
- `vitest.config.ts` は `tests/**/*.test.{ts,tsx}` を対象にする。新テストは `tests/` 直下に置けば拾われる
- orch が必須とするのは `web/web_Summary.md`(機能フォルダ `web` の直下)である。サブフォルダの
  `_Summary.md` は追加のドキュメントであり、存在しても機械検証を妨げない。名前は
  `<フォルダ名>_Summary.md` に揃える
- 行数上限 300 行はすべてのファイルに適用される(`.md` も対象)

## インターフェイス契約

### 置き場の規則(`web_Summary.md` に「Summary の置き場」節として明文化する)
1. ソースファイルは、そのファイルのディレクトリから `web/` へ向かって最も近い
   `<フォルダ名>_Summary.md` に、**その Summary のあるフォルダからの相対パス**で載せる
   - `src/features/viewer/ViewerHud.tsx` → `src/features/viewer/viewer_Summary.md` に `ViewerHud.tsx`
   - `src/store/camera.ts` → `src/store/store_Summary.md` に `camera.ts`
   - `src/api/client.ts`、`src/styles/tokens.css`、`src/main.tsx`、`tsconfig.json`、`vitest.config.ts`
     → `web/web_Summary.md` に `src/api/client.ts` のように `web/` からの相対パス
2. テスト(`tests/*.test.ts(x)`)は、対応するソースが載っている Summary の `## テスト` 節に
   ファイル名(`hud-menu.test.ts`)で載せる。`api-client.test.ts` / `ws-client.test.ts` /
   `styles-rules.test.ts` / `summary-coverage.test.ts` は `web_Summary.md` の `## テスト` 節
3. フォルダ Summary の節構成は `# <フォルダ名>` / `## 目的` / `## ファイル一覧と役割` /
   `## 公開インターフェイス` / `## 他フォルダとの関係` / `## テスト`
4. `web_Summary.md` の節構成は `# web` / `## 目的` / `## 構成と Summary の置き場`(上記 1〜3 の規則と、
   7 つのフォルダ Summary へのパス一覧)/ `## 共通ファイル`(api / styles / main.tsx / tsconfig /
   vitest.config の一覧と役割、公開インターフェイス)/ `## 他機能フォルダとの関係`(shared / server
   との関係だけ)/ `## テスト`

### 新規 Summary(7 ファイル)
| ファイル | 載せる内容 |
| --- | --- |
| `src/app/app_Summary.md` | `src/app/*` 16 ファイル。他機能との関係のうち App / ReviewPage / useRealtime / WsClient 再接続 / dispatchServerMessage / review-stores の段落 |
| `src/store/store_Summary.md` | `src/store/*` 7 ファイル。camera ストア(`selfCamera` / `requestCamera` / `resetSeq` / `setFocalLength`)、annotation ストア(`mode` / `color` / `drafting` / `overlay`)、presence(`applyWelcome` / `updateCamera`)、comments(`items` 順序・`selectedId` 補正・各 action)の段落 |
| `src/features/viewer/viewer_Summary.md` | `src/features/viewer/*` 25 ファイル。CameraRig の優先順位表、ViewerHud / CameraMenu / LightGizmo、FocalLengthRig、useCameraBroadcast のスロットル、OrbitControls の割り当て、ModelMesh の LoadingManager、pick の段落 |
| `src/features/annotation/annotation_Summary.md` | `src/features/annotation/*` 8 ファイル。AnnotationLayer の表面／空間描画、RoomStrokes / StrokeLines の overlay の段落 |
| `src/features/comments/comments_Summary.md` | `src/features/comments/*` 10 ファイル。Comment 投稿・一覧・再現(useCommentReplay)の段落 |
| `src/features/presence/presence_Summary.md` | `src/features/presence/*` 5 ファイル。PresenceList / RemoteCameras / Follow 表示の段落 |
| `src/features/shortcuts/shortcuts_Summary.md` | `src/features/shortcuts/*` 7 ファイル。ショートカットの有効条件・設定ダイアログの段落 |

散文の段落は「主に説明しているモジュールのフォルダ」へ移す。2 つのフォルダにまたがる段落
(例: `useCameraBroadcast` が presence の自分のカメラを更新する)は、処理を開始する側
(この例では viewer)に置き、相手側の「他フォルダとの関係」に1行の参照
(`viewer_Summary.md を参照`)を書く。文章を新たに書き足したり要約し直したりせず、**既存の文を移す**。

### 網羅性テスト
```ts
// web/tests/summary-coverage.test.ts(新規)
// styles-rules.test.ts と同じ方法で web/ ディレクトリを解決し、以下を検査する。
// 走査対象: web/src 配下の *.ts / *.tsx / *.css(ignore: node_modules, dist, .vite)、
//           web/tests 配下の *.test.ts / *.test.tsx、web 配下の *_Summary.md

describe("web summaries", () => {
  it("names every folder summary after its folder");
  //   src 配下の各 *_Summary.md について、ファイル名が `${basename(dirname)}_Summary.md` に等しい

  it("lists every source file in the nearest summary by relative path");
  //   各ソースについて「そのディレクトリから web/ へ向かって最も近い *_Summary.md」を探し、
  //   その Summary の本文に「Summary のあるフォルダからの相対パス」(区切りは "/")が含まれる

  it("lists every test file in some summary by file name");
  //   各 tests/*.test.ts(x) の basename が、web 配下のいずれかの *_Summary.md に含まれる

  it("indexes every folder summary from web_Summary.md");
  //   src 配下の各 *_Summary.md の web/ からの相対パスが web_Summary.md に含まれる
});
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| task 046 完了時点の全ソース・全テスト | 上記 4 つの検査がすべて通る(= 移し漏れがない) |
| `web/web_Summary.md` | `# web` / `## 目的` / `## 構成と Summary の置き場` / `## 共通ファイル` / `## 他機能フォルダとの関係` / `## テスト` の節を持ち、150 行以内 |
| 7 つのフォルダ Summary | それぞれ上記の節構成を持ち、各 150 行以内(`viewer_Summary.md` が最大で 100 行前後の見込み) |
| 既存の `web_Summary.md` にあった文・箇条書き | どれかの Summary に1か所だけ存在する(重複して残さない、消さない)。ただし「ファイル一覧」と「公開インターフェイス」でパスの書き方が変わるのは可 |
| `src/features/viewer/ViewerHud.tsx` | `viewer_Summary.md` の「ファイル一覧と役割」に `ViewerHud.tsx` で載る。`web_Summary.md` には載らない |
| `src/api/client.ts` | `web_Summary.md` の「共通ファイル」に `src/api/client.ts` で載る |
| `tests/hud-menu.test.ts` | `viewer_Summary.md` の `## テスト` に `hud-menu.test.ts` で載る |
| `tests/store-camera.test.ts` | `store_Summary.md` の `## テスト` に載る |
| `tests/styles-rules.test.ts`、`tests/summary-coverage.test.ts` | `web_Summary.md` の `## テスト` に載る |
| 仮に `src/features/viewer/foo.ts` を追加して Summary を更新しない | `lists every source file …` が `foo.ts` を挙げて失敗する(テストコード中のメッセージに不足パスを含める) |
| 仮に `src/features/viewer/Viewer_Summary.md` と誤命名 | `names every folder summary …` が失敗する |
| `npm run typecheck` | 変更対象に `.ts`/`.tsx` の実装がないので通る(新テストは `/// <reference types="node" />` を付ける) |
| 既存の `tests/styles-rules.test.ts` | 変更せず、そのまま通る |

## やらないこと
- `web/src` 配下のコード(`.ts` / `.tsx` / `.css`)を変更しない。リネーム・移動もしない
- `web/tests` の既存テストを変更しない
- Summary の文章を書き直したり、新しい説明を足したりしない(移すだけ。現状と食い違う記述を
  見つけても直さず、最終メッセージの申し送りに書く)
- `shared_Summary.md` / `server_Summary.md` / `workspace/AGENTS.md` を変更しない
- `src/api` / `src/styles` にフォルダ Summary を作らない(共通ファイルとして `web_Summary.md` に残す)
- `vitest.config.ts` / `tsconfig.json` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] 7 つのフォルダ Summary が契約どおりの名前・節構成で存在する
- [ ] `web_Summary.md` が索引構成になり、置き場の規則と 7 ファイルへのパスを含む
- [ ] `tests/summary-coverage.test.ts` の 4 つの検査がある
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
