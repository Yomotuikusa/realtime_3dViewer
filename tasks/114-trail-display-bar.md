---
id: 114
title: web HUD に選択ボーンの軌跡表示の切り替えを置く
feature: trail
depends_on: [113]
owns: [web/src/features/trail/TrailBar.tsx, web/src/features/trail/trail-labels.ts, web/src/features/trail/trail-icons.tsx, web/src/features/trail/trail_Summary.md, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/trail-bar.test.ts]
reads: [web/src/features/joint/JointDisplayBar.tsx, web/src/features/joint/joint-icons.tsx, web/src/features/joint/joint-labels.ts, web/src/features/trail/trail-target.ts, web/src/features/compare/model-scenes.ts, web/src/features/outliner/selection.ts, web/src/store/display.ts, web/src/features/viewer/viewer.css, web/tests/joint-display-bar.test.ts, shared/src/trail.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
選択中のボーンの軌跡を、HUD のボタン 1 つで出し入れできるようにする。
押した時点の選択ボーンを共有鍵(`ObjectPartRef`)へ変換して送るので、
ルームの全員が同じボーンの軌跡を見る。

## 前提
- 同じ形の常設アイコンバーが既に 2 つある。`web/src/features/joint/JointDisplayBar.tsx` が
  最も近い前例で、`className="hud-display"` の `role="group"` の中に
  `className="btn hud-display__btn"` のボタンを並べ、アイコンは
  `className="hud-display__icon"` の inline SVG(`web/src/features/joint/joint-icons.tsx`)を使う。
  **CSS は viewer.css の `.hud-display` 系をそのまま再利用するので、新しい CSS は書かない**
- 送信の作法は設計書 §13.5 の 4 点目。**ローカルの display ストアを先に更新してから `send` する**
  (サーバは送信者に返さない)。同値のときは `motionTrailEquals` で弾いて送らない
- 共有値は `MotionTrail = { visible: boolean; target: ObjectPartRef | null }`(110、`shared/src/trail.ts`)。
  `motionTrailEquals` / `cloneMotionTrail` / `DEFAULT_MOTION_TRAIL` も同じファイルにある
- 選択は `web/src/features/outliner/selection.ts` の `useSelectionStore`。
  `{ versionId, objectId }` の `objectId` は `Object3D.uuid` でクライアントごとに変わるため、
  **そのままでは送れない**。`web/src/features/trail/trail-target.ts`(112)の
  `objectPartRefOf(scenes, object)` で `ObjectPartRef` へ直してから送る
- scene は `web/src/features/compare/model-scenes.ts` の `useModelScenesStore` と
  `selectModelScene(scenes, versionId)`。uuid から Object3D は
  `scene.getObjectByProperty("uuid", objectId)` で引ける
- `web/tests/joint-display-bar.test.ts` が `ViewerHud.tsx` を検査しており、
  `<JointDisplayBar send={send} />` がちょうど 1 つあること、
  `<DisplayModeBar send={send} />` より後にあること、
  `expect(viewerHudText).not.toContain("useDisplayStore")` を含む。
  `<TrailBar send={send} />` を `<JointDisplayBar send={send} />` の直後へ置き、
  display ストアの購読は `TrailBar.tsx` の中だけで行えばこの検査は通る

## インターフェイス契約

### 新規 `web/src/features/trail/trail-labels.ts`

```ts
/** 軌跡バーの role="group" の aria-label */
export const TRAIL_DISPLAY_LABEL = "モーション軌跡の表示";
/** 表示トグルのボタン名(aria-label / title) */
export const TRAIL_VISIBLE_LABEL = "モーション軌跡";
/** ボーンが選ばれていないときのボタンの title */
export const TRAIL_NO_BONE_HINT = "ボーンを選ぶと軌跡を表示できます";
```

### 新規 `web/src/features/trail/trail-icons.tsx`

`joint-icons.tsx` と同じ流儀で、形状を定数として出してから SVG を組む。

```ts
export const TRAIL_VIEW_BOX = "0 0 16 16";
/** 軌跡を表す弧。左下から右上へ弧を描く */
export const TRAIL_ARC_PATH = "M2.5 12.5C5.5 12.5 8.5 9.5 13.5 3.5";
/** 弧の上に並べるフレーム点の中心 [cx, cy] */
export const TRAIL_DOTS: readonly (readonly [number, number])[];
/** フレーム点の半径 */
export const TRAIL_DOT_RADIUS = 1.1;

/** 弧と、その上に並ぶフレーム点 */
export function TrailIcon(): ReactElement;
```

`TrailIcon` は `className="hud-display__icon"`、`viewBox={TRAIL_VIEW_BOX}`、
`aria-hidden="true"`、`focusable="false"`、`fill="none"`、`stroke="currentColor"`、
`strokeWidth="1"` を持ち、`TRAIL_ARC_PATH` の `<path>` の後に
`TRAIL_DOTS` の数だけ `<circle … fill="currentColor" stroke="none" />` を並べる。
`TRAIL_DOTS` は 3 点以上とし、末尾の点だけ `r={TRAIL_DOT_RADIUS * 1.6}` で
現在位置として大きく描く。

### 新規 `web/src/features/trail/TrailBar.tsx`

```ts
export function TrailBar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

内部で次を求める。

- `selectedTarget: ObjectPartRef | null`
  選択があり、その版の scene が登録済みで、`getObjectByProperty("uuid", objectId)` の結果が
  `Bone` のインスタンスであるときだけ `objectPartRefOf(scenes, bone)` の値。
  それ以外(選択なし / 版が未登録 / 見つからない / Bone でない)は null
- ボタンの `disabled` は `selectedTarget === null && !motionTrail.visible`
- ボタンの `aria-pressed` は `motionTrail.visible`
- ボタンの `title` と `aria-label` は、`disabled` のとき `TRAIL_NO_BONE_HINT`、
  そうでなければ `TRAIL_VISIBLE_LABEL`

クリック時に作る次の値を `applyTrail(next)` へ渡す。

```ts
const next: MotionTrail =
  motionTrail.visible && (selectedTarget === null || isSameObjectPart(selectedTarget, motionTrail.target))
    ? { visible: false, target: motionTrail.target }
    : { visible: true, target: selectedTarget };
```

`applyTrail` は `motionTrailEquals(motionTrail, next)` なら何もせず、
そうでなければ `setMotionTrail(next)` を呼んでから
`send({ type: "trail:display", trail: next })` を呼ぶ(`JointDisplayBar` の `applyDisplay` と同じ形)。
`motionTrail.target` が null のときの比較は `isSameObjectPart` を使わず `null` 判定で行う。

### `web/src/features/viewer/ViewerHud.tsx`

`<JointDisplayBar send={send} />` の直後へ `<TrailBar send={send} />` を置く。
import は `import { TrailBar } from "../trail/TrailBar";`。他は変えない。

## 振る舞い

| 状況 | 期待する結果 |
| --- | --- |
| 選択なし・非表示 | ボタンが `disabled`、`aria-pressed` が false |
| メッシュを選択中(Bone でない)・非表示 | `disabled` |
| 版ルートを選択中・非表示 | `disabled`(`objectPartRefOf` が null を返すため) |
| 選択の版が `scenes` に無い・非表示 | `disabled` |
| ボーン選択あり・非表示 | 有効。押すと `{ visible: true, target: 選択ボーンの ObjectPartRef }` をストアへ入れて送信 |
| ボーン選択あり・表示中・target が同じボーン | 押すと `{ visible: false, target: そのまま }` |
| ボーン選択あり・表示中・target が別のボーン | 押すと `{ visible: true, target: 選択ボーン }` |
| 選択なし・表示中 | 有効(`disabled` でない)。押すと `{ visible: false, target: 現在の target }` |
| Bone 以外を選択中・表示中 | 押すと `{ visible: false, target: 現在の target }` |
| 送る値が現在値と `motionTrailEquals` で同値 | `setMotionTrail` も `send` も呼ばない |
| 送信前後の順序 | `setMotionTrail` が `send` より先に呼ばれる |
| `send` が false を返す(未接続) | ストアの更新は取り消さない(`JointDisplayBar` と同じ) |
| `aria-pressed` | `motionTrail.visible` と一致する |
| `disabled` のときの `title` / `aria-label` | `TRAIL_NO_BONE_HINT` |
| 有効なときの `title` / `aria-label` | `TRAIL_VISIBLE_LABEL` |
| ラベル 3 つ | 空文字でなく、日本語を含む |
| `TrailIcon` | `hud-display__icon` を持ち、子が `1 + TRAIL_DOTS.length` 個。先頭が `TRAIL_ARC_PATH` の path |
| `TRAIL_DOTS` の末尾の点 | 半径が他より大きい |
| ViewerHud | `<TrailBar send={send} />` がちょうど 1 つで、`<JointDisplayBar send={send} />` より後、`hud-menus` の `</div>` より前 |
| ViewerHud のソース | `useDisplayStore` を含まない(既存検査) |

## やらないこと
- 新しい CSS。viewer.css の `.hud-display` / `.hud-display__btn` / `.hud-display__icon` を再利用する
- `web/src/features/viewer/viewer.css` と `web/src/features/joint/` の変更
- `web/src/features/trail/TrailRig.tsx` / `trail-overlay.ts` / `trail-target.ts` の変更(112 / 113 の成果物)
- キーボードショートカットの割り当て。`features/shortcuts` には触れない
- 対象ボーン名の表示や、軌跡の色・前後フレーム数の設定 UI。必要になったら別タスクで行う
- 既存テストの `expect` の削除・緩和。`joint-display-bar.test.ts` の ViewerHud 検査は
  `<TrailBar send={send} />` を `<JointDisplayBar send={send} />` の直後へ置けばそのまま通る

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] trail_Summary.md と viewer_Summary.md が更新されている
- [ ] すべてのファイルが300行以内(viewer_Summary.md は現在 159 行)
- [ ] verify: に書いたコマンドが成功する
