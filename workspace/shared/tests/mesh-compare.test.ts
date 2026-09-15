import { describe, expect, it } from "vitest";
import {
  ClientMessageSchema,
  parseClientMessage,
  ServerMessageSchema,
} from "../src/protocol";
import {
  COMPARE_THRESHOLD_STEP_PERMILLE,
  DEFAULT_MESH_COMPARE,
  isCompareThresholdPermille,
  MIN_COMPARE_THRESHOLD_PERMILLE,
  MeshCompareSchema,
} from "../src/types";
import {
  COMPARE_THRESHOLD_STEPS_PERMILLE,
  cloneMeshCompare,
  isMeshCompareActive,
  meshCompareEquals,
  nearestCompareThresholdIndex,
} from "../src/compare";

const active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };

describe("mesh compare", () => {
  it("validates compare values and the default", () => {
    expect(MIN_COMPARE_THRESHOLD_PERMILLE).toBe(0);
    for (const value of [active, { ...active, thresholdPermille: 0.3 }, { baseId: null, targetId: null, thresholdPermille: 0 }, { ...active, thresholdPermille: 50 }]) {
      expect(MeshCompareSchema.safeParse(value).success).toBe(true);
    }
    const onePermille = MeshCompareSchema.safeParse({ ...active, thresholdPermille: 1 });
    expect(onePermille.success).toBe(true);
    if (onePermille.success) expect(onePermille.data.thresholdPermille).toBe(1);
    for (const baseVisible of [true, false]) {
      const result = MeshCompareSchema.safeParse({ ...active, baseVisible });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.baseVisible).toBe(baseVisible);
    }
    const withoutBaseVisible = MeshCompareSchema.safeParse(active);
    expect(withoutBaseVisible.success).toBe(true);
    if (withoutBaseVisible.success) expect("baseVisible" in withoutBaseVisible.data).toBe(false);
    for (const baseVisible of ["yes", 1, null]) {
      expect(MeshCompareSchema.safeParse({ ...active, baseVisible }).success).toBe(false);
    }
    for (const thresholdPermille of [0.05, 2.55, -1, 51, "5"]) {
      expect(MeshCompareSchema.safeParse({ ...active, thresholdPermille }).success).toBe(false);
    }
    expect(MeshCompareSchema.safeParse({ ...active, thresholdPermille: 2.5 }).success).toBe(true);
    for (const baseId of ["", "a b", undefined]) {
      expect(MeshCompareSchema.safeParse({ ...active, baseId }).success).toBe(false);
    }
    expect(MeshCompareSchema.safeParse({ baseId: "v1", targetId: "v2" }).success).toBe(false);
    expect(DEFAULT_MESH_COMPARE).toEqual({ baseId: null, targetId: null, thresholdPermille: 5 });
    expect(MeshCompareSchema.safeParse(DEFAULT_MESH_COMPARE).success).toBe(true);
  });

  it("validates the 0.1 permille grid and shared slider steps", () => {
    expect(COMPARE_THRESHOLD_STEP_PERMILLE).toBe(0.1);
    for (const value of [0, 0.1, 0.3, 0.7, 2.5, 50]) {
      expect(isCompareThresholdPermille(value)).toBe(true);
    }
    for (const value of [0.05, 2.55, -0.1, 50.1, NaN, Infinity]) {
      expect(isCompareThresholdPermille(value)).toBe(false);
    }

    expect(COMPARE_THRESHOLD_STEPS_PERMILLE).toHaveLength(60);
    expect(COMPARE_THRESHOLD_STEPS_PERMILLE[3]).toBe(0.3);
    expect(COMPARE_THRESHOLD_STEPS_PERMILLE[9]).toBe(0.9);
    expect(COMPARE_THRESHOLD_STEPS_PERMILLE[10]).toBe(1);
    expect(COMPARE_THRESHOLD_STEPS_PERMILLE[14]).toBe(5);
    expect(COMPARE_THRESHOLD_STEPS_PERMILLE[14]).toBe(DEFAULT_MESH_COMPARE.thresholdPermille);
    expect(COMPARE_THRESHOLD_STEPS_PERMILLE[59]).toBe(50);
    for (let index = 0; index < COMPARE_THRESHOLD_STEPS_PERMILLE.length; index += 1) {
      expect(isCompareThresholdPermille(COMPARE_THRESHOLD_STEPS_PERMILLE[index]!)).toBe(true);
      if (index > 0) {
        expect(COMPARE_THRESHOLD_STEPS_PERMILLE[index]!).toBeGreaterThan(COMPARE_THRESHOLD_STEPS_PERMILLE[index - 1]!);
      }
    }

    for (const [value, index] of [[5, 14], [0, 0], [50, 59], [0.3, 3], [1, 10],
      [0.04, 0], [0.06, 1], [0.55, 6], [0.65, 7], [0.95, 9], [2.5, 11], [3.7, 13],
      [100, 59], [-5, 0], [NaN, 14], [Infinity, 14]] as const) {
      expect(nearestCompareThresholdIndex(value)).toBe(index);
    }
  });

  it("detects active values, compares all fields, and clones", () => {
    expect(isMeshCompareActive(active)).toBe(true);
    for (const value of [
      { ...active, baseId: "v1", targetId: "v1" },
      { ...active, baseId: null },
      { ...active, targetId: null },
      { baseId: null, targetId: null, thresholdPermille: 5 },
    ]) expect(isMeshCompareActive(value)).toBe(false);
    expect(meshCompareEquals(active, { ...active })).toBe(true);
    expect(meshCompareEquals(active, { ...active, baseVisible: false })).toBe(true);
    expect(meshCompareEquals(active, { ...active, baseVisible: true })).toBe(false);
    expect(meshCompareEquals({ ...active, baseVisible: true }, { ...active, baseVisible: true })).toBe(true);
    expect(meshCompareEquals(active, { ...active, baseId: "v3" })).toBe(false);
    expect(meshCompareEquals(active, { ...active, targetId: "v3" })).toBe(false);
    expect(meshCompareEquals(active, { ...active, thresholdPermille: 10 })).toBe(false);
    expect(meshCompareEquals(active, { ...active, thresholdPermille: 0.3 })).toBe(false);
    expect(meshCompareEquals({ ...active, baseVisible: true }, { ...active, baseVisible: true, thresholdPermille: 10 })).toBe(false);
    expect(isMeshCompareActive({ ...active, baseVisible: true })).toBe(true);
    const visibleCompare = { ...active, baseVisible: true };
    expect(cloneMeshCompare(visibleCompare)).toEqual(visibleCompare);
    expect(cloneMeshCompare(visibleCompare)).not.toBe(visibleCompare);
    expect(cloneMeshCompare(active)).toEqual(active);
    expect(cloneMeshCompare(active)).not.toBe(active);
  });

  it("validates protocol messages and optional welcome compare state", () => {
    expect(ClientMessageSchema.safeParse({ type: "mesh:compare", compare: DEFAULT_MESH_COMPARE }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ type: "mesh:compare", compare: { baseId: "v1" } }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ type: "mesh:compare" }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: "mesh:compare", compare: DEFAULT_MESH_COMPARE }).success).toBe(false);

    const withoutCompare = ServerMessageSchema.safeParse({ type: "welcome", selfId: "u1", users: [], strokes: [] });
    expect(withoutCompare.success).toBe(true);
    if (withoutCompare.success) expect("meshCompare" in withoutCompare.data).toBe(false);

    const withCompare = ServerMessageSchema.safeParse({
      type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { ...active, baseVisible: true, thresholdPermille: 0.3 },
    });
    expect(withCompare.success).toBe(true);
    if (withCompare.success && withCompare.data.type === "welcome") {
      expect(withCompare.data.meshCompare).toEqual({ ...active, baseVisible: true, thresholdPermille: 0.3 });
    }
    expect(ServerMessageSchema.safeParse({
      type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { baseId: "v1" },
    }).success).toBe(false);
  });

  it("parses a mesh compare client frame", () => {
    const visibleCompare = { ...active, baseVisible: true };
    expect(parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: visibleCompare }))).toEqual({
      ok: true,
      msg: { type: "mesh:compare", compare: visibleCompare },
    });
    const zeroThreshold = { ...active, thresholdPermille: 0 };
    expect(parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: zeroThreshold }))).toEqual({
      ok: true,
      msg: { type: "mesh:compare", compare: zeroThreshold },
    });
    const fractionalThreshold = { ...active, thresholdPermille: 0.3 };
    expect(parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: fractionalThreshold }))).toEqual({
      ok: true,
      msg: { type: "mesh:compare", compare: fractionalThreshold },
    });
  });
});
