---
id: 060
title: shared/server/web ライトの向きをルーム全員で共有する(受信側)
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/protocol.ts, shared/tests/protocol.test.ts, shared/tests/lighting.test.ts, shared/shared_Summary.md, server/src/realtime/hub.ts, server/tests/realtime-hub-light.test.ts, server/server_Summary.md, web/src/features/viewer/lighting.ts, web/src/features/viewer/viewer_Summary.md, web/src/store/lighting.ts, web/src/store/store_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/app_Summary.md, web/tests/store-lighting.test.ts, web/tests/realtime-dispatch.test.ts]
reads: [shared/src/index.ts, shared/tests/types.test.ts, server/src/realtime/ws.ts, server/tests/realtime-hub.test.ts, server/tests/realtime-hub-focal.test.ts, web/src/app/review-stores.ts, web/src/features/viewer/SceneLights.tsx, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/viewer-pointer.ts, web/tests/summary-coverage.test.ts, web/tests/lighting.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
ライトの向きは今 `web/src/store/lighting.ts` のローカルストアにしかなく、WebSocket に一切
乗っていない。そのため同じモデルを見ていても参加者ごとに陰影が違う。ライトの向きを
**ルーム単位で1つの共有値**にし、誰かが回したら同室の全員の画面でライトが動くようにする。

このタスクは **受信側**(型・スキーマ・メッセージ・サーバの保持と中継・web の適用)だけを作る。
自分の変更をサーバへ送る側は 061 で行う。したがってこのタスク完了時点では、
**手元でライトを回しても他の参加者には伝わらない**(サーバから来た値を適用する口だけができる)。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

### なぜ shared / server / web を1タスクにまとめてあるのか

このリポジトリの慣例(038 shared → 039 server → 043 web)に反して3つに割れない。
`ClientMessage` に `light` を1つ足すだけで `npm run typecheck`
(= `tsc shared && tsc server && tsc web` の直列実行)が落ちることを計画時に実測してある。

```
server/src/realtime/hub.ts(101,47): error TS2366: Function lacks ending return statement
  and return type does not include 'undefined'.
```

`RoomHub.handle()` の `switch (msg.type)`(server/src/realtime/hub.ts:111-140)と web の
`dispatchServerMessage` の `default: msg satisfies never`(web/src/app/realtime-dispatch.ts:45-47)が
どちらも union の網羅性検査になっているため、**protocol の union 追加とこの2つのハンドラは
同じコミットに入れるしかない**。038 が3分割できたのは `focalLength?` という任意フィールドの
追加で union が増えなかったからである。**タスクを分割しようとしないこと。**

### 既存の形

- `ClientMessage` / `ServerMessage` は `z.discriminatedUnion("type", [...])` のスキーマと
  1:1 で書かれている。`satisfies z.ZodType<ClientMessage>` で型整合が検証される。
  shared/src/protocol.ts:17-35, 38-67
- zod は 4.5.4。**`z.number()` は NaN と ±Infinity をどちらも拒否する**(計画時に実測確認済み)。
  したがって有限数の検証に `.finite()` は要らない。
- `RoomHub` の `Room` は `{ users: Map, strokes: Map }` で、**参加者が0人になるとルームごと削除される**。
  server/src/realtime/hub.ts:38-41, 97-99
- `join()` は `welcome`(`target: "self"`)と `user:joined`(`target: "others"`)の2通を返す。
  server/src/realtime/hub.ts:188-205
- `handle()` の `case "camera"` は焦点距離の有無で返すオブジェクトを出し分けている。
  任意フィールドの載せ方はこの形に倣う。server/src/realtime/hub.ts:112-124
- web の lighting ストアは `angles` と `rotate` / `reset` だけを持つ。`resetReviewStores()` の
  対象に入っている。web/src/store/lighting.ts, web/src/app/review-stores.ts:8-15
- `normalizeYaw` は yaw を `[-π, π)` へ畳み、`clampPitch` は pitch を ±85° に丸める。
  どちらも有限数でなければ 0 を返す。web/src/features/viewer/lighting.ts:20-34
- `LightAngles` は今 web/src/features/viewer/lighting.ts で `interface` として定義され、
  store / LightGizmo / light-gizmo / SceneLights / viewer-pointer が
  `type LightAngles` を **このパスから** import している。
- web のテストは jsdom で `@testing-library` がない。**React コンポーネントのレンダリングテストは
  書けない**。検証できるのは純粋関数とストアだけ。web/vitest.config.ts
- `web/tests/summary-coverage.test.ts` が、src の全ファイルが最寄りの `_Summary.md` に相対パスで
  載っていること、`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っていることを
  機械的に検査する。**新しいテストファイルを足したら Summary にも書くこと。**

### 計画時に実測済みの事実

下記のインターフェイス契約どおりに実装したプロトタイプで
`npm run typecheck` と `npm run test` を実行し、**型検査が通り、既存の 413 テスト
(shared+server 109 / web 304)が1つも変更なしで通る**ことを確認してある。
既存テストを修正しなければならなくなったら、契約から外れている疑いがある。

## インターフェイス契約

### 変更 shared/src/types.ts

`Project` と `PresenceUser` の間(shared/src/types.ts:44-51 のあいだ)に型を足す。

```ts
/** ルームで共有するワールド固定ライトの向き(ラジアン)。 */
export interface LightAngles {
  /** 方位角。web 側は [-π, π) に正規化して持つ */
  yaw: number;
  /** 仰角。0 が水平、正が上方 */
  pitch: number;
}
```

`FocalLengthSchema`(shared/src/types.ts:93)と `StrokeSchema`(:95)のあいだにスキーマを足す。

```ts
/** ライトの向き。範囲は検証せず、有限数であることだけを保証する(適用側で正規化する) */
export const LightAnglesSchema = z.object({
  yaw: z.number(),
  pitch: z.number(),
}) satisfies z.ZodType<LightAngles>;
```

`PresenceUser` は**変更しない**。ライトは参加者ごとの値ではない。

### 変更 shared/src/protocol.ts

`CAMERA_SEND_INTERVAL_MS`(:15)の直後に定数を足す。

```ts
/** ライトの向きの送信間隔(ms)。061 の送信 throttle が使う */
export const LIGHT_SEND_INTERVAL_MS = 50;
```

union とスキーマに次を足す。`LightAnglesSchema` と `type LightAngles` の import も足す。

```ts
export type ClientMessage =
  | /* 既存はそのまま */
  | { type: "light"; angles: LightAngles };

export type ServerMessage =
  | { type: "welcome"; selfId: string; users: PresenceUser[]; strokes: Stroke[]; light?: LightAngles }
  | /* 既存はそのまま */
  | { type: "light"; userId: string; angles: LightAngles };
```

スキーマ側は次のとおり。`light` は `stroke:clear` の直後に置く。

```ts
// ClientMessageSchema
z.object({ type: z.literal("light"), angles: LightAnglesSchema }),

// ServerMessageSchema の welcome に1行足す
light: LightAnglesSchema.optional(),

// ServerMessageSchema
z.object({ type: z.literal("light"), userId: IdSchema, angles: LightAnglesSchema }),
```

### 変更 server/src/realtime/hub.ts

`Room` に1行足す。`join()` の `existingRoom ?? {...}`(:172-175)にも `light: null` を足す。

```ts
interface Room {
  users: Map<string, PresenceUser>;
  strokes: Map<string, Stroke>;
  /** ルームで共有するライトの向き。誰も変えていなければ null */
  light: LightAngles | null;
}
```

`handle()` の `switch` に `case "camera"` の直後、`case "stroke:add"` の前に足す。

```ts
case "light": {
  const angles: LightAngles = { yaw: msg.angles.yaw, pitch: msg.angles.pitch };
  room.light = angles;
  return [{ target: "others", msg: { type: "light", userId: connId, angles: { ...angles } } }];
}
```

`join()` の `welcome` は、`room.light` が非 null のときだけ `light` を載せる。

```ts
const users = [...room.users.values()].map(copyUser);
const strokes = [...room.strokes.values()].map(copyStroke);
return [
  {
    target: "self",
    msg: room.light === null
      ? { type: "welcome", selfId: connId, users, strokes }
      : { type: "welcome", selfId: connId, users, strokes, light: { ...room.light } },
  },
  { target: "others", msg: { type: "user:joined", user: copyUser(user) } },
];
```

`copyUser` / `usersIn` / `strokesIn` / `disconnect` は**変更しない**。

### 変更 web/src/features/viewer/lighting.ts

`LightAngles` の定義を削除し、shared のものを再エクスポートするだけにする。
**他のファイルの import 文は書き換えない**(このパスから引き続き取れる)。

```ts
import type { LightAngles, Vec3 } from "@shared/types";

export type { LightAngles };
```

`DEFAULT_LIGHT_ANGLES` / `MAX_LIGHT_PITCH` / `LIGHT_ROTATE_SPEED` / `LIGHT_DISTANCE` /
強度3定数 / `normalizeYaw` / `clampPitch` / `rotateLight` / `lightPosition` /
`fillLightPosition` は**すべてこのファイルに残す**。中身も変えない。

### 変更 web/src/store/lighting.ts

```ts
/** 直近の angles 更新の出どころ。061 の送信側がエコー防止に使う */
export type LightAnglesOrigin = "local" | "remote";

export interface LightingStoreState {
  angles: LightAngles;
  /** 初期値は "local" */
  origin: LightAnglesOrigin;
  /** サーバから受け取った向きを正規化して適用する。origin は "remote" */
  applyRemote(angles: LightAngles): void;
  /** rotateLight の規則でライトを回す。origin は "local" */
  rotate(deltaX: number, deltaY: number): void;
  /** DEFAULT_LIGHT_ANGLES へ戻す。origin は "local" */
  reset(): void;
}
```

`applyRemote` は `{ yaw: normalizeYaw(angles.yaw), pitch: clampPitch(angles.pitch) }` を
新しいオブジェクトとして入れる。引数は変更しない。

### 変更 web/src/app/realtime-dispatch.ts

シグネチャは変えない。`useLightingStore` を import し、`lighting` を他のストアと同じ形で取る。

- `case "welcome"` の `annotation.applyWelcome(msg.strokes)` の直後に
  `if (msg.light !== undefined) { lighting.applyRemote(msg.light); }`
- `case "light": lighting.applyRemote(msg.angles); break;` を追加する

## 振る舞い

### LightAnglesSchema(shared/tests/lighting.test.ts に新規追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ yaw: 0, pitch: 0 }` | 受理 |
| `{ yaw: -3.14, pitch: 1.48 }` | 受理 |
| `{ yaw: 1000, pitch: -1000 }` | 受理(範囲は検証しない) |
| `{ yaw: Number.NaN, pitch: 0 }` | 拒否 |
| `{ yaw: 0, pitch: Number.POSITIVE_INFINITY }` | 拒否 |
| `{ yaw: 0 }` / `{ pitch: 0 }` | 拒否 |
| `{ yaw: "0", pitch: 0 }` | 拒否 |
| `{ yaw: 0, pitch: 0, extra: 1 }` | 受理し、`data` に `extra` を含まない |

### protocol(shared/tests/protocol.test.ts に追加)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ClientMessageSchema` に `{ type: "light", angles: { yaw: 1, pitch: 0.5 } }` | 受理 |
| `ClientMessageSchema` に `{ type: "light", angles: { yaw: Number.NaN, pitch: 0 } }` | 拒否 |
| `ClientMessageSchema` に `{ type: "light" }` | 拒否 |
| `ServerMessageSchema` に `{ type: "light", userId: "user-1", angles }` | 受理 |
| `ServerMessageSchema` に `{ type: "light", angles }`(userId なし) | 拒否 |
| `ServerMessageSchema` の `welcome` に `light` なし | 受理し、`data` に `light` キーを含まない |
| `ServerMessageSchema` の `welcome` に `light: { yaw: 1, pitch: 0.5 }` | 受理し、その値を保つ |
| `parseClientMessage(JSON.stringify({ type: "light", angles }))` | `{ ok: true }` で `msg.angles` が一致 |
| `LIGHT_SEND_INTERVAL_MS` | `50` |

### RoomHub(server/tests/realtime-hub-light.test.ts に新規追加)

`hub.connect("p1")` の戻り値が connId になる。`newId` を差し替えて id を固定する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| join 済みの `a` が `{ type: "light", angles: { yaw: 1, pitch: 0.5 } }` | `[{ target: "others", msg: { type: "light", userId: "a", angles: { yaw: 1, pitch: 0.5 } } }]` |
| 上記の直後に `b` が join | `welcome` の `light` が `{ yaw: 1, pitch: 0.5 }` |
| 誰も light を送っていないルームへの join | `welcome` に `light` キーが存在しない(`"light" in msg === false`) |
| `a` が light を送ったあと `b` が別の light を送る | `room` の値が後勝ち。次の join の `welcome` が `b` の値 |
| light 送信後に返った `angles` オブジェクトを書き換える | 次の `welcome` の値が変わらない(複製されている) |
| join していない接続からの `light` | `[]`(既存の `if (!connection.user) return []` のまま) |
| 存在しない connId からの `light` | `[]` |
| 別プロジェクト `p2` の join | `p1` の light を引き継がない(`welcome` に `light` なし) |
| 全員 disconnect したあと同じ projectId へ join | `welcome` に `light` なし(ルームごと消える) |
| `light` 送信が `usersIn()` の `PresenceUser` に与える影響 | なし(`light` プロパティは生えない) |
| `light` 送信が `strokesIn()` に与える影響 | なし |

### lighting ストア(web/tests/store-lighting.test.ts に追加)

既存の3テストは変更しない。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `origin` が `"local"` |
| `rotate(100, 0)` | `origin` が `"local"` |
| `reset()` | `origin` が `"local"` |
| `applyRemote({ yaw: 1, pitch: 0.5 })` | `angles` が `{ yaw: 1, pitch: 0.5 }`、`origin` が `"remote"` |
| `applyRemote({ yaw: Math.PI * 1.5, pitch: 0 })` | `angles.yaw` が `-Math.PI / 2`(`toBeCloseTo` 精度10) |
| `applyRemote({ yaw: 0, pitch: 100 })` | `angles.pitch` が `MAX_LIGHT_PITCH` |
| `applyRemote({ yaw: Number.NaN, pitch: Number.NaN })` | `angles` が `{ yaw: 0, pitch: 0 }` |
| `applyRemote(x)` 呼び出し後の引数 `x` | 変化しない。`angles` は `x` と別オブジェクト |
| `applyRemote` のあと `rotate(100, 0)` | `origin` が `"local"` に戻り、`applyRemote` の値から累積する |
| `applyRemote` のあと `reset()` | `angles` が `DEFAULT_LIGHT_ANGLES`、`origin` が `"local"` |

### dispatchServerMessage(web/tests/realtime-dispatch.test.ts に追加)

`beforeEach` に `useLightingStore.getState().reset()` を足す。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "light", userId: "u2", angles: { yaw: 1, pitch: 0.5 } }` | `angles` が `{ yaw: 1, pitch: 0.5 }`、`origin` が `"remote"` |
| `welcome` に `light: { yaw: 1, pitch: 0.5 }` | 同上。既存の selfId / presence / strokes の反映も従来どおり |
| `welcome` に `light` なし | `angles` が `DEFAULT_LIGHT_ANGLES` のまま、`origin` が `"local"` のまま |
| `{ type: "light", ... }` を受けたあと `error` を受ける | ライトの値が変わらない |

### 結線後の全体像(この表は直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| 他の参加者がライトを回した | 自分の画面のモデルとギズモの両方が追従して動く |
| 途中から入室した | その時点のルームのライトの向きで見え始める |
| 自分でライトを回した | 自分の画面だけが動く(送信は 061) |
| 全員が退室してから入り直した | ライトは既定の向きに戻っている |
| 別プロジェクトのレビュー画面 | ライトは共有されない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **ライトはルーム単位の1つの値**である。`PresenceUser` に生やさない。参加者ごとに持つと
  「誰の値が正か」が決まらず、`welcome` でどれを採用するかも決められない
- 競合は **後から届いた値が勝つ**(last writer wins)。順序制御・タイムスタンプ・
  排他ロックのたぐいを作らない
- **サーバは値を検証も正規化もしない**。スキーマを通った有限数をそのまま保持して中継する。
  範囲外の値の始末は適用側(`applyRemote`)の責務
- `applyRemote` は必ず `normalizeYaw` / `clampPitch` を通す。素の値を `angles` に入れない
- `origin` は 061 の送信側がエコー(受信した値を送り返す)を止めるためだけに存在する。
  このタスクでは値を正しく立てるところまでで、購読者はまだいない
- ライトの向きを SQLite に保存しない。ルームが消えれば失われる(線と同じ扱い)
- `web/src/app/review-stores.ts` は**変更しない**。lighting ストアは既に対象に入っている
- `server/src/realtime/ws.ts` は**変更しない**。新しいメッセージは既存の
  `parseClientMessage` → `hub.handle` → `sendOutbounds` の経路をそのまま通る
- 新規テストファイルは `shared/tests/lighting.test.ts` と
  `server/tests/realtime-hub-light.test.ts` の2つだけ。server のテストは
  `server/tests/realtime-hub-focal.test.ts` の `join()` ヘルパーと同じ書き方に倣う
- 4つの Summary(shared / server / store / app)と viewer_Summary.md を実態に合わせる。
  viewer_Summary.md は `lighting.ts` の行と公開インターフェイスの `LightAngles` に
  「型は `@shared/types` 由来(再エクスポート)」と分かる記述を入れるだけでよい

## やらないこと
- **タスクを shared / server / web に割り直さない**(上記のとおり typecheck が通らない)
- 自分の変更をサーバへ送らない。`light` メッセージを `send` する結線は 061 で行う
- `SceneLights.tsx` / `LightGizmo.tsx` / `light-gizmo.ts` / `viewer-pointer.ts` /
  `CameraRig.tsx` / `ViewerHud.tsx` / `viewer.css` を変更しない
- ライトの強度・色・種類・個数を変えない。影を有効にしない
- `PresenceUser` と `PresenceUserSchema` を変更しない
- `CameraState` / `CommentSchema` にライトを入れない(コメント再現でライトを復元しない)
- ライトの向きを localStorage や SQLite に永続化しない
- `hint()` の文言を変えない(「共有」と書き足さない)
- 既存の `camera` / `stroke:*` / `comment:*` メッセージの形を変えない
- `resetReviewStores()` の対象ストアを増減しない
- `camera-throttle.ts` / `useCameraBroadcast.ts` を変更しない(061 の担当)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] **既存のテストを1つも書き換えていない**(追加だけ。計画時に実測確認済み)
- [ ] `web/tests/summary-coverage.test.ts` が通る(新規テスト名が Summary にある)
- [ ] shared / server / store / app / viewer の各 Summary が実態に合っている
- [ ] すべてのファイルが300行以内(Summary を含む)
- [ ] `npm run typecheck && npm run test` が成功する
