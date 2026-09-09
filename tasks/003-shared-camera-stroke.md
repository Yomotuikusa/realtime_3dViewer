---
id: 003
title: shared カメラ補間と線の間引き(純粋関数)
feature: shared
depends_on: [002]
owns: [shared/src/camera.ts, shared/src/stroke.ts, shared/src/index.ts, shared/tests/camera.test.ts, shared/tests/stroke.test.ts, shared/shared_Summary.md]
reads: [../docs/3dreviewer-plan-and-architecture.md, ../docs/task-breakdown.md, shared/src/types.ts]
verify: npm run test:shared
status: done
---

## 目的
Follow Camera / コメント再現で使うカメラ補間・比較(§16.2, §16.4)と、Annotation 送信前の
点列間引き(§16.3)を、three.js に依存しない純粋関数として shared に置き、web から使う。

## 前提
- 001 の `Vec3` `CameraState` を import する。three.js は import しない(shared は node 環境でテストする)
- `shared/src/index.ts` に `export * from "./camera"; export * from "./stroke";` を追加する。
  `SHARED_SCAFFOLD` は残す
- 決定事項 D15(docs/task-breakdown.md §3): 2 点未満の線は送らない
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// shared/src/camera.ts
import type { CameraState, Vec3 } from "./types";

/** モデルロード前の初期視点 */
export const DEFAULT_CAMERA: CameraState = { position: [3, 3, 3], target: [0, 0, 0] };

export function vec3Equals(a: Vec3, b: Vec3, eps?: number): boolean;      // eps 既定 1e-4。各成分の差の絶対値がすべて eps 以下
export function vec3Distance(a: Vec3, b: Vec3): number;
export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3;
export function cameraEquals(a: CameraState, b: CameraState, eps?: number): boolean;  // position と target 両方が vec3Equals
export function lerpCamera(from: CameraState, to: CameraState, t: number): CameraState; // t は [0,1] にクランプ。新しいオブジェクトを返す
export function cloneCamera(c: CameraState): CameraState;                // 配列も複製(参照を共有しない)
```

```ts
// shared/src/stroke.ts
import type { Vec3 } from "./types";

/** モデルの最大辺長から simplify の許容誤差を決める(modelSize * 0.001) */
export function simplifyTolerance(modelSize: number): number;

/**
 * Ramer–Douglas–Peucker(3D)。先頭と末尾は必ず残す。
 * points.length <= 2 なら複製を返す。tolerance <= 0 なら複製を返す(間引かない)。
 */
export function simplify(points: Vec3[], tolerance: number): Vec3[];

/** 送信可能か: 2 点以上 2000 点以下 */
export function isSendableStroke(points: Vec3[]): boolean;
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `vec3Equals([0,0,0],[0.00005,0,0])` | true(既定 eps 1e-4)。`[0.001,0,0]` は false |
| `vec3Distance([0,0,0],[3,4,0])` | 5 |
| `lerpVec3([0,0,0],[10,10,10],0.5)` | `[5,5,5]` |
| `lerpCamera(a,b,0)` / `lerpCamera(a,b,1)` | a と等しい / b と等しい(`cameraEquals` で判定)。返り値は a, b と別オブジェクト |
| `lerpCamera(a,b,-1)` / `lerpCamera(a,b,2)` | クランプされ、それぞれ t=0 / t=1 と同じ |
| `cameraEquals` で position は同じだが target が eps 超で違う | false |
| `cloneCamera(c)` | `cameraEquals` true、かつ `clone.position !== c.position` |
| `simplify([], 0.1)` / 1 点 / 2 点 | 同じ内容の新しい配列(元配列と別参照) |
| `simplify` に直線上の 5 点 `[0,0,0],[1,0,0],[2,0,0],[3,0,0],[4,0,0]`, tolerance 0.01 | `[[0,0,0],[4,0,0]]` |
| `simplify` に `[0,0,0],[1,1,0],[2,0,0]`, tolerance 0.5 | 3 点とも残る(中点の距離 1 > 0.5) |
| 同上、tolerance 2 | `[[0,0,0],[2,0,0]]` |
| `simplify` の tolerance が 0 / 負 | 複製を返す(点は減らない) |
| `simplify` の先頭・末尾 | どの入力でも出力の先頭・末尾は入力と同じ |
| 1000 点のランダム折れ線を simplify | 出力点数 <= 入力点数、先頭末尾一致、例外なし(再帰深度で落ちない) |
| `simplifyTolerance(10)` | 0.01 |
| `isSendableStroke` に 1 点 / 2 点 / 2000 点 / 2001 点 | false / true / true / false |

## やらないこと
- レイキャスト・法線オフセット・three.js 依存の処理(web の 017)
- throttle 処理(web の 014)
- `SHARED_SCAFFOLD` の削除
- 依存の追加・package.json の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] shared_Summary.md が更新されている(camera / stroke の公開インターフェイスを追記)
- [ ] すべてのファイルが300行以内
- [ ] verify: `npm run test:shared` が成功する
