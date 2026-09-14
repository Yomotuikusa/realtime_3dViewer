---
id: 078
title: web ModelMesh のシーン登録レジストリと MeshCompareRig を作り、ルーム共有の比較設定を 3D ビューへ適用する
feature: web
depends_on: [075, 077]
owns: [web/src/features/compare/model-scenes.ts, web/src/features/compare/MeshCompareRig.tsx, web/src/features/compare/compare_Summary.md, web/tests/compare-model-scenes.test.ts, web/tests/compare-rig.test.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/viewer_Summary.md]
reads: [shared/src/types.ts, shared/src/compare.ts, web/src/store/display.ts, web/src/store/objects.ts, web/src/features/compare/deviation.ts, web/src/features/compare/overlay.ts, web/src/features/viewer/model-target.ts, web/src/features/viewer/PlaybackClock.tsx, web/tests/pick.test.ts, web/tests/mesh-display.test.ts, web/tests/store-display.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
075 で display ストアに入るようになった比較設定(基準・対象・しきい値)を、実際の 3D ビューへ反映する。
基準と対象の版が両方ロード済みなら 076 で距離を計算し、077 で対象に赤青を重ね描きする。
これで 075〜078 が揃い、他の参加者が(079 完了後に)設定した比較、または welcome の比較が画面に出る。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 075 の `useDisplayStore` に `meshCompare: MeshCompare`(`baseId` / `targetId` / `thresholdPermille`)がある。
  `@shared/compare` の `isMeshCompareActive(compare)` が「両方 non-null かつ異なる」判定を提供する
- 076 の `computeDeviation(target, base): DeviationResult | null`(`baseSize` と `meshes[]`)、
  077 の `applyCompareOverlay(mesh, signedDistance, threshold)` / `clearCompareOverlays(root)`。
  しきい値のワールド値は本タスクで `baseSize * thresholdPermille / 1000` として換算する
- `ModelMesh({ src, visible, primary, meshDisplay })` は `useGLTF` の `scene` を描画する。
  web/src/features/viewer/ModelMesh.tsx。`useGLTF` は同じ URL の `scene` をキャッシュして返すため、
  アンマウント時に改変を戻す流儀(:41)がある。比較重ね描きはアンマウント時に本タスクの Rig が消す
- `ViewerCanvas` が objects ストアの `version.id` ごとに `ModelMesh` を描き、`<PlaybackClock />` を1つ置いている。
  web/src/features/viewer/ViewerCanvas.tsx:36-48
- `web/tests/pick.test.ts:140-154` は `ModelMesh.tsx` のソースを正規表現で読み、
  `if (!primary) return;` で始まる `useEffect(() => { ... }, [...]);` が**ちょうど2つ**であることを固定している。
  本タスクで足す effect には `if (!primary) return;` を書かないこと
- `web/tests/pick.test.ts:167-170` は `ViewerCanvas.tsx` に
  `export function ViewerCanvas({ children }: { children?: ReactNode })` の行があること、
  `:157-162` は `<PlaybackClock />` がちょうど1つあることを固定している。変えない
- 既存の `model-target.ts`(web/src/features/viewer/model-target.ts)はレイキャスト対象の group を1つだけ持つ
  React 非依存のレジストリ。本タスクの版ごとのシーン登録はこれとは別に zustand ストアで作る
  (React から購読するため)。`resetReviewStores()` の対象には**しない**(アンマウントで空になる)
- web のテストは jsdom で `@testing-library` がない。React コンポーネントのレンダリングテストは書けないので、
  Rig の結線はソース検査、ストアと純粋関数は単体テストで固定する
- `web/tests/summary-coverage.test.ts` が新規ファイル・新規テストの Summary 掲載を検査する

## インターフェイス契約

### 新規 web/src/features/compare/model-scenes.ts

```ts
import type { Object3D } from "three";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ModelScenesState {
  /** versionId → マウント中の ModelMesh が持つ glTF の scene。参照をそのまま保持する(複製しない) */
  scenes: Readonly<Record<string, Object3D>>;
  /** 登録。同じ versionId に同じ scene 参照が既にあれば state を更新しない */
  register(versionId: string, scene: Object3D): void;
  /** 登録中の scene と同じ参照のときだけ削除する(別の scene が登録済みなら触らない) */
  unregister(versionId: string, scene: Object3D): void;
  reset(): void;
}

export const useModelScenesStore: UseBoundStore<StoreApi<ModelScenesState>>;

/** versionId が null または未登録なら null */
export function selectModelScene(scenes: Readonly<Record<string, Object3D>>, versionId: string | null): Object3D | null;
```

### 新規 web/src/features/compare/MeshCompareRig.tsx

```tsx
/** 千分率のしきい値をワールド単位へ換算する。baseSize * permille / 1000 */
export function thresholdWorld(baseSize: number, thresholdPermille: number): number;

/** Canvas に1つだけ置く描画なしの部品。比較設定とロード済みシーンから重ね描きを管理する */
export function MeshCompareRig(): null;
```

振る舞い(実装の指定):

```tsx
const compare = useDisplayStore((state) => state.meshCompare);
const scenes = useModelScenesStore((state) => state.scenes);
const active = isMeshCompareActive(compare);
const base = active ? selectModelScene(scenes, compare.baseId) : null;
const target = active ? selectModelScene(scenes, compare.targetId) : null;
const [result, setResult] = useState<DeviationResult | null>(null);

// 計算 effect。base / target が変わったときだけ再計算する(しきい値では再計算しない)
useEffect(() => {
  if (base === null || target === null) return;
  setResult(computeDeviation(target, base));
  return () => {
    clearCompareOverlays(target);
    setResult(null);
  };
}, [base, target]);

// 着色 effect。result またはしきい値が変わるたびに塗り直す
useEffect(() => {
  if (result === null) return;
  const threshold = thresholdWorld(result.baseSize, compare.thresholdPermille);
  for (const { mesh, signedDistance } of result.meshes) applyCompareOverlay(mesh, signedDistance, threshold);
}, [result, compare.thresholdPermille]);
```

### 変更 web/src/features/viewer/ModelMesh.tsx

```tsx
export function ModelMesh({ src, versionId, visible, primary, meshDisplay }: {
  src: string;
  versionId: string;
  visible: boolean;
  primary: boolean;
  meshDisplay: MeshDisplayMode;
}): ReactElement;
```

既存の effect と JSX は変えない。次の effect を足す(`if (!primary) return;` を含めない)。

```tsx
useEffect(() => {
  useModelScenesStore.getState().register(versionId, scene);
  return () => useModelScenesStore.getState().unregister(versionId, scene);
}, [scene, versionId]);
```

### 変更 web/src/features/viewer/ViewerCanvas.tsx

- `ModelMesh` に `versionId={version.id}` を渡す
- `<PlaybackClock />` の直後に `<MeshCompareRig />` を1つ置く
- 関数のシグネチャ行と他の JSX は変えない

## 振る舞い

### model-scenes ストア(web/tests/compare-model-scenes.test.ts に新規追加)

`afterEach` で `reset()` する。scene は `new Group()` でよい。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期値 | `scenes` が `{}` |
| `register("v1", a)` | `scenes.v1` が `a` と `toBe` |
| `register("v1", a)` を2回 | 2回目で `getState()` の参照が変わらず、subscribe リスナーが呼ばれない |
| `register("v1", a)` のあと `register("v1", b)` | `scenes.v1` が `b` |
| `register("v1", a)` のあと `unregister("v1", a)` | `scenes` に `v1` が無い |
| `register("v1", b)` の状態で `unregister("v1", a)` | `scenes.v1` が `b` のまま |
| 未登録の `unregister("v9", a)` | 例外を投げず、state の参照も変わらない |
| `register` 後の `scenes` オブジェクト | 以前の `scenes` オブジェクトとは別参照(不変更新)、`v1` と `v2` を両方保持 |
| `selectModelScene(scenes, null)` / 未登録 id | null |
| `selectModelScene(scenes, "v1")` | 登録した参照 |
| `reset()` | `scenes` が `{}` |

### thresholdWorld とソース検査(web/tests/compare-rig.test.ts に新規追加。`readSource` は pick.test.ts と同じ読み方)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `thresholdWorld(2, 5)` | 0.01 |
| `thresholdWorld(10, 50)` | 0.5 |
| `thresholdWorld(0, 5)` | 0 |
| `MeshCompareRig.tsx` | `useDisplayStore` と `useModelScenesStore` を import し、`isMeshCompareActive(`、`computeDeviation(`、`clearCompareOverlays(`、`applyCompareOverlay(` を含む。`useFrame` を含まない |
| `MeshCompareRig.tsx` の計算 effect | 依存配列が `[base, target]`(`}, [base, target]);` を含む)で、`thresholdPermille` を含まない |
| `MeshCompareRig.tsx` の着色 effect | `}, [result, compare.thresholdPermille]);` を含む |
| `ModelMesh.tsx` | `register(versionId, scene)` と `unregister(versionId, scene)` を含む。`if (!primary) return;` の effect は2つのまま(既存 pick.test が検査) |
| `ViewerCanvas.tsx` | `versionId={version.id}` を含み、`<MeshCompareRig />` がちょうど1つ |

### 結線後の全体像(079 の後に成立する。手動確認)

| 状況 | 期待する結果 |
| --- | --- |
| welcome の `meshCompare` が v1 基準・v2 対象 | 入室後、両方のロードが終わった時点で v2 に赤青が出る |
| 他の参加者がしきい値を上げた | 再計算なしに赤青の範囲が狭まる |
| 基準と対象を入れ替えた | 旧対象の赤青が消え、新対象に出る |
| 基準か対象を「なし」にした | 赤青が消える |
| 別プロジェクトへ遷移して戻る | 前回の赤青が残らない |
| 対象の版を非表示にする | 赤青も消える(子) |

## やらないこと
- UI と `send`(079)
- ストア・dispatch・protocol の変更(075 で済んでいる)
- Web Worker、進捗表示、計算中インジケータ
- `mesh-display.ts` / `deviation.ts` / `overlay.ts` の変更(必要になったら申し送り)
- `resetReviewStores()` への model-scenes の追加
- `pick.ts` / `model-target.ts` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] compare_Summary.md に model-scenes.ts / MeshCompareRig.tsx / 新規テストを、viewer_Summary.md に ModelMesh の新 prop と ViewerCanvas の変更を載せている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
