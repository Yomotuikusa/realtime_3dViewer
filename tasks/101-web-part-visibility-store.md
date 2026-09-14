---
id: 101
title: web objects ストアに部位の表示状態を持たせ、受信と welcome で反映する
feature: web
depends_on: [098]
owns: [web/src/store/objects.ts, web/src/store/store_Summary.md, web/src/app/realtime-dispatch.ts, web/src/app/app_Summary.md, web/tests/store-objects.test.ts, web/tests/realtime-dispatch.test.ts]
reads: [shared/src/protocol.ts, shared/src/types.ts, shared/src/object-part.ts, shared/shared_Summary.md, web/src/features/objects/ObjectList.tsx, web/tests/review-stores.test.ts, docs/3dreviewer-plan-and-architecture.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
部位(版内オブジェクト)の表示・非表示をルーム共有するための web 側の状態を、版単位の
`hiddenIds` と同じ objects ストアに持たせる。受信ディスパッチで `object:part-visibility` と
`welcome.hiddenObjectParts` を反映する。UI(送信側)と 3D への適用は 102 / 103 が行う。

## 前提
- objects ストアは `objects` / `hiddenIds` を持ち、`setVisible(versionId, visible)` は変化が無ければ state を更新しない
  (`getState()` の参照が同じ)。`applyWelcome(hiddenIds)` は重複除去のうえ全置換し、同じ内容なら更新しない。
  web/src/store/objects.ts
- 098 により `ObjectPartRef { versionId, objectPath }`、`objectPartKey`、`isSameObjectPart` が `@shared/types` /
  `@shared/object-part` にある(`@shared/index` からも再エクスポート)
- `realtime-dispatch.ts` の welcome は `objects.applyWelcome(msg.hiddenObjectIds ?? [])` を呼ぶ(:29)。`switch` は `msg satisfies never`
  で網羅性を検査するため、新しいメッセージ種別に case を足さないと typecheck が落ちる
- `web/tests/store-objects.test.ts` の reset 確認は `toMatchObject({ objects: [], hiddenIds: [] })`。
  `web/tests/review-stores.test.ts` は objects の reset を既存の値で確認しており変更不要
- 設計書 §13.5: 表示に関わる状態はルーム共有が原則。ストアの Summary にもこの原則を書く

## インターフェイス契約

### 変更 web/src/store/objects.ts

```ts
import type { ModelVersion, ObjectPartRef, ObjectPath } from "@shared/types";
import { isSameObjectPart } from "@shared/object-part";

export interface ObjectsStoreState {
  objects: ModelVersion[];
  hiddenIds: string[];
  /** 非表示の部位。追加順。同じ部位は 1 つだけ。objects に無い versionId も保持してよい */
  hiddenParts: ObjectPartRef[];
  setObjects(versions: readonly ModelVersion[]): void;
  append(version: ModelVersion): void;
  setVisible(versionId: string, visible: boolean): void;
  /** visible=false なら hiddenParts に追加、true なら除去する。変化が無ければ state を更新しない */
  setPartVisible(versionId: string, objectPath: ObjectPath, visible: boolean): void;
  /** welcome の hiddenObjectIds / hiddenObjectParts で両方を全置換する(重複除去)。両方とも同じ内容なら更新しない */
  applyWelcome(hiddenIds: readonly string[], hiddenParts?: readonly ObjectPartRef[]): void;
  reset(): void;
}

/** hiddenParts に同じ部位が無ければ表示中 */
export function isObjectPartVisible(hiddenParts: readonly ObjectPartRef[], versionId: string, objectPath: ObjectPath): boolean;

/** versionId の非表示部位の objectPath を追加順で返す */
export function hiddenObjectPaths(hiddenParts: readonly ObjectPartRef[], versionId: string): ObjectPath[];
```

- `hiddenParts` の要素は保存時に `{ versionId, objectPath }` へ複製する(引数の参照を保持しない)
- `applyWelcome` の第 2 引数省略は `[]` と同じ(既存呼び出し・既存テストとの互換)
- `reset()` は `hiddenParts: []` も戻す。`setObjects` は `hiddenParts` を維持する

### 変更 web/src/app/realtime-dispatch.ts

- welcome: `objects.applyWelcome(msg.hiddenObjectIds ?? [], msg.hiddenObjectParts ?? []);`
- `case "object:part-visibility": objects.setPartVisible(msg.versionId, msg.objectPath, msg.visible); break;`
  (098 が `case "error":` の直前に置いた仮分岐 `case "object:part-visibility": break;` をこれに差し替える。case を二重にしない)
  を `object:visibility` の直後に置く

## 振る舞い

### web/tests/store-objects.test.ts(追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| 初期状態 | `hiddenParts` が `[]` |
| `setPartVisible("v1", "0/1", false)` | `hiddenParts` が `[{ versionId: "v1", objectPath: "0/1" }]` |
| 同じ引数でもう一度 | `getState()` の参照が変わらない |
| `setPartVisible("v1", "2", false)` → `setPartVisible("v1", "0/1", true)` | `[{v1,"2"}]`(追加順を保ち、指定分だけ除去) |
| 無い部位を `visible=true` | 参照が変わらない |
| `setPartVisible("v2", "0/1", false)` | `v1` の `"0/1"` とは別要素として追加される |
| `applyWelcome(["v1"], [{v1,"0"}, {v1,"0"}, {v2,"1"}])` | `hiddenIds` が `["v1"]`、`hiddenParts` が `[{v1,"0"},{v2,"1"}]`(重複除去) |
| 同じ内容で `applyWelcome` | 参照が変わらない |
| `applyWelcome([])`(第 2 引数省略)を部位がある状態で | `hiddenParts` が `[]` になる |
| `applyWelcome` に渡した配列の要素を後から書き換える | ストアの要素は変わらない(複製) |
| `setObjects([v1])` | `hiddenParts` が維持される |
| `reset()` | `toMatchObject({ objects: [], hiddenIds: [], hiddenParts: [] })` |
| `isObjectPartVisible([{v1,"0/1"}], "v1", "0/1")` / `("v1", "0/2")` / `("v2", "0/1")` | false / true / true |
| `hiddenObjectPaths([{v1,"2"},{v2,"0"},{v1,"0/1"}], "v1")` / `(…, "v3")` | `["2", "0/1"]` / `[]` |

### web/tests/realtime-dispatch.test.ts(追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `{ type: "object:part-visibility", userId: "u2", versionId: "v1", objectPath: "0/2", visible: false }` | `hiddenParts` が `[{ versionId: "v1", objectPath: "0/2" }]`。`hiddenIds` は変わらない |
| 続けて `visible: true` | `hiddenParts` が `[]` |
| welcome に `hiddenObjectParts: [{ versionId: "v1", objectPath: "0" }]` | `hiddenParts` が同値 |
| 続けて `hiddenObjectParts` なしの welcome | `hiddenParts` が `[]`(既存の "applies welcome hidden ids and clears them when omitted" と同じ形) |

## やらないこと
- 送信側 UI(103)、3D への `visible` 適用(102)
- `ObjectList.tsx` の変更(版単位の UI はそのまま)
- selection ストアや display ストアの変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る。既存テストも通る
- [ ] store_Summary.md を更新している。objects.ts の説明に `hiddenParts` / `setPartVisible` / `isObjectPartVisible` /
      `hiddenObjectPaths` を追加し、他機能との関係に「**3D ビューの見え方を決める状態はルーム共有が原則**
      (設計書 §13.5)。版・部位の非表示は welcome で全置換し、受信で更新する」と書く
- [ ] app_Summary.md の realtime-dispatch.ts の説明とテスト節に `object:part-visibility` / `welcome.hiddenObjectParts` を追加している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
