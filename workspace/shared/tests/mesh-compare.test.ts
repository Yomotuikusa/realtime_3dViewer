import { describe, expect, it } from "vitest";
import {
  ClientMessageSchema,
  parseClientMessage,
  ServerMessageSchema,
} from "../src/protocol";
import {
  DEFAULT_MESH_COMPARE,
  MIN_COMPARE_THRESHOLD_PERMILLE,
  MeshCompareSchema,
} from "../src/types";
import {
  cloneMeshCompare,
  isMeshCompareActive,
  meshCompareEquals,
} from "../src/compare";

const active = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };

describe("mesh compare", () => {
  it("validates compare values and the default", () => {
    expect(MIN_COMPARE_THRESHOLD_PERMILLE).toBe(0);
    for (const value of [active, { baseId: null, targetId: null, thresholdPermille: 0 }, { ...active, thresholdPermille: 50 }]) {
      expect(MeshCompareSchema.safeParse(value).success).toBe(true);
    }
    for (const thresholdPermille of [-1, 51, 2.5, "5"]) {
      expect(MeshCompareSchema.safeParse({ ...active, thresholdPermille }).success).toBe(false);
    }
    for (const baseId of ["", "a b", undefined]) {
      expect(MeshCompareSchema.safeParse({ ...active, baseId }).success).toBe(false);
    }
    expect(MeshCompareSchema.safeParse({ baseId: "v1", targetId: "v2" }).success).toBe(false);
    expect(DEFAULT_MESH_COMPARE).toEqual({ baseId: null, targetId: null, thresholdPermille: 5 });
    expect(MeshCompareSchema.safeParse(DEFAULT_MESH_COMPARE).success).toBe(true);
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
    expect(meshCompareEquals(active, { ...active, baseId: "v3" })).toBe(false);
    expect(meshCompareEquals(active, { ...active, targetId: "v3" })).toBe(false);
    expect(meshCompareEquals(active, { ...active, thresholdPermille: 10 })).toBe(false);
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
      type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { ...active, thresholdPermille: 10 },
    });
    expect(withCompare.success).toBe(true);
    if (withCompare.success && withCompare.data.type === "welcome") {
      expect(withCompare.data.meshCompare).toEqual({ ...active, thresholdPermille: 10 });
    }
    expect(ServerMessageSchema.safeParse({
      type: "welcome", selfId: "u1", users: [], strokes: [], meshCompare: { baseId: "v1" },
    }).success).toBe(false);
  });

  it("parses a mesh compare client frame", () => {
    expect(parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: active }))).toEqual({
      ok: true,
      msg: { type: "mesh:compare", compare: active },
    });
    const zeroThreshold = { ...active, thresholdPermille: 0 };
    expect(parseClientMessage(JSON.stringify({ type: "mesh:compare", compare: zeroThreshold }))).toEqual({
      ok: true,
      msg: { type: "mesh:compare", compare: zeroThreshold },
    });
  });
});
