---
id: 032
title: web viewer のカメラ送信トレーリング・法線変換・アンカー保護・glTF 外部参照の遮断
feature: web
depends_on: [031]
owns: [web/src/features/viewer/useCameraBroadcast.ts, web/src/features/viewer/camera-throttle.ts, web/src/features/viewer/pick.ts, web/src/features/viewer/ModelMesh.tsx, web/src/features/viewer/model-loading.ts, web/src/features/comments/CommentPickLayer.tsx, web/tests/camera-broadcast.test.ts, web/tests/camera-throttle.test.ts, web/tests/pick.test.ts, web/tests/model-loading.test.ts, web/web_Summary.md]
reads: [web/src/store/camera.ts, web/src/store/presence.ts, web/src/store/session.ts, web/src/store/comments.ts, web/src/features/annotation/stroke-build.ts, web/src/features/viewer/ViewerCanvas.tsx, shared/shared_Summary.md, shared/src/camera.ts, shared/src/protocol.ts]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
レビューで確認した viewer の不具合と、`.gltf` 経由の外部リソース取得を直す。(1) カメラ送信が
先頭エッジのみのスロットルで、ドラッグ終了直後の最終位置が 50ms 窓内に来ると次に動かすまで
送られない。(2) 法線を `transformDirection(matrixWorld)` で変換しており非一様スケールで方向がずれる。
(3) コメント入力中にモデルを再クリックするとアンカーだけ無警告で置き換わる。(4) `.gltf` 内の
`buffers[].uri` / `images[].uri` に外部 URL があると閲覧者のブラウザから任意ドメインへ取得が飛ぶ。

## 前提
- `useCameraBroadcast` は store 購読のみで、タイマーを持たない。web/src/features/viewer/useCameraBroadcast.ts:21-41。
  `shouldSendCamera` は web/tests/camera-broadcast.test.ts から参照されるため**残す**
- `CAMERA_SEND_INTERVAL_MS = 50`(shared/src/protocol.ts:14)。`cameraEquals` / `cloneCamera` は shared/src/camera.ts
- 送信成功時は自分の presence カメラも更新する(useCameraBroadcast.ts:31-38)。この副作用は維持する
- `pickModel` は `intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld)`。web/src/features/viewer/pick.ts:46。
  three の `Matrix3.getNormalMatrix(matrix4)` が法線行列(逆転置)を返す
- `CommentPickLayer.handlePointerUp` は `composerAnchor` の有無を見ずに `setComposerAnchor` する。
  web/src/features/comments/CommentPickLayer.tsx:43-57。`CommentComposer` にはキャンセルボタンがあり
  `setComposerAnchor(null)` で閉じる(web/src/features/comments/CommentComposer.tsx:90)
- `ModelMesh` は `useGLTF(src)` のみ。web/src/features/viewer/ModelMesh.tsx:8。drei の `useGLTF(path, useDraco, useMeshopt, extendLoader)`
  の第 4 引数で `GLTFLoader` を受け取れる(node_modules/@react-three/drei/core/Gltf.js:9-26)。
  three の `Loader.manager` は公開フィールドで差し替え可能。`LoadingManager.setURLModifier(fn)` は
  GLTFLoader 内部の FileLoader / TextureLoader が呼ぶ `resolveURL` に効く
- Draco デコーダは drei が別の DRACOLoader(独自 manager)で `https://www.gstatic.com/...` から取得する。
  これは本タスクの遮断対象外(Draco 圧縮モデルを使う場合の外部依存として web_Summary.md に明記する)
- `data:` / `blob:` URI は glb 内包・埋め込みリソースなので**通す**
- 依存の追加・package.json の変更は禁止

## インターフェイス契約

```ts
// web/src/features/viewer/camera-throttle.ts(新規。React / three 非依存)
import type { CameraState } from "@shared/types";

export interface CameraThrottleDeps {
  /** 送信。false なら未送信扱い(次の機会に再送) */
  send: (camera: CameraState) => boolean;
  now: () => number;
  /** delayMs 後に fn を呼ぶ。戻り値はキャンセル関数 */
  schedule: (fn: () => void, delayMs: number) => () => void;
  intervalMs?: number;   // 既定 CAMERA_SEND_INTERVAL_MS
}

export interface CameraThrottle {
  /** 最新のカメラを通知する。間隔内なら保持し、窓明けに最新値だけを送る */
  update(camera: CameraState): void;
  /** 保留中の送信とタイマーを破棄する */
  dispose(): void;
}

export function createCameraThrottle(deps: CameraThrottleDeps): CameraThrottle;
```

```ts
// web/src/features/viewer/useCameraBroadcast.ts
export function shouldSendCamera(prev, next, lastSentAt, now): boolean;   // 変更なし(throttle 内部から使う)
export function useCameraBroadcast(send: (msg: ClientMessage) => boolean): void;   // シグネチャ変更なし
// 実装: createCameraThrottle({ send: camera => send({type:"camera",camera}) && presence 更新, now: performance.now, schedule: setTimeout/clearTimeout })
// を effect 内で作り、store 購読で update、cleanup で dispose + unsubscribe
```

