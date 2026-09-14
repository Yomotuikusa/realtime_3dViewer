---
id: 088
title: shared/server FBX と OBJ をアップロード形式として受け入れる
feature: shared
depends_on: []
owns: [shared/src/api.ts, shared/tests/api.test.ts, shared/shared_Summary.md, server/src/routes/upload-validation.ts, server/tests/upload-validation.test.ts, server/src/routes/projects.ts, server/tests/routes-projects-upload.test.ts, server/tests/routes-projects-formats.test.ts, server/tests/routes-projects-read.test.ts, server/server_Summary.md]
reads: [shared/src/types.ts, server/src/routes/project-upload.ts, server/src/storage/files.ts, server/src/errors.ts, server/tests/helpers/app.ts, server/tests/routes-project-versions.test.ts, web/src/app/upload-labels.ts]
verify: npm run typecheck && npm run test:shared && npm run test:server
status: done
---

## 目的
現在アップロードできるモデル形式は `.glb` と `.gltf` の 2 つだけである。ここに `.fbx` と `.obj`
を加える。本タスクはサーバ側の受け入れ(拡張子・中身の検証・配信 Content-Type)と、その単一
ソースである shared の定数・判定関数までを担当する。

**shared と server を 1 タスクにまとめている理由**: `ALLOWED_MODEL_EXTENSIONS` を広げると、
`shared/tests/api.test.ts` の厳密一致(`toEqual([".glb", ".gltf"])`)と、`server` 側の
「`.fbx` は拒否される」という既存テスト 2 箇所が**同時に落ちる**。片方だけ先にマージすると
必ず赤になるため分割できない。

ビューア側の読み込み(089)とアップロード画面の文言(090)は本タスクに依存する別タスクである。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `ALLOWED_MODEL_EXTENSIONS = [".glb", ".gltf"] as const` が形式の**単一ソース**であり、
  server(`upload-validation.ts`)と web(`UploadPage.tsx`)の両方が import している。
  shared/src/api.ts:38
- `modelExtension(fileName)` は Node の `extname()` で小文字化した拡張子を返し、
  `ALLOWED_MODEL_EXTENSIONS` に無ければ `HttpError(400, "UNSUPPORTED_FORMAT")` を投げる。
  server/src/routes/upload-validation.ts:17-23
- `readUploadedModels` が `modelExtension()` の `UNSUPPORTED_FORMAT` だけを **415** に詰め替えて
  再送出する。本タスクではこの関数を変更しない。server/src/routes/project-upload.ts:24-33
- `assertModelBytes(ext, bytes)` は**空バイト列を常に拒否**したうえで、`.glb` は先頭 4 バイトの
  `glTF`、それ以外(= `.gltf`)は「UTF-8 fatal デコードできる JSON オブジェクトで `asset` キーを持つ」
  を検査する。server/src/routes/upload-validation.ts:26-58
- 保存パスは `dataDir/uploads/<versionId>.glb` で**形式によらず固定**である。
  中身は無変換でそのまま書かれ、元のファイル名は DB の `fileName` 列にだけ残る。
  server/src/storage/files.ts:18
- モデル配信の Content-Type は現在 `fileName` の `.gltf` 判定による 2 分岐のみ。
  server/src/routes/projects.ts:130-132
- `HttpError(status, code, message)` のコンストラクタ順。server/src/errors.ts
- `server/tests/helpers/app.ts:78` の `seedProject` は `fileName` の既定値を `"model.glb"` とする。
  本タスクではこの helper を変更しない
- `server/tests/routes-project-versions.test.ts` は `.glb` しか使っておらず、本タスクの変更で
  落ちない。**owns に入れていないので触らないこと**

### 本タスクの変更で落ちる既存テスト(必ず更新する)
- `shared/tests/api.test.ts:65` — `expect(ALLOWED_MODEL_EXTENSIONS).toEqual([".glb", ".gltf"])`
- `server/tests/upload-validation.test.ts:26-30` — `"a.fbx"` が `UNSUPPORTED_FORMAT` になる想定
- `server/tests/routes-projects-upload.test.ts:204-212`
  (`"rejects unsupported models before creating database rows or files"`)— `a.fbx` の POST が
  415 になる想定

### 行数の制約(重要)
`server/tests/routes-projects-upload.test.ts` は現在 **269 行**あり、上限 300 行に近い。
このファイルへ FBX / OBJ のテストを足すと確実に超過するため、**新規テストは
`server/tests/routes-projects-formats.test.ts` に書く**。既存ファイルへの変更は
上記 it の**ファイル名を 1 つ差し替えるだけ**にとどめ、行を増やさないこと。

新規ファイルは既存ファイルのローカルヘルパー(`testApp` / `modelFile` / `post` / `projectCount`
= `routes-projects-upload.test.ts:7-55`)のうち必要なものだけを同じ形で再定義する。
共通化のために既存ファイルや `tests/helpers/app.ts` を書き換えないこと(helpers は reads である)。

