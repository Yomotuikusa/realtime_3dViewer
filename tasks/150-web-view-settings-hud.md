---
id: 150
title: web 表示系のビュー設定を HUD の「表示」ドロップダウンへ移し、設定ダイアログは操作のみにする
feature: view-settings
depends_on: []
owns: [web/src/features/view-settings/view-settings.ts, web/src/features/view-settings/view-settings-labels.ts, web/src/features/view-settings/ViewSettings.tsx, web/src/features/view-settings/ViewSettingsMenu.tsx, web/src/features/view-settings/view-settings.css, web/src/features/view-settings/view-settings-menu.css, web/src/features/view-settings/view-settings_Summary.md, web/src/features/viewer/hud-menu.ts, web/src/features/viewer/ViewerHud.tsx, web/src/features/viewer/viewer.css, web/src/features/viewer/viewer_Summary.md, web/tests/view-settings.test.ts, web/tests/view-settings-components.test.ts, web/tests/view-settings-menu.test.ts, web/tests/hud-menu.test.ts]
reads: [web/src/store/view-settings.ts, web/src/features/view-settings/view-settings-storage.ts, web/src/features/viewer/HudMenu.tsx, web/src/features/viewer/CameraMenu.tsx, web/src/features/viewer/FocalLengthSlider.tsx, web/src/app/SettingsDialog.tsx, web/src/app/review-labels.ts, web/tests/settings-dialog.test.ts, web/tests/viewer-styles.test.ts, web/tests/styles-rules.test.ts, web/tests/summary-coverage.test.ts, docs/DESIGN_SKILL.md]
verify: npm run typecheck && npm run test:web
status: done
---

## 目的

表示に関わるビュー設定は、3D ビューの見た目を確かめながら調整したい。設定ダイアログの「表示と操作」タブにある 10 項目のうち表示系 8 項目を、ビュー HUD のカメラメニューの下に置く「表示」ドロップダウンへ移す。操作系 2 項目はダイアログに残す。

## 前提

実装者が知らない、このタスクの外側で既に決まっている事実だけを挙げる。

- ビュー設定は 10 キー・5 グループで定義済み。キー、グループ、単位、既定値、範囲、順序は `web/src/features/view-settings/view-settings.ts:6-60`。グループは `annotation` / `viewer` / `input` / `joint` / `outliner` の 5 つ。
- 設定値は zustand ストア `web/src/store/view-settings.ts` が保持し、`setSetting(key, value)` / `resetSetting(key)` / `resetAll()` / `selectViewSetting(key)` を公開する。localStorage への保存はストア側で行われる。端末ローカル設定でありルーム共有ではない。
- 設定ダイアログは 3 タブ構成で、第 3 タブが `ViewSettings` を描く。`web/src/app/SettingsDialog.tsx:33,37`。タブ文言は `VIEW_SETTINGS_TITLE` を参照しており、`web/tests/settings-dialog.test.ts:56` も同じ定数と比較するため、定数の値を変えてもこのテストは通る。
- HUD のドロップダウンは `web/src/features/viewer/HudMenu.tsx` が汎用の殻(トグル + `open` のときだけ children を描くパネル)で、中身は `CameraMenu.tsx`。メニュー id・ラベル・初期状態・トグル関数は `web/src/features/viewer/hud-menu.ts`。`toggleHudMenu` は「同じものを押したら閉じる、違うものを押したらそれだけが開く」ため、同時に開くのは 1 つ。
- `ViewerHud.tsx:63-77` の `.hud-menus` は横並びの flex 行で、`DisplayModeBar` / `JointDisplayBar` / `TrailBar` / カメラの `HudMenu` を並べている。
- `.hud-menu`(幅 13.5rem)、`.hud-menu__toggle`、`.hud-menu__panel`(`position: absolute`)、`.hud-menu__item`、`.hud-menu__section`(section 間に区切り線)は `web/src/features/viewer/viewer.css:40-98` に定義済み。
- `web/tests/viewer-styles.test.ts` が `.hud-menu` の幅 13.5rem、`.hud-menu__toggle`、`.hud-menu__panel`、`.hud-menu__item`、`.hud-menus` の既存宣言を直接アサートしている。このテストはこのタスクでは変更しないので、既存ルールは消さず残すこと。
- HUD のスライダーの既存の作りは `FocalLengthSlider.tsx`(`.hud-focal` > `.hud-focal__head` に `<label>` と `<output>`、その下に `input[type=range]`)。
- `web/tests/styles-rules.test.ts` が `src` 配下の全 CSS を走査し、デザイントークン(`--space-*`、`--color-*`、`--text-*` など)の使用を検査する。
- `web/tests/summary-coverage.test.ts` が各機能フォルダの `<名前>_Summary.md` の存在と記述を検査する。
- `web/tests/outliner-styles.test.ts` は `DEFAULT_VIEW_SETTINGS` だけを参照しており、既定値を変えない限り影響しない。

