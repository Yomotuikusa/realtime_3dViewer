import { describe, expect, it } from "vitest";
import {
  ACTION_ORDER,
  applyBinding,
  bindingFromChord,
  DEFAULT_KEYMAP,
  formatBinding,
  isAssignableCode,
  isModifierCode,
  isTypingTarget,
  isValidBinding,
  resolveAction,
} from "../src/features/shortcuts/keymap";

const chord = (code: string, options: Partial<KeyboardEvent> = {}) => ({
  code,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...options,
});

describe("keymap", () => {
  it("recognizes modifier codes", () => {
    for (const code of ["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"]) {
      expect(isModifierCode(code)).toBe(true);
    }
    for (const code of ["KeyP", "Escape", ""]) {
      expect(isModifierCode(code)).toBe(false);
    }
  });

  it("allows the documented assignable codes only", () => {
    for (const code of [
      "KeyA", "KeyP", "KeyZ", "Digit0", "Digit9", "F1", "F9", "F12", "Escape", "Space", "Backspace", "Delete",
      "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Minus", "Equal",
      "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash", "Backquote",
    ]) {
      expect(isAssignableCode(code)).toBe(true);
    }
    for (const code of ["Tab", "Enter", "NumpadEnter", "F13", "ShiftLeft", "", "Unidentified", "Numpad1"]) {
      expect(isAssignableCode(code)).toBe(false);
    }
  });

  it("converts unmodified and shifted chords to bindings", () => {
    expect(bindingFromChord(chord("KeyP"))).toBe("KeyP");
    expect(bindingFromChord(chord("KeyP", { shiftKey: true }))).toBe("Shift+KeyP");
    expect(bindingFromChord(chord("Escape"))).toBe("Escape");
    expect(bindingFromChord(chord("F12", { shiftKey: true }))).toBe("Shift+F12");
    for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true, ctrlKey: true }]) {
      expect(bindingFromChord(chord("KeyP", options))).toBeNull();
    }
    for (const code of ["Tab", "Enter", "ShiftLeft", ""]) {
      expect(bindingFromChord(chord(code))).toBeNull();
    }
  });

  it("validates only normalized bindings", () => {
    for (const value of ["KeyP", "Escape", "Digit1", "ArrowUp", "F12", "Shift+KeyP", "Shift+Escape", "Shift+F12"]) {
      expect(isValidBinding(value)).toBe(true);
    }
    for (const value of [
      "Ctrl+KeyP", "Alt+KeyP", "Meta+KeyP", "Shift+Shift+KeyP", "shift+KeyP", "Tab", "Enter", "NotACode", "", "+KeyP", "KeyP+",
      null, undefined, 123, {}, ["KeyP"],
    ]) {
      expect(isValidBinding(value)).toBe(false);
    }
  });

  it("resolves actions with duplicate priority and ignores unsafe input", () => {
    expect(ACTION_ORDER).toEqual(["pen", "comment", "clearMode", "viewReset", "viewFit"]);
    expect(resolveAction(DEFAULT_KEYMAP, chord("KeyP"))).toBe("pen");
    expect(resolveAction(DEFAULT_KEYMAP, chord("KeyC"))).toBe("comment");
    expect(resolveAction(DEFAULT_KEYMAP, chord("Escape"))).toBe("clearMode");
    expect(resolveAction(DEFAULT_KEYMAP, chord("KeyR"))).toBe("viewReset");
    expect(resolveAction(DEFAULT_KEYMAP, chord("KeyF"))).toBe("viewFit");
    expect(resolveAction(DEFAULT_KEYMAP, chord("KeyP", { shiftKey: true }))).toBeNull();
    for (const options of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { repeat: true }, { isComposing: true }]) {
      expect(resolveAction(DEFAULT_KEYMAP, chord("KeyP", options))).toBeNull();
    }
    expect(resolveAction(DEFAULT_KEYMAP, chord("KeyX"))).toBeNull();
    expect(resolveAction(DEFAULT_KEYMAP, chord("Tab"))).toBeNull();
    expect(resolveAction({ ...DEFAULT_KEYMAP, pen: null }, chord("KeyP"))).toBeNull();
    expect(resolveAction({ ...DEFAULT_KEYMAP, comment: "KeyP" }, chord("KeyP"))).toBe("pen");
    expect(resolveAction({ ...DEFAULT_KEYMAP, pen: null, comment: "KeyP" }, chord("KeyP"))).toBe("comment");
    expect(resolveAction({ ...DEFAULT_KEYMAP, pen: "Shift+KeyP" }, chord("KeyP", { shiftKey: true }))).toBe("pen");
  });

  it("applies a binding without mutating the source or other bindings", () => {
    const source = { ...DEFAULT_KEYMAP };
    const next = applyBinding(source, "pen", "KeyQ");
    expect(next).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyQ" });
    expect(next).not.toBe(source);
    expect(source).toEqual(DEFAULT_KEYMAP);
    expect(applyBinding(DEFAULT_KEYMAP, "pen", "KeyC")).toEqual({ ...DEFAULT_KEYMAP, pen: "KeyC", comment: null });
    expect(applyBinding(DEFAULT_KEYMAP, "pen", null)).toEqual({ ...DEFAULT_KEYMAP, pen: null });
    expect(applyBinding(DEFAULT_KEYMAP, "pen", "KeyP")).toEqual(DEFAULT_KEYMAP);
    expect(applyBinding(DEFAULT_KEYMAP, "pen", "Shift+KeyC")).toEqual({ ...DEFAULT_KEYMAP, pen: "Shift+KeyC" });
    const duplicate = { ...DEFAULT_KEYMAP, pen: "KeyX", comment: "KeyX" };
    expect(applyBinding(duplicate, "viewFit", "KeyX")).toEqual({ ...duplicate, pen: null, comment: null, viewFit: "KeyX" });
  });

  it("formats keyboard codes for display", () => {
    const cases: Record<string, string> = {
      KeyP: "P", "Shift+KeyP": "Shift+P", Digit1: "1", Escape: "Esc", Space: "Space",
      ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Minus: "-", Equal: "=", Slash: "/", Comma: ",", Period: ".",
      Semicolon: ";", Quote: "'", Backquote: "`", Backslash: "\\", BracketLeft: "[", BracketRight: "]",
      Backspace: "Backspace", Delete: "Delete", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", F12: "F12",
      "Shift+ArrowUp": "Shift+↑", XYZ: "XYZ",
    };
    for (const [binding, label] of Object.entries(cases)) {
      expect(formatBinding(binding)).toBe(label);
    }
    expect(formatBinding(null)).toBe("未割り当て");
  });

  it("identifies typing targets including contenteditable descendants", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const editableEmpty = document.createElement("div");
    editableEmpty.setAttribute("contenteditable", "");
    const child = document.createElement("span");
    editable.append(child);
    const nonEditable = document.createElement("div");
    nonEditable.setAttribute("contenteditable", "false");
    for (const target of [input, textarea, select, editable, editableEmpty, child]) {
      expect(isTypingTarget(target)).toBe(true);
    }
    for (const target of [nonEditable, document.createElement("button"), document.createElement("div"), document.createElement("canvas"), document.body, null, new EventTarget()]) {
      expect(isTypingTarget(target)).toBe(false);
    }
  });
});
