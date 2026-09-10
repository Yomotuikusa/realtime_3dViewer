import {
  bindingFromChord,
  isModifierCode,
  type Binding,
  type KeyChord,
} from "./keymap";

/** キャプチャを拒否した理由。 */
export type CaptureRejection = "modifier" | "unsupported";

export type CaptureResult =
  | { status: "ignored" }
  | { status: "cancelled" }
  | { status: "rejected"; reason: CaptureRejection }
  | { status: "assigned"; binding: Binding };

/** キー待機中に押されたキーを割り当てるか、待機を続けるかを判定する。 */
export function captureBinding(chord: KeyChord): CaptureResult {
  if (isModifierCode(chord.code)) {
    return { status: "ignored" };
  }
  if (chord.code === "Escape" && !chord.shiftKey && !chord.ctrlKey && !chord.metaKey && !chord.altKey) {
    return { status: "cancelled" };
  }
  if (chord.ctrlKey || chord.metaKey || chord.altKey) {
    return { status: "rejected", reason: "modifier" };
  }
  const binding = bindingFromChord(chord);
  if (binding === null) {
    return { status: "rejected", reason: "unsupported" };
  }
  return { status: "assigned", binding };
}
