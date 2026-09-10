---
id: 056
title: web 既定視点・視点再現・全体表示の補間時間を 300ms から 400ms に延ばす
feature: web
depends_on: [055]
owns: [web/src/features/viewer/camera-animation.ts, web/tests/camera-animation.test.ts, web/src/features/viewer/viewer_Summary.md]
reads: [web/src/features/viewer/CameraRig.tsx, shared/src/camera.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
正面 / 右などの既定視点へ移るカメラの補間が速すぎる。ease-out のため前半に大半が動くこともあり、
補間時間を 300ms から 400ms に延ばして少し落ち着かせる。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 補間時間は `CAMERA_ANIMATION_DURATION_MS = 300` の 1 か所で決まり、`stepCameraAnimation` が
  `(now - startedAt) / CAMERA_ANIMATION_DURATION_MS` で進行度を求める。
  web/src/features/viewer/camera-animation.ts:5, 34
- `CameraRig` はこの定数を参照せず、`startCameraAnimation` / `stepCameraAnimation` を呼ぶだけである。
  既定視点・視点再現・(055 以降は)全体表示がすべてこの補間を通る。web/src/features/viewer/CameraRig.tsx:104, 116
- 既存テストは時刻を直書きしている。`startedAt = 1000` の補間に対して `1150`(半分)、`1300`(到達)、
  `5000`(大幅超過)を渡し、最後に `expect(CAMERA_ANIMATION_DURATION_MS).toBe(300)` を検査する。
  web/tests/camera-animation.test.ts:59-61, 114
- `viewer_Summary.md` に「300ms」の記述が 3 か所ある(camera-animation.ts の説明、他フォルダとの関係、振る舞い表)。
  web/src/features/viewer/viewer_Summary.md:26, 69, 78

## インターフェイス契約

### 変更 web/src/features/viewer/camera-animation.ts

値だけ変える。他の export は名前・シグネチャ・挙動とも変えない。

```ts
/** 既定視点・視点再現・全体表示の補間にかける時間(ms)。 */
export const CAMERA_ANIMATION_DURATION_MS = 400;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `CAMERA_ANIMATION_DURATION_MS` | `400` |
| `A = startCameraAnimation(from, to, 1000)` に `stepCameraAnimation(A, 1000 + CAMERA_ANIMATION_DURATION_MS / 2)` | `camera.position` が `lerpVec3(from.position, to.position, 0.875)` と `1e-9` 以内で一致、`done: false` |
| `stepCameraAnimation(A, 1000 + CAMERA_ANIMATION_DURATION_MS)` | `camera` は `to` と `cameraEquals(…, 0)`、`done: true` |
| `stepCameraAnimation(A, 1000 + CAMERA_ANIMATION_DURATION_MS - 1)` | `done: false` |
| `stepCameraAnimation(A, 5000)` | `camera` は `to` と `cameraEquals(…, 0)`、`done: true` |
| 既存の `easeOutCubic` / `startCameraAnimation` / NaN / ソース検査のテスト | そのまま通る |

## 実装メモ
- `camera-animation.test.ts` の `1150` / `1300` は `1000 + CAMERA_ANIMATION_DURATION_MS / 2` /
  `1000 + CAMERA_ANIMATION_DURATION_MS` に書き換え、時刻の直書きを残さない。`5000` はそのままでよい
- `viewer_Summary.md` の「300ms」3 か所を「400ms」に改める。それ以外の文は変えない

## やらないこと
- easing(`easeOutCubic`)を変えない。ease-in-out への変更や別カーブの追加はしない
- 補間時間を設定・ショートカット・props で変えられるようにしない
- `CameraRig.tsx` / `follow.ts`(`FOLLOW_LERP_T`)/ `view-presets.ts` / `fit-camera.ts` を変更しない
- `shared/` と `server/` を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] `CAMERA_ANIMATION_DURATION_MS` が `400` で、他の export は変わっていない
- [ ] 振る舞い表の全行に対応するテストが `web/tests/camera-animation.test.ts` にあり、通る
- [ ] `viewer_Summary.md` の補間時間の記述が 400ms になっている
- [ ] すべてのファイルが300行以内
- [ ] `npm run typecheck && npm run test:web` が成功する
