---
id: 092
title: NURBS サーフェスを含む FBX の読み込み失敗を直す
feature: web
depends_on: []
owns: [web/src/features/viewer/fbx-compat.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/viewer_Summary.md, web/tests/fbx-compat.test.ts, web/tests/model-scene.test.ts]
reads: [web/src/features/viewer/model-loading.ts, web/src/features/viewer/useModelScene.ts, web/src/features/viewer/ViewerCanvas.tsx, web/tests/pick.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
Maya 由来の FBX(NURBS サーフェスを含むもの)がビューアで必ず読み込みに失敗する。
three の `FBXLoader` が未対応の `attrType` を `Group` にしてしまい、そこへスキンクラスタが
繋がっていると `bindSkeleton()` が `Group` に無い `bind()` を呼んで例外を投げ、
**ファイル全体**の読み込みが失敗するため。該当ノードのスキン適用だけを読み飛ばして読み込めるようにする。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。ここは**実機で確認済み**の事実である。

### 失敗の再現と原因(調査済み)
- 実ファイル `Human.fbx`(1,784,800 bytes、バイナリ FBX 7700)で再現する。例外は次のとおり。

  ```
  TypeError: model.bind is not a function
      at FBXLoader.js:1602   (FBXTreeParser#bindSkeleton)
  ```

- この FBX の `Objects.Model` の `attrType` 内訳は
  `Null` 249 / `LimbNode` 223 / `Line` 40 / `Mesh` 36 / `NurbsCurve` 22 / **`NurbsSurface` 1**。
  落ちているのは `srfML_Cn_Tongue`(`NurbsSurface`)である
- `FBXLoader.parseModels()` の switch は `Camera` / `Light` / `Mesh` / `NurbsCurve` / `LimbNode` / `Root` /
  `Null` しか持たず、`default` で `new Group()` を作る。
  node_modules/three/examples/jsm/loaders/FBXLoader.js:1063-1086
- その後 `bindSkeleton()` が、スキンクラスタの繋がった Geometry の親 Model すべてに対して
  `model.bind( new Skeleton( ... ), model.matrixWorld )` を呼ぶ。`Group` には `bind` が無い。
  node_modules/three/examples/jsm/loaders/FBXLoader.js:1587-1610
- `SkinnedMesh` になるのは `attrType === "Mesh"` かつ `geometry.FBX_Deformer` がある場合だけで、
  `LimbNode` / `Root` は `new Bone()` になる。`Bone` にも `bind` は無い
- サーバ側(アップロード検証・保存・配信)は正常である。同じバイト列が往復することを確認済み
- `node_modules/three` は npm 配布物と完全一致で未改変である(これは three 0.186 の素の挙動)
- **検証済みの直し方**: `Group.prototype` に no-op の `bind` を生やすと、この `Human.fbx` は
  SkinnedMesh 36 個・Bone 280 個が正常に読み込まれ、ブラウザでもモデルが描画される。
  NURBS サーフェスの 1 個は空の `Group` として残り描画されない
  (three は NURBS サーフェスのジオメトリ自体に非対応なので、元から描けない)
- 他の Maya 由来 FBX 4 本(`Mesh` のみ、`Mesh` + スキン)は現状でも読み込めており、
  このシムを入れても結果は変わらないことを確認済み

### 変更対象まわりの現状
- `ModelMesh.tsx` の `extendLoader` は**モジュールスコープの関数 1 つ**で、glTF / FBX / OBJ の
  3 経路すべてがローダー生成直後に呼ぶ唯一の共通フックである。web/src/features/viewer/ModelMesh.tsx:17-19

  ```tsx
  /** 読み込み時の外部リソース取得を同一オリジンへ制限する */
  function extendLoader(loader: Loader): void {
    loader.manager = createModelLoadingManager(location.origin);
  }
  ```

- `web/tests/model-scene.test.ts:29-34` が `ModelMesh.tsx` のソースに対して
  `source.match(/loader\.manager = createModelLoadingManager\(location\.origin\)/g)` が
  **ちょうど 1 件**であることを検査している。`extendLoader` に行を足しても通る
- `web/tests/summary-coverage.test.ts` は「src の全ファイルが最寄りの `_Summary.md` に相対パスで
  載っている」「`web/tests/*.test.ts` の全ファイル名がいずれかの Summary に載っている」を検査する
- web のテストは jsdom。`three` は**テストから直接 import できる**
  (`web/tests/playback.test.ts` などが `from "three"` で import している)

## インターフェイス契約

### 新規 web/src/features/viewer/fbx-compat.ts

中身を次のとおりに固定する。**このファイルは typecheck とテストが通ることを確認済みである。そのまま書くこと。**

```ts
import { Bone, Group } from "three";

interface SkinBindable {
  bind?: (...args: unknown[]) => void;
}

/** bind を持たないノードへ skinning が要求されたときに何もしない差し替え */
function ignoreSkinBinding(): void {}

/**
 * three の FBXLoader は attrType が未対応(NurbsSurface / Line など)の Model を Group に、
 * LimbNode / Root を Bone にする。そこへスキンクラスタが繋がっていると bindSkeleton が
 * `model.bind(...)` を呼び、TypeError でファイル全体の読み込みが失敗する。
 * Group / Bone に no-op の bind を生やし、そのノードのスキン適用だけを読み飛ばす。
 * SkinnedMesh は自前の bind を持つため影響を受けない。
 */
export function installFbxSkinCompat(): void {
  for (const prototype of [Group.prototype, Bone.prototype] as unknown as SkinBindable[]) {
    if (typeof prototype.bind !== "function") {
      prototype.bind = ignoreSkinBinding;
    }
  }
}
```

### 変更 web/src/features/viewer/ModelMesh.tsx

import を 1 行足し、`extendLoader` の**先頭**で呼ぶ。他は一切変更しない。

```tsx
import { createModelLoadingManager } from "./model-loading";
import { installFbxSkinCompat } from "./fbx-compat";

/** 読み込み時の外部リソース取得を同一オリジンへ制限する */
function extendLoader(loader: Loader): void {
  installFbxSkinCompat();
  loader.manager = createModelLoadingManager(location.origin);
}
```

- 呼び出し場所を `extendLoader` 以外にしないこと。`useLoader` / `useGLTF` はローダー生成直後・
  `load()` 前にこの関数を呼ぶため、ここが「読み込み前に必ず一度通る」唯一の地点である
- モジュールのトップレベルに裸の `installFbxSkinCompat()` 文を置かないこと
- `FbxModel` の中や React の render 本体で呼ばないこと
- 冪等なので毎回呼んでよい(`typeof !== "function"` ガードで 2 回目以降は何もしない)

## 振る舞い

### 新規 web/tests/fbx-compat.test.ts

`three` を直接 import してよい。**このテストは実際に書いて通したものである。そのまま書くこと。**

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `installFbxSkinCompat()` 後に `new Group()` へ `bind(new Skeleton([]), new Matrix4())` | 例外を投げない |
| `installFbxSkinCompat()` 後に `new Bone()` へ `bind(new Skeleton([]), new Matrix4())` | 例外を投げない |
| `SkinnedMesh.prototype.bind` と `Group.prototype.bind` | 別物である(本来の skinning を壊していない) |
| `installFbxSkinCompat()` 後に `new SkinnedMesh().bind(new Skeleton([]), new Matrix4())` | 例外を投げない |
| `installFbxSkinCompat()` を 2 回呼ぶ | `Group.prototype.bind` が 1 回目と同一参照のまま(上書きしない) |

```ts
import { Bone, Group, Matrix4, Skeleton, SkinnedMesh } from "three";
import { describe, expect, it } from "vitest";
import { installFbxSkinCompat } from "../src/features/viewer/fbx-compat";

function bindOf(prototype: object): unknown {
  return (prototype as { bind?: unknown }).bind;
}

function bindable(node: object): (skeleton: Skeleton, matrix: Matrix4) => void {
  return (node as { bind: (skeleton: Skeleton, matrix: Matrix4) => void }).bind.bind(node);
}
```

### 追加 web/tests/model-scene.test.ts

既存の it は**一切変更しない**。次の 1 つを足す。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ModelMesh.tsx` | `from "./fbx-compat"` を含み、`extendLoader` の本体が `installFbxSkinCompat();` を `loader.manager = ...` より前に持つ |

### 見た目と操作(手動確認。自動テストは書けない)

| 操作 | 期待する結果 |
| --- | --- |
| NURBS サーフェスを含む `Human.fbx` をアップロードして開く | モデルが表示される。「モデルの読み込みに失敗しました。」が出ない |
| その FBX の NURBS サーフェス部分(舌など) | 表示されない。**これは仕様として受け入れる**(three が NURBS サーフェス非対応) |
| 既存の glTF / GLB / OBJ / 他の FBX | 従来どおり表示され、スキンとアニメーションも従来どおり動く |

## やらないこと
- `three` を `node_modules` で書き換えること、パッチ適用ツール(patch-package 等)の導入
- `FBXLoader.js` をリポジトリへ vendoring すること
- `package.json` / `package-lock.json` の変更(依存を足さない)
- `Object3D.prototype` への no-op 追加(範囲を `Group` と `Bone` に限る)
- NURBS サーフェス / NURBS カーブを実際にテッセレートして描画すること
- 読み込みに失敗したモデルだけを切り離す仕組み(版ごとの `ErrorBoundary` 分割)
- エラーメッセージにファイル名や原因を足すこと(091 の担当範囲でもない。別途起票する)
- `useModelScene.ts` / `model-loading.ts` / `ViewerCanvas.tsx` / `mesh-display.ts` の変更
- FBX のスケール補正、単位の自動判定

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりの `fbx-compat.ts` と `extendLoader` になっている
- [ ] 振る舞い表(自動テストの行)の全行に対応するテストがあり、通る
- [ ] `web/tests/model-scene.test.ts` の既存 it が未変更のまま通る
- [ ] viewer_Summary.md を更新している。具体的には
      「## ファイル一覧と役割」に `fbx-compat.ts` の行を足し、
      `ModelMesh.tsx` の役割行に「読み込み前に `installFbxSkinCompat()` を呼ぶ」旨を足し、
      「## 公開インターフェイス」に `fbx-compat.ts: installFbxSkinCompat()` を足し、
      「## 他フォルダとの関係」に「three の FBXLoader が未対応の attrType(NurbsSurface / Line)を
      Group にするため、そこへ繋がったスキンは読み飛ばす。NURBS サーフェスは描画されない」を明記し、
      「## テスト」節に `tests/fbx-compat.test.ts` の行を足して `tests/model-scene.test.ts` の説明を実態に合わせる
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
