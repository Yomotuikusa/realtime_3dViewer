import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_JOINT_DISPLAY, DEFAULT_MESH_COMPARE, DEFAULT_MESH_DISPLAY } from "@shared/types";
import { useDisplayStore } from "../src/store/display";

afterEach(() => useDisplayStore.getState().reset());

describe("display store", () => {
  it("starts at the default mesh display mode and compare value", () => {
    expect(useDisplayStore.getState().meshDisplay).toBe(DEFAULT_MESH_DISPLAY);
    expect(useDisplayStore.getState().meshDisplay).toBe("solid");
    expect(useDisplayStore.getState().meshCompare).toEqual(DEFAULT_MESH_COMPARE);
    expect(useDisplayStore.getState().meshCompare).not.toBe(DEFAULT_MESH_COMPARE);
    expect(useDisplayStore.getState().jointDisplay).toEqual(DEFAULT_JOINT_DISPLAY);
    expect(useDisplayStore.getState().jointDisplay).not.toBe(DEFAULT_JOINT_DISPLAY);
  });

  it("sets a mode and resets it to solid", () => {
    useDisplayStore.getState().setMeshDisplay("wireframe");
    expect(useDisplayStore.getState().meshDisplay).toBe("wireframe");
    useDisplayStore.getState().setMeshDisplay("solid-wireframe");
    useDisplayStore.getState().reset();
    expect(useDisplayStore.getState().meshDisplay).toBe("solid");
  });

  it("does not update state or notify subscribers for the same mode", () => {
    useDisplayStore.getState().setMeshDisplay("wireframe");
    const before = useDisplayStore.getState();
    let calls = 0;
    const unsubscribe = useDisplayStore.subscribe(() => { calls += 1; });

    useDisplayStore.getState().setMeshDisplay("wireframe");

    expect(useDisplayStore.getState()).toBe(before);
    expect(calls).toBe(0);
    unsubscribe();
  });

  it("sets a copied compare value and suppresses equal updates", () => {
    const compare = { baseId: "v1", targetId: "v2", thresholdPermille: 10 };
    useDisplayStore.getState().setMeshCompare(compare);
    expect(useDisplayStore.getState().meshCompare).toEqual(compare);
    expect(useDisplayStore.getState().meshCompare).not.toBe(compare);

    const before = useDisplayStore.getState();
    let calls = 0;
    const unsubscribe = useDisplayStore.subscribe(() => { calls += 1; });
    useDisplayStore.getState().setMeshCompare({ ...compare });
    expect(useDisplayStore.getState()).toBe(before);
    expect(calls).toBe(0);
    useDisplayStore.getState().setMeshCompare({ ...compare, thresholdPermille: 11 });
    expect(useDisplayStore.getState().meshCompare.thresholdPermille).toBe(11);
    unsubscribe();
  });

  it("resets both values and keeps compare unchanged when display changes", () => {
    const compare = { baseId: "v1", targetId: "v2", thresholdPermille: 10 };
    useDisplayStore.getState().setMeshCompare(compare);
    useDisplayStore.getState().setMeshDisplay("wireframe");
    expect(useDisplayStore.getState().meshCompare).toEqual(compare);
    useDisplayStore.getState().reset();
    expect(useDisplayStore.getState().meshCompare).toEqual(DEFAULT_MESH_COMPARE);
    expect(useDisplayStore.getState().meshDisplay).toBe("solid");
  });

  it("sets a copied joint display, suppresses equal updates, and resets it", () => {
    const display = { visible: true, xray: false };
    useDisplayStore.getState().setJointDisplay(display);
    expect(useDisplayStore.getState().jointDisplay).toEqual(display);
    expect(useDisplayStore.getState().jointDisplay).not.toBe(display);
    const before = useDisplayStore.getState();
    let calls = 0;
    const unsubscribe = useDisplayStore.subscribe(() => { calls += 1; });
    useDisplayStore.getState().setJointDisplay({ ...display });
    expect(useDisplayStore.getState()).toBe(before);
    expect(calls).toBe(0);
    useDisplayStore.getState().setJointDisplay({ visible: true, xray: true });
    expect(useDisplayStore.getState().jointDisplay).toEqual({ visible: true, xray: true });
    expect(useDisplayStore.getState().meshDisplay).toBe("solid");
    expect(useDisplayStore.getState().meshCompare).toEqual(DEFAULT_MESH_COMPARE);
    useDisplayStore.getState().reset();
    expect(useDisplayStore.getState().jointDisplay).toEqual(DEFAULT_JOINT_DISPLAY);
    unsubscribe();
  });
});
