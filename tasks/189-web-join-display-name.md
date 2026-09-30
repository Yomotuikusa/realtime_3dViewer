---
id: 189
title: 入室ダイアログの表示名をアカウントの表示名と連動させる
feature: app
depends_on: [187]
owns: [web/src/app/JoinDialog.tsx, web/src/app/app_Summary.md, web/tests/join-dialog-account.test.ts]
reads: [web/src/api/account.ts, web/src/app/display-name.ts, web/src/app/ReviewPage.tsx, shared/src/account.ts, shared/src/protocol.ts, web/tests/display-name.test.ts, web/tests/timeline-styles.test.ts, web/tests/project-list-page.test.ts]
verify: npm run typecheck && npm run test
status: done
---

## 目的
いまの表示名はブラウザの localStorage にしか残らないため、別の端末では入力し直しになる。
入室ダイアログの初期値にアカウント(users.display_name)の表示名を使い、入室時にその名前をサーバにも保存する。
匿名ユーザーの表示名も保存する。登録すると同じ users 行がアカウントになるので、そのまま引き継がれる。

## 前提
- `JoinDialog({ onJoin })`(`web/src/app/JoinDialog.tsx`)は、`loadStoredName()` を初期値にした入力欄を持つ。
  送信時に `resolveDisplayName(input)`(空なら `Guest-<4桁>`)→ `saveName(name)` → `onJoin(name)` を行う
- `getAccount(): Promise<Account>` と `updateDisplayName(displayName): Promise<Account>` は
  `web/src/api/account.ts`(187)にある
  - `Account.displayName` は `string | null`
  - `PATCH /api/account` は匿名ユーザーにも使える(サーバが匿名ユーザーを作成・解決する)
- サーバの表示名は trim 後 1〜`MAX_NAME_LENGTH`(50)文字。`resolveDisplayName` の結果はこの範囲に収まる
- `web/tests/timeline-styles.test.ts:42` は ReviewPage.tsx のソース中の `<JoinDialog` の位置を検査している。
  **ReviewPage.tsx は変更しない**。JoinDialog の props も変えない
- ReviewPage を実際に描画するテストは無い
- web のコンポーネントテストは jsdom 上で `createRoot` + `act` で描画する。API は
  `vi.mock("../src/api/account", ...)` でモックする(`web/tests/project-list-page.test.ts` のモックの書き方に倣う)

## インターフェイス契約

`JoinDialog` のシグネチャは変えない。

```tsx
export function JoinDialog({ onJoin }: { onJoin: (name: string) => void }): ReactElement;
```

追加する振る舞い:
1. マウント時に `getAccount()` を 1 回呼ぶ
2. 解決した `displayName` が null でなく、かつマウント後に利用者が入力欄を 1 度も変更していなければ、入力欄をその値にする
3. `getAccount()` が失敗したら `console.error` に記録し、入力欄は変えない
4. アンマウント後に解決・失敗しても state を更新しない
5. 送信時は従来どおり `saveName(name)` → `onJoin(name)` を行う。その後 `updateDisplayName(name)` を呼ぶ
   - 待たない
   - 失敗は `.catch` で `console.error` に記録する
   - 入室は妨げない

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| localStorage に `"Local"`、`getAccount` が `displayName: "田中"` | 入力欄が「田中」になる |
| `getAccount` が `displayName: null` | 入力欄は「Local」のまま |
| `getAccount` の解決前に利用者が「Mine」と入力 | 解決後も入力欄は「Mine」 |
| `getAccount` が拒否 | 入力欄は「Local」のまま。`console.error` が呼ばれ、未処理の拒否が出ない |
| アンマウント後に `getAccount` が解決 | 例外・警告なし |
| 「入室する」(入力「田中」) | `onJoin("田中")` が呼ばれ、localStorage は「田中」、`updateDisplayName("田中")` が 1 回呼ばれる |
| 入力を空にして入室 | `onJoin` と `updateDisplayName` に同じ `Guest-dddd` が渡る |
| `updateDisplayName` が拒否 | `onJoin` は呼ばれている。`console.error` が呼ばれ、未処理の拒否が出ない |
| `web/tests/display-name.test.ts`・`timeline-styles.test.ts` | 変更せずに通る |

## やらないこと
- ReviewPage・ReviewHeader・session ストアの変更
- WS の `join` メッセージや presence へのアカウント ID の追加
- 表示名だけを変更する専用 UI
- `web/src/api/account.ts`・`shared/`・`server/` の変更

## 完了条件
- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャで実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] app_Summary.md の JoinDialog の説明を更新している
- [ ] すべてのファイルが300行以内
- [ ] verify: に書いたコマンドが成功する
