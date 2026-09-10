import type { AnnotationMode, PenPlacement } from "../../store/annotation";
import { formatBinding, type Binding } from "../shortcuts/keymap";
import type { ViewPreset } from "./view-presets";

/** HUD のボタンに出すモード。"none" は解除状態でありボタンを持たない。 */
export type ToolMode = Exclude<AnnotationMode, "none">;

export const MODE_LABELS: Readonly<Record<ToolMode, string>> = {
  pen: "ペン",
  comment: "コメント",
};

export const MODE_ORDER: readonly ToolMode[] = ["pen", "comment"];
export const VIEW_PRESET_LABELS: Readonly<Record<ViewPreset, string>> = {
  front: "正面",
  back: "背面",
  right: "右",
  left: "左",
};
export const RESET_LABEL = "視点を戻す";
export const LIGHT_RESET_LABEL = "ライトを戻す";
export const FIT_LABEL = "全体を表示";
export const UNDO_LABEL = "1本戻す";
export const CLEAR_LABEL = "自分の線を消す";
export const OVERLAY_LABEL = "透過表示";
export const UNFOLLOW_LABEL = "追従を解除";
export const PLACEMENT_LABELS: Readonly<Record<PenPlacement, string>> = {
  surface: "表面",
  space: "空間",
};
export const PLACEMENT_ORDER: readonly PenPlacement[] = ["surface", "space"];

/** ボタン名にショートカットキーを併記する。未割り当てなら name をそのまま返す。 */
export function withShortcut(name: string, binding: Binding | null): string {
  return binding === null ? name : `${name} (${formatBinding(binding)})`;
}

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
  placement: PenPlacement;
}

export function hint(input: HintInput): string {
  if (input.following) {
    return "操作すると追従が解除されます";
  }
  if (input.mode === "none") {
    return "Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動、Shift+右ドラッグでライトの向き";
  }
  if (input.mode === "pen") {
    if (!input.canEdit) {
      return "接続が切れているため線を描けません";
    }
    return input.placement === "space"
      ? "ドラッグして注視点の平面に線を描きます。モデルの外へはみ出しても途切れません(Alt を押している間は視点操作になります)"
      : "モデルの上をドラッグして表面に線を描きます(Alt を押している間は視点操作になります)";
  }
  return input.hasAnchor
    ? "右のパネルで本文を入力してください"
    : "モデルをクリックしてコメントの位置を決めます";
}
