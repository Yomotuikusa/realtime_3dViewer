---
id: 073
title: web applyMeshDisplay を作り、ModelMesh がルーム共有の表示方法(メッシュ / ワイヤフレーム / メッシュ+ワイヤ)をシーンへ適用する
feature: web
depends_on: [072]
owns: [web/src/features/viewer/mesh-display.ts, web/tests/mesh-display.test.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/ViewerCanvas.tsx, web/src/features/viewer/viewer_Summary.md]
reads: [shared/src/types.ts, web/src/store/display.ts, web/src/features/viewer/pick.ts, web/src/features/viewer/PlaybackRig.tsx, web/src/features/viewer/playback-driver.ts, web/src/store/objects.ts, web/tests/pick.test.ts, web/tests/summary-coverage.test.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
072 で web の `useDisplayStore` に入るようになったメッシュの表示方法を、実際に 3D ビューへ反映する。
「メッシュ」は従来どおり、「ワイヤフレーム」は各材質の線描画、「メッシュ+ワイヤ」は
通常描画の上に線を重ねる。切替 UI は 074 で載せるため、本タスク完了時点では
他の参加者が(074 完了後に)切り替えた値、または welcome の値が反映されるだけである。

## 前提
実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- 072 で `MeshDisplayMode = "solid" | "wireframe" | "solid-wireframe"` と `DEFAULT_MESH_DISPLAY`
  が `@shared/types` に、`useDisplayStore`(`meshDisplay`、`setMeshDisplay`、`reset`)が
  web/src/store/display.ts にある
- `ModelMesh({ src, visible, primary })` は `useGLTF` の `scene` を `<primitive object={scene} visible={visible} />`
  で描画し、primary のときだけ箱の計測と Fit 要求、クリップ登録を行う。web/src/features/viewer/ModelMesh.tsx
- `ViewerCanvas` が objects ストアを読んで `ModelMesh` に `visible` / `primary` を渡している。
  web/src/features/viewer/ViewerCanvas.tsx:17-19, :37-41
- `web/tests/pick.test.ts:140-154` は `ModelMesh.tsx` のソースを正規表現で読み、
  `if (!primary) return;` で始まる `useEffect(() => { ... }, [...]);` が**ちょうど2つ**あることを固定している。
  本タスクで足す effect には `if (!primary) return;` を書かないこと(表示方法は全オブジェクトに適用する)
- `web/tests/pick.test.ts:167-170` は `ViewerCanvas.tsx` に
  `export function ViewerCanvas({ children }: { children?: ReactNode })` の行があることを固定している。変えない
- `pickModel` は `raycaster.intersectObject(target, true)` で再帰的に当たり判定し、可視な最近傍を返す。
  web/src/features/viewer/pick.ts:35-47。**重ね描き用の Mesh がヒットするとコメントのピンやペンの
  表面判定が二重になる**ので、重ね描き用オブジェクトの `raycast` を無効にする
- `useGLTF` は同じ URL の `scene` をキャッシュして返す。材質やシーンの改変はアンマウント後も残るため、
  アンマウント時に元へ戻す
- `PlaybackRig` の `AnimationMixer` は `SkinnedMesh` のボーンと `morphTargetInfluences` を**配列の要素を
  書き換える形で**更新する。重ね描き用 Mesh が同じ skeleton と同じ `morphTargetInfluences` 配列を
  参照していれば、追加の同期なしにアニメーションへ追従する
- three.js は 0.186.0、`@types/three` は 0.185.4。`Mesh.material` の型は `Material | Material[]` で、
  基底 `Material` 型に `wireframe` は無い(`"wireframe" in material` の型ガードが要る)。
  `wireframe` / `polygonOffset` の変更は `needsUpdate` 不要
- web の vitest(jsdom)で `three` の `Mesh` / `SkinnedMesh` / `Raycaster` はそのまま使える。web/tests/pick.test.ts
- `web/tests/summary-coverage.test.ts` が新規ファイル・新規テストの Summary 掲載を検査する

### 計画時に実測済みの事実

下記契約どおりのプロトタイプを three 0.186 で実行し、次を確認済み。

- 材質配列を含む全材質の `wireframe` が切り替わる
- solid-wireframe を2回適用しても重ね描きは1つのまま(冪等)
- `SkinnedMesh` の重ね描きは skeleton・bindMatrix・`morphTargetInfluences` を共有する
- solid へ戻すと重ね描きが除去され、`polygonOffset` が false に戻り、`Bone` などの既存の子は残る
- `"wireframe" in material` の型ガードで `tsc --strict` が通る

## インターフェイス契約

### 新規 web/src/features/viewer/mesh-display.ts

```ts
import { InstancedMesh, Material, Mesh, MeshBasicMaterial, Object3D, SkinnedMesh } from "three";
import type { MeshDisplayMode } from "@shared/types";

/** 重ね描き用オブジェクトの userData キー。値は true */
export const MESH_DISPLAY_OVERLAY_KEY = "meshDisplayOverlay";
/** 重ね描きの線の色(濃いグレー) */
export const WIREFRAME_OVERLAY_COLOR = 0x1f2937;
/** 重ね描きの線の不透明度 */
export const WIREFRAME_OVERLAY_OPACITY = 0.6;

/** userData[MESH_DISPLAY_OVERLAY_KEY] === true なら重ね描き用オブジェクト */
export function isMeshDisplayOverlay(object: Object3D): boolean;

/** 重ね描き用の材質。wireframe、transparent、opacity、depthWrite=false、toneMapped=false */
export function createWireframeOverlayMaterial(): MeshBasicMaterial;

/**
 * mesh と同じ geometry を線描画する子オブジェクトを作る(まだ add はしない)。
 * - SkinnedMesh なら SkinnedMesh を作り bindMode を写して bind(mesh.skeleton, mesh.bindMatrix)
 * - それ以外は Mesh
 * - morphTargetInfluences / morphTargetDictionary は参照を共有
 * - raycast は何もしない関数に差し替える
 * - userData[MESH_DISPLAY_OVERLAY_KEY] = true
 */
export function createWireframeOverlay(mesh: Mesh): Mesh;

/**
 * root 配下(root 自身を含む)の全 Mesh に mode を適用する。何度呼んでも同じ結果になる。
 * - 重ね描き用オブジェクトは走査対象から除く(重ね描きの重ね描きを作らない)
 * - 各 Mesh の材質(配列なら全要素)のうち "wireframe" を持つものについて
 *     wireframe = (mode === "wireframe")
 *     polygonOffset = (mode === "solid-wireframe"), polygonOffsetFactor = 1, polygonOffsetUnits = 1
 * - mode === "solid-wireframe" かつ InstancedMesh でない Mesh に重ね描きの子が無ければ createWireframeOverlay で作って add する
 * - それ以外の mode で重ね描きの子があれば remove し、その material を dispose する(geometry は共有なので dispose しない)
 */
export function applyMeshDisplay(root: Object3D, mode: MeshDisplayMode): void;
```

### 変更 web/src/features/viewer/ModelMesh.tsx

```tsx
export function ModelMesh({ src, visible, primary, meshDisplay }: {
  src: string;
  visible: boolean;
  primary: boolean;
  meshDisplay: MeshDisplayMode;
}): ReactElement;
```

既存の2つの effect と JSX は変えない。次の2つの effect を足す。

```tsx
useEffect(() => {
  applyMeshDisplay(scene, meshDisplay);
}, [meshDisplay, scene]);

useEffect(() => () => applyMeshDisplay(scene, "solid"), [scene]);
```

### 変更 web/src/features/viewer/ViewerCanvas.tsx

`useDisplayStore((state) => state.meshDisplay)` を読み、`ModelMesh` に `meshDisplay={meshDisplay}` を渡す。
関数のシグネチャ行と他の JSX は変えない。

## 振る舞い

### applyMeshDisplay(web/tests/mesh-display.test.ts に新規追加)

`Group` の下に `Mesh(BoxGeometry, [MeshStandardMaterial, MeshStandardMaterial])`、
`Bone` を子に持ち `Skeleton([bone])` に `bind` した `SkinnedMesh(BoxGeometry, MeshStandardMaterial)`
(`morphTargetInfluences = [0.5]`)、`Group`、`Line` を置いたシーンで検証する。

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `applyMeshDisplay(root, "wireframe")` | 全材質(配列の全要素を含む)の `wireframe` が true、`polygonOffset` が false、重ね描きの子が無い |
| `applyMeshDisplay(root, "solid-wireframe")` | 基底材質の `wireframe` が false、`polygonOffset` が true・factor 1・units 1。各 Mesh に `isMeshDisplayOverlay` な子が**ちょうど1つ** |
| 重ね描きの子(Mesh) | `geometry` が親と同一参照、`material` が `MeshBasicMaterial` で `wireframe` true、`color.getHex()` が `WIREFRAME_OVERLAY_COLOR`、`opacity` が `WIREFRAME_OVERLAY_OPACITY`、`transparent` true、`depthWrite` false、`toneMapped` false |
| 重ね描きの子(SkinnedMesh の場合) | `instanceof SkinnedMesh`、`skeleton` が親と同一参照、`bindMatrix.equals(parent.bindMatrix)`、`bindMode` が同じ、`morphTargetInfluences` が親と同一参照 |
| 重ね描きの子に対する `new Raycaster()` の `intersectObject(overlay)` | `[]`(raycast が無効) |
| 重ね描きの子がある状態で親 Mesh に `intersectObject(mesh, true)` | 重ね描きを付ける前と同じ件数(当たり判定が二重にならない) |
| `applyMeshDisplay(root, "solid-wireframe")` を2回 | 重ね描きの子は各 Mesh に1つのまま。重ね描きの子には子が無い |
| solid-wireframe のあと `applyMeshDisplay(root, "solid")` | 重ね描きの子が無い、除去した材質の `dispose` が呼ばれている(`vi.spyOn`)、`wireframe` false、`polygonOffset` false、`Bone` は SkinnedMesh の子に残る |
| solid-wireframe のあと `applyMeshDisplay(root, "wireframe")` | 重ね描きの子が無い、`wireframe` true |
| `Group` / `Line` | 変更されない(`Line` の材質の `wireframe` プロパティが生えない) |
| root 自身が Mesh | root の材質にも適用される |
| `wireframe` を持たない材質(`new Material()`)の Mesh | 例外を投げず、その材質は触らない。solid-wireframe では重ね描きは付く |
| `InstancedMesh` を solid-wireframe | 材質の `polygonOffset` は true になるが、重ね描きの子は付かない |
| `isMeshDisplayOverlay(new Group())` | false |
| `createWireframeOverlay(mesh).userData[MESH_DISPLAY_OVERLAY_KEY]` | true。まだ `mesh.children` には入っていない |

### ソース検査(同じテストファイルに追加。pick.test.ts の `readSource` と同じ読み方)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `ModelMesh.tsx` | `applyMeshDisplay(scene, meshDisplay)` と `applyMeshDisplay(scene, "solid")` を含む。`if (!primary) return;` を含む effect は2つのまま(既存 pick.test が検査) |
| `ViewerCanvas.tsx` | `useDisplayStore` を import し、`meshDisplay={meshDisplay}` を含む |

### 結線後の全体像(074 の後に成立する。直接のテスト対象ではない)

| 状況 | 期待する結果 |
| --- | --- |
| welcome の `meshDisplay` が `"wireframe"` | 入室直後から全オブジェクトが線描画で見える |
| 他の参加者が「メッシュ+ワイヤ」にした | 陰影付きのモデルの上に濃いグレーの線が重なる。ちらつき(z-fighting)が無い |
| メッシュ+ワイヤでアニメーション再生 | 線も一緒に動く |
| メッシュ+ワイヤでモデル表面をクリックしてコメント | 通常時と同じ位置にピンが立つ |
| 非表示にしたオブジェクト | 線も一緒に消える(子なので `visible` を継承する) |
| 別プロジェクトへ遷移して戻る | 前回の表示方法が残らない(アンマウントで solid へ戻し、welcome で揃う) |

## やらないこと
- 切替 UI と `send` は 074
- ストア・dispatch・protocol の変更(072 で済んでいる)
- `InstancedMesh` への重ね描き(材質の wireframe 切替だけ行う)
- `Points` / `Line` / `Sprite` の表示方法変更
- 線の色や太さの設定 UI、`WireframeGeometry` / `EdgesGeometry` による稜線抽出
- `pick.ts` の変更(重ね描き側の raycast を無効にするので不要)

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] viewer_Summary.md に mesh-display.ts、ModelMesh の新 prop、ViewerCanvas の変更、mesh-display.test.ts を載せている
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
