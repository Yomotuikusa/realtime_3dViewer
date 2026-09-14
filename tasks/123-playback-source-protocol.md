---
id: 123
title: shared/server/web に再生対象オブジェクト(playback:source)のルーム共有を通す
feature: shared
depends_on: []
owns: [shared/src/protocol.ts, shared/shared_Summary.md, shared/tests/protocol-playback.test.ts, server/src/realtime/room-display.ts, server/src/realtime/hub.ts, server/server_Summary.md, server/tests/room-display.test.ts, server/tests/realtime-hub-playback.test.ts, web/src/store/display.ts, web/src/store/store_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/app_Summary.md, web/tests/store-display.test.ts, web/tests/realtime-dispatch-playback.test.ts]
reads: [shared/src/types.ts, shared/tests/protocol-trail.test.ts, server/src/realtime/ws.ts, server/tests/realtime-hub-trail.test.ts, web/tests/realtime-dispatch.test.ts, web/src/app/review-stores.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
アニメーションを持つオブジェクトが複数あるとき、タイムラインで再生する対象(versionId)を
ルーム全員で共有できるようにする。本タスクは型・スキーマ・中継・ストアまでの結線だけを行う。
再生対象の解決と静止は 124、ドロップダウン UI は 125、コメントへの記録は 126。

## 前提
- ルーム共有の表示状態は `trail:display` と同じ経路を通る(設計書 §13.5)。
  `shared/src/protocol.ts` の union とスキーマ → `server/src/realtime/room-display.ts` の
  `applyDisplayMessage` / `displayWelcomeFields` → `server/src/realtime/hub.ts:98-105` の表示系 case 群 →
  `web/src/app/realtime-dispatch.ts` → `web/src/store/display.ts`
- hub.ts は welcome に `...displayWelcomeFields(room.display)` を展開している(hub.ts:204)。
  `motionTrailIn(projectId)` のような状態取得メソッドが並んでいる
- protocol.ts には `const IdSchema = z.string().min(1)` がローカルにある(protocol.ts:104)
- `ClientMessage` / `ServerMessage` の switch は hub.ts と realtime-dispatch.ts で網羅性検査になっている。
  両方に case を足さないと typecheck が落ちる
- `resetReviewStores` は既に `useDisplayStore.getState().reset()` を呼んでいる(review-stores.ts)
- realtime-dispatch.test.ts は 248 行あるため、本タスクのテストは新規 `web/tests/realtime-dispatch-playback.test.ts` に書く
  (既存 realtime-dispatch.test.ts は変更しない)

## インターフェイス契約

```ts
// shared/src/protocol.ts
export type ClientMessage =
  | ...
  /** 自分がタイムラインの再生対象オブジェクトを切り替えた */
  | { type: "playback:source"; versionId: string };

export type ServerMessage =
  | {
      type: "welcome";
      ...
      /** ルームで選ばれた再生対象の versionId。誰も選んでいなければ省略される */
      playbackSource?: string;
    }
  | ...
  /** userId が再生対象を切り替えた(送信元以外へ中継) */
  | { type: "playback:source"; userId: string; versionId: string };

// ClientMessageSchema:  z.object({ type: z.literal("playback:source"), versionId: IdSchema })
// ServerMessageSchema:  z.object({ type: z.literal("playback:source"), userId: IdSchema, versionId: IdSchema })
// welcome スキーマ:     playbackSource: IdSchema.optional()
```

```ts
// server/src/realtime/room-display.ts
export interface RoomDisplayState {
  ...
  /** ルームで共有する再生対象の versionId。誰も選んでいなければ null */
  playbackSource: string | null;
}
// DisplayClientMessage の Extract 対象に "playback:source" を追加
// DisplayWelcomeFields の Pick 対象に "playbackSource" を追加
// applyDisplayMessage:
//   case "playback:source":
//     state.playbackSource = msg.versionId;
//     return { type: "playback:source", userId, versionId: msg.versionId };
// displayWelcomeFields: state.playbackSource !== null のときだけ fields.playbackSource を設定

// server/src/realtime/hub.ts
//   表示系 case 群に `case "playback:source":` を追加(applyDisplayMessage へ委譲、target: "others")
playbackSourceIn(projectId: string): string | null; // ルームが無ければ null
```

```ts
// web/src/store/display.ts
export interface DisplayStoreState {
  ...
  /** ルームで選ばれた再生対象の versionId。初期値 null(未選択) */
  playbackSource: string | null;
  /** 同値なら state を更新しない */
  setPlaybackSource(versionId: string | null): void;
}
// reset() で playbackSource を null に戻す

// web/src/app/realtime-dispatch.ts
//   welcome:  display.setPlaybackSource(msg.playbackSource ?? null);
//   case "playback:source": display.setPlaybackSource(msg.versionId); break;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| ClientMessageSchema に `{ type: "playback:source", versionId: "v1" }` | 成功 |
| ClientMessageSchema に versionId が空文字 / 欠落 | 失敗 |
| ServerMessageSchema に `{ type: "playback:source", userId: "u1", versionId: "v1" }` | 成功。userId 欠落は失敗 |
| welcome に playbackSource 無し | 成功し、`playbackSource` は undefined |
| welcome に `playbackSource: "v2"` | 成功し、値が保たれる |
| hub: a が `playback:source` v2 を送る | `[{ target: "others", msg: { type: "playback:source", userId: "a", versionId: "v2" } }]`。`playbackSourceIn("p1")` が "v2" |
| hub: その後に b が join | b の welcome に `playbackSource: "v2"` |
| hub: 誰も送っていないルームに join | welcome に `playbackSource` キーが無い。`playbackSourceIn` は null |
| hub: v2 の後に v3 を送る | 最新の "v3" が保持される |
| hub: 存在しないルームの `playbackSourceIn` | null |
| `createRoomDisplayState()` | `playbackSource: null` |
| display ストア初期値 | `playbackSource === null` |
| `setPlaybackSource("v1")` を 2 回 | 2 回目は state 参照が変わらない(購読者が呼ばれない) |
| `setPlaybackSource(null)` | null に戻る |
| `reset()` | null に戻る |
| dispatch: welcome に playbackSource 無し(事前に "v1" を設定済み) | null になる |
| dispatch: welcome に `playbackSource: "v2"` | "v2" になる |
| dispatch: `{ type: "playback:source", userId: "u", versionId: "v3" }` | "v3" になる |

## やらないこと
- サーバー側で versionId の実在確認はしない(存在しない id もそのまま保存・中継する。解決は 124 のクライアント側)
- 再生時刻・再生中フラグ・clipIndex の共有はしない
- viewer / timeline / comments への結線(124〜126)
- 既存の realtime-dispatch.test.ts / protocol.test.ts への追記(新規テストファイルに書く)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared / server / store / app の各 Summary が更新されている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
