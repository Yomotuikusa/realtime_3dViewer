---
id: 181
title: ルーム共有の表示状態を DB に保存し、全員退室やサーバ再起動の後も復元する
feature: server
depends_on: [180]
owns: [shared/src/protocol.ts, shared/shared_Summary.md, shared/tests/protocol-display-fields.test.ts, server/src/db/schema.sql, server/src/db/room-display.ts, server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/src/index.ts, server/server_Summary.md, server/tests/db-room-display.test.ts, server/tests/room-display-restore.test.ts, server/tests/realtime-hub-persistence.test.ts]
reads: [server/src/db/connection.ts, server/src/db/projects.ts, server/src/realtime/room-state.ts, server/src/realtime/ws.ts, server/tests/room-display.test.ts, server/tests/realtime-hub-forget.test.ts, server/tests/realtime-hub-light.test.ts, server/tests/helpers/tmp.ts, shared/src/types.ts, shared/src/trail.ts, shared/src/object-part.ts, shared/tests/protocol.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
ライトの向き・明るさ、非表示の版と部位、メッシュ表示方法、比較設定、ジョイント・軌跡の表示設定、再生対象
(= `RoomDisplayState`)は RoomHub のメモリにしかない。最後の参加者が退室するとルームごと消え
(`server/src/realtime/hub.ts:70`)、サーバを再起動しても消える。これを project 単位で DB に保存し、
ルームを作り直すときに復元して、プロジェクトの見え方が保存されるようにする。

## 前提
- 表示状態の型・更新・welcome 用の書き出しは `server/src/realtime/room-display.ts` に集約されている。
  `displayWelcomeFields(state)` は未設定・空のキーを省いた、JSON にそのまま載る複製を返す(`room-display.ts:105-117`)。
  **保存形式はこの `DisplayWelcomeFields` をそのまま JSON にしたものとする**
- `hiddenParts` は `Map<objectPartKey(part), ObjectPartRef>` で、挿入順を保つ(`room-display.ts:18-19`、
  `shared/src/object-part.ts` の `objectPartKey`)
- welcome の表示フィールドのスキーマは、いまは `ServerMessageSchema` の welcome 要素の中に直書きされている
  (`shared/src/protocol.ts:132-146`)。本タスクでこれを `DisplayStateFieldsSchema` として切り出し、welcome からはその `.shape` を展開して使う。
  **`ClientMessage` / `ServerMessage` の union の variant は増減させない**(hub.ts と realtime-dispatch.ts の網羅性検査には影響しない)
- RoomHub は ws 非依存の純粋クラスで、`new RoomHub(options)` の options はすべて省略可能(`hub.ts:28-49`)。
  既存の hub テストはすべて options なしか `now` / `newId` / `guestDigits` だけで作っている。**displayStore を渡さないときの挙動は一切変えない**
- ルームは最初の join で `createRoom()` から作られ(`hub.ts:186-195`)、最後の参加者の disconnect で消える(`hub.ts:69-70`)
- `hub.forgetObject(projectId, versionId)` は REST の版削除後に `server/src/index.ts:23-26` の publish 経由で呼ばれる。
  いまはルームが無いと何もしない(`hub.ts:173-176`)
- `ws.ts` の `socket.on("message")` の中で `hub.handle` が例外を投げると、捕捉されずにプロセスが落ちる。
  **保存の失敗を hub.handle の外へ投げてはならない**(DB 側のアダプタでログを出して止める。契約参照)
- 180 の project 削除は comments・model_versions・projects を消し、projects を参照する表は `ON DELETE CASCADE` で消える。
  削除された project の参加者がまだ接続中なら、ルームはメモリに残り、表示操作は続けて届く
- ログは `console.*(JSON.stringify({ level, msg, ... }))` の 1 行形式(`server/src/index.ts:34-39`、`server/src/app.ts:84-94`)
- ストローク(`Room.strokes`)と Presence は揮発のままでよい(設計書 §11「揮発データ(presence / camera / 描画中の線)は WS」)

## インターフェイス契約

### `shared/src/protocol.ts`

```ts
/** welcome に載るルーム共有の表示状態のフィールド。すべて省略可能 */
export type DisplayStateFields = Pick<
  Extract<ServerMessage, { type: "welcome" }>,
  "light" | "lightBrightness" | "hiddenObjectIds" | "hiddenObjectParts" | "meshDisplay"
  | "meshCompare" | "jointDisplay" | "motionTrail" | "playbackSource"
>;

export const DisplayStateFieldsSchema = z.object({
  light: LightAnglesSchema.optional(),
  lightBrightness: LightBrightnessSchema.optional(),
  hiddenObjectIds: z.array(IdSchema).optional(),
  hiddenObjectParts: z.array(ObjectPartRefSchema).optional(),
  meshDisplay: MeshDisplayModeSchema.optional(),
  meshCompare: MeshCompareSchema.optional(),
  jointDisplay: JointDisplaySchema.optional(),
  motionTrail: MotionTrailSchema.optional(),
  playbackSource: IdSchema.optional(),
}) satisfies z.ZodType<DisplayStateFields>;
```

welcome の要素は `z.object({ type: z.literal("welcome"), selfId, users, strokes, ...DisplayStateFieldsSchema.shape })` にする
(受け付ける値は変えない)。

### schema.sql(追加)

```sql
CREATE TABLE IF NOT EXISTS project_room_state (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  display_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### `server/src/realtime/room-display.ts`(追加)

```ts
/** 表示状態の保存先。RoomHub に注入する */
export interface RoomDisplayStore {
  /** 保存が無い(または読めない)なら null */
  load(projectId: string): DisplayWelcomeFields | null;
  /** 例外を投げない(失敗時はアダプタがログを出す) */
  save(projectId: string, fields: DisplayWelcomeFields): void;
}

/**
 * 保存済みフィールドから表示状態を作る。null なら createRoomDisplayState() と同じ。
 * 値はすべて複製し、hiddenObjectIds・hiddenObjectParts の順序を保つ(部位のキーは objectPartKey)。
 * displayWelcomeFields(restoreRoomDisplayState(f)) は f と等しい。
 */
export function restoreRoomDisplayState(fields: DisplayWelcomeFields | null): RoomDisplayState;
```

### `server/src/realtime/hub.ts`(変更)

```ts
export interface RoomHubOptions {
  now?: () => number;
  newId?: () => string;
  guestDigits?: () => string;
  /** 指定したときだけ表示状態を保存・復元する */
  displayStore?: RoomDisplayStore;
}
```
- ルームを新しく作る join で、`room.display = restoreRoomDisplayState(displayStore.load(projectId))` にしてから welcome を作る
- 表示を変える 9 種(`light` 〜 `playback:source`)を `applyDisplayMessage` した直後に
  `displayStore.save(projectId, displayWelcomeFields(room.display))`
- `forgetObject`:ルームがあれば従来どおり消してから save。ルームが無く store があれば、load → null なら何もしない、
  そうでなければ `restoreRoomDisplayState` → `forgetObjectInDisplay` → save
- camera・stroke・join・disconnect では save しない

### `server/src/db/room-display.ts`(新規)

```ts
import type { DisplayWelcomeFields, RoomDisplayStore } from "../realtime/room-display";

/**
 * 行が無ければ null。JSON として読めない、または DisplayStateFieldsSchema に合わないときは
 * console.warn に {"level":"warn","msg":"room_display_invalid","projectId":...} を 1 行出して null。
 */
export function loadRoomDisplay(db: Db, projectId: string): DisplayWelcomeFields | null;

/**
 * upsert する。project が存在しないときは行を作らず、例外も投げない:
 *   INSERT INTO project_room_state (project_id, display_json, updated_at)
 *   SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?)
 *   ON CONFLICT(project_id) DO UPDATE SET display_json = excluded.display_json, updated_at = excluded.updated_at
 * (SELECT に WHERE を付けたままにする。WHERE が無いと SQLite は ON を結合条件と解釈する)
 */
export function saveRoomDisplay(db: Db, projectId: string, fields: DisplayWelcomeFields, updatedAt: number): void;

/**
 * load は loadRoomDisplay、save は saveRoomDisplay(updatedAt = now())。
 * save で例外が出たら console.error に {"level":"error","msg":"room_display_save_failed","projectId":...,"error":<message>}
 * を 1 行出し、再送出しない。
 */
export function createRoomDisplayStore(db: Db, now: () => number): RoomDisplayStore;
```

### `server/src/index.ts`
`new RoomHub({ displayStore: createRoomDisplayStore(db, () => Date.now()) })` にする。ほかは変えない。

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `restoreRoomDisplayState(null)` | `createRoomDisplayState()` と等しい |
| 9 フィールドすべてを持つ f で `displayWelcomeFields(restoreRoomDisplayState(f))` | f と `toEqual`。hiddenObjectIds・hiddenObjectParts の順序も同じ |
| restore 後に元の f の配列・オブジェクトを書き換える | 復元した状態は変わらない(複製) |
| `DisplayStateFieldsSchema` に `{}` | 成功 |
| `DisplayStateFieldsSchema` に `lightBrightness` が範囲外・`meshDisplay: "x"` | 失敗 |
| 既存の welcome テスト(`shared/tests/protocol*.test.ts`) | 変更なしで通る |
| 保存なしの project に最初の join | welcome に表示フィールドが無い(従来どおり) |
| store 付きの hub で `light` を送る | `save(projectId, { light })` が 1 回呼ばれる |
| `object:visibility`(false)→ `mesh:compare` の順に送る | 2 回目の save の引数に hiddenObjectIds と meshCompare の両方が入る |
| `camera`・`stroke:add`・`stroke:clear` | save は呼ばれない |
| light を変えて全員退室 → 別の接続で join | welcome.light が保存した値 |
| 同じ store を渡した**新しい RoomHub**(再起動相当)で join | welcome に保存した表示フィールドが載る。strokes は `[]` |
| ルームがある状態で `forgetObject(p, "v1")` | 従来どおり参照を消し、save の引数に v1 が含まれない |
| ルームが無く、保存に v1 の非表示・比較の baseId・再生対象がある状態で `forgetObject(p, "v1")` | load → v1 の参照を消した状態で save。次の join の welcome に v1 が現れない |
| ルームも保存も無い状態で `forgetObject` | save は呼ばれない |
| displayStore なしの RoomHub | 既存の hub テストがすべて変更なしで通る |
| `saveRoomDisplay` → `loadRoomDisplay`(実 DB) | 保存したフィールドがそのまま返る |
| 同じ project に 2 回 save | 行は 1 つで、2 回目の内容と updated_at |
| 存在しない project に save | 例外なし、行は作られない |
| display_json が `"{"`(壊れた JSON)・`{"meshDisplay":"x"}` | null を返し、console.warn に `room_display_invalid` が 1 回出る |
| display_json に未知のキーがある | 未知のキーを除いて読み込める |
| 版・コメントの無い project を `DELETE FROM projects` | その project の project_room_state の行も消える |
| `createRoomDisplayStore` の save で DB が閉じているなど例外 | 例外は外へ出ず、console.error に `room_display_save_failed` が 1 回出る |

## やらないこと
- ストローク・Presence・カメラの永続化
- 書き込みの間引き(debounce)。表示操作は client 側で送信間隔が制限されているので、変更のたびに保存する
- 削除された project のルームを閉じる・接続中の参加者へ通知する(別途起票予定)
- `ClientMessage` / `ServerMessage` の variant の追加・変更、web 側の変更
- `server/src/realtime/ws.ts`・`room-state.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] server_Summary.md(project_room_state、db/room-display.ts、hub の displayStore)と shared_Summary.md を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
