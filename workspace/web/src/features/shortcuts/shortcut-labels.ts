import { MODE_LABELS, FIT_LABEL, RESET_LABEL } from "../viewer/hud-labels";
import type { ShortcutAction } from "./keymap";
import type { CaptureRejection } from "./capture";

/** 設定画面に出すアクション名。 */
export const ACTION_LABELS: Readonly<Record<ShortcutAction, string>> = {
  pen: MODE_LABELS.pen,
  comment: MODE_LABELS.comment,
  clearMode: "モード解除",
  viewReset: RESET_LABEL,
  viewFit: FIT_LABEL,
};

export const SETTINGS_OPEN_LABEL = "ショートカット設定";
export const SETTINGS_TITLE = "ショートカットキー";
export const SETTINGS_HELP =
  "「変更」を押してから割り当てたいキーを押してください。Shift との組み合わせだけが使えます。Esc で中止します。";
export const CHANGE_LABEL = "変更";
export const CANCEL_CAPTURE_LABEL = "やめる";
export const CAPTURING_MESSAGE = "キーを押してください";
export const UNBIND_LABEL = "解除";
export const RESET_KEYMAP_LABEL = "既定に戻す";
export const CLOSE_LABEL = "閉じる";

/** キャプチャを拒否した理由の説明文。 */
export function rejectionMessage(reason: CaptureRejection): string {
  return reason === "modifier"
    ? "Ctrl / Cmd / Alt との組み合わせは使えません"
    : "このキーは割り当てられません";
}
