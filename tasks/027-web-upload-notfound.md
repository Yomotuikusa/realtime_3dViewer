---
id: 027
title: web アップロード画面と NotFound の整え(トークン適用・入力の説明・エラー位置)
feature: web
depends_on: [026]
owns: [web/src/app/App.tsx, web/src/app/UploadPage.tsx, web/src/app/upload-labels.ts, web/src/app/upload.css, web/tests/upload-labels.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, ../docs/DESIGN_SKILL.md, web/web_Summary.md, web/src/styles/tokens.css, web/src/styles/controls.css, web/src/app/review.css, web/src/app/routes.ts, web/src/api/client.ts, shared/src/api.ts]
verify: npm run typecheck && npm run test:web && npm run build
status: done
---

## 目的
入口(`/`)と NotFound を 023 のトークンに載せ、レビュー画面(024〜026)と同じ製品に見えるようにする。
**仮説検証(設計書 §8)には不要**なので第4回の最後に置く。時間が無ければ起票のまま止めてよい
(`docs/task-breakdown.md` §4)。

## 前提
- `UploadPage`(78 行)は プロジェクト名 / モデルファイル の 2 入力と送信ボタン、`role="alert"` のエラー、
  `createProject` → `navigate(projectPath(id))` を持つ。**検証・送信・遷移のロジックは変えない**
- 上限は `MAX_UPLOAD_BYTES_DEFAULT`(100MB)、拡張子は `ALLOWED_MODEL_EXTENSIONS`(`.glb` `.gltf`)。
  いずれも `@shared/api`。サーバの実上限は環境変数で変わりうるので、文言は「100MB まで」ではなく
  `MAX_UPLOAD_BYTES_DEFAULT` から生成する
- `App.tsx` の NotFound は `<main>ページが見つかりません: {pathname}</main>` の 1 行
- `.field` `.field__label` `.input` `.btn--primary` `.alert` は 023 の `controls.css`
- SKILL §3.1: 集中した作成フローは狭い幅。§4.2: ラベルは見える形で、必要なときだけ helper
- D36 / D37。依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/app/upload-labels.ts
export const APP_NAME: string;              // 3D Reviewer
export const UPLOAD_LEAD: string;           // glTF / GLB をアップロードすると、共有用のレビュー URL が発行されます。
export const PROJECT_NAME_LABEL: string;    // プロジェクト名
export const MODEL_FILE_LABEL: string;      // モデルファイル
export const SUBMIT_LABEL: string;          // レビューを開始
export const SUBMITTING_LABEL: string;      // アップロード中…
export const NOT_FOUND_TITLE: string;       // ページが見つかりません
export const NOT_FOUND_HOME: string;        // アップロード画面へ
/** 「.glb / .gltf、100 MB まで」。bytes は 1024 基数で MB に丸め(小数なし)、拡張子は与えた順に " / " で結ぶ */
export function fileHelp(extensions: readonly string[], maxBytes: number): string;
/** 選択中ファイルの表示: 「name(12.3 MB)」。1 MB 未満は KB。小数 1 桁 */
export function fileSummary(name: string, bytes: number): string;
```

```tsx
// web/src/app/UploadPage.tsx(変更)
/** <main class="upload">
 *    <header class="upload__head"><h1 class="upload__title">{APP_NAME}</h1><p class="upload__lead">{UPLOAD_LEAD}</p></header>
 *    <form class="upload__form" onSubmit=…>
 *      <label class="field"><span class="field__label">{PROJECT_NAME_LABEL}</span><input class="input" maxLength={100} …/></label>
 *      <label class="field"><span class="field__label">{MODEL_FILE_LABEL}</span><input class="input" type="file" accept=".glb,.gltf" …/>
 *        <span class="upload__help">{file ? fileSummary(file.name, file.size) : fileHelp(ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT)}</span></label>
 *      {error && <p class="alert" role="alert">{error}</p>}      ← ボタンの直前(失敗した操作の近く。SKILL §4.8)
 *      <button class="btn btn--primary" type="submit" disabled={submitting}>{submitting ? SUBMITTING_LABEL : SUBMIT_LABEL}</button>
 *  クライアント検証の文言(現状 3 種)は変えない */
export function UploadPage(): React.ReactElement;

// web/src/app/App.tsx(変更)— NotFound だけ
/** <main class="upload upload--message"><h1 class="upload__title">{NOT_FOUND_TITLE}</h1><p class="upload__lead">{pathname}</p>
 *    <a class="btn" href="/" onClick={e => { e.preventDefault(); navigate("/") }}>{NOT_FOUND_HOME}</a></main>
 *  ルート判定は変えない */
```

```css
/* web/src/app/upload.css — 接頭辞 upload- */
/* .upload         max-width 32rem; margin 0 auto; padding var(--space-6) var(--space-4); display:grid; gap var(--space-5)
   .upload__title  text-xl; font-weight 600(製品名だがアプリ画面なので大きくしない)
   .upload__lead   text-muted
   .upload__form   display:grid; gap var(--space-4)
   .upload__help   text-sm; text-muted
   .upload--message  text-align center */
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `fileHelp([".glb", ".gltf"], 100 * 1024 * 1024)` | `".glb / .gltf、100 MB まで"` |
| `fileHelp([".glb"], 50 * 1024 * 1024)` | `".glb、50 MB まで"` |
| `fileSummary("a.glb", 12.3 * 1024 * 1024)` | `"a.glb(12.3 MB)"` |
| `fileSummary("a.glb", 512 * 1024)` | `"a.glb(512.0 KB)"` |
| 定数 | 契約のコメントどおり |
| `/`(目視) | 幅 32rem に収まり、見出し・説明・2 入力・ボタンが縦に並ぶ。file 入力の下に helper |
| ファイルを選ぶ(目視) | helper がファイル名とサイズに変わる |
| 名前空で送信(目視) | ボタンの直上に alert。文言は現状のまま |
| `/nope`(目視) | 「ページが見つかりません」+ パス + 「アップロード画面へ」で `/` に戻る(履歴が push される) |
| 既存の全テスト + `styles-rules.test.ts` | 通る |
| `UploadPage.tsx` `App.tsx` | inline `style={{` が 0 箇所 |

## やらないこと
- ドラッグ&ドロップ、進捗バー、複数ファイル、`.gltf` の外部 `.bin` 対応(D11 の既知の制限)
- 過去プロジェクトの一覧(認証なし・一覧 API なし)
- `routes.ts` `api/client.ts` の変更
- ダークテーマ・レスポンシブ(D37)。ただし 32rem 幅は狭い画面でも壊れないのでそのまま
- 依存の追加・package.json の変更

## 目視確認(マージ後に人間が行う)
- [ ] `/` と `/p/<id>` を行き来して、同じ製品に見える(文字サイズ・ボタン・枠の色が揃っている)
- [ ] `docs/DESIGN_SKILL.md` §12: 中央の巨大見出し・ヒーロー・装飾イラストが無い
- [ ] NotFound から戻れる

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM 構造・クラス名で実装されている
- [ ] 振る舞い表の純粋関数の行すべてに対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(`upload-labels` `upload.css`、NotFound の遷移)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web && npm run build` が成功する
- [ ] 最終メッセージに `docs/DESIGN_SKILL.md` §16 の Visual audit 1〜12 への回答を書く
