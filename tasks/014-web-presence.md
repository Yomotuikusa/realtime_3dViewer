---
id: 014
title: web Presence(参加者一覧・他者カメラ表示・自カメラ送信)
feature: web
depends_on: [013]
owns: [web/src/store/presence.ts, web/src/features/presence/PresenceList.tsx, web/src/features/presence/RemoteCameras.tsx, web/src/features/viewer/useCameraBroadcast.ts, web/src/app/realtime-dispatch.ts, web/src/app/ReviewPage.tsx, web/tests/store-presence.test.ts, web/tests/camera-broadcast.test.ts, web/tests/realtime-dispatch.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/protocol.ts, shared/src/camera.ts, server/server_Summary.md, web/src/store/session.ts, web/src/store/camera.ts, web/src/api/ws.ts, web/src/app/useRealtime.ts, web/src/features/viewer/ViewerCanvas.tsx]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
MVP #2(Real-time Presence)。同じレビュー空間にいる人の一覧と、各人が「今どこから見ているか」の
3D 表示(§16.2)。自分のカメラを 20Hz 上限で送信し、他者のカメラを受信して反映する。

## 前提
- 013 で `dispatchServerMessage`(D23)、`useRealtime`、session ストア、`WsClient` が実装済み。
  **このタスクは `realtime-dispatch.ts` に `welcome` の users 反映と
  `user:joined` / `user:left` / `camera` の case を足す**(既存 case の意味は変えない)
- 012 の camera ストア(`selfCamera` は OrbitControls の change で更新される)を購読する。
  カメラの取得方法をここで作り直さない
- `CAMERA_SEND_INTERVAL_MS`(= 50)は `@shared/protocol`、`cameraEquals` `cloneCamera` は
  `@shared/camera`。throttle の比較を自前実装しない
- サーバ規則(§15): `camera` は送信者以外へ中継される。自分の `PresenceUser.camera` は
  `welcome` / 自分の送信分でのみ変わる
- `RemoteCameras` は `ViewerCanvas` の children として Canvas 内に置く。
  ラベルは drei の `Html` を使う
- **R3F コンポーネントの描画テストは書かない**。テスト対象は presence ストアと
  `shouldSendCamera`、`dispatchServerMessage`
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/store/presence.ts
import type { CameraState, PresenceUser } from "@shared/types";

export interface PresenceStoreState {
  users: Record<string, PresenceUser>;      // 自分も含む
  followingUserId: string | null;           // Follow の対象。実際の追従は 015
  /** welcome 受信時の全置換 */
  applyWelcome(users: PresenceUser[]): void;
  upsertUser(user: PresenceUser): void;
  /** 対象を消す。Follow 中の相手なら followingUserId を null に戻す(§16.2) */
  removeUser(userId: string): void;
  /** 未知の userId なら何もしない */
  updateCamera(userId: string, camera: CameraState): void;
  /** 未知の userId なら何もしない */
  follow(userId: string): void;
  unfollow(): void;
  reset(): void;
}
export const usePresenceStore: /* zustand の UseBoundStore<StoreApi<PresenceStoreState>> */;
```

```ts
// web/src/features/viewer/useCameraBroadcast.ts
import type { CameraState } from "@shared/types";
import type { ClientMessage } from "@shared/protocol";

/** 送るべきか: 前回送信から CAMERA_SEND_INTERVAL_MS 以上経過し、かつ前回送信値と cameraEquals でない。
 *  prev が null(未送信)なら間隔条件だけで判定する */
export function shouldSendCamera(
  prev: CameraState | null, next: CameraState, lastSentAt: number, now: number,
): boolean;

/** camera ストアの selfCamera を購読し、shouldSendCamera が true のとき
 *  send({type:"camera", camera}) する。Follow 中も送信を止めない(§16.2) */
