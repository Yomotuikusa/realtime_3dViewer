import { describe, expect, it } from "vitest";
import { captureBinding } from "../src/features/shortcuts/capture";
import type { KeyChord } from "../src/features/shortcuts/keymap";

const chord = (code: string, options: Partial<KeyChord> = {}): KeyChord => ({
  code,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...options,
});

describe("captureBinding", () => {
  it.each([
    ["KeyQ", { status: "assigned", binding: "KeyQ" }],
    ["KeyQ with Shift", { chord: chord("KeyQ", { shiftKey: true }), status: "assigned", binding: "Shift+KeyQ" }],
    ["F5", { status: "assigned", binding: "F5" }],
    ["Shift+Escape", { chord: chord("Escape", { shiftKey: true }), status: "assigned", binding: "Shift+Escape" }],
  ])("assigns %s", (name, expected) => {
    const input = typeof expected === "object" && "chord" in expected ? expected.chord : chord(name as string);
    const result = captureBinding(input);
    expect(result).toEqual({ status: expected.status, binding: expected.binding });
  });

  it.each([
    ["ShiftLeft", { shiftKey: true }],
    ["ControlRight", { ctrlKey: true }],
    ["AltLeft", { altKey: true }],
    ["MetaLeft", { metaKey: true }],
  ])("ignores modifier code %s", (code, options) => {
    expect(captureBinding(chord(code, options))).toEqual({ status: "ignored" });
  });

  it("cancels only on unmodified Escape", () => {
    expect(captureBinding(chord("Escape"))).toEqual({ status: "cancelled" });
    expect(captureBinding(chord("Escape", { ctrlKey: true }))).toEqual({ status: "rejected", reason: "modifier" });
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["cmd", { metaKey: true }],
    ["alt", { altKey: true }],
    ["Shift+ctrl", { shiftKey: true, ctrlKey: true }],
    ["unsupported with ctrl", { code: "Tab", ctrlKey: true }],
  ])("rejects %s modifier combinations before key support", (_name, options) => {
    const input = "code" in options ? chord(options.code, options) : chord("KeyQ", options);
    expect(captureBinding(input)).toEqual({ status: "rejected", reason: "modifier" });
  });

  it.each(["Tab", "Enter", "NumpadEnter", "F13", "Numpad1", ""])("rejects unsupported code %s", (code) => {
    expect(captureBinding(chord(code))).toEqual({ status: "rejected", reason: "unsupported" });
  });
});
