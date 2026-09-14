---
id: 090
title: web アップロード画面を FBX と OBJ に対応させる
feature: web
depends_on: [088]
owns: [web/src/app/UploadPage.tsx, web/src/app/upload-labels.ts, web/tests/upload-labels.test.ts, web/src/app/app_Summary.md]
reads: [shared/src/api.ts, web/src/app/upload.css, web/src/api/client.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
088 でサーバが `.fbx` / `.obj` を受け入れるようになるが、アップロード画面はファイル選択ダイアログの
`accept` とエラー文言・説明文が `.glb` / `.gltf` のままで、選ぼうとしてもファイルが出てこない。
画面側を形式の単一ソースへ追従させる。

OBJ は材質ファイル(`.mtl`)を読み込まないため単色表示になる。これはアップロード時点で
伝えないと誤解されるので、画面に注記を出すところまでを本タスクに含める。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `UploadPage` は `ALLOWED_MODEL_EXTENSIONS` を import して `validateModelFiles` と `fileHelp` に
  渡しているが、**`accept` 属性だけが `".glb,.gltf"` のハードコード**である。
  web/src/app/UploadPage.tsx:79
- `validateModelFiles(files, extensions, maxBytes)` は「0 件 → `NO_FILE_SELECTED`」
  「1 件でも対応外拡張子 → `UNSUPPORTED_EXTENSION`」「合計が上限超 → `FILE_TOO_LARGE`」の順で
  判定する純粋関数で、拡張子は `lastIndexOf(".")` + 小文字化で取る。
  **このロジックは変更しない**(`extensions` 引数が広がるだけで正しく動く)。
  web/src/app/upload-labels.ts:32-55
- `fileHelp(extensions, maxBytes)` は `` `${extensions.join(" / ")}、${MB} MB まで` `` を返す。
  **このロジックも変更しない**。同 :23-26
- ヘルプ表示は 1 つの `<span className="upload__help">` に、ファイル未選択なら
  `` `${fileHelp(...)}。${MODEL_FILES_HELP_SUFFIX}` ``、選択済みなら `filesSummary(files)` を出す。
  web/src/app/UploadPage.tsx:84-88
- `upload.css` に `.upload__help` のスタイルがある。**CSS は変更しない**
- 088 で `ALLOWED_MODEL_EXTENSIONS` は `[".glb", ".gltf", ".fbx", ".obj"]`(この順)になる
- `web/tests/summary-coverage.test.ts` が「`web/tests/*.test.ts` の全ファイル名がいずれかの
  Summary に載っている」を検査する。本タスクは新規テストファイルを作らないので影響しない

### 本タスクの変更で落ちる既存テスト(必ず更新する)
- `web/tests/upload-labels.test.ts:29` — `UPLOAD_LEAD` の期待値が旧文言

`fileHelp` / `validateModelFiles` のテスト(:39-40, :58-74)は**拡張子配列をリテラルで渡している**
ため、定数を広げても落ちない。それらの既存行は消さず、4 形式の行を足す形で拡張する。

## インターフェイス契約

### 変更 web/src/app/upload-labels.ts

文言 2 件を書き換え、注記を 1 件追加する。**関数のシグネチャと実装は一切変更しない。**

```ts
export const UPLOAD_LEAD = "glTF / GLB / FBX / OBJ をアップロードすると、共有用のレビュー URL が発行されます。";
export const UNSUPPORTED_EXTENSION = "対応しているモデル形式は .glb / .gltf / .fbx / .obj です。";
/** OBJ は材質ファイルを読み込まない旨の注記。アップロード画面のヘルプ下に常時出す */
export const OBJ_MATERIAL_NOTE = "OBJ は材質ファイル(.mtl)を読み込まないため、単色で表示されます。";
```

`APP_NAME` / `PROJECT_NAME_LABEL` / `MODEL_FILE_LABEL` / `MODEL_FILES_HELP_SUFFIX` /
`SUBMIT_LABEL` / `SUBMITTING_LABEL` / `NOT_FOUND_TITLE` / `NOT_FOUND_HOME` /
`NO_FILE_SELECTED` / `FILE_TOO_LARGE` の値は変更しない。

### 変更 web/src/app/UploadPage.tsx

2 箇所だけを変える。

1. `accept` のハードコードを定数由来にする。

```tsx
            accept={ALLOWED_MODEL_EXTENSIONS.join(",")}
```

2. 既存のヘルプ `<span>` の**直後**に、注記の `<span>` を 1 つ足す。既存の `<span>` は変更しない。

```tsx
          <span className="upload__help">
            {files.length > 0
              ? filesSummary(files)
              : `${fileHelp(ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT)}。${MODEL_FILES_HELP_SUFFIX}`}
          </span>
          <span className="upload__help">{OBJ_MATERIAL_NOTE}</span>
```

注記はファイル選択の有無にかかわらず**常に表示する**(条件分岐を付けない)。
`OBJ_MATERIAL_NOTE` を import に足すこと。フォーム送信処理・state・エラー表示は変更しない。

## 振る舞い

### web/tests/upload-labels.test.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `UPLOAD_LEAD` | `"glTF / GLB / FBX / OBJ をアップロードすると、共有用のレビュー URL が発行されます。"` |
| `UNSUPPORTED_EXTENSION` | `"対応しているモデル形式は .glb / .gltf / .fbx / .obj です。"` |
| `OBJ_MATERIAL_NOTE` | `"OBJ は材質ファイル(.mtl)を読み込まないため、単色で表示されます。"` |
| `ALLOWED_MODEL_EXTENSIONS.join(",")` | `".glb,.gltf,.fbx,.obj"`(`accept` にそのまま入る形) |
| `fileHelp(ALLOWED_MODEL_EXTENSIONS, 100 * 1024 * 1024)` | `".glb / .gltf / .fbx / .obj、100 MB まで"` |
| `fileHelp([".glb", ".gltf"], ...)` / `fileHelp([".glb"], ...)` の既存 2 行 | 現状どおり通る |
| `validateModelFiles([{ name: "a.fbx", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)` | `null` |
| `validateModelFiles([{ name: "a.OBJ", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)` | `null`(大文字小文字を問わない) |
| `validateModelFiles([{ name: "a.glb", size: 1 }, { name: "b.fbx", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)` | `null`(形式が混在してもよい) |
| `validateModelFiles([{ name: "a.stl", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)` | `UNSUPPORTED_EXTENSION` |
| `validateModelFiles([{ name: "a.fbx", size: 101 * 1024 * 1024 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)` | `FILE_TOO_LARGE`(拡張子検査が先に通る) |
| 既存の `validateModelFiles` の 6 行 | すべて現状どおり通る |
| その他の文言・`fileSummary` / `filesSummary` の既存 it | すべて現状どおり通る |

`ALLOWED_MODEL_EXTENSIONS` を `@shared/api` から import して使う(vitest の alias は設定済み)。

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| アップロード画面を開く | リード文に「glTF / GLB / FBX / OBJ」と出る |
| ファイル選択ダイアログを開く | `.glb` `.gltf` `.fbx` `.obj` の 4 種が選べる |
| ファイル未選択のヘルプ | 「.glb / .gltf / .fbx / .obj、100 MB まで。複数選択できます」と、その下に OBJ の注記 |
| ファイル選択後 | 上段がファイル要約に変わり、OBJ の注記は**そのまま残る** |
| `.stl` をドラッグして送信 | 「対応しているモデル形式は .glb / .gltf / .fbx / .obj です。」がアラートに出る |
| `.fbx` を 1 件選んで送信 | アップロードが成功しレビュー画面へ遷移する |
| `.glb` と `.obj` を同時に選んで送信 | 2 版のプロジェクトが作られる |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `accept` は `ALLOWED_MODEL_EXTENSIONS.join(",")` を**その場で式として書く**。
  別の定数に切り出したり、MIME タイプ(`model/gltf-binary` など)を足したりしないこと
- `UNSUPPORTED_EXTENSION` の区切りは `" / "` ではなく `" / "` を使った上記の文字列そのままとし、
  テストと完全一致させる。表記ゆれ(読点区切り、括弧付き)を作らないこと
- 注記は既存の `.upload__help` クラスを再利用する。新しいクラス名や CSS を足さない
- `validateModelFiles` / `fileHelp` / `fileSummary` / `filesSummary` の実装は 1 行も変えない。
  拡張子が増えても引数経由で正しく動く
- 形式ごとの上限サイズ分け、拡張子ごとの個別メッセージは作らない

## やらないこと
- `shared/` `server/` の変更(088 の担当)
- `web/src/features/viewer/` の変更(089 の担当)
- `upload.css` / `web/src/styles/` の変更
- ドラッグ&ドロップ対応、アップロード進捗表示、サムネイル生成
- `.mtl` / テクスチャを併せてアップロードする仕組み
- `client.ts` の `createProject` / `addModelVersion` の変更
- NotFound 画面の文言変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの定数名・文言・JSX で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] app_Summary.md を更新している。具体的には `UploadPage.tsx` の役割行を
      「`.glb`/`.gltf`/`.fbx`/`.obj` のアップロード画面。`accept` は `ALLOWED_MODEL_EXTENSIONS` 由来で、
      OBJ が材質なし表示になる注記を常時出す」に書き直し、公開インターフェイスの
      `upload-labels.ts` 行に `OBJ_MATERIAL_NOTE` を足し、テスト節の
      `tests/upload-labels.test.ts` の説明を実態に合わせる
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
