---
id: 071
title: web 右ドックの参加者とコメントの間に「オブジェクト」一覧を置き、表示・非表示の共有切替とファイル追加を行う
feature: web
depends_on: [068, 070]
owns: [web/src/features/objects/ObjectList.tsx, web/src/features/objects/objects-labels.ts, web/src/features/objects/objects.css, web/src/features/objects/objects_Summary.md, web/tests/objects-labels.test.ts, web/tests/objects-styles.test.ts, web/src/app/ReviewPage.tsx, web/src/app/review.css, web/src/app/app_Summary.md, web/web_Summary.md]
reads: [shared/src/protocol.ts, shared/src/types.ts, shared/src/api.ts, web/src/store/objects.ts, web/src/api/client.ts, web/src/app/upload-labels.ts, web/src/features/presence/PresenceList.tsx, web/src/features/presence/presence-labels.ts, web/src/features/presence/presence.css, web/src/styles/controls.css, web/src/styles/tokens.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, web/tests/viewer-styles.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
シーンにあるオブジェクト(版)を右ドックに一覧し、行ごとに 3D ビューの表示・非表示を
切り替えてルーム全員へ共有する。一覧からファイルを追加してシーンにオブジェクトを増やせるようにする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 070 の `useObjectsStore` に `objects`(number 昇順)、`hiddenIds`、`append`、`setVisible` があり、
  `isObjectVisible(hiddenIds, id)` がある。web/src/store/objects.ts
- 069 の `addModelVersion(projectId, file): Promise<ModelVersion>` と、
  `validateModelFiles(files, ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT): string | null` がある。
  web/src/api/client.ts, web/src/app/upload-labels.ts
- 067 のサーバは版追加成功時に `object:added` をルーム全員(自分を含む)へ配信し、
  070 の dispatch が `append` する。`append` は同 id を無視するので、REST 応答で `append` しても二重にならない
- 066 の `ClientMessage` に `{ type: "object:visibility"; versionId; visible }` がある。
  サーバ(068)は送信元以外へ中継するので、自分のストアは自分で更新する
- `send: (msg: ClientMessage) => boolean` は `ViewerHud({ send })` / `AnnotationLayer({ send })` と
  同じ受け渡し形式。戻り値は未接続時 false。web/src/features/annotation/AnnotationLayer.tsx:18
- 右ドックは `.review-panel` の2段グリッド(`grid-template-rows: auto 1fr`)で、
  `<PresenceList />` と `.review-panel__comments` を縦に並べている。web/src/app/review.css, ReviewPage.tsx:174-180
- 一覧の見た目は `PresenceList` と `presence.css` を踏襲する(見出し `.presence__heading`、
  行 `.presence__row`、`data-*` で状態表現)。クラス名は `objects__*` で新設し、presence の CSS は使い回さない
- CSS の規約: 生の色は `tokens.css` 以外で禁止、状態は `aria-*` / `data-*` で表現、
  `!important` / `@import` 禁止。`tests/styles-rules.test.ts` が機械検証する
- 新しい機能フォルダには `objects_Summary.md` が必須で、`web_Summary.md` の一覧に
  `src/features/objects/objects_Summary.md` を載せないと `tests/summary-coverage.test.ts` が落ちる
- `tests/viewer-styles.test.ts` のように、CSS のテキストをテストで検査するのがこのプロジェクトの流儀

## インターフェイス契約

```ts
// web/src/features/objects/objects-labels.ts
export const OBJECTS_HEADING = "オブジェクト";
export const VISIBLE_LABEL = "表示中";
export const HIDDEN_LABEL = "非表示";
export const ADD_FILES_LABEL = "ファイルを追加";
export const ADDING_LABEL = "追加中…";
export const ADD_FAILED = "ファイルの追加に失敗しました。";

/** "オブジェクト (N)" */
export function objectsHeading(count: number): string;
/** "v<number>" */
export function versionTag(version: { number: number }): string;
/** "<fileName> の表示を切り替え" */
export function toggleAriaLabel(version: { fileName: string }): string;
```

```tsx
// web/src/features/objects/ObjectList.tsx
export function ObjectList({ projectId, send }: {
  projectId: string;
  send: (msg: ClientMessage) => boolean;
}): ReactElement;
```

描画:
```html
<section class="objects" aria-label="オブジェクト">
  <h2 class="objects__heading">オブジェクト (2)</h2>
  <ul class="objects__list">
    <li class="objects__row" data-hidden="false">
      <span class="badge objects__tag" data-tone="neutral">v1</span>
      <span class="objects__name" title="robot.glb">robot.glb</span>
      <button class="btn btn--quiet objects__toggle" type="button" aria-pressed="true" aria-label="robot.glb の表示を切り替え">表示中</button>
    </li>
    ...
  </ul>
  <label class="objects__add">
    <input class="objects__file" type="file" multiple accept=".glb,.gltf" hidden />
    <span class="btn">ファイルを追加</span>   <!-- 追加中は disabled 相当の data-busy="true" とラベル「追加中…」 -->
  </label>
  <p class="alert" role="alert">...</p>   <!-- エラーがあるときだけ -->
</section>
```

- `aria-pressed` = 表示中なら true。ボタン文言は表示中 `VISIBLE_LABEL`、非表示 `HIDDEN_LABEL`
- 行の `data-hidden` は非表示なら "true"。非表示の行は名前を `--color-text-muted` にする
- 切替クリック: `setVisible(id, !visible)` してから `send({ type: "object:visibility", versionId: id, visible: !visible })`。
  `send` の戻り値は無視する(未接続でもローカルは切り替わる。再接続時の welcome で同期される)
- 追加: input の change で `validateModelFiles(files, ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT)`。
  非 null なら alert に表示して送らない。null なら `busy` を立て、**ファイルを順番に**
  `addModelVersion(projectId, file)` → 成功ごとに `append(version)`。失敗したらそこで止め、
  `ApiClientError` / `Error` の message(空なら `ADD_FAILED`)を alert に出す。終了後 `busy` を下ろし、input の value を空にする
- 一覧は `useObjectsStore` の `objects` の順(number 昇順)

`ReviewPage.tsx`: `<aside className="review-panel">` の中を
`<PresenceList />` → `<ObjectList projectId={projectId} send={realtime.send} />` → `.review-panel__comments` の順にする。

`review.css`: `.review-panel` を `grid-template-rows: auto auto minmax(0, 1fr)` にする。
`objects.css` は `ObjectList.tsx` から import する。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `objectsHeading(2)` | `"オブジェクト (2)"` |
| `versionTag({ number: 3 })` | `"v3"` |
| `toggleAriaLabel({ fileName: "a.glb" })` | `"a.glb の表示を切り替え"` |
| 定数の値 | 上記契約どおり(テストで固定) |
| `objects.css` | `.objects__row[data-hidden="true"]` セレクタがあり、`--color-text-muted` を使う。`.objects__file` は `display: none` にせず `hidden` 属性に任せる(セレクタを持たない)。生色を含まない(styles-rules) |
| `review.css` | `.review-panel` に `grid-template-rows: auto auto minmax(0, 1fr)` がある(テキスト検査) |
| `ReviewPage.tsx` | `<PresenceList />` の後、`review-panel__comments` の前に `<ObjectList` がある(ソース検査) |
| `objects_Summary.md` | 存在し、`web_Summary.md` に `src/features/objects/objects_Summary.md` が載っている(summary-coverage) |

コンポーネントの振る舞い(手動確認。React コンポーネントの自動テストは本プロジェクトでは行わない):

| 操作 | 期待する結果 |
| --- | --- |
| 行の「表示中」を押す | 自分の 3D ビューでそのオブジェクトが消え、ボタンが「非表示」、`aria-pressed=false`。同室の他の参加者でも消える |
| 他の参加者が切り替える | 自分の一覧のボタン表示と 3D ビューが追従する |
| 非表示のまま別の人が入室 | その人の一覧・ビューも非表示で始まる |
| 「ファイルを追加」で .glb を2つ選ぶ | 順に追加され、一覧に v(N+1)、v(N+2) が増え、3D ビューに描画される。同室の他の参加者にも増える |
| .txt を混ぜて選ぶ | `UNSUPPORTED_EXTENSION` の文言が alert に出て何も送られない |
| 追加中 | ボタンが「追加中…」になり再選択できない |

## やらないこと
- オブジェクトの削除・並べ替え・リネーム
- 一覧からの選択・フォーカス(カメラ移動)
- コメントの対象オブジェクト選択
- 可視性の localStorage 保存
- `PresenceList` / `CommentList` の変更
- `ViewerCanvas` / ストアの変更(070 で済んでいる)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る
- [ ] objects_Summary.md を作成し、app_Summary.md(ReviewPage、review.css)と web_Summary.md(索引)を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
