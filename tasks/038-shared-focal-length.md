---
id: 038
title: shared Presence に焦点距離(focalLength)を乗せる型とスキーマ
feature: shared
depends_on: []
owns: [shared/src/types.ts, shared/src/protocol.ts, shared/src/camera.ts, shared/tests/types.test.ts, shared/tests/protocol.test.ts, shared/tests/camera.test.ts, shared/shared_Summary.md]
reads: [web/web_Summary.md, server/server_Summary.md, server/src/realtime/hub.ts]
verify: npm run typecheck && npm run test:shared
status: done
---

## 目的
カメラの焦点距離(レンズの mm)を web に足すにあたり、**追従(Follow)中だけ**は追従先の焦点距離も
再現したい。そのために `PresenceUser` と `camera` メッセージへ焦点距離を運ぶ口を用意する。
このタスクは型・スキーマ・定数・丸め関数だけを追加し、値を実際に持ち回るのは 039(server)と
043(web)で行う。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `CameraState` は `{ position: Vec3; target: Vec3 }` で、コメントの保存形にも使われている。
  shared/src/types.ts:5-9, shared/src/types.ts:78-81
- **`CameraState` は変更しない。** 焦点距離を `CameraState` に入れると `CommentSchema.camera`
  経由で DB に保存され、コメント再現でも復元されてしまう。
  今回の要件は「自分の画面だけに効き、追従している人にも適用される」なので、
  焦点距離は Presence の側(`PresenceUser` と `camera` メッセージ)にだけ乗せる。
  shared/src/types.ts:98(`CommentSchema` の `camera: CameraStateSchema`)
- `PresenceUser` は `{ id, name, color, camera: CameraState | null }`。
  shared/src/types.ts:49-56
- `camera` メッセージはクライアント側が `{ type: "camera"; camera: CameraState }`、
  サーバ側が `{ type: "camera"; userId: string; camera: CameraState }`。
  shared/src/protocol.ts:17-30
- `ClientMessageSchema` / `ServerMessageSchema` / `PresenceUserSchema` は
  `z.object(...)` であり `.strict()` ではない。**スキーマに書いていないキーは
  パース時に落ちる**。したがって新しいフィールドはスキーマにも足さないと素通しされない。
- `shared/src/index.ts` は `types` / `api` / `protocol` / `camera` / `stroke` を
  `export *` している。新しい export は自動的に `@shared/*` から見える。
  shared/src/index.ts:1-5
- `shared/src/camera.ts` は `types.ts` から import している。**逆向きの import はない。**
  循環を避けるため、定数とスキーマは `types.ts` に、計算する関数は `camera.ts` に置くこと。
  shared/src/camera.ts:1
- `server/src/realtime/hub.ts` の `copyUser` は `{ ...user, camera: ... }` のスプレッドで
  作られているため、`PresenceUser` に足したフィールドは自動的にコピーされる。
  server/src/realtime/hub.ts:54-56
- 既存の定数は `MAX_ID_LENGTH` などすべて `types.ts` に置かれている。
  shared/src/types.ts:58-62

## インターフェイス契約

### 変更 shared/src/types.ts

既存の export はどれも変更しない。次を追加する。

```ts
/** 焦点距離(mm)の下限。これより広角にはしない */
export const MIN_FOCAL_LENGTH_MM = 14;
/** 焦点距離(mm)の上限 */
export const MAX_FOCAL_LENGTH_MM = 300;
/** 既定の焦点距離(mm) */
export const DEFAULT_FOCAL_LENGTH_MM = 50;

/** 焦点距離(mm)。MIN_FOCAL_LENGTH_MM 以上 MAX_FOCAL_LENGTH_MM 以下の有限数 */
export const FocalLengthSchema = z.number().min(MIN_FOCAL_LENGTH_MM).max(MAX_FOCAL_LENGTH_MM);
```

`PresenceUser` を次のように変える。

```ts
export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  camera: CameraState | null;
  /** 焦点距離(mm)。まだ一度も送られていなければ undefined */
  focalLength?: number;
}
```

`PresenceUserSchema` に `focalLength: FocalLengthSchema.optional()` を足す。
`satisfies z.ZodType<PresenceUser>` は維持する。

### 変更 shared/src/protocol.ts

`ClientMessage` と `ServerMessage` の `camera` を次のように変える。他のメッセージは変更しない。

```ts
export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "camera"; camera: CameraState; focalLength?: number }
  // 以下は変更しない
  ;

export type ServerMessage =
  | { type: "camera"; userId: string; camera: CameraState; focalLength?: number }
  // 以下は変更しない
  ;
```

`ClientMessageSchema` / `ServerMessageSchema` の `camera` の要素に
`focalLength: FocalLengthSchema.optional()` を足す。
`satisfies z.ZodType<ClientMessage>` / `satisfies z.ZodType<ServerMessage>` は維持する。

### 変更 shared/src/camera.ts

既存の export はどれも変更しない。次を追加する。

```ts
/**
 * 焦点距離(mm)を [MIN_FOCAL_LENGTH_MM, MAX_FOCAL_LENGTH_MM] に丸める。
 * 有限数でない値は DEFAULT_FOCAL_LENGTH_MM を返す。
 */
export function clampFocalLength(focalLengthMm: number): number;
```

## 振る舞い

### FocalLengthSchema

