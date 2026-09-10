---
id: 039
title: server RoomHub が camera メッセージの焦点距離を保持して中継する
feature: server
depends_on: [038]
owns: [server/src/realtime/hub.ts, server/tests/realtime-hub-focal.test.ts, server/server_Summary.md]
reads: [shared/shared_Summary.md, shared/src/types.ts, shared/src/protocol.ts, server/src/realtime/ws.ts, server/tests/realtime-hub.test.ts]
verify: npm run typecheck && npm run test:server
status: done
---

## 目的
web が `camera` メッセージに乗せてくる焦点距離(mm)を `RoomHub` が参加者ごとに保持し、
同室の他の参加者へ中継する。これで追従(Follow)側が追従先の焦点距離を再現できるようになる。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 038 で `shared` に次が入っている。shared/shared_Summary.md
  - `PresenceUser` に `focalLength?: number`(mm。未送信なら `undefined`)
  - `ClientMessage` の `camera` に `focalLength?: number`
  - `ServerMessage` の `camera` に `focalLength?: number`
  - `FocalLengthSchema` が 14〜300 の範囲を検証する。**スキーマを通った値は範囲内である**
- `RoomHub.handle()` の `case "camera"` は現在こう書かれている。
  server/src/realtime/hub.ts:110-118

  ```ts
  case "camera":
    connection.user.camera = copyCamera(msg.camera);
    return [{
      target: "others",
      msg: { type: "camera", userId: connId, camera: copyCamera(msg.camera) },
    }];
  ```

- `copyUser` は `{ ...user, camera: user.camera ? copyCamera(user.camera) : null }` で、
  スプレッドにより `focalLength` は自動的にコピーされる。**変更不要**。
  server/src/realtime/hub.ts:54-56
- `usersIn()` / `welcome` / `user:joined` はすべて `copyUser` を通る。
  server/src/realtime/hub.ts:141-144, server/src/realtime/hub.ts:186-196
- `join()` が作る `PresenceUser` リテラルは `{ id, name, color, camera: null }`。
  `focalLength` は optional なので足さなくてもコンパイルは通る。
  server/src/realtime/hub.ts:171-176
- `server/src/realtime/ws.ts` は `parseClientMessage` の結果をそのまま `hub.handle()` へ渡す。
  メッセージの中身は見ていないので**変更不要**。server/src/realtime/ws.ts
- 既存の `server/tests/realtime-hub.test.ts` は 228 行あり、上限 300 行に余裕が少ない。
  **このタスクのテストは新規ファイル `server/tests/realtime-hub-focal.test.ts` に書く**
- 既存テストのヘルパーは次の形。同じ書き方に合わせる。server/tests/realtime-hub.test.ts:9-23

  ```ts
  const camera: CameraState = { position: [1, 2, 3], target: [4, 5, 6] };
  function join(hub: RoomHub, connId: string, name: string) {
    return hub.handle(connId, { type: "join", name });
  }
  ```

- `RoomHub` のコンストラクタは `{ now?, newId?, guestDigits? }` を受ける。
  `newId` を差し替えると `connect()` が返す接続 ID を固定できる。
  server/src/realtime/hub.ts:26-30

## インターフェイス契約

`RoomHub` の公開メソッドのシグネチャは**一切変更しない**。

```ts
export class RoomHub {
  connect(projectId: string): string;
  disconnect(connId: string): Outbound[];
  handle(connId: string, msg: ClientMessage): Outbound[];
  connectionsIn(projectId: string): string[];
  projectOf(connId: string): string | null;
  usersIn(projectId: string): PresenceUser[];
  strokesIn(projectId: string): Stroke[];
}
```

`case "camera"` の実装だけを次の規則に置き換える。

```ts
case "camera": {
  connection.user.camera = copyCamera(msg.camera);
  if (msg.focalLength !== undefined) {
    connection.user.focalLength = msg.focalLength;
  }
  const focalLength = connection.user.focalLength;
  return [{
    target: "others",
    msg: focalLength === undefined
      ? { type: "camera", userId: connId, camera: copyCamera(msg.camera) }
      : { type: "camera", userId: connId, camera: copyCamera(msg.camera), focalLength },
  }];
}
```

## 振る舞い

