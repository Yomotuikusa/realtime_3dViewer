---
id: 061
title: web ライトの向きの変更をルームへ送信する
feature: web
depends_on: [060]
owns: [web/src/features/viewer/send-throttle.ts, web/src/features/viewer/camera-throttle.ts, web/src/features/viewer/useLightBroadcast.ts, web/src/app/ReviewPage.tsx, web/tests/send-throttle.test.ts, web/tests/light-broadcast.test.ts, web/src/features/viewer/viewer_Summary.md, web/src/app/app_Summary.md]
reads: [shared/src/protocol.ts, shared/src/types.ts, web/src/store/lighting.ts, web/src/features/viewer/lighting.ts, web/src/features/viewer/useCameraBroadcast.ts, web/tests/camera-throttle.test.ts, web/tests/camera-broadcast.test.ts, web/src/app/realtime-dispatch.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
060 で「サーバから届いたライトの向きを適用する」口はできたが、**まだ誰も送っていない**。
自分がライトを回したら `light` メッセージをルームへ送り、同室の全員の画面で
ライトが動くようにする。これで「カメラごとにライトが違って見える」状態が解消される。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 060 で次が入っている。
  - `ClientMessage` に `{ type: "light"; angles: LightAngles }`
  - `LIGHT_SEND_INTERVAL_MS = 50`(shared/src/protocol.ts)
  - `LightAngles` は `@shared/types` にあり、`web/src/features/viewer/lighting.ts` が再エクスポートする
  - lighting ストアに `origin: "local" | "remote"` と `applyRemote(angles)` がある。
    `rotate` / `reset` は `origin` を `"local"`、`applyRemote` は `"remote"` にする
- `createCameraThrottle` は「前回送信から `intervalMs` 未満なら保留し、窓明けに最新値だけを送る」
  先頭送信+トレーリング送信の throttle である。`send` が `false` を返したら未送信として
  再試行し、`dispose()` で保留とタイマーを捨てる。
  web/src/features/viewer/camera-throttle.ts:34-113
- **この throttle のロジックは値の型に依存していない**。値の比較(`payloadEquals`)と
  複製(`clonePayload`)だけが `CameraPayload` 固有である。
- `web/tests/camera-throttle.test.ts`(241行)が `createCameraThrottle` の挙動を
  先頭送信・トレーリング・重複抑止・送信失敗の再試行・破棄時キャンセルまで固定している。
  **このテストは1行も変更しない。**`createCameraThrottle` の公開シグネチャを変えないこと。
- `useCameraBroadcast` は `useEffect` の中で throttle を作り、
  `useCameraStore.subscribe` で購読し、cleanup で `dispose()` と解除を行う。
  この形をそのまま真似る。web/src/features/viewer/useCameraBroadcast.ts:22-49
- `ReviewPage` は `useCameraBroadcast(realtime.send)` を呼び、
  アンマウント時に `resetReviewStores()` する `useEffect` を**その後に**宣言している。
  React は宣言順に cleanup を呼ぶので、購読解除はストア初期化より先に走る。
  web/src/app/ReviewPage.tsx:49-54
- web のテストは jsdom で `@testing-library` がない。**React フックそのものはテストできない**。
  `useCameraBroadcast` も純粋関数 `shouldSendCamera` だけがテストされている。
  web/tests/camera-broadcast.test.ts
- `web/tests/summary-coverage.test.ts` が、src の全ファイルが最寄りの `_Summary.md` に
  相対パスで載っていること、`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に
  載っていることを機械的に検査する。

## インターフェイス契約

### 新規 web/src/features/viewer/send-throttle.ts

`camera-throttle.ts` の内部ロジックを**そのまま**値の型 `T` へ一般化したもの。
挙動を変えてはならない。`markSent` だけが新しい。

```ts
export interface SendThrottleDeps<T> {
  /** 送信。false なら未送信扱い(タイマーまたは次の更新で再試行) */
  send: (value: T) => boolean;
  now: () => number;
  /** delayMs 後に fn を呼ぶ。戻り値はキャンセル関数 */
  schedule: (fn: () => void, delayMs: number) => () => void;
  /** 同値判定。等しければ送信しない */
  equals: (a: T, b: T) => boolean;
  /** 値の複製。保持する値は必ずこれを通す */
  clone: (value: T) => T;
  /** 送信間隔(ms) */
  intervalMs: number;
}

export interface SendThrottle<T> {
  /** 最新値を通知する。間隔内なら保持し、窓明けに最新値だけを送る */
  update(value: T): void;
  /**
   * 送信せずに「最後に送った値」として記録し、保留中の送信を捨てる。
   * 最終送信時刻は更新しない(次の変更は間隔を待たずに送れる)。
   */
  markSent(value: T): void;
  /** 保留中の送信とタイマーを破棄する */
  dispose(): void;
}

export function createSendThrottle<T>(deps: SendThrottleDeps<T>): SendThrottle<T>;
```

### 変更 web/src/features/viewer/camera-throttle.ts

**公開インターフェイスは現状のまま変えない。**`CameraPayload` / `payloadEquals` /
`CameraThrottleDeps` / `clonePayload`(非公開)は残し、実装を `createSendThrottle` へ委譲する。

```ts
export type CameraThrottle = SendThrottle<CameraPayload>;

export function createCameraThrottle(deps: CameraThrottleDeps): CameraThrottle {
  return createSendThrottle<CameraPayload>({
    ...deps,
    intervalMs: deps.intervalMs ?? CAMERA_SEND_INTERVAL_MS,
    equals: payloadEquals,
    clone: clonePayload,
  });
}
```

`CameraThrottleDeps` の `intervalMs?: number` はそのまま残す。
`CameraThrottle` は `interface` から上記の `type` 別名に変わる(`markSent` が増えるだけ)。

### 新規 web/src/features/viewer/useLightBroadcast.ts

```ts
import type { LightAngles } from "@shared/types";
import type { ClientMessage } from "@shared/protocol";
import type { LightAnglesOrigin } from "../../store/lighting";
import type { SendThrottle } from "./send-throttle";

/** yaw と pitch が厳密に等しいか。 */
export function lightAnglesEqual(a: LightAngles, b: LightAngles): boolean;

/** lighting ストアの変化1回ぶんの入力。 */
export interface LightingChange {
  angles: LightAngles;
  origin: LightAnglesOrigin;
}

/**
 * lighting ストアの変化1回ぶんを throttle へ伝える。React に依存しない。
 * origin が "remote" のときは送信せず markSent だけを行う(受信値を送り返さない)。
 */
export function onLightingChange(throttle: SendThrottle<LightAngles>, change: LightingChange): void;

/** lighting ストアの局所的な変更を light メッセージとして送る。 */
export function useLightBroadcast(send: (msg: ClientMessage) => boolean): void;
```

`useLightBroadcast` の中身は次の形にする。

```ts
useEffect(() => {
  const throttle = createSendThrottle<LightAngles>({
    send: (angles) => send({ type: "light", angles }),
    now: () => performance.now(),
    schedule: (fn, delayMs) => {
      const timeout = setTimeout(fn, delayMs);
      return () => clearTimeout(timeout);
    },
    equals: lightAnglesEqual,
    clone: (angles) => ({ ...angles }),
    intervalMs: LIGHT_SEND_INTERVAL_MS,
  });

  const unsubscribe = useLightingStore.subscribe((state) => onLightingChange(throttle, state));
  return () => {
    throttle.dispose();
    unsubscribe();
  };
}, [send]);
```

### 変更 web/src/app/ReviewPage.tsx

props と返り値は変えない。`useCameraBroadcast(realtime.send);` の直後に1行足すだけ。

```tsx
useCameraBroadcast(realtime.send);
useLightBroadcast(realtime.send);
```

## 振る舞い

### lightAnglesEqual(web/tests/light-broadcast.test.ts)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `({ yaw: 1, pitch: 0.5 }, { yaw: 1, pitch: 0.5 })` | `true` |
| 同じ値の別オブジェクト同士 | `true` |
| `({ yaw: 1, pitch: 0.5 }, { yaw: 1.0000001, pitch: 0.5 })` | `false`(厳密比較。epsilon を使わない) |
| `({ yaw: 1, pitch: 0.5 }, { yaw: 1, pitch: -0.5 })` | `false` |
| `({ yaw: 0, pitch: 0 }, { yaw: -0, pitch: 0 })` | `true`(`0 === -0`) |

### onLightingChange(web/tests/light-broadcast.test.ts)

`update` / `markSent` / `dispose` を `vi.fn()` にしたスタブ throttle で検証する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `origin: "local"` | `update(angles)` が1回。`markSent` は呼ばれない |
| `origin: "remote"` | `markSent(angles)` が1回。`update` は呼ばれない |
| どちらの場合も渡す値 | `change.angles` と同一の値(`toEqual`) |
| `origin: "local"` を3回連続 | `update` が3回 |
| `"local"` → `"remote"` → `"local"` | `update` 2回、`markSent` 1回。順序もこのとおり |

### createSendThrottle(web/tests/send-throttle.test.ts)

テスト内に最小の擬似クロック(`now` と `schedule` を差し替え、時間を進められるもの)を
書いて使う。`equals` は厳密比較、`clone` は複製とする。
既存の `camera-throttle.test.ts` が本体ロジックを網羅しているので、ここは
**`markSent` と汎用化の確認**に絞ってよい。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `update("a")` を最初に呼ぶ | `send("a")` が即座に1回 |
| `update("a")` のあと間隔内に `update("b")` | `send("b")` は呼ばれない。窓明けに `send("b")` が1回 |
| `update("a")` のあと `markSent("b")` して窓明け | `send` が追加で呼ばれない(保留が捨てられる) |
| `markSent("b")` の直後に `update("b")` | `send` が呼ばれない(送信済み扱い) |
| `markSent("b")` の直後に `update("a")` | `send("a")` が呼ばれる(値が違う) |
| `update("a")` → `markSent("b")` → 間隔未満で `update("c")` | `send("c")` はすぐには呼ばれず、窓明けに1回 |
| `dispose()` のあとの `markSent` / `update` | `send` が呼ばれない |
| `send` が `false` を返した直後の `markSent` | 以降その値では送らない |
| `clone` が呼ばれること | `markSent` に渡したオブジェクトを後から書き換えても判定に影響しない |

### 結線後の全体像(この表は直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| ギズモを左右にドラッグ | 50ms ごとに `light` が送られ、同室の全員のライトが追従する |
| ドラッグを止めた | 最後の向きが必ず1回送られる(トレーリング送信) |
| 他の参加者のライト変更を受信した | 自分の画面が追従し、**受信した値を送り返さない** |
| 受信した向きから自分が回した | 受信値を起点に送信される |
| ライトギズモの「ライトを戻す」 | 既定の向きが送信され、全員のライトが戻る |
| 切断中にライトを回した | 送信は失敗し、再接続後の最初の変更で最新の向きが送られる |
| レビュー画面を離れた | 購読が解除され、`resetReviewStores()` による初期化は送信されない |
| ライト以外(カメラ・焦点距離・線) | 従来どおりの送信のまま変わらない |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **`camera-throttle.ts` の挙動を変えてはならない。** 中身を `send-throttle.ts` へ移し、
  `createCameraThrottle` はそれを呼ぶだけの薄い包みにする。
  `web/tests/camera-throttle.test.ts` が無変更で通ることが、正しく移せたことの証拠になる
- `markSent` は **`lastSentAt` を更新しない**。受信は自分の送信ではないので、
  送信間隔を消費させてはならない
- `markSent` は保留中の値とタイマーを捨てる。捨てないと、受信で上書きされた古い
  自分の値が窓明けに送られてしまう
- エコー防止は `origin` で行う。「送った値と同じなら送らない」だけに頼らない。
  受信のたびに送り返すと、参加者が増えるほど往復が増える
- `onLightingChange` を `useLightBroadcast` から独立した関数として export するのは、
  jsdom でフックをテストできないためである。フックの中にロジックを埋め込まないこと
- `useLightBroadcast` は送信成功時に何も追加更新しない。
  `useCameraBroadcast` が presence を更新しているのは自分のカメラを一覧に出すためで、
  ライトにはそれに当たるものがない
- 購読は `useLightingStore.subscribe(listener)` の**引数1つの形**を使う
  (`useCameraBroadcast` と同じ)。セレクタ付きの `subscribeWithSelector` は導入しない
- `LIGHT_SEND_INTERVAL_MS` を使う。`CAMERA_SEND_INTERVAL_MS` を流用しない
- 新規テストファイルは `web/tests/send-throttle.test.ts` と
  `web/tests/light-broadcast.test.ts` の2つ。両方を viewer_Summary.md のテスト節に書く
- `viewer_Summary.md` と `app_Summary.md` は 060 でも更新される。
  060 のマージ後の内容を土台に書き足すこと

## やらないこと
- `shared/` と `server/` を変更しない(060 で完了している)
- `web/src/store/lighting.ts` / `realtime-dispatch.ts` を変更しない(060 で完了している)
- `useCameraBroadcast.ts` / `shouldSendCamera` / `camera-throttle.test.ts` /
  `camera-broadcast.test.ts` を変更しない
- `createCameraThrottle` / `CameraPayload` / `payloadEquals` / `CameraThrottleDeps` の
  公開シグネチャを変えない。`camera` メッセージの送信間隔や判定を変えない
- `SceneLights.tsx` / `LightGizmo.tsx` / `light-gizmo.ts` / `viewer-pointer.ts` /
  `CameraRig.tsx` / `ViewerHud.tsx` / `viewer.css` / `hud-labels.ts` を変更しない
- ライトの向きの送信に別の間隔・デバウンス・`requestAnimationFrame` を導入しない
- ドラッグの開始/終了を検知して送信をまとめる、といった最適化をしない
- 競合解決(順序制御・タイムスタンプ・ロック)を作らない。後勝ちのままにする
- ライトの向きを localStorage に保存しない
- `ReviewPage.tsx` の他の部分(レイアウト・取得処理・ショートカット・設定ダイアログ)を変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] `web/tests/camera-throttle.test.ts` を1行も変更せずに通る
- [ ] `web/tests/summary-coverage.test.ts` が通る(新規2ファイルが Summary にある)
- [ ] `viewer_Summary.md` と `app_Summary.md` が実態に合っている
      (`send-throttle.ts` / `useLightBroadcast.ts` の追加、`camera-throttle.ts` の委譲、
      `ReviewPage` がライト送信も結線すること)
- [ ] すべてのファイルが300行以内(Summary を含む)
- [ ] `npm run typecheck && npm run test:web` が成功する