## インターフェイス契約

### web/src/features/view-settings/view-settings.ts(追加のみ)

`ViewSettingKey`、`VIEW_SETTING_ORDER`、`VIEW_SETTING_GROUP_ORDER`、`VIEW_SETTING_SPECS`、`DEFAULT_VIEW_SETTINGS`、`isViewSettingKey`、`clampViewSetting` は既存のまま変更しない。以下を追加する。

```ts
/** 設定を表示する面。hud = 3D ビュー HUD の「表示」メニュー、dialog = 設定ダイアログ。 */
export type ViewSettingSurface = "hud" | "dialog";

export const VIEW_SETTING_GROUP_SURFACE: Readonly<Record<ViewSettingGroup, ViewSettingSurface>> = {
  annotation: "hud",
  viewer: "hud",
  input: "dialog",
  joint: "hud",
  outliner: "hud",
};

/** HUD の「表示」メニューに上から並べるグループ。 */
export const HUD_VIEW_SETTING_GROUP_ORDER: readonly ViewSettingGroup[] = ["annotation", "viewer", "joint", "outliner"];

/** 設定ダイアログに上から並べるグループ。 */
export const DIALOG_VIEW_SETTING_GROUP_ORDER: readonly ViewSettingGroup[] = ["input"];

/** グループに属するキーを VIEW_SETTING_ORDER の順で返す。 */
export function viewSettingKeysInGroup(group: ViewSettingGroup): readonly ViewSettingKey[];

/** 面に属するキーを VIEW_SETTING_ORDER の順で返す。 */
export function viewSettingKeysOnSurface(surface: ViewSettingSurface): readonly ViewSettingKey[];
```

### web/src/features/view-settings/view-settings-labels.ts

```ts
/** 設定ダイアログ第 3 タブの名前。表示系が HUD へ移ったので「操作」だけを指す。 */
export const VIEW_SETTINGS_TITLE = "操作";
```

`VIEW_SETTINGS_HELP`、`VIEW_SETTING_GROUP_LABELS`、`VIEW_SETTING_LABELS`、`RESET_VIEW_SETTING_LABEL`、`RESET_VIEW_SETTINGS_LABEL`、`formatViewSetting` は変更しない。`VIEW_SETTINGS_HELP` は HUD 側とダイアログ側の両方で表示する。

### web/src/features/viewer/hud-menu.ts

```ts
export type HudMenuId = "camera" | "display";

/** 右上に上から並べるメニューの順。 */
export const HUD_MENU_ORDER: readonly HudMenuId[] = ["camera", "display"];

export const HUD_MENU_LABELS: Readonly<Record<HudMenuId, string>> = {
  camera: "カメラ",
  display: "表示",
};

/** ページ表示直後に開いているメニュー。カメラのみ。 */
export const HUD_MENU_INITIAL: HudMenuId | null = "camera";

/** 既存のまま。同時に開くのは 1 つ。 */
export function toggleHudMenu(open: HudMenuId | null, clicked: HudMenuId): HudMenuId | null;
```

### web/src/features/view-settings/ViewSettingsMenu.tsx(新規)

```tsx
/**
 * HUD の「表示」メニューの中身。HudMenu の children として描かれる。
 * HUD_VIEW_SETTING_GROUP_ORDER のグループごとに .hud-menu__section を作り、
 * 最後の section に「すべて既定に戻す」を置く。
 */
export function ViewSettingsMenu(): ReactElement;
```

DOM 契約。クラス名とアクセシビリティ属性はこのとおりにする。

