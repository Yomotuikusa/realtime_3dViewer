import { describe, expect, it } from "vitest";
import { ACTION_ORDER } from "../src/features/shortcuts/keymap";
import {
  ACTION_LABELS,
  CANCEL_CAPTURE_LABEL,
  CAPTURING_MESSAGE,
  CHANGE_LABEL,
  CLOSE_LABEL,
  rejectionMessage,
  RESET_KEYMAP_LABEL,
  SETTINGS_HELP,
  SETTINGS_OPEN_LABEL,
  SETTINGS_TITLE,
  UNBIND_LABEL,
} from "../src/features/shortcuts/shortcut-labels";
import { FIT_LABEL, MODE_LABELS, RESET_LABEL } from "../src/features/viewer/hud-labels";

describe("shortcut labels", () => {
  it("contains one label for every action in display order", () => {
    expect(Object.keys(ACTION_LABELS).sort()).toEqual([...ACTION_ORDER].sort());
    expect(ACTION_LABELS.pen).toBe(MODE_LABELS.pen);
    expect(ACTION_LABELS.comment).toBe(MODE_LABELS.comment);
    expect(ACTION_LABELS.clearMode).toBe("モード解除");
    expect(ACTION_LABELS.viewReset).toBe(RESET_LABEL);
    expect(ACTION_LABELS.viewFit).toBe(FIT_LABEL);
  });

  it("explains each capture rejection", () => {
    expect(rejectionMessage("modifier")).toBe("Ctrl / Cmd / Alt との組み合わせは使えません");
    expect(rejectionMessage("unsupported")).toBe("このキーは割り当てられません");
  });

  it("defines all visible settings labels", () => {
    for (const label of [
      SETTINGS_OPEN_LABEL,
      SETTINGS_TITLE,
      SETTINGS_HELP,
      CHANGE_LABEL,
      CANCEL_CAPTURE_LABEL,
      CAPTURING_MESSAGE,
      UNBIND_LABEL,
      RESET_KEYMAP_LABEL,
      CLOSE_LABEL,
    ]) {
      expect(label).not.toBe("");
    }
  });
});
