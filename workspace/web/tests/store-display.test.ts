import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MESH_DISPLAY } from "@shared/types";
import { useDisplayStore } from "../src/store/display";

afterEach(() => useDisplayStore.getState().reset());

describe("display store", () => {
  it("starts at the default mesh display mode", () => {
    expect(useDisplayStore.getState().meshDisplay).toBe(DEFAULT_MESH_DISPLAY);
    expect(useDisplayStore.getState().meshDisplay).toBe("solid");
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
});