```
<div class="view-settings-menu">
  <p class="view-settings-menu__help">{VIEW_SETTINGS_HELP}</p>
  <div class="hud-menu__section view-settings-menu__group" role="group" aria-label={グループ名}>   // グループごとに1つ
    <p class="view-settings-menu__group-name">{グループ名}</p>
    <div class="view-setting-hud-row" data-changed={既定と違うか}>                                  // キーごとに1つ
      <div class="view-setting-hud-row__head">
        <label class="view-setting-hud-row__name" for={id}>{VIEW_SETTING_LABELS[key]}</label>
        <output class="view-setting-hud-row__value" for={id}>{formatViewSetting(key, value)}</output>
      </div>
      <input id={id} class="view-setting-hud-row__range" type="range" min max step value />
    </div>
  </div>
  <div class="hud-menu__section">
    <button class="btn hud-menu__item view-settings-menu__reset" type="button">{RESET_VIEW_SETTINGS_LABEL}</button>
  </div>
</div>
```

`id` は `useId()` を基に `${baseId}-${key}` で作る。`input` の `onChange` と `onInput` はいずれも `useViewSettingsStore.getState().setSetting(key, Number(event.currentTarget.value))` を呼ぶ(ドラッグ中も即座にビューへ反映させるため、既存 `ViewSettings.tsx` と同じ扱い)。

### web/src/features/view-settings/ViewSettings.tsx(設定ダイアログ側)

公開シグネチャ `export function ViewSettings(): ReactElement` は変更しない。描くグループを `DIALOG_VIEW_SETTING_GROUP_ORDER` に絞る。ルートの `.view-settings`、`fieldset.view-settings__group`、`.view-setting-row`、`.view-setting-row__name` / `__range` / `__value`、`.view-settings__footer` のクラス構成と、行ごとの `RESET_VIEW_SETTING_LABEL` ボタンはそのまま維持する。

### web/src/features/viewer/ViewerHud.tsx

`.hud-menus` の中で、カメラと表示の 2 つの `HudMenu` を縦スタックに包む。他のバーは横並びのまま変えない。

```tsx
<div className="hud-menus">
  <DisplayModeBar send={send} />
  <JointDisplayBar send={send} />
  <TrailBar send={send} />
  <div className="hud-menu-stack">
    {HUD_MENU_ORDER.map((id) => (
      <HudMenu key={id} id={id} open={openMenu === id}
        onToggle={() => setOpenMenu((open) => toggleHudMenu(open, id))}
        onClose={() => setOpenMenu(null)}>
        {id === "camera" ? <CameraMenu /> : <ViewSettingsMenu />}
      </HudMenu>
    ))}
  </div>
</div>
```

## 振る舞い

| 入力 / 状況 | 期待する結果 |
| --- | --- |
| HUD の「表示」メニューを開く | `HUD_VIEW_SETTING_GROUP_ORDER` の順に 4 グループ、計 8 行のスライダーが出る。行の順は `VIEW_SETTING_ORDER` に従う |
| 設定ダイアログ第 3 タブを開く | `input` グループの 1 fieldset・2 行(寄り引き感度、ライト回転感度)だけが出る。表示系 8 行は出ない |
| 設定ダイアログのタブ名 | 第 3 タブの文言は `VIEW_SETTINGS_TITLE`(= "操作") |
| HUD のスライダーを動かす | `setSetting` が呼ばれ、`<output>` が `formatViewSetting` の表記(px / rem / % / ×)に更新される。行の `data-changed` が `true` になる |
| HUD のスライダーを既定値に戻す位置へ動かす | 行の `data-changed` が `false` になる |
| HUD の値が 8 つとも既定 | 「すべて既定に戻す」は `disabled` |
| HUD の値が 1 つでも既定と違う | 「すべて既定に戻す」は押せる。押すと **hud 面の 8 キーだけ**が既定へ戻り、`dollySensitivity` / `lightRotateSensitivity` は変更前の値のまま |
| ダイアログの「すべて既定に戻す」 | **input 面の 2 キーだけ**が対象。2 キーとも既定なら `disabled`。押しても表示系 8 キーは変わらない |
| ページ表示直後 | カメラメニューが開き、「表示」は閉じている(`HUD_MENU_INITIAL === "camera"`) |
| 「表示」トグルを押す | カメラが開いていれば閉じ、表示だけが開く(`toggleHudMenu` の既存挙動) |
| カメラメニューが開いている状態 | カメラのパネルが通常フローで場所を取り、その下に「表示」トグルが押し下げられて常に見える(パネルが下のトグルを覆わない) |
| メニューのパネル上で Escape | 既存 `HudMenu` の挙動どおりそのメニューが閉じる(変更しない) |
| localStorage に保存された値がある状態で再読み込み | HUD 側・ダイアログ側とも保存値がスライダーに反映される(ストア・storage は無変更) |

