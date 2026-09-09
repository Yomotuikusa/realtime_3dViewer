---
id: 015
title: web Follow Camera(他ユーザーの視点への追従・操作で解除)
feature: web
depends_on: [014]
owns: [web/src/features/viewer/follow.ts, web/src/features/viewer/CameraRig.tsx, web/tests/follow.test.ts, web/web_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/shared_Summary.md, shared/src/types.ts, shared/src/camera.ts, web/src/store/camera.ts, web/src/store/presence.ts, web/src/store/session.ts, web/src/features/viewer/ViewerCanvas.tsx]
verify: npm run typecheck && npm run test:web
status: todo
---

## 目的
MVP #3(Follow Camera)。`PresenceList` の Follow ボタン(014)で決まった `followingUserId` の
視点へ自分のカメラを補間で追従させ、自分で操作したら解除する(§16.2)。
追従の判断を純粋関数に切り出し、`CameraRig` は毎フレームそれを適用するだけにする。

## 前提
- 014 の presence ストア(`users` / `followingUserId` / `follow` / `unfollow`)と、
  013 の session ストア(`selfId`)が実装済み。**対象が退室したときの `unfollow` は
  014 の `removeUser` が既に行う**。ここで重複実装しない
- 012 の `CameraRig` は `change` → `setSelfCamera`、`pendingCamera` の補間、`resetSeq` / `fitSeq`
  を扱っている。**このタスクで Follow の分岐を足す**(既存の責務は変えない)
- `lerpCamera` `cameraEquals` `cloneCamera` は `@shared/camera`。補間の数学を再実装しない
- Follow 中も自分の camera は送信し続ける(§16.2)。`useCameraBroadcast`(014)は
  `selfCamera` を購読しているので、`CameraRig` が追従後に `setSelfCamera` すれば自動で送られる
- 決定事項 **D27**(docs/task-breakdown.md §3): CameraRig の優先順位と、
  `pendingCamera` consume 時の `unfollow`
- R3F コンポーネントの描画テストは書かない。テスト対象は `follow.ts` のみ
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/viewer/follow.ts
import type { CameraState, PresenceUser } from "@shared/types";

/** 1 フレームあたりの補間係数(§16.2 の t≈0.2) */
export const FOLLOW_LERP_T = 0.2;

/** 追従先のカメラ。追従しない(null / 未知 / 自分自身 / 相手の camera が null)なら null。
 *  返り値は cloneCamera した別参照 */
export function followTargetCamera(
  users: Record<string, PresenceUser>,
  followingUserId: string | null,
  selfId: string | null,
): CameraState | null;

/** 次フレームのカメラ。arrived は lerp 後の値が target と cameraEquals(既定 eps)か */
export function followStep(
  current: CameraState,
  target: CameraState,
): { camera: CameraState; arrived: boolean };
```

`CameraRig` の `useFrame` での優先順位(D27。上から順に最初に当てはまるものだけ実行):

| 状況 | 動作 |
| --- | --- |
| `resetSeq` が増えた | 既存どおり即座に `DEFAULT_CAMERA`。追従中なら `presence.unfollow()` も呼ぶ |
| `pendingCamera` が非 null(consume 時) | 既存どおり目標に設定。**consume した時点で `presence.unfollow()`** |
| 補間目標(pending 由来)が残っている | 既存どおり `lerpCamera(現在, 目標, 0.2)`。到達でクリア |
| `followTargetCamera(...)` が非 null | `followStep(現在, 対象)` の `camera` を `camera.position` / `controls.target` に適用し `controls.update()`。`arrived` でも追従は続ける(相手が動けばまた追う) |
| それ以外 | 何もしない(ユーザーの自由操作) |

- OrbitControls の `start` イベント(ユーザーが操作を始めた)で `presence.unfollow()`。
  プログラムからの `controls.update()` では `start` は発火しないので、追従自体では解除されない
- 追従で動かした後も既存の `change` ハンドラが `setSelfCamera` を呼ぶ(送信は 014 の仕組みに任せる)

## 振る舞い

(テスト対象は `follow.ts`。`CameraRig` は typecheck のみ)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `followTargetCamera(users, null, "me")` | `null` |
| `followTargetCamera(users, "nope", "me")`(未知の id) | `null` |
| `followTargetCamera(users, "me", "me")`(自分自身) | `null` |
| 対象 `a` の `camera` が `null` | `null` |
| 対象 `a` の `camera` が非 null | その camera と `cameraEquals`、かつ `result !== users.a.camera`、`result.position !== users.a.camera.position` |
| `followTargetCamera(users, "a", null)`(selfId 未確定) | `a` の camera を返す(selfId が null なら自分判定はしない) |
| `followStep(a, b)`(遠い) | `camera` が `lerpCamera(a, b, FOLLOW_LERP_T)` と `cameraEquals`、`arrived === false` |
| `followStep(a, a)` | `arrived === true` |
| `followStep(a, a')`(差 1e-6) | `arrived === true` |
| `followStep` を `a` → `b`(距離 10)に対し 60 回繰り返す | 最後は `arrived === true`(収束する) |
| `FOLLOW_LERP_T` | 0.2 |

## やらないこと
- presence ストア / `PresenceList` の変更(014 の成果物)
- Annotation / Comment(016 以降)。`pendingCamera` を積む側(コメント再現)は 020
- `web/src/store/camera.ts` の変更。`useCameraBroadcast` の変更
- R3F コンポーネントの描画テスト、CSS ファイルの追加
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(CameraRig の優先順位表 D27 を転記)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run typecheck && npm run test:web` が成功する
