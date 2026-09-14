---
id: 089
title: web ビューアで FBX と OBJ を読み込めるようにする
feature: web
depends_on: [088]
owns: [web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/useModelScene.ts, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/pick.test.ts, web/tests/model-scene.test.ts, web/tests/mesh-display.test.ts]
reads: [shared/src/api.ts, shared/src/types.ts, web/src/features/viewer/model-loading.ts, web/src/features/viewer/mesh-display.ts, web/src/features/viewer/playback.ts, web/src/features/viewer/playback-frames.ts, web/src/features/viewer/PlaybackRig.tsx, web/src/features/compare/model-scenes.ts, web/src/store/camera.ts, web/src/store/playback.ts, web/src/store/objects.ts, web/src/api/client.ts, web/tests/model-loading.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
088 で `.fbx` / `.obj` のアップロードを受け入れるようになるが、ビューアは `useGLTF` しか
使っておらず、これらを読み込めない。`ModelMesh` を形式ごとのローダーへ分岐させる。

`useGLTF` と `useLoader(FBXLoader, ...)` を同じコンポーネント内の条件分岐で呼ぶと React の
hooks 規則に反するため、**形式ごとに別コンポーネントへ割り**、共通の副作用を 1 つのフックへ
切り出す構成にする。これが本タスクの中心である。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- `ModelMesh({ src, versionId, visible, primary, meshDisplay })` が現在
  `useGLTF(src, true, true, (loader) => { loader.manager = createModelLoadingManager(location.origin); })`
  で読み、4 つの `useEffect` を持つ。web/src/features/viewer/ModelMesh.tsx
  1. `primary` のときだけ `Box3` の最大辺を `useCameraStore.setModelSize` に入れ `requestFit()`。依存 `[primary, scene]`
  2. `primary` のときだけ `usePlaybackStore.setClips(clipSummaries(animations), detectFps(animations))`。
     cleanup で `setClips([])`。依存 `[animations, primary]`
  3. `applyMeshDisplay(scene, meshDisplay)`。依存 `[meshDisplay, scene]`
  4. `useModelScenesStore.register(versionId, scene)` / cleanup で `unregister`。依存 `[scene, versionId]`
  5. さらに cleanup 専用の `useEffect(() => () => applyMeshDisplay(scene, "solid"), [scene])`
- 描画は `<primitive object={scene} visible={visible} />` と、
  `animations.length > 0 && <PlaybackRig root={scene} clips={animations} />`
- `PlaybackRig({ root, clips })` の `root` は `Object3D`、`clips` は `readonly AnimationClip[]`。
  web/src/features/viewer/PlaybackRig.tsx:8
- `applyMeshDisplay(root: Object3D, mode: MeshDisplayMode)`。web/src/features/viewer/mesh-display.ts:76
- `useModelScenesStore.register(versionId: string, scene: Object3D)`。scene を**複製せず参照で**持つ。
  web/src/features/compare/model-scenes.ts:5-10
- `createModelLoadingManager(origin)` は `LoadingManager` の `setURLModifier` で data/blob と
  同一オリジンだけを通し、外部 URL を `about:blank` に置換する。
  web/src/features/viewer/model-loading.ts:18-22
- `ViewerCanvas` は `useObjectsStore` の `objects: ModelVersion[]` を map して `ModelMesh` を描く。
  `ModelVersion` は `fileName` を持つ(shared/src/types.ts:184-191)ので、**形式判別に必要な情報は
  すでに `ViewerCanvas` の手元にある**。web/src/features/viewer/ViewerCanvas.tsx:38-48
- `modelUrl(projectId, versionId)` が返すのは `/api/projects/<id>/versions/<id>/model` で、
  **拡張子を持たない**。URL からは形式を判別できない。web/src/api/client.ts:64
- `web/tests/summary-coverage.test.ts` は「src の全ファイルが最寄りの `_Summary.md` に相対パスで
  載っている」「`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っている」を検査する
- web のテストは jsdom で `@testing-library` が無い。R3F のフックを使うコンポーネントは
  レンダリングできないため、**本タスクのテストはソース検査と型検査で行う**
- 088 で `@shared/api` に `ModelFormat` 型と `modelFormat(fileName): ModelFormat | null` が追加される

### 本タスクの変更で落ちる既存テスト(必ず更新する)
- `web/tests/pick.test.ts:140-153`(`"keeps model size, fit, and clips work behind the primary guard"`)
  が `features/viewer/ModelMesh.tsx` のソースから `if (!primary) return;` を含む `useEffect` を
  正規表現で抜き、**ちょうど 2 つ**であることを検査している。これらの `useEffect` は
  `useModelScene.ts` へ移るため、**読み込み対象のパスを差し替える**
- `web/tests/mesh-display.test.ts:229-240`(`"connects ModelMesh and ViewerCanvas to mesh display state"`)
  が `features/viewer/ModelMesh.tsx` のソースに `applyMeshDisplay(scene, meshDisplay)` と
  `applyMeshDisplay(scene, "solid")` が含まれることを検査している。これらは `useModelScene.ts`
  へ移るため、**読み込み対象のパスを差し替える**(`readSource` の引数のみ。expect の中身は不変。
  同テスト内の `canvas` = `ViewerCanvas.tsx` 側の 2 つの expect も不変)

### ローダーについて確認済みの事実
- `three/examples/jsm/loaders/FBXLoader.js` と `OBJLoader.js` は three 0.186 に同梱され、
  型は `@types/three` にある。バイナリ FBX の解凍に使う fflate も three 同梱。
  **依存パッケージの追加は不要。package.json を変更しないこと**
- `FBXLoader` / `OBJLoader` はいずれも `Loader<Group>` を継承し、`Group` を返す
- `Object3D.animations: AnimationClip[]` が three の基底にあるため、FBX の読み込み結果は
  `group.animations` でクリップを取り出せる
- `@react-three/drei` の `useFBX(path)` は**使わない**。ローダーを拡張する引数を持たず、
  `createModelLoadingManager` を差し込めないため、同一オリジン制限が効かなくなる
- `OBJLoader` は `mtllib` 行を `materialLibraries` に記録するだけで、**外部 `.mtl` を一切
  fetch しない**(OBJLoader.js:709)。既定材質は `MeshPhongMaterial`(同 :856)。
  したがって OBJ は単色表示になる。これは仕様として受け入れる

## インターフェイス契約

### 新規 web/src/features/viewer/useModelScene.ts

現在 `ModelMesh` にある 5 つの `useEffect` を**そのまま**移す。中身のロジックを変えないこと。

```ts
import type { AnimationClip, Object3D } from "three";
import type { MeshDisplayMode } from "@shared/types";

export interface ModelSceneOptions {
  versionId: string;
  primary: boolean;
  meshDisplay: MeshDisplayMode;
}

/**
 * 読み込み済みのシーンをビューアへ接続する共通副作用。
 * 形式(glTF / FBX / OBJ)によらず同じ処理を行う。
 */
export function useModelScene(
  scene: Object3D,
  animations: readonly AnimationClip[],
  options: ModelSceneOptions,
): void;
```

実装の先頭で必ず次のとおり分割代入する。`pick.test.ts` の正規表現が `if (!primary) return;` と
いう字面に依存しているため、`options.primary` のまま使わないこと。

```ts
export function useModelScene(scene, animations, options): void {
  const { versionId, primary, meshDisplay } = options;
  // 以降、現在の ModelMesh と同一の 5 つの useEffect(依存配列も同じ)
}
```

### 変更 web/src/features/viewer/ModelMesh.tsx

形式ごとの読み込みコンポーネントと、それを選ぶディスパッチャにする。

```tsx
import { type ComponentType, type ReactElement } from "react";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { AnimationClip, Loader, Object3D } from "three";
import { modelFormat, type ModelFormat } from "@shared/api";
import type { MeshDisplayMode } from "@shared/types";
import { createModelLoadingManager } from "./model-loading";
import { PlaybackRig } from "./PlaybackRig";
import { useModelScene, type ModelSceneOptions } from "./useModelScene";

/** アニメーションを持たない形式が渡す不変の空配列。毎回新しい配列を作らない */
const NO_ANIMATIONS: readonly AnimationClip[] = [];

/** 読み込み時の外部リソース取得を同一オリジンへ制限する */
function extendLoader(loader: Loader): void {
  loader.manager = createModelLoadingManager(location.origin);
}

interface ModelSourceProps {
  src: string;
  versionId: string;
  visible: boolean;
  primary: boolean;
  meshDisplay: MeshDisplayMode;
}

/** 読み込み済みのシーンをビューアへ接続して描く。形式によらず共通 */
function ModelScene({ scene, animations, visible, ...options }: {
  scene: Object3D;
  animations: readonly AnimationClip[];
  visible: boolean;
} & ModelSceneOptions): ReactElement;

function GltfModel(props: ModelSourceProps): ReactElement;
function FbxModel(props: ModelSourceProps): ReactElement;
function ObjModel(props: ModelSourceProps): ReactElement;

/** 形式ごとの読み込みコンポーネント。ModelFormat の全キーを必ず埋める */
export const MODEL_COMPONENTS: Readonly<Record<ModelFormat, ComponentType<ModelSourceProps>>> = {
  glb: GltfModel,
  gltf: GltfModel,
  fbx: FbxModel,
  obj: ObjModel,
};

export function ModelMesh(props: ModelSourceProps & { fileName: string }): ReactElement | null;
```

各コンポーネントの中身は次のとおりに固定する。

```tsx
function GltfModel({ src, ...rest }: ModelSourceProps): ReactElement {
  const { scene, animations } = useGLTF(src, true, true, extendLoader);
  return <ModelScene scene={scene} animations={animations} {...rest} />;
}

function FbxModel({ src, ...rest }: ModelSourceProps): ReactElement {
  const group = useLoader(FBXLoader, src, extendLoader);
  return <ModelScene scene={group} animations={group.animations} {...rest} />;
}

function ObjModel({ src, ...rest }: ModelSourceProps): ReactElement {
  const group = useLoader(OBJLoader, src, extendLoader);
  return <ModelScene scene={group} animations={NO_ANIMATIONS} {...rest} />;
}
```

`ModelScene` の中身も固定する(現在の `ModelMesh` の return をそのまま移す)。

```tsx
function ModelScene({ scene, animations, visible, ...options }): ReactElement {
  useModelScene(scene, animations, options);
  return (
    <>
      <primitive object={scene} visible={visible} />
      {animations.length > 0 && <PlaybackRig root={scene} clips={animations} />}
    </>
  );
}
```

`ModelMesh` は形式を引いてコンポーネントを選ぶだけにする。

```tsx
export function ModelMesh({ fileName, ...props }: ModelSourceProps & { fileName: string }): ReactElement | null {
  const format = modelFormat(fileName);
  if (!format) return null;
  const Source = MODEL_COMPONENTS[format];
  return <Source {...props} />;
}
```

### 変更 web/src/features/viewer/ViewerCanvas.tsx

`ModelMesh` へ `fileName` を渡す 1 行だけを足す。他は一切変更しない。

```tsx
              <ModelMesh
                src={modelUrl(version.projectId, version.id)}
                fileName={version.fileName}
                versionId={version.id}
                visible={isObjectVisible(hiddenIds, version.id)}
                primary={version.id === primaryId}
                meshDisplay={meshDisplay}
              />
```

`export function ViewerCanvas({ children }: { children?: ReactNode })` のシグネチャは
`pick.test.ts:181` が完全一致で検査しているため**変えない**。

## 振る舞い

### web/tests/pick.test.ts の更新

`"keeps model size, fit, and clips work behind the primary guard"` の `readSource` の引数を
`"features/viewer/ModelMesh.tsx"` から `"features/viewer/useModelScene.ts"` に差し替える。
**正規表現と 3 つの `expect` は変更しない**(移した先でも 2 つ・同じ内訳で通るはずである)。
他の it はすべて変更しない。

### 新規 web/tests/model-scene.test.ts

`web/tests/pick.test.ts:9-15` の `sourceRoot` / `readSource` と同じ解決方法をそのまま真似る
(`process.cwd()` 直下に `web/src` があればそれ、無ければ `src`)。R3F のフックを含むため
**モジュールを import せず、ソース文字列だけを検査する**。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ModelMesh.tsx` | `from "three/examples/jsm/loaders/FBXLoader.js"` と `from "three/examples/jsm/loaders/OBJLoader.js"` を含む |
| `ModelMesh.tsx` | `useFBX` を含まない(drei の hook は manager を差し込めないため禁止) |
| `ModelMesh.tsx` | `useLoader(FBXLoader, src, extendLoader)` と `useLoader(OBJLoader, src, extendLoader)` を含む |
| `ModelMesh.tsx` | `useGLTF(src, true, true, extendLoader)` を含む |
| `ModelMesh.tsx` | `loader.manager = createModelLoadingManager(location.origin)` がちょうど 1 箇所(`extendLoader` に集約されている) |
| `ModelMesh.tsx` | `MODEL_COMPONENTS` の宣言が `glb:` `gltf:` `fbx:` `obj:` の 4 キーを含む |
| `ModelMesh.tsx` | `animations={NO_ANIMATIONS}` を含み、`animations={[]}` を**含まない**(毎レンダーの新配列を禁止) |
| `ModelMesh.tsx` | `const NO_ANIMATIONS` がモジュールのトップレベルにある(行頭から `const NO_ANIMATIONS` に一致する行がある) |
| `ModelMesh.tsx` | `.scale`、`setScalar`、`multiplyScalar` のいずれも含まない(スケール補正の禁止) |
| `ModelMesh.tsx` | `applyMeshDisplay`、`setModelSize`、`requestFit`、`setClips`、`useModelScenesStore` を**含まない**(すべて `useModelScene.ts` へ移っている) |
| `useModelScene.ts` | `applyMeshDisplay(scene, meshDisplay)`、`applyMeshDisplay(scene, "solid")`、`setModelSize`、`requestFit()`、`setClips`、`register(versionId, scene)`、`unregister(versionId, scene)` をすべて含む |
| `useModelScene.ts` | `const { versionId, primary, meshDisplay } = options;` を含む |
| `useModelScene.ts` | `useGLTF`、`useLoader`、`FBXLoader`、`OBJLoader` のいずれも含まない(読み込みを持たない) |
| `useModelScene.ts` | `useEffect(` がちょうど 5 回出現する |
| `ViewerCanvas.tsx` | `fileName={version.fileName}` を含む |
| `ViewerCanvas.tsx` | `<ModelMesh` がちょうど 1 箇所 |

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| `.fbx` をアップロードしてレビュー画面を開く | モデルが表示され、初回に全体が収まる位置へカメラが寄る |
| アニメーション入りの `.fbx` を開く | 下部タイムラインにクリップが並び、再生できる |
| `.obj` をアップロードして開く | モデルが**単色(材質なし)**で表示される。タイムラインにクリップは出ない |
| FBX / OBJ で表示モードバーを切り替える | メッシュ / ワイヤフレーム / メッシュ+ワイヤが glTF と同じように効く |
| FBX / OBJ をオブジェクト一覧で非表示にする | 表示が消え、同室の参加者にも反映される |
| FBX / OBJ 上でコメントピンを打つ | glTF と同じようにピンが置ける |
| cm 単位で書き出した `.fbx` と m 単位の `.glb` を同じプロジェクトで比較する | 100 倍のスケール差がそのまま見える(**仕様。補正しない**) |
| 外部テクスチャを参照する `.fbx` を開く | テクスチャは 404 になり three が警告を出すが、描画は続く。埋め込みテクスチャは表示される |

## 実装メモ
判断が割れやすい箇所を先に決めてある。ここから外れる実装をしないこと。

- **スケール補正を一切しない。** FBX が cm 単位で書き出されていても `scale` を触らない。
  単体表示は `setModelSize` + Fit が吸収する。比較時のズレは仕様として受け入れる
- **依存パッケージを足さない。** `package.json` / `package-lock.json` を変更しないこと。
  ローダーも fflate も three 0.186 に同梱されている
- import パスは `three/examples/jsm/loaders/FBXLoader.js`(`.js` 付き)とする。
  `three/addons/...` 形式にしない
- `extendLoader` は `(loader: Loader) => void` の**モジュールスコープ関数 1 つ**にする。
  毎レンダー新しい関数を作らない。`useGLTF` の第 4 引数にもこの関数をそのまま渡す(型は通る)
- `ObjModel` の `animations` は必ずモジュールスコープの `NO_ANIMATIONS` を渡す。
  インラインの `[]` は毎レンダー参照が変わり、`useModelScene` の
  `[animations, primary]` 依存の `useEffect` が毎回走ってしまう
- `modelFormat(fileName)` が `null` を返したときは何も描かず `null` を返す。
  サーバが 088 で弾くため通常は到達しない
- `useModelScene` の 5 つの `useEffect` は**現在の順序・依存配列・cleanup をそのまま維持する**。
  まとめたり順序を入れ替えたりしないこと(`pick.test.ts` の正規表現が本数を数える)
- `ModelScene` / `GltfModel` / `FbxModel` / `ObjModel` は `ModelMesh.tsx` 内に置く。
  それぞれ 10 行前後で、ファイル全体は 90 行前後に収まる見込み。ファイルを増やさないこと
- `MODEL_COMPONENTS` は `Record<ModelFormat, ...>` 型なので、形式の取りこぼしは typecheck が
  機械的に検出する。実行時の網羅チェックを書き足さないこと

## やらないこと
- アップロード画面の `accept` 属性や文言の変更(090 の担当)
- `shared/` `server/` の変更(088 の担当)
- `web/package.json` / `package-lock.json` の変更
- FBX / OBJ のスケール正規化、単位の自動判定、比較時の自動フィット
- `.mtl` を一緒にアップロードして OBJ の材質を復元する仕組み
- `MTLLoader` / `ColladaLoader` / `STLLoader` など他ローダーの追加
- `mesh-display.ts` / `PlaybackRig.tsx` / `model-scenes.ts` / `model-loading.ts` の変更
- Draco / KTX2 など glTF 拡張まわりの挙動変更
- `web/src/features/compare/` の変更(比較は `Object3D` を扱うのでそのまま動く)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・コンポーネント構成で実装されている
- [ ] 振る舞い表(ソース検査)の全行に対応するテストがあり、通る
- [ ] `web/tests/pick.test.ts` の既存 it が新しいパスで通る(正規表現と expect は未変更)
- [ ] viewer_Summary.md を更新している。具体的には
      `ModelMesh.tsx` の役割行を「拡張子から形式を判別して glTF / FBX / OBJ のローダーへ割り、
      `useModelScene` で共通接続する」に書き直し、`useModelScene.ts` の行を追加し、
      `ViewerCanvas.tsx` の行に `fileName` を渡す旨を足し、公開インターフェイス節を
      `ModelMesh({ src, fileName, versionId, visible, primary, meshDisplay })` /
      `MODEL_COMPONENTS` / `useModelScene` / `ModelSceneOptions` に更新し、
      テスト節に `tests/model-scene.test.ts` を足して `tests/pick.test.ts` の説明を実態に合わせ、
      「他フォルダとの関係」に OBJ が材質なしで表示されること・FBX のスケールを補正しないことを明記する
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