`safeParse` の `success` で判定する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `50` | 成功。`data` が `50` |
| `14` / `300`(境界) | 成功 |
| `27.5`(小数) | 成功 |
| `13.9` / `300.1` | 失敗 |
| `0` / `-1` | 失敗 |
| `Number.NaN` | 失敗 |
| `Number.POSITIVE_INFINITY` / `Number.NEGATIVE_INFINITY` | 失敗 |
| `"50"` | 失敗 |
| `null` | 失敗 |

### PresenceUserSchema

`{ id: "user-1", name: "Alice", color: "#ff8800", camera: null }` を基準にする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `focalLength` を含まない | 成功。`data` に `focalLength` キーが現れない(`"focalLength" in data` が `false`) |
| `focalLength: 50` | 成功。`data.focalLength` が `50` |
| `focalLength: 14` / `focalLength: 300` | 成功 |
| `focalLength: 5` / `focalLength: 400` | 失敗 |
| `focalLength: null` | 失敗 |
| `focalLength: "50"` | 失敗 |
| `focalLength: undefined` を明示 | 成功。`data.focalLength` が `undefined` |
| `camera` が `CameraState` の値 | 成功。`data.camera` に `focalLength` が混入しない |

### ClientMessageSchema / ServerMessageSchema の camera

`camera` は `{ position: [1, 2, 3], target: [0, 0, 0] }`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "camera", camera }` | 成功。`data` に `focalLength` キーが現れない |
| `{ type: "camera", camera, focalLength: 50 }` | 成功。`data.focalLength` が `50` |
| `{ type: "camera", camera, focalLength: 400 }` | 失敗 |
| `{ type: "camera", camera, focalLength: "50" }` | 失敗 |
| `{ type: "camera", camera, focalLength: null }` | 失敗 |
| Server 側 `{ type: "camera", userId: "user-1", camera, focalLength: 85 }` | 成功。`data.focalLength` が `85` |
| Server 側 `{ type: "camera", userId: "user-1", camera }` | 成功。`focalLength` キーが現れない |
| `parseClientMessage(JSON.stringify({ type: "camera", camera, focalLength: 85 }))` | `{ ok: true }` で `msg.focalLength` が `85` |
| `join` / `stroke:add` / `stroke:remove` / `stroke:clear` の各形 | 既存どおり成功する(退行がないこと) |

### clampFocalLength

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `50` | `50` |
| `14` / `300`(境界) | そのまま |
| `27.5` | `27.5`(丸めない) |
| `5` | `14` |
| `1000` | `300` |
| `0` / `-100` | `14` |
| `Number.NaN` | `50`(`DEFAULT_FOCAL_LENGTH_MM`) |
| `Number.POSITIVE_INFINITY` | `50` |
| `Number.NEGATIVE_INFINITY` | `50` |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **`focalLength` は必須フィールドにしない。** 必須にすると
  `server/src/realtime/hub.ts` の `join()` が作る `PresenceUser` リテラルに
  プロパティが足りず `npm run typecheck` が落ちる。039 で server を直すまでの間、
  main を壊さないために optional にする。値を持たない状態は
  `null` ではなく **`undefined`(キーなし)** で表す
- `clampFocalLength` は **非有限を最初に弾いてから** `Math.min` / `Math.max` を掛ける。
  `Number.isFinite(focalLengthMm)` が `false` なら `DEFAULT_FOCAL_LENGTH_MM` を返す。
  この順にしないと `NaN` が `Math.min`/`Math.max` を素通りする
- `clampFocalLength` は四捨五入しない。表示用の丸めは web 側(042)の仕事
- 定数とスキーマは `types.ts` に、`clampFocalLength` は `camera.ts` に置く。
  `types.ts` から `camera.ts` を import してはならない(循環する)
- `FocalLengthSchema` に `.finite()` を足す必要はない。`min` / `max` が `Infinity` を弾く
- `PresenceUserSchema` の追加位置は `camera: CameraStateSchema.nullable()` の直後にする
- テストは既存ファイルへ追記する。`types.test.ts`(183行)、`protocol.test.ts`(116行)、
  `camera.test.ts`(56行)はいずれも上限 300 行に余裕がある

## やらないこと
- **`CameraState` / `CameraStateSchema` / `CommentSchema` を変更しない。**
  焦点距離をコメントに保存しない
- `mm` と `fov`(度)の換算関数を shared に置かない。**042 で web 側に置く**。
  shared が持つのは mm の範囲と丸めだけ
- `lerpCamera` / `cameraEquals` / `cloneCamera` を変更しない。焦点距離は補間しない
- `server/` と `web/` を変更しない。`hub.ts` はこのタスクでは読むだけ
- `shared/src/api.ts` / `shared/src/stroke.ts` / `shared/src/index.ts` を変更しない
- ライティング(040)や既定カメラ(041)に関わる型を足さない。どちらも web 内で完結する

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`types.test.ts` に `FocalLengthSchema` と `PresenceUserSchema` の系列、
      `protocol.test.ts` に `camera` メッセージの系列、
      `camera.test.ts` に `clampFocalLength` の系列を追加する)
- [ ] `shared_Summary.md` の記述が実態に合っている
      (`MIN_FOCAL_LENGTH_MM` / `MAX_FOCAL_LENGTH_MM` / `DEFAULT_FOCAL_LENGTH_MM` /
      `FocalLengthSchema` / `clampFocalLength` の追加、
      `PresenceUser.focalLength` と `camera` メッセージの `focalLength` が
      **Presence 専用で CameraState には含まれない**こと)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:shared` が成功する
