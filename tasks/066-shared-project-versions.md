---
id: 066
title: shared Project に全版一覧 versions を追加し、オブジェクト可視性と版追加の WS メッセージを定義する(server / web の網羅性検査と Project 組み立て箇所の最小追随を含む)
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/protocol.ts, shared/tests/types.test.ts, shared/tests/protocol.test.ts, shared/tests/types-bounds.test.ts, shared/shared_Summary.md, server/src/db/projects.ts, server/src/realtime/hub.ts, server/tests/helpers/app.ts, server/tests/db-projects.test.ts, server/tests/realtime-hub-objects.test.ts, server/server_Summary.md, web/src/app/realtime-dispatch.ts, web/tests/realtime-dispatch.test.ts, web/tests/api-client.test.ts, web/src/app/app_Summary.md]
reads: [shared/src/index.ts, shared/src/api.ts, shared/tests/lighting.test.ts, server/src/realtime/ws.ts, server/tests/realtime-hub-light.test.ts, server/tests/routes-projects-read.test.ts, web/src/api/client.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
1つのシーン(project)に複数のモデルファイル(= `model_versions` の行)を置き、
右ドックの「オブジェクト」一覧と、その表示・非表示をルームで共有する。
その土台として、shared の `Project` に全版一覧を持たせ、WS メッセージを3種追加する。
併せて、この型変更で壊れる server / web の箇所を**同じコミットで最小限**追随させる
(server: `Project` を組み立てる2箇所と RoomHub の網羅 switch、web: dispatch の網羅 switch とテスト fixture)。
機能としての実装(一括アップロード・可視性の保持・web のストアと UI)は 067〜071 で行う。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### なぜ shared / server / web を1タスクにまとめてあるのか(060 と同じ理由)

`verify` の `npm run typecheck` は `tsc shared && tsc server && tsc web` の直列実行である。
`ClientMessage` / `ServerMessage` の union に種類を足すと、次の2つの**網羅性検査**が落ちる
ことが計画時に実測済みである(060 の前提と同じ)。

- `RoomHub.handle()` の `switch (msg.type)` に default が無く、union が増えると
  `TS2366: Function lacks ending return statement` になる。server/src/realtime/hub.ts:113-142
- web の `dispatchServerMessage` の `default: msg satisfies never`。web/src/app/realtime-dispatch.ts:55-57

さらに `Project.versions` を必須にすると、`Project` を組み立てている
`server/src/db/projects.ts:84-89` と `server/tests/helpers/app.ts:76-81` が `TS2741` で落ち、
`ProjectSchema` で有効値を検証している `shared/tests/types-bounds.test.ts:89-100`、
`findProject` の戻り値を `toEqual` で固定している `server/tests/db-projects.test.ts:113-118`、
`ProjectSchema` で応答を parse する web の API クライアントを
`versions` 無しの fixture で試す `web/tests/api-client.test.ts:14-26` が落ちる。
**したがって union 追加とハンドラ、必須化と組み立て箇所は同じコミットに入れるしかない。
タスクを分割しようとしないこと。owns はそのために server / web まで広げてある。**

### shared の既存の形

- `Project` は現在 `latestVersion: ModelVersion` の1件だけを持つ。shared/src/types.ts:44-49
- `ModelVersion` と `ModelVersionSchema` は既にある。shared/src/types.ts:35-42, :132-139
- `ProjectSchema` は `satisfies z.ZodType<Project>` で型整合を検証している。shared/src/types.ts:141-146
- protocol.ts の `ClientMessage` / `ServerMessage` は discriminated union で、
  `ClientMessageSchema` / `ServerMessageSchema` も同じ順序で並ぶ。shared/src/protocol.ts:21-72
- protocol.ts のローカル `IdSchema` は `z.string().min(1)` である(types.ts の `IdSchema` とは別物)。
  新しいメッセージの `versionId` / `hiddenObjectIds` の要素にはこのローカル `IdSchema` を使う。
- `shared/tests/protocol.test.ts:75` の "accepts all ten server message variants" は
  server メッセージの種類数を固定している。本タスクで 12 種になるので、テスト名と内容を更新する。
- `shared/src/index.ts` は `export *` なので変更不要。
- **オブジェクト = `model_versions` の1行**である。新しい型 `SceneObject` などは作らない。
- 可視性はサーバ(RoomHub)がルーム単位で「非表示の versionId の集合」として保持し、
  welcome に載せる(068 で実装)。本タスクの RoomHub は**中継だけ**で、状態を持たない。

### server の既存の形

- `findProject` は `ORDER BY number DESC LIMIT 1` で最新版1件だけを取り、版ゼロなら null を返す。
  server/src/db/projects.ts:63-90。`toModelVersion(row)` が行→`ModelVersion` の変換。
- `seedProject` は `Project` リテラルを組み立てて返す。server/tests/helpers/app.ts:65-83
- `routes-projects-read.test.ts:18-25` は `GET /api/projects/:id` の応答を `ProjectSchema.parse` で
  検証している。`findProject` が `versions` を返せばそのまま通る(変更不要)。
- RoomHub の `case "light"` は状態保持 + `others` へ中継の形。server/src/realtime/hub.ts:127-131。
  本タスクの `object:visibility` は**中継だけ**なので、状態保持部分は真似ない。
- `ws.ts` は `hub.handle` の戻り値 `Outbound[]` をそのまま配る。変更不要。
- ライトの RoomHub テストは `server/tests/realtime-hub-light.test.ts` にあり、
  `join` ヘルパと `new RoomHub({ newId })` の作り方はこれに倣う。
- `hub.ts` は 241 行。本タスクの追加は case 1つ(5行程度)に収める。

### web の既存の形

- `dispatchServerMessage` は各ストアの `getState()` を取って switch で振り分ける。
  web/src/app/realtime-dispatch.ts:8-58
- `web/src/api/client.ts:72,76` は `createProject` / `getProject` の応答を `ProjectSchema` で
  parse する。`web/tests/api-client.test.ts:14-26` の `project` fixture は `versions` を持たない
  ため、本タスクで `versions: [<latestVersion と同じオブジェクト>]` を足す(他は変更しない)。
- web のオブジェクトストア(`web/src/store/objects.ts`)は 070 で作る。本タスクでは
  新メッセージを**何もしないで受ける**(no-op)。

## インターフェイス契約

```ts
// shared/src/types.ts
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  /** versions の末尾要素と同じもの。既存呼び出し側との互換のため残す */
  latestVersion: ModelVersion;
  /** project に属する全版。number 昇順。1件以上 */
  versions: ModelVersion[];
}

export const ProjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  createdAt: TimestampSchema,
  latestVersion: ModelVersionSchema,
  versions: z.array(ModelVersionSchema).min(1),
}).refine(
  (project) => project.versions[project.versions.length - 1]?.id === project.latestVersion.id,
  { message: "latestVersion must be the last element of versions" },
) satisfies z.ZodType<Project>;
```

```ts
// shared/src/protocol.ts
export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "camera"; camera: CameraState; focalLength?: number }
  | { type: "light"; angles: LightAngles }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear" }
  /** 自分が versionId のオブジェクトの表示・非表示を切り替えた */
  | { type: "object:visibility"; versionId: string; visible: boolean };

export type ServerMessage =
  | {
      type: "welcome";
      selfId: string;
      users: PresenceUser[];
      strokes: Stroke[];
      light?: LightAngles;
      /** ルームで非表示になっているオブジェクトの versionId。空なら省略される */
      hiddenObjectIds?: string[];
    }
  | { type: "user:joined"; user: PresenceUser }
  | { type: "user:left"; userId: string }
  | { type: "camera"; userId: string; camera: CameraState; focalLength?: number }
  | { type: "light"; userId: string; angles: LightAngles }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear"; userId: string }
  | { type: "comment:created"; comment: Comment }
  | { type: "comment:updated"; comment: Comment }
  /** userId が versionId の表示・非表示を切り替えた(送信元以外へ中継) */
  | { type: "object:visibility"; userId: string; versionId: string; visible: boolean }
  /** REST でオブジェクトが追加された(ルーム全員へ配信) */
  | { type: "object:added"; version: ModelVersion }
  | { type: "error"; code: string; message: string };
```

スキーマは上記と 1:1 で `ClientMessageSchema` / `ServerMessageSchema` に追加する。
`hiddenObjectIds` は `z.array(IdSchema).optional()`、`version` は `ModelVersionSchema`。
既存の定数(`MAX_NAME_LENGTH`、`CAMERA_SEND_INTERVAL_MS`、`LIGHT_SEND_INTERVAL_MS`)と
`parseClientMessage` / `parseServerMessage` は変更しない。

```ts
// server/src/db/projects.ts
/** project の全版を number 昇順で返す。project が無ければ空配列 */
export function listModelVersions(db: Db, projectId: string): ModelVersion[];

/** versions(number 昇順)と latestVersion(= versions の末尾)を含む Project。project 不在・版ゼロなら null */
export function findProject(db: Db, projectId: string): Project | null;

// insertProject / insertModelVersion / findModelVersion / toModelVersion は変更しない
```

```ts
// server/tests/helpers/app.ts
// seedProject の戻り値 project は versions: [version] を持つ。シグネチャは変更しない
export function seedProject(t: TestApp, opts?: { fileName?: string; bytes?: Uint8Array }):
  { project: Project; version: ModelVersion };
```

```ts
// server/src/realtime/hub.ts — handle() の switch に case を1つ足すだけ。Room・その他のメソッドは変更しない
//   case "object:visibility":
//     return [{ target: "others", msg: { type: "object:visibility", userId: connId, versionId: msg.versionId, visible: msg.visible } }];
```

```ts
// web/src/app/realtime-dispatch.ts — switch に no-op の case を足すだけ。welcome の hiddenObjectIds は読まない
//   case "object:visibility":
//   case "object:added":
//     break;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ProjectSchema.safeParse` に `versions` が無い | 拒否 |
| `versions: []` | 拒否 |
| `versions` が1件で、その id が `latestVersion.id` と同じ | 受理 |
| `versions` が2件で、末尾の id が `latestVersion.id` と同じ | 受理 |
| `versions` が2件で、先頭の id だけが `latestVersion.id` と同じ | 拒否(refine) |
| `versions` の要素が `ModelVersionSchema` を満たさない | 拒否 |
| `types-bounds.test.ts` の既存 `ProjectSchema` 検証2箇所 | fixture に `versions: [modelVersion]` を足し、既存の合否(名前長の境界)がそのまま維持される |
| `ClientMessageSchema` に `{ type: "object:visibility", versionId: "v1", visible: false }` | 受理 |
| 同上で `versionId: ""` | 拒否 |
| 同上で `visible` が文字列 `"false"` | 拒否 |
| `ServerMessageSchema` に `welcome` で `hiddenObjectIds` なし | 受理。parse 結果にキーが存在しない |
| `welcome` で `hiddenObjectIds: ["v1", "v2"]` | 受理。配列がそのまま残る |
| `welcome` で `hiddenObjectIds: [""]` | 拒否 |
| `ServerMessageSchema` に `{ type: "object:visibility", userId, versionId, visible }` | 受理 |
| `ServerMessageSchema` に `{ type: "object:added", version: <ModelVersion> }` | 受理 |
| 同上で `version` が不正 | 拒否 |
| `parseClientMessage` / `parseServerMessage` に新メッセージの JSON 文字列 | `ok: true` で型付きの msg を返す |
| `listModelVersions` で版が3つある project | number 昇順3件 |
| `listModelVersions` で未知の projectId | `[]` |
| `findProject` で版が2つある project(既存 db-projects テスト) | `{ id, name, createdAt, latestVersion: second, versions: [first, second] }` に `toEqual` |
| `findProject` で版ゼロ / project 不在 | `null`(既存どおり) |
| `seedProject` の戻り値 `project` | `versions: [version]` を持ち、`ProjectSchema.safeParse` が受理する |
| `GET /api/projects/p1`(既存 routes-projects-read テスト) | 変更なしで通る(応答が `ProjectSchema.parse` を満たす) |
| RoomHub: join 済み a が `{ type: "object:visibility", versionId: "v1", visible: false }` を送る | `[{ target: "others", msg: { type: "object:visibility", userId: "a", versionId: "v1", visible: false } }]` |
| RoomHub: 同上を受けても | その後 b が join したときの welcome に `hiddenObjectIds` キーが無い(状態を持たない。068 で実装) |
| RoomHub: join 前の接続 / 未知の接続からの `object:visibility` | `[]` |
| web dispatch に `{ type: "object:visibility", userId: "u2", versionId: "v1", visible: false }` | 例外なし。session / presence / annotation / comments / lighting の各ストアが変化しない |
| web dispatch に `{ type: "object:added", version }` | 同上 |
| web dispatch に `welcome` で `hiddenObjectIds: ["v1"]` | 既存の welcome 処理(self / users / strokes / light)がそのまま行われる |
| `web/tests/api-client.test.ts` の既存テスト | fixture に `versions` を足し、全件そのまま通る |

## やらないこと
- 一括アップロード・版追加 API・`publish(object:added)`(067)
- RoomHub の可視性状態の保持と welcome への反映(068)
- web の `objects` ストア・複数モデル描画・オブジェクト一覧 UI(069〜071)
- `Project` から `latestVersion` を取り除くこと(互換のため残す)
- 可視性を永続化する型やスキーマの追加(DB には保存しない)
- `server/src/routes/**`、`web/src/api/client.ts`、`web/src/store/**` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md の型・スキーマ・protocol の記述、server_Summary.md の db/projects・RoomHub・テスト一覧(realtime-hub-objects.test.ts を追加)、app_Summary.md の realtime-dispatch の記述を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
