---
id: 143
title: web 他者のカメラ表示をモデルの大きさに合わせて拡縮する
feature: presence
depends_on: []
owns: [web/src/features/presence/RemoteCameras.tsx, web/src/features/presence/remote-camera-size.ts, web/src/features/presence/presence_Summary.md, web/tests/remote-camera-size.test.ts]
reads: [web/src/store/camera.ts, web/src/store/presence.ts, web/src/features/joint/joint-display.ts, web/tests/store-presence.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
他者のカメラを示す錐と名札の位置がワールド単位の固定値(`0.12` / `0.3` / `0.28`)なので、大きなモデルでは
見えず、小さなモデルでは画面を覆う。ジョイント球(`jointRadius`)と同じく、モデルの最大辺長に対する比で決める。

## 前提
- `web/src/features/presence/RemoteCameras.tsx`(全 45 行)。`RemoteCamera({ user })` が
  `<coneGeometry args={[0.12, 0.3, 8]} />`、`<Html position={[0, 0.28, 0]} center>` を描く。
  `RemoteCameras()` は `usePresenceStore((state) => state.users)` と `useSessionStore((state) => state.selfId)` を読む
- `web/src/store/camera.ts:15` `modelSize: number`(初期値 1)。primary モデル読み込み時に `useModelScene.ts:30-37` が設定する
- 比で決める既存の形: `web/src/features/joint/joint-display.ts:24-27` `JOINT_RADIUS_RATIO = 0.008`(`:25`)/ `JOINT_FALLBACK_RADIUS = 0.01`(`:27`)
- `RemoteCameras` を読むテストは無い。R3F コンポーネントはヘッドレスで描画しない(設計書 §19)ので、純粋関数のテストとソース検査で固定する
- `presence_Summary.md:8-9` に `RemoteCameras.tsx` の説明が **2 行重複**している。`:21-22` が `## テスト`

## インターフェイス契約

```ts
// web/src/features/presence/remote-camera-size.ts(新規)
/** 錐の底面半径 = モデルの最大辺長 * この比(最大辺長 1 で従来の 0.12) */
export const REMOTE_CAMERA_RADIUS_RATIO = 0.12;
/** 錐の高さ = モデルの最大辺長 * この比(従来 0.3) */
export const REMOTE_CAMERA_HEIGHT_RATIO = 0.3;
/** 名札の y オフセット = モデルの最大辺長 * この比(従来 0.28) */
export const REMOTE_CAMERA_TAG_OFFSET_RATIO = 0.28;
/** 錐の分割数 */
export const REMOTE_CAMERA_SEGMENTS = 8;

export interface RemoteCameraSize {
  radius: number;
  height: number;
  tagOffset: number;
}

/** modelSize が正の有限数でなければ 1 として扱う */
export function remoteCameraSize(modelSize: number): RemoteCameraSize;
```

```tsx
// web/src/features/presence/RemoteCameras.tsx
//   RemoteCamera が useCameraStore((state) => state.modelSize) を読み、remoteCameraSize(modelSize) の
//   radius / height を <coneGeometry args={[radius, height, REMOTE_CAMERA_SEGMENTS]} />、
//   tagOffset を <Html position={[0, tagOffset, 0]} center> に使う。他は変更しない
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `remoteCameraSize(1)` | `{ radius: 0.12, height: 0.3, tagOffset: 0.28 }`(従来と同じ見た目) |
| `remoteCameraSize(100)` | `{ radius: 12, height: 30, tagOffset: 28 }` |
| `remoteCameraSize(0)` / `(-1)` / `(NaN)` / `(Infinity)` | `remoteCameraSize(1)` と同じ |
| `RemoteCameras.tsx` のソース | `remoteCameraSize(`、`REMOTE_CAMERA_SEGMENTS`、`useCameraStore((state) => state.modelSize)` を含み、`0.12` `0.3` `0.28` の数値リテラルを含まない |
| 既存テスト | すべて通る |

## やらないこと
- 錐の形・色・名札のスタイル(`presence-tag`)は変えない
- Follow やカメラ中継の仕組みは触らない
- 比率を設定 UI に出さない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] presence_Summary.md の RemoteCameras.tsx の重複行を 1 行にまとめ、remote-camera-size.ts の役割と公開インターフェイス、`## テスト` に remote-camera-size.test.ts が載っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
