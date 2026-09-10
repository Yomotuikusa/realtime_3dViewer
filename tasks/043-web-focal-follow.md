---
id: 043
title: web 追従中に追従先の焦点距離を反映する
feature: web
depends_on: [039, 042]
owns: [web/src/features/viewer/camera-throttle.ts, web/src/features/viewer/useCameraBroadcast.ts, web/src/features/viewer/follow.ts, web/src/features/viewer/CameraRig.tsx, web/src/store/presence.ts, web/src/app/realtime-dispatch.ts, web/tests/camera-throttle.test.ts, web/tests/camera-broadcast.test.ts, web/tests/follow.test.ts, web/tests/store-presence.test.ts, web/tests/realtime-dispatch.test.ts, web/web_Summary.md]
reads: [shared/shared_Summary.md, server/server_Summary.md, shared/src/protocol.ts, shared/src/types.ts, shared/src/camera.ts, web/src/store/camera.ts, web/src/features/viewer/focal-length.ts, web/src/features/presence/RemoteCameras.tsx, web/vitest.config.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
焦点距離(042)は自分の画面だけのローカル設定だが、**他の参加者を追従(Follow)している間は
追従先の焦点距離も再現したい**。そうしないと同じ視点を共有しているのに構図が食い違う。
自分の焦点距離を `camera` メッセージに乗せて送り、追従中だけ相手の値を自分の camera ストアへ入れる。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 038 / 039 で次が済んでいる。shared/shared_Summary.md, server/server_Summary.md
  - `ClientMessage` の `camera` が `{ type: "camera"; camera: CameraState; focalLength?: number }`
  - `ServerMessage` の `camera` が `{ type: "camera"; userId: string; camera: CameraState; focalLength?: number }`
  - `PresenceUser` に `focalLength?: number`(mm。まだ送られていなければ `undefined`)
  - `RoomHub` は最後に受け取った焦点距離を保持し、`welcome` / `user:joined` / 中継する
    `camera` メッセージにも載せる
  - **`CameraState` には `focalLength` が入っていない。** コメントには保存されない
- 042 で camera ストアに `focalLength: number`(既定 50)と
  `setFocalLength(focalLengthMm)`(`clampFocalLength` して同値なら `set` しない)が入っている。
  web/web_Summary.md
- `useCameraBroadcast` は `useCameraStore.subscribe((state) => throttle.update(state.selfCamera))`
  で購読している。**`subscribe` にセレクタを渡していないので、`focalLength` が変わったときも
  このコールバックは呼ばれる。** web/src/features/viewer/useCameraBroadcast.ts:42-45
- `createCameraThrottle` は「50ms 未満の間隔では送らない」「最後に送った値と
  `cameraEquals` で同値なら送らない」「送れなかったら次の窓で再送する」を実装している。
  web/src/features/viewer/camera-throttle.ts
- `throttle.send` が `true` を返したときだけ `usePresenceStore.updateCamera(selfId, camera)` で
  自分の Presence を更新している。web/src/features/viewer/useCameraBroadcast.ts:27-35
- `followTargetCamera(users, followingUserId, selfId)` は追従先の `CameraState` の複製を返し、
  自分自身を追従しているときと相手のカメラが `null` のときは `null` を返す。
  web/src/features/viewer/follow.ts:9-25
- `CameraRig` の `useFrame` は、reset → pendingCamera → 追従 の順に処理し、
  追従では `followStep(current, followTarget)` の結果を毎フレーム適用している。
  web/src/features/viewer/CameraRig.tsx:106-117
- `shouldSendCamera(prev, next, lastSentAt, now)` は `useCameraBroadcast.ts` から export
  されているが `useCameraBroadcast` 自身は使っていない(節流は `createCameraThrottle` が行う)。
  web/src/features/viewer/useCameraBroadcast.ts:13-21, web/tests/camera-broadcast.test.ts
- `RemoteCameras` は `user.camera` だけを見て円錐を描いている。**変更不要。**
  web/src/features/presence/RemoteCameras.tsx
- web のテストは jsdom 環境で `@testing-library` がない。
  **React コンポーネントのレンダリングテストは書けない。** web/vitest.config.ts
- `web/tests/camera-throttle.test.ts` は 191 行ある。`update()` の引数の形が変わるので
  **既存テストは全面的に書き換えになる**。行数は同程度に収まる見込み

## インターフェイス契約

### 変更 web/src/features/viewer/camera-throttle.ts

```ts
import type { CameraState } from "@shared/types";

/** 1回の送信で運ぶ視点情報。 */
export interface CameraPayload {
  camera: CameraState;
  /** 送信時点の焦点距離(mm) */
  focalLength: number;
}

/** camera が cameraEquals で同値、かつ焦点距離が厳密に等しいなら true。 */
export function payloadEquals(a: CameraPayload, b: CameraPayload): boolean;

export interface CameraThrottleDeps {
  /** 送信。false なら未送信扱い(次の機会に再送) */
  send: (payload: CameraPayload) => boolean;
  now: () => number;
  /** delayMs 後に fn を呼ぶ。戻り値はキャンセル関数 */
  schedule: (fn: () => void, delayMs: number) => () => void;
  intervalMs?: number;
}

export interface CameraThrottle {
  /** 最新の視点情報を通知する。間隔内なら保持し、窓明けに最新値だけを送る */
  update(payload: CameraPayload): void;
  /** 保留中の送信とタイマーを破棄する */
  dispose(): void;
}

export function createCameraThrottle(deps: CameraThrottleDeps): CameraThrottle;
```

### 変更 web/src/features/viewer/useCameraBroadcast.ts

`shouldSendCamera` は現在のシグネチャのまま変更しない。

```ts
export function shouldSendCamera(
  prev: CameraState | null,
  next: CameraState,
  lastSentAt: number,
  now: number,
): boolean;

export function useCameraBroadcast(send: (msg: ClientMessage) => boolean): void;
```

### 変更 web/src/store/presence.ts

```ts
export interface PresenceStoreState {
  // 他は変更しない
  /**
   * 追従表示用のカメラを更新する。
   * focalLength が number のときだけ user.focalLength を書き換え、
   * undefined のときは既存の値を保つ。
   */
  updateCamera(userId: string, camera: CameraState, focalLength?: number): void;
}
```

### 変更 web/src/features/viewer/follow.ts

`FOLLOW_LERP_T` と `followStep` は変更しない。`followTargetCamera` の返り値だけを変える。

```ts
/** 追従先の視点情報。 */
export interface FollowTarget {
  camera: CameraState;
  /** 追従先がまだ焦点距離を送っていなければ null */
  focalLength: number | null;
}

export function followTargetCamera(
  users: Record<string, PresenceUser>,
  followingUserId: string | null,
  selfId: string | null,
): FollowTarget | null;
```

### 変更 web/src/app/realtime-dispatch.ts / web/src/features/viewer/CameraRig.tsx

シグネチャは変更しない。

```ts
export function dispatchServerMessage(msg: ServerMessage): void;
export function CameraRig(): ReactElement;
```

## 振る舞い

### payloadEquals

`camera` は `{ position: [1, 2, 3], target: [0, 1, 0] }`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 同じ `camera` と同じ焦点距離 | `true` |
| `position` が `[1.000001, 2, 3]`(既定 eps 内)で焦点距離が同じ | `true` |
| `position` が `[1.01, 2, 3]` で焦点距離が同じ | `false` |
| `camera` が同じで焦点距離が `50` と `85` | `false` |
| `camera` が同じで焦点距離が `50` と `50.0000001` | `false`(厳密比較) |

### createCameraThrottle

既存のテストの筋(間隔・再送・dispose)はすべて維持し、引数を `CameraPayload` に置き換える。
`now` と `schedule` は既存テストと同じくフェイクを渡す。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初回 `update({ camera, focalLength: 50 })` | `send` が `{ camera, focalLength: 50 }` で呼ばれる |
| `send` に渡る `camera` | 引数とは別オブジェクト(複製されている) |
| 間隔内に `update` を複数回 | 窓明けに最新の payload だけが1回送られる |
| 直前に送った payload と `payloadEquals` で同値な `update` | `send` が呼ばれない |
| `camera` は同じで `focalLength` だけ変えた `update` | 間隔を満たせば `send` が呼ばれる |
| `focalLength` は同じで `camera` だけ動かした `update` | 既存どおり `send` が呼ばれる |
| `send` が `false` を返す | 次の窓で同じ payload が再送される |
| `dispose()` のあとの `update` | `send` が呼ばれず、`schedule` のキャンセル関数が呼ばれる |
| `intervalMs` を指定 | 既存どおりその間隔が使われる |

### presence ストアの updateCamera

`upsertUser({ id: "u1", name: "Alice", color: "#112233", camera: null })` を前提にする。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `updateCamera("u1", camera, 85)` | `users.u1.camera` が複製され、`focalLength` が `85` |
| `updateCamera("u1", camera)`(焦点距離なし) | `camera` が更新され、`focalLength` は `undefined` のまま |
| `updateCamera("u1", camera, 85)` のあと `updateCamera("u1", camera2)` | `focalLength` が `85` のまま |
| `updateCamera("u1", camera, 85)` のあと `updateCamera("u1", camera2, 24)` | `focalLength` が `24` |
| 知らない `userId` | 何も起きない(既存どおり) |
| `upsertUser({ ...user, focalLength: 85 })` | `users.u1.focalLength` が `85`(複製される) |
| `applyWelcome([{ ...user, focalLength: 135 }])` | `users.u1.focalLength` が `135` |
| `updateCamera` の返り値と `users.u1.camera` | 引数の `camera` とは別オブジェクト(既存どおり) |
| `reset()` | `users` が `{}` |

### followTargetCamera

`users` は `{ u1: { id: "u1", name: "Alice", color: "#112233", camera, focalLength: 85 } }`。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `followTargetCamera(users, "u1", "me")` | `{ camera, focalLength: 85 }` |
| `focalLength` を持たないユーザーを追従 | `{ camera, focalLength: null }` |
| `followingUserId` が `null` | `null` |
| `followingUserId` が `selfId` と同じ | `null` |
| `users` に `followingUserId` がない | `null` |
| 追従先の `camera` が `null` | `null` |
| `selfId` が `null` で `followingUserId` が指す相手がいる | `{ camera, focalLength }` を返す(既存どおり) |
| 返り値の `camera` | `users` の中の `CameraState` とは別オブジェクト |
| `followStep` / `FOLLOW_LERP_T` | 既存どおり(退行がないこと) |

### dispatchServerMessage

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "camera", userId: "u1", camera, focalLength: 85 }` | `users.u1.camera` と `focalLength` が更新される |
| `{ type: "camera", userId: "u1", camera }` | `camera` だけ更新され、`focalLength` は据え置き |
| `welcome` / `user:joined` / stroke 系 / comment 系 / `error` | 既存どおり(退行がないこと) |

### 結線後の全体像

React のレンダリングテストは書けないため、この表は実装の指針であって直接のテスト対象ではない。

| 状況 | 期待する結果 |
| --- | --- |
| スライダーで焦点距離を変える | カメラを動かさなくても 50ms 以内に `camera` メッセージが1回飛ぶ |
| 他の参加者を追従する | 相手の位置・注視点に加えて焦点距離もこちらへ適用される |
| 追従先がまだ焦点距離を送っていない | 自分の焦点距離のまま変わらない |
| 追従中に追従先が焦点距離を変える | こちらの焦点距離も追随する |
| 追従を解除する | そのときの焦点距離が残る(自分の設定として引き継がれる) |
| 追従していないとき | 他の参加者の焦点距離は自分の画面に影響しない |
| コメントを選んで再現する | 位置と注視点だけ再現され、焦点距離は自分の現在値のまま |
| 他の参加者の視錐台マーカー(`RemoteCameras`) | 見た目は変わらない |
| ページを再読み込みする | 焦点距離は 50mm から始まる |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- `camera-throttle.ts` の内部で持つ `lastSentCamera` / `pendingCamera` は
  `CameraPayload` を持つように変える。複製は
  `{ camera: cloneCamera(payload.camera), focalLength: payload.focalLength }` で作る
  (内部ヘルパー `clonePayload` を作ってよいが export しない)
- 同値判定は `cameraEquals` の直接呼び出しをやめ、すべて `payloadEquals` に通す
- **`payloadEquals` の焦点距離は `===` の厳密比較にする。**
  スライダーの刻みは 1mm なので `eps` を入れる必要がない
- `useCameraBroadcast` の `subscribe` は
  `throttle.update({ camera: state.selfCamera, focalLength: state.focalLength })` に変える。
  毎回新しいオブジェクトを作ることになるが、同値判定は `payloadEquals` が行うので問題ない
- `send` の中身は
  `send({ type: "camera", camera: payload.camera, focalLength: payload.focalLength })` とし、
  成功時の Presence 更新を
  `usePresenceStore.getState().updateCamera(selfId, payload.camera, payload.focalLength)` にする
- **`shouldSendCamera` は変更しない。** `useCameraBroadcast` 本体では使われておらず、
  既存テスト(`camera-broadcast.test.ts`)がそのまま通ること
- `store/presence.ts` の `updateCamera` は
  `focalLength === undefined` なら既存の値を保つ。`cloneUser` は既存のまま
  (`{ ...user, camera: ... }` のスプレッドなので `focalLength` は自動でコピーされる)
- `follow.ts` の `followTargetCamera` は返り値を
  `{ camera: cloneCamera(user.camera), focalLength: user.focalLength ?? null }` にする。
  **`undefined` を `null` に正規化する**のは、呼び出し側で
  「送られていない」と「値が入っている」を分岐しやすくするため
- `CameraRig` の `useFrame` の追従処理は次の形に変える。ほかの分岐は触らない。

  ```ts
  const followTarget = followTargetCamera(
    presence.users,
    presence.followingUserId,
    useSessionStore.getState().selfId,
  );
  if (followTarget !== null) {
    if (followTarget.focalLength !== null) {
      cameraStore.setFocalLength(followTarget.focalLength);
    }
    const next = followStep(current, followTarget.camera);
    applyCamera(camera, controls, next.camera);
    cameraStore.setSelfCamera(next.camera);
  }
  ```

- **焦点距離は補間しない。** 追従先の値をそのまま `setFocalLength` に渡す。
  `setFocalLength` は同値なら `set` を呼ばないので、毎フレーム呼んでも再レンダリングは起きない
- 追従で `setFocalLength` された値は自分の camera ストアに入るため、
  そのまま自分の `camera` メッセージとしても送り返される。これは意図した挙動であり、
  抑止する分岐を書かない(位置・注視点が既に同じ扱いになっている)
- `realtime-dispatch.ts` は `case "camera"` を
  `presence.updateCamera(msg.userId, msg.camera, msg.focalLength);` に変えるだけ
- `camera-throttle.test.ts` は既存の `update(camera)` 呼び出しをすべて
  `update({ camera, focalLength })` に書き換える。テストの意図(間隔・再送・dispose)は変えない

## やらないこと
- 焦点距離をコメントに保存しない。`CommentComposer` / `compose.ts` / `replay.ts` /
  comments ストアを変更しない
- `CameraState` に `focalLength` を足さない。`shared/` と `server/` を変更しない
- 焦点距離を専用のメッセージ型(`focal` など)で送らない。`camera` メッセージに相乗りさせる
- 焦点距離の補間(lerp)をしない
- `RemoteCameras` の見た目を焦点距離に応じて変えない
- `shouldSendCamera` のシグネチャを変えない
- `CameraRig` の reset 分岐・`pendingCamera` 分岐・`OrbitControls` の props を変更しない
- `store/camera.ts` / `focal-length.ts` / `FocalLengthSlider.tsx` / `FocalLengthRig.tsx` /
  `ViewerHud.tsx` / `ViewerCanvas.tsx` / `hud-labels.ts` / `viewer.css` を変更しない
- ライティング(040)と既定カメラ(041)の挙動を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
      (`camera-throttle.test.ts` を `CameraPayload` の形へ書き換えて `payloadEquals` の系列を足し、
      `follow.test.ts` に `FollowTarget` の系列、
      `store-presence.test.ts` に `focalLength` の系列、
      `realtime-dispatch.test.ts` に `camera` メッセージの `focalLength` の系列を足す。
      `camera-broadcast.test.ts` は既存のまま通ること)
- [ ] `web_Summary.md` のファイル一覧・公開インターフェイス・他機能との関係が実態に合っている
      (`CameraPayload` / `payloadEquals` / `FollowTarget`、
      `updateCamera` の第3引数、追従中だけ焦点距離が反映されること、
      コメントには保存されないこと)
- [ ] すべてのファイルが300行以内(`web_Summary.md` を含む)
- [ ] `npm run typecheck && npm run test:web` が成功する