### 形式判定に使う事実(three のローダー実装から確認済み)
- バイナリ FBX の先頭は ASCII で `Kaydara FBX Binary  \0`(`Binary` の後ろに**半角スペース 2 つ**、
  末尾に NUL。合計 **21 バイト**)。three/examples/jsm/loaders/FBXLoader.js:4364-4370
- ASCII FBX は `FBXVersion: <数字>` 行を持つ。同 :4402-4416
- OBJ はテキストで、頂点行が `v ` で始まる

## インターフェイス契約

### 変更 shared/src/api.ts

```ts
export const ALLOWED_MODEL_EXTENSIONS = [".glb", ".gltf", ".fbx", ".obj"] as const;

/** 受け入れるモデル形式。ALLOWED_MODEL_EXTENSIONS の各要素から先頭のドットを除いたもの */
export type ModelFormat = "glb" | "gltf" | "fbx" | "obj";

/** 形式ごとのモデル配信 Content-Type */
export const MODEL_CONTENT_TYPES: Readonly<Record<ModelFormat, string>> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/octet-stream",
  obj: "text/plain; charset=utf-8",
};

/**
 * ファイル名の最後のドット以降を小文字で見て形式を返す。
 * ドットが無い / 位置 0(ドットファイル) / 対応外の拡張子なら null。
 * Node の path に依存しない(web からも使う)。
 */
export function modelFormat(fileName: string): ModelFormat | null;
```

- `ALLOWED_MODEL_EXTENSIONS` の**並び順は上記のとおり**にする(`.glb`, `.gltf`, `.fbx`, `.obj`)。
  090 がこの順で画面に出す
- `modelFormat` は `lastIndexOf(".")` で末尾拡張子を取る。`extname()` を使わない

### 変更 server/src/routes/upload-validation.ts

`ModelExt` を手書きの union からテンプレートリテラル型へ変える。以後、形式を増やすときに
shared の 1 箇所だけで追従する。

```ts
import { ALLOWED_MODEL_EXTENSIONS, type ModelFormat, type ErrorCode } from "@shared/api";

export type ModelExt = `.${ModelFormat}`;

/** Return the supported final extension after case-insensitive validation. */
export function modelExtension(fileName: string): ModelExt;

/** Validate the format-specific bytes before they are persisted. */
export function assertModelBytes(ext: ModelExt, bytes: Uint8Array): void;
```

`modelExtension` の実装(`extname()` を使う現在の形)は**変えない**。返り値のキャスト先だけが
広がる。`assertModelBytes` は空バイト列を先に弾く現在の構造を保ったまま、`ext` による
4 分岐にする(`switch` でも if 連鎖でもよい)。

### 形式ごとのバイト検証(assertModelBytes)

判定は次のとおりに固定する。ここから外れる判定を足さないこと。

| ext | 判定 |
| --- | --- |
| `.glb` | 先頭 4 バイトが `glTF`(0x67 0x6c 0x54 0x46)。**現在の実装のまま** |
| `.gltf` | 全体を UTF-8 fatal デコードして `JSON.parse` し、配列でも null でもないオブジェクトで `asset` を自前プロパティに持つ。**現在の実装のまま** |
| `.fbx` | 先頭 21 バイトが `Kaydara FBX Binary  \0` と一致する(バイナリ)。一致しなければ、先頭 **4096** バイトを UTF-8 で(**fatal なしで**)デコードし `FBXVersion:` を含む(ASCII)。どちらでもなければ不合格 |
| `.obj` | 先頭 **65536** バイトを UTF-8 で(**fatal なしで**)デコードし、`/^v\s/m` に一致する行がある |

- FBX / OBJ で `fatal: true` を使わないこと。先頭だけを切り出すと UTF-8 のマルチバイト境界で
  落ちる。形式の担保はマジックバイト / 頂点行の有無で行う
- 先頭バイトの切り出しは `bytes.subarray(0, n)` を使う(コピーしない)
- 不合格はすべて既存の `unsupportedFormat()`(= `HttpError(400, "UNSUPPORTED_FORMAT")`)で送出する。
  ステータスを 415 に変えない(415 への詰め替えは `project-upload.ts` の役目)

### 変更 server/src/routes/projects.ts

`GET /:projectId/versions/:versionId/model` の Content-Type 決定だけを差し替える。
他のルート・保存処理・エラー処理は一切変更しない。

```ts
const format = modelFormat(version.fileName);
const contentType = format ? MODEL_CONTENT_TYPES[format] : "application/octet-stream";
```

`Cache-Control` と `Content-Length` のヘッダ、`c.body(...)` の形は現状のまま。

## 振る舞い

