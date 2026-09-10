import type { AnnotationMode } from "../../store/annotation";

/** HUD のボタンに出すモード。"none" は解除状態でありボタンを持たない。 */
export type ToolMode = Exclude<AnnotationMode, "none">;

export const MODE_LABELS: Readonly<Record<ToolMode, string>> = {
  pen: "ペン",
  comment: "コメント",
};

export const MODE_ORDER: readonly ToolMode[] = ["pen", "comment"];
export const RESET_LABEL = "視点を戻す";
export const FIT_LABEL = "全体を表示";
export const UNDO_LABEL = "1本戻す";
export const CLEAR_LABEL = "自分の線を消す";
export const OVERLAY_LABEL = "透過表示";
export const UNFOLLOW_LABEL = "追従を解除";

const COLOR_NAMES: Readonly<Record<string, string>> = {
  "#ff0000": "赤",
  "#ff8800": "橙",
  "#00aa00": "緑",
  "#0088ff": "青",
  "#aa00ff": "紫",
  "#ff00aa": "桃",
};

export function colorName(hex: string): string {
  return COLOR_NAMES[hex.toLowerCase()] ?? hex;
}

export function followingLabel(name: string): string {
  return name === "" ? "他の参加者の視点を追従中" : `${name} の視点を追従中`;
}

export interface HintInput {
  mode: AnnotationMode;
  canEdit: boolean;
  hasAnchor: boolean;
  following: boolean;
}

export function hint(input: HintInput): string {
  if (input.following) {
    return "操作すると追従が解除されます";
  }
  if (input.mode === "none") {
    return "Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動";
  }
  if (input.mode === "pen") {
    return input.canEdit
      ? "モデルの上をドラッグして線を描きます(Alt を押している間は視点操作になります)"
      : "接続が切れているため線を描けません";
  }
  return input.hasAnchor
    ? "右のパネルで本文を入力してください"
    : "モデルをクリックしてコメントの位置を決めます";
}