```ts
// web/src/features/viewer/pick.ts
export function pickModel(raycaster, camera, ndc, target): PickHit | null;   // シグネチャ変更なし
// 法線: new Matrix3().getNormalMatrix(intersection.object.matrixWorld) を applyMatrix3 して normalize()
```

```ts
// web/src/features/viewer/model-loading.ts(新規)
import { LoadingManager } from "three";
export const BLOCKED_RESOURCE_URL = "about:blank";
/** url が data: / blob: か、origin と同一オリジンならそのまま返す。それ以外は BLOCKED_RESOURCE_URL */
export function resolveModelResourceUrl(url: string, origin: string): string;
/** setURLModifier に resolveModelResourceUrl(url, location.origin) を設定した LoadingManager */
export function createModelLoadingManager(origin: string): LoadingManager;
```

```tsx
// web/src/features/viewer/ModelMesh.tsx
const { scene } = useGLTF(src, true, true, (loader) => { loader.manager = createModelLoadingManager(location.origin); });
```

```ts
// web/src/features/comments/CommentPickLayer.tsx  handlePointerUp
// useCommentsStore.getState().composerAnchor !== null なら何もしない(既存アンカーを保護)
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| throttle: t=0 に update(A) | 即時 send(A) |
| t=0 に update(A)、t=20 に update(B) | B は送られず保持。t=50 にタイマーで send(B) が 1 回だけ呼ばれる |
| t=0 update(A)、t=20 update(B)、t=30 update(C) | t=50 に send(C) のみ(B は送られない) |
| t=0 update(A)、t=20 update(B)、t=30 update(A) | t=50 に何も送らない(最後に送った値と同じ) |
| t=0 update(A)、t=60 update(B) | 即時 send(B)、タイマーは作られない |
| send が false を返す(未接続) | 送信済みとして記録しない。次の update または窓明けタイマーで再送する |
| update(B) 保留中に dispose() | schedule のキャンセル関数が呼ばれ、send は呼ばれない |
| 同じカメラを連続 update | 2 回目以降は送らない(既存挙動) |
| `useCameraBroadcast`: effect cleanup | throttle.dispose と unsubscribe が呼ばれる(hook 内。テスト不要、typecheck で完了。camera-broadcast.test.ts は shouldSendCamera の既存テストを維持) |
| `pickModel`: `box.scale.set(1, 4, 1)` の面(+X 面など)を正面から当てる | 返る normal が単位長で、`transformDirection` 版とは異なり真の面法線と一致する(±1e-6 で `[1,0,0]`) |
| `pickModel`: スケール 1 の box | 既存テストと同じ結果 |
| `resolveModelResourceUrl("data:application/octet-stream;base64,AAA", origin)` | そのまま |
| `resolveModelResourceUrl("blob:http://localhost/abc", origin)` | そのまま |
| `resolveModelResourceUrl("/api/projects/p/versions/v/model", "http://localhost:5173")` | そのまま |
| `resolveModelResourceUrl("http://localhost:5173/x.bin", "http://localhost:5173")` | そのまま |
| `resolveModelResourceUrl("https://evil.example/pixel.png", "http://localhost:5173")` | `BLOCKED_RESOURCE_URL` |
| `resolveModelResourceUrl("//evil.example/a.bin", "http://localhost:5173")` | `BLOCKED_RESOURCE_URL` |
| `resolveModelResourceUrl("not a url ::", origin)` | 相対 URL として origin 基準で解決し、同一オリジンなら通す(`new URL(url, origin)` の結果で判定) |
| `createModelLoadingManager(origin).resolveURL("https://evil.example/a.png")` | `BLOCKED_RESOURCE_URL` |
| `CommentPickLayer`: `composerAnchor` が非 null の状態でモデルをクリック | `setComposerAnchor` が呼ばれない(コンポーネント内。React 描画のテスト基盤が無いためテスト不要。実装と typecheck で完了) |
| `CommentPickLayer`: `composerAnchor` が null | 従来どおりアンカーが設定される |

## やらないこと
- Draco デコーダの取得先変更・同梱はしない
- サーバ側での `.gltf` 外部 URI 検査は行わない(必要なら別タスク)
- `CameraRig` / `follow.ts` の相互 follow 対策は行わない
- `RoomStrokes` の再ソート最適化は行わない
- 031 の対象ファイル(App / ReviewPage / client.ts / AnnotationLayer 等)は変更しない

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] web_Summary.md が更新されている(camera-throttle.ts、model-loading.ts、Draco の外部依存の明記、アンカー保護)
- [ ] すべてのファイルが300行以内 (実際の上限はフェーズプロンプトの実効基準に従う)
- [ ] verify: に書いたコマンドが成功する
