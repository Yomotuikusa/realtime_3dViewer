---
id: 147
title: web ジョイント球の大きさとピック半径を表示設定から取る
feature: joint
depends_on: [144]
owns: [web/src/features/joint/joint-display.ts, web/src/features/joint/joint-highlight.ts, web/src/features/joint/joint-pick.ts, web/src/features/joint/JointRig.tsx, web/src/features/joint/joint_Summary.md, web/tests/joint-display.test.ts, web/tests/joint-highlight.test.ts, web/tests/joint-pick.test.ts, web/tests/joint-rig.test.ts]
reads: [web/src/store/view-settings.ts, web/src/features/view-settings/view-settings.ts, web/src/features/view-settings/view-settings_Summary.md, web/src/features/outliner/SelectionPickLayer.tsx, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
144 が定義した `jointRadiusScale` を球と選択マーカーの半径に掛け、`jointPickRadiusPx` を `pickJoint` の引数にする。
ピック側の呼び出し元(`SelectionPickLayer.tsx`、outliner フォルダ)の結線は 145 が行うので、ここでは省略可能な引数として足す。

## 前提
- 144 のストア: `useViewSettingsStore`、`selectViewSetting(key)`。既定値は `jointRadiusScale` 1、`jointPickRadiusPx` 12
- `web/src/features/joint/joint-display.ts:25` `JOINT_RADIUS_RATIO = 0.008`、`:27` `JOINT_FALLBACK_RADIUS = 0.01`。
  `jointRadius(root)`(`:109-116`)は最大辺長 × 比、辺長 0 なら fallback。`addJointOverlay(root, colors)`(`:128`)が
  `new SphereGeometry(jointRadius(root), 8, 6)`(`:137`)で球を作り、既に overlay があればそれを返す(冪等。`joint-display.test.ts:71`)
- `web/src/features/joint/joint-highlight.ts:10` `SELECTED_JOINT_RADIUS_SCALE = 1.8`。`addSelectedJointMarker(root, bone, color)`(`:34`)が
  `new SphereGeometry(jointRadius(root) * SELECTED_JOINT_RADIUS_SCALE, 12, 8)`(`:49`)
- `web/src/features/joint/joint-pick.ts:7` `JOINT_PICK_RADIUS_PX = 12`。`pickJoint(camera, ndc, viewport, scenes)`(`:17-22`。`Ndc` は `viewer/pick.ts:4-7` の export で import 済み)が
  `let closestDistance = JOINT_PICK_RADIUS_PX`(`:24`)を初期値にする。呼び出し元は `outliner/SelectionPickLayer.tsx:40`
- `web/tests/joint-rig.test.ts:28` は overlay の effect の deps 配列をソース文字列で固定している。`radiusScale` を足した配列に書き換える。
  x-ray の effect(`JointRig.tsx:44-45`)の deps は変えない
- `JointRig.tsx:25-30` は display / model-scenes / selection / theme(3 色)を読み、`:33-38` の effect が
  `addJointOverlay(scene, { joint, link })` と cleanup `removeJointOverlay(scene)`、`:50-59` が選択マーカーの追加・削除、
  `:63-71` の `useFrame` が `updateJointOverlay` / `updateSelectedJointMarker` を呼ぶ
- 固定しているテスト: `joint-display.test.ts:106`(`radius === 2 * JOINT_RADIUS_RATIO`)、`joint-pick.test.ts:47`(`JOINT_PICK_RADIUS_PX === 12`)、
  `joint-rig.test.ts:18`(`export function JointRig(): null` のソース契約)
- `joint_Summary.md:9-12` が各ファイルの説明、`:31-38` が `## テスト`

## インターフェイス契約

```ts
// web/src/features/joint/joint-display.ts(既存 export はすべて残す)
/** root 配下全体の大きさからジョイント球の半径を求め、scale(既定 1)を掛ける。fallback にも掛ける */
export function jointRadius(root: Object3D, scale?: number): number;
/** 球の半径に radiusScale(既定 1)を掛ける。既に overlay があればそれを返す(従来どおり) */
export function addJointOverlay(root: Object3D, colors: JointColors, radiusScale?: number): JointOverlay | null;

// web/src/features/joint/joint-highlight.ts
export function addSelectedJointMarker(root: Object3D, bone: Bone, color: number, radiusScale?: number): SelectedJointMarker;
// 半径は jointRadius(root, radiusScale) * SELECTED_JOINT_RADIUS_SCALE

// web/src/features/joint/joint-pick.ts
/** クリック点から radiusPx(既定 JOINT_PICK_RADIUS_PX)以内のジョイントだけを拾う */
export function pickJoint(camera: Camera, ndc: Ndc, viewport: { width: number; height: number }, scenes: Readonly<Record<string, Object3D>>, radiusPx?: number): JointHit | null;
```

```tsx
// web/src/features/joint/JointRig.tsx
//   const radiusScale = useViewSettingsStore(selectViewSetting("jointRadiusScale"));
//   overlay の effect: addJointOverlay(scene, { joint, link }, radiusScale)。deps に radiusScale を加える
//     (値が変わると cleanup の removeJointOverlay → 再 add で球が作り直される)
//   選択マーカーの effect: addSelectedJointMarker(scene, target, hexToNumber(selectedColor), radiusScale)。deps に radiusScale
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `jointRadius(root)`(最大辺長 2) | `2 * JOINT_RADIUS_RATIO`(既存テストのまま) |
| `jointRadius(root, 2)` | `2 * JOINT_RADIUS_RATIO * 2` |
| `jointRadius(emptyRoot, 2)`(辺長 0) | `JOINT_FALLBACK_RADIUS * 2` |
| `addJointOverlay(root, colors, 0.5)` | 球の `geometry.parameters.radius === jointRadius(root) * 0.5` |
| `addJointOverlay(root, colors, 0.5)` の後 `addJointOverlay(root, colors, 3)` | 同じ overlay を返し半径は変わらない(冪等は従来どおり。作り直しは Rig の cleanup が担う) |
| `addSelectedJointMarker(root, bone, color, 2)` | 半径 `jointRadius(root, 2) * SELECTED_JOINT_RADIUS_SCALE` |
| `pickJoint(…)`(radiusPx 省略)でジョイントが 13px 先 | null(既存どおり 12px) |
| `pickJoint(…, 20)` で 13px 先 | 拾う |
| `pickJoint(…, 4)` で 5px 先 | null |
| `JointRig.tsx` のソース | `selectViewSetting("jointRadiusScale")`、`addJointOverlay(scene, { joint: hexToNumber(jointColor), link: hexToNumber(linkColor) }, radiusScale)`、`addSelectedJointMarker(scene, target, hexToNumber(selectedColor), radiusScale)` を含む。`joint-rig.test.ts:28` の deps 配列の文字列は `radiusScale` 入りに更新する |
| `joint_Summary.md` | `## 他フォルダとの関係` に「`view-settings` の `jointRadiusScale` / `jointPickRadiusPx` を消費する(ピック半径の結線は outliner 側)」の趣旨の 1 行 |
| 既存テスト | すべて通る |

### 目視確認(マージ後に人間が行う)
| 操作 | 期待する結果 |
| --- | --- |
| リグ付きモデルでジョイント表示を ON にし「ジョイント球の大きさ」を ×4 → ×0.25 | 球と選択マーカーが即座に拡縮する。リンク線は変わらない |

## やらないこと
- `SelectionPickLayer.tsx` の結線は 145(outliner)が行う。ここでは触らない
- 144 のストア・UI・ラベルは変更しない
- 球の分割数(8, 6 / 12, 8)やリンク線は変えない
- 依存の追加・package.json の変更はしない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] joint_Summary.md の該当ファイルの説明と公開インターフェイスが更新され、view-settings への参照が入っている
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
