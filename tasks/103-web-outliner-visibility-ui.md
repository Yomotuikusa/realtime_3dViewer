---
id: 103
title: web アウトライナに瞳の列見出しと行ごとの表示チェックボックスを付けてルームへ共有する
feature: web
depends_on: [102]
owns: [web/src/features/outliner/Outliner.tsx, web/src/features/outliner/OutlinerRow.tsx, web/src/features/outliner/outliner-icons.tsx, web/src/features/outliner/outliner-labels.ts, web/src/features/outliner/outliner.css, web/src/features/outliner/outliner_Summary.md, web/tests/outliner-styles.test.ts, web/tests/outliner-labels.test.ts, web/src/app/ReviewPage.tsx, web/src/app/app_Summary.md, web/tests/layout-styles.test.ts]
reads: [shared/src/protocol.ts, web/src/store/objects.ts, web/src/store/store_Summary.md, web/src/features/outliner/outliner-tree.ts, web/src/features/outliner/selection.ts, web/src/features/objects/ObjectList.tsx, web/src/features/objects/objects-labels.ts, web/src/styles/tokens.css, web/src/styles/controls.css, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, docs/3dreviewer-plan-and-architecture.md, docs/task-breakdown.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的
アウトライナから各オブジェクトの表示・非表示を切り替えられるようにする。見出しの右端に瞳のアイコン
(列の意味を示す)を置き、各行の右端にチェックボックス(チェック = 表示)を置く。
版のルート行は既存の版単位の共有(`object:visibility`)、子孫の行は部位の共有(`object:part-visibility`)
として、どちらもローカルのストアを更新してから `send` する(設計書 §13.5、台帳 D39)。

## 前提
- `Outliner()` は props なしで、`hiddenIds` を読んでルート行に `hidden` を渡している。web/src/features/outliner/Outliner.tsx。
  `OutlinerRow` は `hidden?: boolean` を `data-hidden` に写す(OutlinerRow.tsx:33)。`.outliner__row` は flex で
  `.outliner__expand` と `.outliner__select`(flex: 1 1 auto)を並べる(outliner.css:28-34, 64-78)
- 版単位の切り替えの前例は `ObjectList.handleToggle`(web/src/features/objects/ObjectList.tsx:42-46):
  `setVisible(versionId, !visible)` のあと `send({ type: "object:visibility", versionId, visible: !visible })`
- objects ストアに `hiddenParts`、`setPartVisible(versionId, objectPath, visible)`、`isObjectPartVisible(hiddenParts, versionId, objectPath)`、
  `hiddenObjectPaths(hiddenParts, versionId)` がある(101)。web/src/store/objects.ts
- `OutlinerNode` に `path`(ルートは `""`)がある(102)。子孫の行の共有鍵はこの `path`
- three は親が非表示なら子孫も描かない。したがって祖先(版を含む)が非表示の行は、自身の値にかかわらず 3D では見えない。
  行の見た目(薄色)は `data-hidden` で表し、チェックボックスは自身の値を示す
- `ReviewPage` は `<Outliner />` を `.review-outliner` に置く(web/src/app/ReviewPage.tsx:162)。`realtime.send` は
  `ObjectList` に渡しているのと同じもの。`web/tests/layout-styles.test.ts:69` が `<Outliner />` の個数を断言している
- `web/tests/outliner-styles.test.ts:56-79` "keeps tree and selection local to the outliner" は `Outliner.tsx` に
  `send(` が無いことを断言している。本タスクは Outliner に `send` を渡すので**この断言は要件と矛盾する。テストを更新する**
  (OutlinerRow.tsx の `send(` 不在の断言は残す)
- 文言は `*-labels.ts` に置いてテストする(台帳 D36)。状態は属性セレクタで表す(D35)。生色は tokens.css 以外に書かない
- button の中に input を入れてはならない(HTML の入れ子禁止)。チェックボックスは `.outliner__select` の外、`.outliner__row` の直下に置く

## インターフェイス契約

### 変更 web/src/features/outliner/outliner-labels.ts(追加のみ)

```ts
/** 瞳アイコンの列見出し(title / aria-label) */
export const OUTLINER_VISIBILITY_HEADING = "表示";

/** "<label> の表示を切り替え" */
export function visibilityAriaLabel(label: string): string;
```

### 変更 web/src/features/outliner/outliner-icons.tsx(追加のみ)

```tsx
/** 見出し右端の瞳。className "outliner__eye-icon"、viewBox は OUTLINER_ICON_VIEW_BOX、aria-hidden、data-kind は付けない */
export function EyeIcon(): ReactElement;
```

図案: `fill="none" stroke="currentColor" strokeWidth="1.25"` で、まぶた `M1.5 8C3 4.5 5.5 3 8 3s5 1.5 6.5 5C13 11.5 10.5 13 8 13S3 11.5 1.5 8Z` と瞳 `<circle cx="8" cy="8" r="2.25" />`。
`OUTLINER_KIND_ICONS` には入れない。

### 変更 web/src/features/outliner/OutlinerRow.tsx

```ts
export interface OutlinerRowProps {
  id: string;
  depth: number;
  label: string;
  kind: OutlinerNodeKind | null;
  badge?: string;
  loading?: boolean;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  /** この行自身の表示状態。チェックボックスの checked */
  visible: boolean;
  /** 版または祖先の行が非表示で、この行の値にかかわらず 3D で見えない */
  ancestorHidden: boolean;
  onToggleExpand(id: string): void;
  onSelect(): void;
  onToggleVisible(): void;
  children?: ReactNode;
}
```

- `hidden` prop は削除し、`data-hidden={!visible || ancestorHidden}` にする
- `.outliner__row` の中で `.outliner__select` ボタンの**直後**に置く:

```tsx
<input
  type="checkbox"
  className="outliner__visible"
  checked={visible}
  disabled={loading === true}
  aria-label={visibilityAriaLabel(label)}
  onChange={onToggleVisible}
/>
```

```ts
export interface OutlinerBranchProps {
  versionId: string;
  node: OutlinerNode;
  depth: number;
  expandedIds: readonly string[];
  selected: OutlinerSelection | null;
  /** この版の非表示部位の path(objects ストアの hiddenObjectPaths の結果) */
  hiddenPaths: readonly string[];
  /** 版または祖先が非表示 */
  ancestorHidden: boolean;
  onToggleExpand(id: string): void;
  onSelect(selection: OutlinerSelection): void;
  onToggleVisible(versionId: string, objectPath: string): void;
}
```

- `visible = !hiddenPaths.includes(node.path)`。子へは `ancestorHidden={ancestorHidden || !visible}` を渡す
- `onToggleVisible` は `() => onToggleVisible(versionId, node.path)` で行へ渡す

### 変更 web/src/features/outliner/Outliner.tsx

```tsx
import type { ClientMessage } from "@shared/protocol";

export function Outliner({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement;
```

- 見出しを次にする(`.outliner` の 1 行目):

```tsx
<div className="outliner__head">
  <h2 className="outliner__heading">{OUTLINER_HEADING}</h2>
  <span className="outliner__eye" role="img" aria-label={OUTLINER_VISIBILITY_HEADING} title={OUTLINER_VISIBILITY_HEADING}>
    <EyeIcon />
  </span>
</div>
```

- ストアから `hiddenParts` / `setVisible` / `setPartVisible` を追加で購読し、次のハンドラを持つ:

```ts
const handleVersionToggle = (versionId: string): void => {
  const visible = isObjectVisible(useObjectsStore.getState().hiddenIds, versionId);
  setVisible(versionId, !visible);
  send({ type: "object:visibility", versionId, visible: !visible });
};
const handlePartToggle = (versionId: string, objectPath: string): void => {
  const visible = isObjectPartVisible(useObjectsStore.getState().hiddenParts, versionId, objectPath);
  setPartVisible(versionId, objectPath, !visible);
  send({ type: "object:part-visibility", versionId, objectPath, visible: !visible });
};
```

- ルート行: `visible={isObjectVisible(hiddenIds, version.id)}`、`ancestorHidden={false}`、`onToggleVisible={() => handleVersionToggle(version.id)}`(`hidden` prop は廃止)
- 子の `OutlinerBranch`: `hiddenPaths={hiddenObjectPaths(hiddenParts, version.id)}`、`ancestorHidden={!isObjectVisible(hiddenIds, version.id)}`、`onToggleVisible={handlePartToggle}`
- 読み込み中(`root === null`)のルート行は `visible` を版の状態で表示し、チェックボックスは `disabled`(既存の `loading`)

### 変更 web/src/features/outliner/outliner.css(追加。既存ルールは変更しない)

```css
.outliner__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-right: var(--space-1);
}

.outliner__eye {
  display: inline-flex;
  color: var(--color-text-muted);
}

.outliner__eye-icon {
  width: 1rem;
  height: 1rem;
}

.outliner__visible {
  flex: 0 0 auto;
  width: 0.875rem;
  height: 0.875rem;
  margin: 0 var(--space-1) 0 0;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.outliner__visible[disabled] {
  cursor: default;
}
```

### 変更 web/src/app/ReviewPage.tsx
`<Outliner />` を `<Outliner send={realtime.send} />` にする。他は変更しない。

## 振る舞い

### web/tests/outliner-labels.test.ts(追記)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `OUTLINER_VISIBILITY_HEADING` | `"表示"` |
| `visibilityAriaLabel("Body")` | `"Body の表示を切り替え"` |

### web/tests/outliner-styles.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `EyeIcon()` | `type === "svg"`、`className === "outliner__eye-icon"`、`viewBox === "0 0 16 16"`、`aria-hidden === "true"`、`data-kind` が undefined。`OUTLINER_KIND_ICONS` の値に含まれない |
| `outliner.css` | `.outliner__head` の本文に `justify-content: space-between`、`.outliner__visible` の本文に `accent-color: var(--color-accent)`、`.outliner__visible[disabled]` が存在。既存の CSS 断言はそのまま通る |
| `Outliner.tsx` | `send(`、`"object:visibility"`、`"object:part-visibility"`、`setPartVisible(`、`setVisible(`、`hiddenObjectPaths(`、`isObjectPartVisible(`、`<EyeIcon`、`OUTLINER_VISIBILITY_HEADING`、`ClientMessage` を含む。`hidden={` を含まない |
| `Outliner.tsx` | 既存の `useState<string[]>([])`、`role="tree"`、`useModelScenesStore`、`useSelectionStore`、`buildOutlinerTree(`、`toggleId(`、`versionTag(`、`isObjectVisible(`、`import "./outliner.css"` の断言は残す。**`not.toContain("send(")` と `not.toContain("ClientMessage")` の断言は削除する**(it 名も "shares visibility and keeps selection local" のように直す) |
| `OutlinerRow.tsx` | `type="checkbox"`、`className="outliner__visible"`、`checked={visible}`、`visibilityAriaLabel(`、`onChange={onToggleVisible}`、`data-hidden={!visible || ancestorHidden}` を含む。`send(`、`ClientMessage`、`hidden?:` を含まない。既存の `role="treeitem"` 等の断言は残す |
| `OutlinerRow.tsx` | `type="checkbox"` の出現位置が `className="outliner__select"` より後、`role="group"` より前(select ボタンの外・直後) |

### web/tests/layout-styles.test.ts(更新)

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| `app/ReviewPage.tsx` | `<Outliner send={realtime.send} />` がちょうど 1 回(既存の `<Outliner />` の断言を置き換える) |

### 見た目と操作(目視確認。マージ後に人間が行う)

| 操作 | 期待する結果 |
| --- | --- |
| アウトライナを開く | 見出し「アウトライナ」の右端に瞳のアイコン。各行の右端にチェック済みのチェックボックス |
| メッシュの行のチェックを外す | そのメッシュが 3D から消え、行が薄い色になる。他の参加者の画面でも消える |
| もう一度チェックする | 再表示され、他の参加者にも反映される |
| グループの行のチェックを外す | 配下すべてが消える。配下の行は薄い色になるがチェックボックスは自身の値(チェック済み)のまま |
| 版のルート行のチェックを外す | 右パネルの「オブジェクト」の表示ボタンも「非表示」に変わる(同じストア)。全員に反映される |
| 非表示の部位がある状態で別の人が入室 | その人の画面でも最初から非表示 |
| チェックボックスをクリック | 行の選択状態は変わらない(選択はラベル側のボタン) |
| 非表示にした部位にコメントのピンを打とうとする | ピックされない(後ろのメッシュに当たる) |

## やらないこと
- 「すべて表示 / すべて非表示」の一括操作(瞳アイコンは押せない列見出し)
- `ObjectList.tsx` の変更(版単位の UI は既存のまま。ストアを共有しているので自動的に同期する)
- 3D ビュー側からの表示切り替え
- 非表示部位の比較計算からの除外

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・DOM 構造・CSS で実装されている
- [ ] 振る舞い表(自動テスト側)の全行に対応するテストがあり、通る。既存テストも通る
- [ ] outliner_Summary.md を更新している。目的に「行ごとの表示・非表示をルームへ共有する」を足し、
      Outliner.tsx の説明に `send` と 2 種のメッセージ、OutlinerRow.tsx にチェックボックス、outliner-labels.ts /
      outliner-icons.tsx に追加分を書き、他機能との関係の「選択・展開状態はルームへ送信しない」に
      「表示・非表示は送信する(設計書 §13.5)」を並べる
- [ ] app_Summary.md の ReviewPage.tsx の説明を `Outliner` に `send` を渡す形に更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
- [ ] 最終メッセージに docs/DESIGN_SKILL.md §16 の監査結果を書く(台帳 D38)
