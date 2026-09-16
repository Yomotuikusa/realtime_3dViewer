---
id: 149
title: web ルーム共有のライトの明るさをストア・受信・送信・ギズモのスライダーへ結線する
feature: viewer
depends_on: [148, 144, 146]
owns: [web/src/store/lighting.ts, web/src/store/store_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/src/features/viewer/lighting.ts, web/src/features/viewer/SceneLights.tsx, web/src/features/viewer/LightGizmo.tsx, web/src/features/viewer/useLightBrightnessBroadcast.ts, web/src/features/viewer/hud-labels.ts, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/tests/store-lighting.test.ts, web/tests/realtime-dispatch.test.ts, web/tests/light-brightness-broadcast.test.ts, web/tests/hud-labels.test.ts, web/tests/light-gizmo.test.ts, web/tests/lighting.test.ts, web/tests/viewer-styles.test.ts, web/tests/review-stores.test.ts]
reads: [shared/src/types.ts, shared/src/protocol.ts, shared/shared_Summary.md, web/src/features/viewer/useLightBroadcast.ts, web/src/features/viewer/send-throttle.ts, web/src/features/viewer/light-gizmo.ts, web/src/app/review-stores.ts, web/tests/light-broadcast.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, docs/3dreviewer-plan-and-architecture.md, docs/DESIGN_SKILL.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
148 で protocol と RoomHub に入った `light:brightness` を web に結線する(設計書 §13.5 の 4 点セットの 3. 受信反映と 4. 送信側 UI)。
明るさは既定の 3 灯の強さに掛ける倍率で、ライトギズモの下のスライダーで変え、向きと同じ throttle で送る。

## 前提
- shared(148): `MIN_LIGHT_BRIGHTNESS` 0.25 / `MAX_LIGHT_BRIGHTNESS` 4 / `DEFAULT_LIGHT_BRIGHTNESS` 1、`LightBrightnessSchema`(`shared/src/types.ts`)。
  `ClientMessage` `{ type: "light:brightness"; brightness }`、`ServerMessage` `{ type: "light:brightness"; userId; brightness }`、welcome の `lightBrightness?: number`。
  `web/src/app/realtime-dispatch.ts` には `case "light:brightness": break;` の仮分岐が入っている
- ストア `web/src/store/lighting.ts`(全 47 行): `LightingStoreState { angles; origin: LightAnglesOrigin; applyRemote(angles); rotate(dx, dy); reset() }`。
  `origin` は送信側のエコー防止用(`"local" | "remote"`)。`reset()` は `resetReviewStores()`(`web/src/app/review-stores.ts:14-23`)から呼ばれる
- 送信 `web/src/features/viewer/useLightBroadcast.ts`(全 51 行): `lightAnglesEqual`、`LightingChange { angles; origin }`、
  `onLightingChange(throttle, change)`(`:18-28`。local なら `throttle.update`、remote なら `throttle.markSent`)、
  `useLightBroadcast(send)`(`:30-51`。`createSendThrottle<LightAngles>` に `send` / `now` / `schedule` / `equals` / `clone` / `intervalMs: LIGHT_SEND_INTERVAL_MS` を渡し、
  `useLightingStore.subscribe` で `onLightingChange` を呼ぶ)。`send-throttle.ts` の `createSendThrottle<T>(deps)` は汎用
- `web/src/app/ReviewPage.tsx:91-92` `useCameraBroadcast(realtime.send); useLightBroadcast(realtime.send);`
- 受信 `realtime-dispatch.ts:48-50` `case "light": lighting.applyRemote(msg.angles); break;`、welcome は `:28-30` `if (msg.light !== undefined) lighting.applyRemote(msg.light);`
- 描画 `SceneLights.tsx`(全 21 行): `AMBIENT_LIGHT_INTENSITY` 0.9 / `KEY_LIGHT_INTENSITY` 2.2 / `FILL_LIGHT_INTENSITY` 0.5(`lighting.ts:9-11`)を `intensity` に渡す。
  `lighting.test.ts:67` が 3 定数を `[0.9, 2.2, 0.5]` で固定(値は変えない)
- ギズモ `LightGizmo.tsx`: `<div className="light-gizmo" role="group" aria-label={LIGHT_DIRECTION_LABEL}>` の中に `.light-gizmo__stage`(role slider)と `.light-gizmo__reset` ボタン(`onClick={() => useLightingStore.getState().reset()}`)。
  146 で `handlePointerMove` に感度が入っている。`viewer.css:221-257`(ファイル末尾)に `.light-gizmo` / `__stage` / `__reset` の規則
- 文言 `hud-labels.ts:22, 24` `LIGHT_RESET_LABEL = "ライトリセット"`、`LIGHT_DIRECTION_LABEL = "ライトの向き"`(テストは `hud-labels.test.ts`)
- テスト: `store-lighting.test.ts`(`:13-70` の 6 件)、`realtime-dispatch.test.ts:229, 240`(light の event / welcome)、`light-broadcast.test.ts:21-63`(throttle の 5 件。写す形)、
  `light-gizmo.test.ts:69-80`(LightGizmo ソースの `rotation={[0, GIZMO_BOX_ROTATION_Y, 0]}` 契約。`:79`)、`viewer-styles.test.ts`(viewer.css)、
  `review-stores.test.ts:70`(reset 後の lighting は `angles` だけを `toEqual` で見ている。フィールド追加で壊れないが、brightness の復帰も同じ場所で固定する)。
  `light-broadcast.test.ts` は `createSendThrottle` を使わず `{ update: vi.fn(), markSent: vi.fn(), dispose: vi.fn() }` のスタブに `onLightingChange` を直接呼ぶ形
- CSS 規約(D35): 生の色を書かない、状態は属性セレクタ。`accent-color: var(--color-accent)` の例は `outliner.css:112-119`
- `store_Summary.md:8, 26`(lighting.ts)、`viewer_Summary.md:8, 9, 31, 49, 55, 68, 85`、`app_Summary.md:57`(realtime-dispatch.test.ts)

## インターフェイス契約

```ts
// web/src/features/viewer/lighting.ts(既存 export はすべて残す)
/** スライダーの刻み */
export const LIGHT_BRIGHTNESS_STEP = 0.25;
/** 3 灯の強さに brightness を掛けた値。brightness が有限数でなければ 1 として扱う */
export function scaledLightIntensities(brightness: number): { ambient: number; key: number; fill: number };
```

```ts
// web/src/store/lighting.ts
export interface LightingStoreState {
  angles: LightAngles;
  origin: LightAnglesOrigin;
  /** ルーム共有の明るさ(倍率)。既定 DEFAULT_LIGHT_BRIGHTNESS */
  brightness: number;
  /** 直近の brightness 更新の出どころ。angles の origin とは独立 */
  brightnessOrigin: LightAnglesOrigin;
  applyRemote(angles: LightAngles): void;
  /** MIN〜MAX に丸めて brightnessOrigin を "remote" にする */
  applyRemoteBrightness(brightness: number): void;
  rotate(deltaX: number, deltaY: number): void;
  /** 有限数でなければ無視。MIN〜MAX に丸め、同値なら何もしない。brightnessOrigin を "local" にする */
  setBrightness(brightness: number): void;
  /** angles と brightness の両方を既定に戻し、origin / brightnessOrigin を "local" にする */
  reset(): void;
}
```

```ts
// web/src/features/viewer/useLightBrightnessBroadcast.ts(新規。useLightBroadcast.ts と同じ構造)
export interface LightBrightnessChange { brightness: number; brightnessOrigin: LightAnglesOrigin }
/** local なら throttle.update(brightness)、remote なら throttle.markSent(brightness) */
export function onLightBrightnessChange(throttle: SendThrottle<number>, change: LightBrightnessChange): void;
/** createSendThrottle<number>({ send: (b) => send({ type: "light:brightness", brightness: b }), equals: Object.is, clone: (b) => b, intervalMs: LIGHT_SEND_INTERVAL_MS, … })
 *  を作り、useLightingStore.subscribe で onLightBrightnessChange を呼ぶ。cleanup で dispose と unsubscribe */
export function useLightBrightnessBroadcast(send: (msg: ClientMessage) => boolean): void;
```

```ts
// web/src/app/realtime-dispatch.ts
//   case "light:brightness": lighting.applyRemoteBrightness(msg.brightness); break;
//   welcome: if (msg.lightBrightness !== undefined) lighting.applyRemoteBrightness(msg.lightBrightness);
// web/src/app/ReviewPage.tsx:92 の直後に useLightBrightnessBroadcast(realtime.send);
```

```ts
// web/src/features/viewer/hud-labels.ts(追加)
export const LIGHT_BRIGHTNESS_LABEL = "ライトの明るさ";
/** "×1.00" の形 */
export function brightnessText(brightness: number): string;
```

```tsx
// web/src/features/viewer/SceneLights.tsx
//   const brightness = useLightingStore((state) => state.brightness);
//   const { ambient, key, fill } = scaledLightIntensities(brightness);  → 3 灯の intensity に渡す

// web/src/features/viewer/LightGizmo.tsx(.light-gizmo__stage と .light-gizmo__reset の間に置く)
<input
  className="light-gizmo__brightness"
  type="range"
  min={MIN_LIGHT_BRIGHTNESS}
  max={MAX_LIGHT_BRIGHTNESS}
  step={LIGHT_BRIGHTNESS_STEP}
  value={brightness}
  aria-label={LIGHT_BRIGHTNESS_LABEL}
  aria-valuetext={brightnessText(brightness)}
  title={LIGHT_BRIGHTNESS_LABEL}
  onChange={(event) => useLightingStore.getState().setBrightness(Number(event.currentTarget.value))}
/>
// リセットボタンは従来どおり reset()(向きと明るさの両方が戻る)
```

```css
/* web/src/features/viewer/viewer.css(追加) */
.light-gizmo__brightness { width: 100%; accent-color: var(--color-accent); cursor: pointer; }
```

## 振る舞い

### ストア(`store-lighting.test.ts`、`review-stores.test.ts`)
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `brightness === DEFAULT_LIGHT_BRIGHTNESS`、`brightnessOrigin === "local"`。既存の angles の初期値テストは変わらない |
| `setBrightness(2)` | `brightness === 2`、`brightnessOrigin === "local"`、`angles` / `origin` は変わらない |
| `setBrightness(2)` を 2 回 | 2 回目で state の参照が変わらない |
| `setBrightness(10)` / `(0)` | 4 / 0.25 |
| `setBrightness(NaN)` / `(Infinity)` | 無視(値も origin も変わらない) |
| `applyRemoteBrightness(3)` | `brightness === 3`、`brightnessOrigin === "remote"`。`origin`(angles)は変わらない |
| `applyRemoteBrightness(9)` | 4 に丸める |
| `rotate(10, 0)` の後 | `origin === "local"` だが `brightnessOrigin` は直前のまま |
| `reset()` | `brightness === DEFAULT_LIGHT_BRIGHTNESS`、`brightnessOrigin === "local"`、angles も既定 |
| `resetReviewStores()` | `angles` が既定(既存の `review-stores.test.ts:70` はそのまま通る)に加え、`brightness === DEFAULT_LIGHT_BRIGHTNESS` と `brightnessOrigin === "local"` を同じテストに足して固定する |

### 受信(`realtime-dispatch.test.ts`)
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "light:brightness", userId: "u2", brightness: 2 }` | `brightness === 2`、`brightnessOrigin === "remote"` |
| welcome に `lightBrightness: 0.5` | `brightness === 0.5`、`"remote"` |
| welcome に `lightBrightness` 無し | 既定のまま(既存の「keeps the default light when welcome has no light」と同じ形で追加) |

### 送信(`light-brightness-broadcast.test.ts`。`light-broadcast.test.ts` の 5 件を写す)
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `onLightBrightnessChange(throttle, { brightness: 2, brightnessOrigin: "local" })` | `throttle.update(2)` が呼ばれ、`markSent` は呼ばれない |
| 連続した local 変更 | 毎回 `update` |
| `brightnessOrigin: "remote"` | `markSent(2)` が呼ばれ、`update` は呼ばれない |
| local と remote が交互 | 呼び出し順が保たれる |
| `useLightBrightnessBroadcast.ts` のソース | `createSendThrottle<number>`、`type: "light:brightness"`、`LIGHT_SEND_INTERVAL_MS`、`useLightingStore.subscribe` を含む |
| `ReviewPage.tsx` のソース | `useLightBroadcast(realtime.send);` の直後に `useLightBrightnessBroadcast(realtime.send);` がある |

### 描画・UI・文言
| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `scaledLightIntensities(1)` | `{ ambient: 0.9, key: 2.2, fill: 0.5 }`(3 定数と一致) |
| `scaledLightIntensities(2)` / `(NaN)` | 各 2 倍 / `(1)` と同じ |
| `LIGHT_BRIGHTNESS_STEP` | 0.25 |
| `brightnessText(1)` / `(0.25)` | `"×1.00"` / `"×0.25"` |
| `LIGHT_BRIGHTNESS_LABEL` | `"ライトの明るさ"` |
| `SceneLights.tsx` のソース | `scaledLightIntensities(` と `state.brightness` を含み、`AMBIENT_LIGHT_INTENSITY` 等を `intensity=` に直接渡していない |
| `LightGizmo.tsx` のソース | `className="light-gizmo__brightness"`、`type="range"`、`min={MIN_LIGHT_BRIGHTNESS}`、`max={MAX_LIGHT_BRIGHTNESS}`、`step={LIGHT_BRIGHTNESS_STEP}`、`setBrightness(` を含む。既存の `light-gizmo.test.ts:69-80` の契約は変わらない |
| `viewer.css` | `.light-gizmo__brightness` に `accent-color: var(--color-accent)` があり、生の色を含まない |

### 目視確認(マージ後に人間が行う)
| 操作 | 期待する結果 |
| --- | --- |
| 2 つのブラウザで同じレビューを開き、片方でスライダーを ×4 | もう片方のモデルも明るくなる(50ms 程度の遅れ) |
| 3 人目が後から入室 | 入室直後から ×4 の明るさ |
| 「ライトリセット」 | 向きと明るさの両方が全員で既定に戻る |
| ライト / ダークテーマ | スライダーがテーマ色で描かれ、ギズモの幅に収まる |

## やらないこと
- 明るさをテーマ・view-settings(端末ローカル)に置かない
- `useLightBroadcast.ts` / `send-throttle.ts` は変更しない(同じ構造で別ファイル)
- 3 灯の既定の強さの値は変えない
- 矢印キーで明るさは変えない(スライダーのネイティブ操作に任せる)
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] store_Summary.md / viewer_Summary.md / app_Summary.md が更新されている(新ファイル、新テスト、`light:brightness` の受信)
- [ ] 実装役は docs/DESIGN_SKILL.md §16 の監査結果を最終メッセージに書く(D38)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