### shared/tests/api.test.ts

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ALLOWED_MODEL_EXTENSIONS` | `[".glb", ".gltf", ".fbx", ".obj"]`(順序込みで `toEqual`) |
| `modelFormat("a.glb")` / `("a.gltf")` / `("a.fbx")` / `("a.obj")` | `"glb"` / `"gltf"` / `"fbx"` / `"obj"` |
| `modelFormat("a.GLB")` / `modelFormat("A.Fbx")` | `"glb"` / `"fbx"` |
| `modelFormat("a.b.obj")` | `"obj"`(最後のドットだけを見る) |
| `modelFormat("noext")` | `null` |
| `modelFormat(".glb")` | `null`(ドットの位置が 0) |
| `modelFormat("a.glb.zip")` / `modelFormat("a.stl")` / `modelFormat("")` | すべて `null` |
| `modelFormat("a.")` | `null` |
| `MODEL_CONTENT_TYPES` のキー | `ALLOWED_MODEL_EXTENSIONS` の各要素から先頭のドットを外したものと一致(両者を sort して比較) |
| `MODEL_CONTENT_TYPES.glb` / `.gltf` | `"model/gltf-binary"` / `"model/gltf+json"` |
| `MODEL_CONTENT_TYPES.fbx` / `.obj` | `"application/octet-stream"` / `"text/plain; charset=utf-8"` |
| `Object.values(ErrorCode)` | 6(既存アサーションを変えない) |

### server/tests/upload-validation.test.ts

既存の `"rejects unsupported or ambiguous extensions"` から `"a.fbx"` を**外す**。
`"noext"` と `"a.glb.zip"` は残し、`"a.stl"` を足す。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `modelExtension("a.FBX")` / `modelExtension("a.OBJ")` | `".fbx"` / `".obj"` |
| `modelExtension("a.stl")` / `("noext")` / `("a.glb.zip")` | 400 `UNSUPPORTED_FORMAT` |
| `.fbx` + `Kaydara FBX Binary  \0` + 任意の後続バイト | 合格(例外なし) |
| `.fbx` + `; FBX 7.4 project file\nFBXHeaderExtension:  {\n\tFBXVersion: 7400\n}` | 合格 |
| `.fbx` + `Kaydara FBX Binary ` (スペース 1 つ、NUL 無し) | 400 `UNSUPPORTED_FORMAT` |
| `.fbx` + `FBXHeaderExtension:  {` だけで `FBXVersion:` を含まないテキスト | 400 `UNSUPPORTED_FORMAT` |
| `.fbx` + `glTF1234` | 400 `UNSUPPORTED_FORMAT` |
| `.fbx` + 空の `Uint8Array` | 400 `UNSUPPORTED_FORMAT` |
| `.fbx` + `FBXVersion:` を **5000 バイト目以降**にだけ持つテキスト | 400 `UNSUPPORTED_FORMAT`(先頭 4096 バイトしか見ない) |
| `.obj` + `# comment\nv 0 0 0\nv 1 0 0\nf 1 2 3\n` | 合格 |
| `.obj` + 先頭が `v -1.5 0.0 2.25`(コメント無し) | 合格 |
| `.obj` + `mtllib a.mtl\nusemtl x\n`(頂点行なし) | 400 `UNSUPPORTED_FORMAT` |
| `.obj` + `vt 0 0\nvn 0 1 0\n`(`v ` で始まる行がない) | 400 `UNSUPPORTED_FORMAT` |
| `.obj` + 空の `Uint8Array` | 400 `UNSUPPORTED_FORMAT` |
| `.glb` / `.gltf` の既存 4 つの it | すべて現状どおり通る |

### server/tests/routes-projects-upload.test.ts(1 箇所だけ差し替える)

`"rejects unsupported models before creating database rows or files"` の
`modelFile(glbBytes(), "a.fbx")` を `modelFile(glbBytes(), "a.stl")` に変える。
**it 名・アサーション・他の行は一切変更しない。行を増やさないこと。**

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `POST /api/projects` に `a.stl` を 1 件 | 415 `UNSUPPORTED_FORMAT`。project 行 0 件、uploads ディレクトリが空 |
| 既存のその他の it | すべて現状どおり通る |

### 新規 server/tests/routes-projects-formats.test.ts

`describe("POST /api/projects (FBX / OBJ)")` として書く。FBX / OBJ の有効バイト列を作る
ローカルヘルパ(`fbxBytes()` / `objBytes()`)を先頭に置く。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 有効な**バイナリ** FBX を `a.fbx` で 1 件 POST | 201。`latestVersion.fileName` が `"a.fbx"`、`byteSize` が送ったバイト数 |
| 有効な **ASCII** FBX を `a.fbx` で 1 件 POST | 201 |
| 有効な OBJ テキストを `a.obj` で 1 件 POST | 201。`latestVersion.fileName` が `"a.obj"` |
| `a.glb`(有効 GLB)と `b.fbx`(有効 FBX)を同時に 2 件 POST | 201。versions が `[{number:1,fileName:"a.glb"},{number:2,fileName:"b.fbx"}]` |
| 中身が `glTF12345678` のまま名前だけ `a.fbx` で POST | 400 `UNSUPPORTED_FORMAT`。project 行 0 件、uploads が空 |
| 中身が `mtllib a.mtl\n` だけ(頂点行なし)の `a.obj` を POST | 400 `UNSUPPORTED_FORMAT`。project 行 0 件 |
| `a.obj`(有効)を 1 件 POST したあと、その project へ `b.fbx`(有効)を版追加 | 201。`number` が 2、`fileName` が `"b.fbx"` |

版追加は `POST /api/projects/:projectId/versions` に `file` 1 件の FormData を送る
(`server/tests/routes-project-versions.test.ts` の送り方を参考にする。同ファイルは変更しない)。

### server/tests/routes-projects-read.test.ts

Content-Type の既存 2 件(`.glb` → `model/gltf-binary`、`.gltf` → `model/gltf+json`)はそのままに、
次を足す。`seedProject` の `fileName` を変えるだけでよく、バイト列の中身は問わない。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `fileName: "a.fbx"` のモデルを GET | `content-type` が `application/octet-stream` |
| `fileName: "a.obj"` のモデルを GET | `content-type` が `text/plain; charset=utf-8` |
| `fileName: "a.bin"`(対応外の名前が DB にある場合) | `content-type` が `application/octet-stream` |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **保存パスは `uploads/<versionId>.glb` のまま変更しない。** 内部名であり形式に依存せず、
  変えると既存 uploads の移行が必要になる。`storage/files.ts` を触らないこと。
  代わりに `server_Summary.md` に「拡張子 `.glb` は内部名で、中身の形式とは無関係」と明記する
- `ModelExt` は `.${ModelFormat}` のテンプレートリテラル型にする。手書きの union に戻さない
- FBX のマジックは**先頭 21 バイト**。`Binary` の後ろのスペースは 2 つ、末尾は NUL(`\0`)である。
  文字列リテラルとして `"Kaydara FBX Binary  \0"` と書き、`TextEncoder` で比較しても、
  バイト配列を 1 つずつ比べてもよい
- `.obj` の判定に `/^v\s/m` を使う。`/^v /m` にすると `v\t` 区切りの OBJ を落とす
- MIME の `text/plain; charset=utf-8` は**この綴りで固定**(セミコロンの後に半角スペース 1 つ)。
  `routes-projects-read.test.ts` が完全一致で検査する
- サイズ上限(`MAX_UPLOAD_BYTES_DEFAULT` = 100MB)は形式ごとに変えない
- `assertModelBytes` を分岐で伸ばす結果 `upload-validation.ts` が 100 行前後になる見込み。
  上限 300 行に収まるので分割しないこと
- **`server/tests/routes-projects-upload.test.ts`(269 行)に行を足さないこと。**
  FBX / OBJ のテストはすべて新規の `routes-projects-formats.test.ts` に書く

## やらないこと
- `server/src/storage/files.ts` の保存パス・拡張子の変更
- `server/src/routes/project-upload.ts` の変更(415 への詰め替えは現状のまま動く)
- `server/tests/helpers/app.ts` の既定 `fileName` の変更
- `server/tests/routes-project-versions.test.ts` の変更
- web 側の一切の変更(アップロード画面は 090、ビューアの読み込みは 089)
- `.stl` / `.dae` / `.ply` / `.3ds` など今回の範囲外の形式の追加
- glTF の外部 `.bin` / テクスチャを一緒に保存する仕組み(現状どおり単一ファイルのみ)
- モデルの形式変換(FBX → glTF の変換など)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・定数名・値で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md を更新している。具体的には `src/api.ts` の役割行に `ModelFormat` /
      `modelFormat` / `MODEL_CONTENT_TYPES` を加え、公開インターフェイスの api 行にも 3 つを足す
- [ ] server_Summary.md を更新している。具体的には `src/routes/upload-validation.ts` の説明を
      「glTF/GLB/FBX/OBJ の拡張子・マジックバイト/JSON/頂点行の検査」に直し、
      `src/storage/files.ts` の行に「`.glb` は内部名で中身の形式とは無関係」と明記し、
      `src/routes/projects.ts` の Content-Type の説明を `MODEL_CONTENT_TYPES` 由来に直し、
      `tests/upload-validation.test.ts` / `tests/routes-projects-read.test.ts` の説明を実態に合わせ、
      `tests/routes-projects-formats.test.ts` の行を追加する
- [ ] `server/tests/routes-projects-upload.test.ts` の行数が 269 行から増えていない
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