`hub.connect("p1")` → `join(hub, connId, "Alice")` を済ませた接続を前提にする。
`camera` は `{ position: [1, 2, 3], target: [4, 5, 6] }`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `handle(a, { type: "camera", camera, focalLength: 85 })` | 返り値が `[{ target: "others", msg: { type: "camera", userId: "a", camera, focalLength: 85 } }]` |
| そのあと `usersIn("p1")` | `a` の `focalLength` が `85` |
| `handle(a, { type: "camera", camera })`(焦点距離なし・初回) | 返り値の `msg` に `focalLength` キーがない(`"focalLength" in msg` が `false`) |
| そのあと `usersIn("p1")` | `a` の `focalLength` が `undefined`(`"focalLength" in user` が `false`) |
| `focalLength: 85` を送ったあと `handle(a, { type: "camera", camera })` | 返り値の `msg.focalLength` が `85` のまま(直前の値を保持して中継する) |
| そのあと `usersIn("p1")` | `a` の `focalLength` が `85` |
| `focalLength: 85` のあと `focalLength: 24` を送る | 返り値の `msg.focalLength` が `24`、`usersIn` も `24` |
| `focalLength: 300` / `focalLength: 14`(境界) | そのまま保持・中継する(hub は範囲を再検査しない) |
| join 前の接続に `camera` を送る | `[]`(既存どおり。`focalLength` があっても同じ) |
| `a` が `focalLength: 85` を送ったあと `b` が join する | `b` への `welcome` の `users` に含まれる `a` の `focalLength` が `85` |
| `b` の join で `a` へ届く `user:joined` の `user` | `focalLength` キーがない(`b` はまだ送っていない) |
| `usersIn("p1")` の返り値を書き換える | `hub` 内部の `focalLength` が変わらない(`copyUser` が複製を返す) |
| `a` が退室したあと再び join する | 新しい `PresenceUser` には `focalLength` がない |
| `handle` が `stroke:add` / `stroke:clear` を処理する | 既存どおり。`focalLength` を触らない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **`msg.focalLength` が `undefined` のときは保持している値を消さない。**
  古いクライアントや焦点距離を送らない実装からの `camera` メッセージで
  他の参加者の見え方が既定へ戻ってしまうのを避けるため
- **中継する値は `msg.focalLength` ではなく `connection.user.focalLength`(更新後の現在値)。**
  これにより「焦点距離なしの `camera` メッセージ」を受け取った他者も
  最後に確定した焦点距離を受け取り続ける
- `focalLength` が `undefined` のときは **キー自体を作らない**。
  `{ ..., focalLength: undefined }` としない。`ServerMessage` は union 型なので、
  `Extract<...>` を書かずに済むよう三項演算子で 2 通りのオブジェクトリテラルを分けて書く
- `case "camera":` はブロック(`{}`)にする。`const` を宣言するため
- `copyCamera` / `copyUser` / `join()` / `colorFor()` は変更しない
- `clampFocalLength` を hub で呼ばない。範囲検証は `ws.ts` が通す
  `parseClientMessage`(= `FocalLengthSchema`)の責務である
- テストは `server/tests/realtime-hub-focal.test.ts` を新規に作り、
  `describe("RoomHub camera focal length", ...)` にまとめる。
  既存の `realtime-hub.test.ts` には追記しない(行数上限に近いため)
- `"focalLength" in obj` の判定は `toEqual` では検出できない
  (vitest の `toEqual` は値が `undefined` のプロパティを無視する)。
  キーの有無を見る行は `Object.hasOwn(...)` または `"focalLength" in ...` で明示的に検証する

## やらないこと
- `server/src/realtime/ws.ts` を変更しない
- `RoomHub` の公開メソッドのシグネチャを変えない
- `PresenceUser` の `focalLength` に既定値(50 など)を入れない。
  「まだ送られていない」状態を `undefined` のまま区別できることが 043 の追従処理に必要
- hub 側で焦点距離の範囲を再検査したり丸めたりしない
- 焦点距離を DB(`server/src/db/`)へ保存しない。コメントにも含めない
- `server/src/routes/` を変更しない
- `shared/` と `web/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] `RoomHub` の公開メソッドのシグネチャが変わっていない
- [ ] 振る舞い表の全行に対応するテストが `server/tests/realtime-hub-focal.test.ts` にあり、通る
- [ ] `server_Summary.md` の記述が実態に合っている
      (`camera` メッセージの `focalLength` を参加者ごとに保持し、
      未指定なら直前の値を保って中継すること、
      `welcome` / `user:joined` / `usersIn` にも載ること)
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:server` が成功する
