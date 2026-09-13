import type { ThemeMode } from "./theme-mode";
import type { ViewerColorKey } from "./viewer-colors";

/** パネルの見出し。タブ名にも使う。 */
export const THEME_SETTINGS_TITLE = "表示色";
export const THEME_SETTINGS_HELP =
  "色の設定はこの端末にだけ保存され、他の参加者の画面は変わりません（共有設定の例外です）。";
/** テーマ選択の role="group" の aria-label。 */
export const THEME_MODE_LABEL = "テーマ";
/** テーマ 3 値のボタン名。 */
export const THEME_MODE_LABELS: Readonly<Record<ThemeMode, string>> = {
  light: "ライト",
  dark: "ダーク",
  system: "OS に合わせる",
};
/** 11 色の一覧の role="group" の aria-label。 */
export const VIEWER_COLORS_LABEL = "3D ビューの色";
/** 色キーごとの表示名。 */
export const VIEWER_COLOR_LABELS: Readonly<Record<ViewerColorKey, string>> = {
  background: "背景",
  selection: "選択したオブジェクト",
  wireframe: "ワイヤフレームの線",
  joint: "ボーンの関節",
  jointLink: "ボーンのつながり",
  jointSelected: "選択したボーン",
  trailLine: "軌跡の線",
  trailPoint: "軌跡のフレーム点",
  trailCurrent: "軌跡の現在位置",
  compareOutside: "比較で外へずれた面",
  compareInside: "比較で内へずれた面",
};

export const PALETTE_LABEL = "パレット";
export const WHEEL_LABEL = "色相と明るさ";
export const HEX_INPUT_LABEL = "16 進の色";
export const RESET_COLORS_LABEL = "すべての色を既定に戻す";
export const RESET_COLOR_LABEL = "既定に戻す";

/** スウォッチのボタン名。開閉状態によらず同じ文言を返す。 */
export function colorPickerLabel(colorName: string): string {
  return `${colorName}の色を選ぶ`;
}

/** 変更済みの色の行に出す印の説明。 */
export const CHANGED_LABEL = "変更済み";