## CSS

- `viewer.css` に追加するのは `.hud-menu-stack`(幅 13.5rem、`display: grid`、`gap: var(--space-2)`)と `.hud-menu-stack .hud-menu__panel`(`position: static` にして押し下げ式にし、角丸・境界を段組みに合わせる)まで。**追加は 14 行以内**(現在 266 行、上限 300 行)。既存の `.hud-menu` / `.hud-menu__panel` / `.hud-menus` / `.hud-menu__item` / `.hud-menu__section` の宣言は消さず残す(`viewer-styles.test.ts` がアサートしている)。
- HUD パネル内の行の見た目(`.view-settings-menu*`、`.view-setting-hud-row*`)は新規 `view-settings-menu.css` に書き、`ViewSettingsMenu.tsx` から import する。
- 生の色・生の余白値は書かず、`--space-*` / `--color-*` / `--text-*` / `--radius-*` トークンを使う。
- `view-settings.css` はダイアログ側が 1 グループになったことで不要になったルールがあれば削ってよいが、`.view-setting-row` 系の既存クラスは残す。

## テスト

- `web/tests/view-settings.test.ts`: 追加した面の分類(`VIEW_SETTING_GROUP_SURFACE`、`HUD_VIEW_SETTING_GROUP_ORDER`、`DIALOG_VIEW_SETTING_GROUP_ORDER`)と `viewSettingKeysInGroup` / `viewSettingKeysOnSurface` の順序・内容を検査する。hud 面 8 キー + dialog 面 2 キー = `VIEW_SETTING_ORDER` 全体であることも検査する。
- `web/tests/view-settings-components.test.ts`: ダイアログ側が `input` グループ 1 fieldset・2 行だけになったこと、行ごとのリセット、「すべて既定に戻す」が input 2 キーだけを戻し表示系を変えないことを検査する。既存の 5 fieldset の期待値は更新する。
- `web/tests/view-settings-menu.test.ts`(新規): `ViewSettingsMenu` の DOM(4 グループ・8 行・ラベル・単位表記・`data-changed`)、スライダー操作での `setSetting`、「すべて既定に戻す」が hud 8 キーだけを戻し `dollySensitivity` / `lightRotateSensitivity` を変えないこと、`view-settings-menu.css` に `.view-setting-hud-row` 系ルールがあることを検査する。
- `web/tests/hud-menu.test.ts`: `HUD_MENU_ORDER` が `["camera", "display"]`、`HUD_MENU_LABELS` に `display: "表示"`、`HUD_MENU_INITIAL` が `"camera"`、camera と display の間のトグル遷移を検査する。

## やらないこと

- `web/src/store/view-settings.ts`、`view-settings-storage.ts`、設定キーの追加・削除・既定値の変更は行わない。10 キーと保存形式は現状のまま。`resetAll()` は使わなくなるが削除しない。
- 設定ダイアログのタブ構成(`SettingsTab` の 3 種と `SETTINGS_TAB_ORDER`)は変えない。`web/src/app/` 配下は一切変更しない。
- `shared` / `server` は変更しない。表示設定をルーム共有にはしない(端末ローカルのまま)。
- `web/tests/viewer-styles.test.ts` と `web/tests/settings-dialog.test.ts` は変更しない。これらが落ちる変更を入れないこと。
- `CameraMenu.tsx` / `HudMenu.tsx` / `FocalLengthSlider.tsx` の中身は変更しない。
- `DisplayModeBar` / `JointDisplayBar` / `TrailBar` を縦スタックへ入れない。

## 完了条件

- [ ] owns: に挙げたファイルだけを変更している
- [ ] インターフェイス契約どおりのシグネチャ・クラス名で実装されている
- [ ] 振る舞い表の全行に対応するテストがあり、通る
- [ ] view-settings_Summary.md と viewer_Summary.md を更新している
- [ ] すべてのファイルが 300 行以内(viewer.css は 280 行以内)
- [ ] `npm run typecheck && npm run test:web` が成功する