export function useCameraBroadcast(send: (msg: ClientMessage) => boolean): void;
```

```tsx
// web/src/features/presence/PresenceList.tsx
/** 参加者一覧。各行に色チップと名前。自分の行は「(あなた)」を付け Follow ボタンを出さない。
 *  他人の行の Follow ボタンは follow(id) / 対象が followingUserId なら「解除」で unfollow() */
export function PresenceList(): React.ReactElement;

// web/src/features/presence/RemoteCameras.tsx
/** 自分以外で camera が非 null のユーザーを、position に置いた小さな錐体(target を向く)+
 *  drei の Html による名前ラベルで描画する。Canvas 内に置く */
export function RemoteCameras(): React.ReactElement;
```

`realtime-dispatch.ts` への追加(013 の表に足す):

| msg.type | 反映先 |
| --- | --- |
| `welcome` | 既存の session 反映に加えて `presence.applyWelcome(msg.users)` |
| `user:joined` | `presence.upsertUser(msg.user)` |
| `user:left` | `presence.removeUser(msg.userId)` |
| `camera` | `presence.updateCamera(msg.userId, msg.camera)` |

`ReviewPage` への追加分:

- サイドパネルに `<PresenceList />` を置く(接続状態表示の下)
- `<ViewerCanvas ...><RemoteCameras /></ViewerCanvas>` として Canvas 内に差し込む
- `useCameraBroadcast(realtime.send)` を呼ぶ

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| presence ストア初期値 | `users:{}`、`followingUserId:null` |
| `applyWelcome([a, b])` | `users` が a, b の 2 件。以前の内容は消える(全置換) |
| `applyWelcome([])` | `users` が空。`followingUserId` は `null` になる |
| `upsertUser(a)` を 2 回(2 回目は name 違い) | 1 件のまま、後勝ちで name が更新される |
| `removeUser("a")` | `users` から消える |
| `removeUser("nope")` | 何も起きない(throw しない) |
| `follow("a")` 済みで `removeUser("a")` | `followingUserId` が `null` に戻る |
| `follow("a")` 済みで `removeUser("b")` | `followingUserId` は `"a"` のまま |
| `updateCamera("a", cam)` | `users.a.camera` が cam。他のフィールドは不変 |
| `updateCamera("nope", cam)` | `users` が変わらない |
| `follow("a")`(a が users に居る) | `followingUserId === "a"` |
| `follow("nope")` | `followingUserId` は変わらない |
| `unfollow()` | `null` |
| `reset()` | 初期値に戻る |
| `shouldSendCamera(null, c, 0, 49)` / `(null, c, 0, 50)` | false / true |
| `shouldSendCamera(c, c, 0, 1000)`(同じ値) | false |
| `shouldSendCamera(c, c2, 0, 1000)`(0.01 違い) | true |
| `shouldSendCamera(c, c2, 0, 49)` | false(間隔条件を満たさない) |
| `shouldSendCamera(c, cNearlyEqual, 0, 1000)`(1e-6 違い) | false(`cameraEquals` の既定 eps) |
| `dispatchServerMessage(welcome)`(users 2 人) | session の selfId / color に加えて `presence.users` が 2 件 |
| `dispatchServerMessage({type:"user:joined", user})` | `presence.users` に 1 件増える |
| `dispatchServerMessage({type:"user:left", userId})` | 消える。Follow 中なら解除される |
| `dispatchServerMessage({type:"camera", userId:"a", camera})` | `users.a.camera` が更新される |
| `dispatchServerMessage({type:"camera", userId:"nope", ...})` | 何も起きず throw しない |
| 013 で通した dispatch のテスト(error 等) | 引き続き通る(既存テストを壊さない) |

## やらないこと
- Follow の実際の追従(`CameraRig` の補間・操作で解除)は 015。ここでは
  `followingUserId` の保持と一覧のボタンまで。`features/viewer/CameraRig.tsx` は変更しない
- Annotation / Comment(016 以降)
- `web/src/api/ws.ts` / `web/src/store/session.ts` / `web/src/store/camera.ts` の変更
- R3F コンポーネントの描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(presence ストア / カメラ送信の throttle 規則)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
