import { describe, expect, it } from "vitest";
import {
  cloneJointDisplay,
  DEFAULT_JOINT_DISPLAY,
  JointDisplaySchema,
  jointDisplayEquals,
  type JointDisplay,
} from "../src/index";

describe("joint display", () => {
  it("exposes the default, equality, and clone behavior", () => {
    expect(DEFAULT_JOINT_DISPLAY).toEqual({ visible: false, xray: true });
    expect(jointDisplayEquals({ visible: true, xray: false }, { visible: true, xray: false })).toBe(true);
    expect(jointDisplayEquals({ visible: true, xray: false }, { visible: false, xray: false })).toBe(false);
    expect(jointDisplayEquals({ visible: true, xray: false }, { visible: true, xray: true })).toBe(false);

    const display: JointDisplay = { visible: true, xray: false };
    const copy = cloneJointDisplay(display);
    expect(copy).toEqual(display);
    expect(copy).not.toBe(display);
    copy.visible = false;
    expect(display.visible).toBe(true);
  });

  it("validates exact boolean fields and strips extras", () => {
    expect(JointDisplaySchema.safeParse({ visible: false, xray: true }).success).toBe(true);
    const withExtra = JointDisplaySchema.safeParse({ visible: true, xray: true, extra: 1 });
    expect(withExtra.success).toBe(true);
    if (withExtra.success) expect(withExtra.data).toEqual({ visible: true, xray: true });
    for (const value of [
      { visible: "true", xray: true },
      { visible: true },
      {},
      null,
    ]) expect(JointDisplaySchema.safeParse(value).success).toBe(false);
  });

  it("exports the runtime functions from the shared index", () => {
    expect(typeof jointDisplayEquals).toBe("function");
    expect(typeof cloneJointDisplay).toBe("function");
    expect(JointDisplaySchema).toBeDefined();
    const typed: JointDisplay = DEFAULT_JOINT_DISPLAY;
    expect(typed).toEqual(DEFAULT_JOINT_DISPLAY);
  });
});
