import { Group } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { selectModelScene, useModelScenesStore } from "../src/features/compare/model-scenes";

describe("model scenes store", () => {
  afterEach(() => useModelScenesStore.getState().reset());

  it("starts empty and selects only registered scenes", () => {
    const scene = new Group();

    expect(useModelScenesStore.getState().scenes).toEqual({});
    expect(selectModelScene(useModelScenesStore.getState().scenes, null)).toBeNull();
    expect(selectModelScene(useModelScenesStore.getState().scenes, "v1")).toBeNull();

    useModelScenesStore.getState().register("v1", scene);
    expect(useModelScenesStore.getState().scenes.v1).toBe(scene);
    expect(selectModelScene(useModelScenesStore.getState().scenes, "v1")).toBe(scene);
  });

  it("does not notify or replace state for an identical registration", () => {
    const scene = new Group();
    const listener = vi.fn();
    const unsubscribe = useModelScenesStore.subscribe(listener);

    useModelScenesStore.getState().register("v1", scene);
    const stateBefore = useModelScenesStore.getState();
    const scenesBefore = stateBefore.scenes;
    listener.mockClear();
    useModelScenesStore.getState().register("v1", scene);

    expect(useModelScenesStore.getState()).toBe(stateBefore);
    expect(useModelScenesStore.getState().scenes).toBe(scenesBefore);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("replaces a scene and unregisters only matching references", () => {
    const first = new Group();
    const second = new Group();

    useModelScenesStore.getState().register("v1", first);
    useModelScenesStore.getState().register("v1", second);
    expect(useModelScenesStore.getState().scenes.v1).toBe(second);

    useModelScenesStore.getState().unregister("v1", first);
    expect(useModelScenesStore.getState().scenes.v1).toBe(second);
    useModelScenesStore.getState().unregister("v1", second);
    expect("v1" in useModelScenesStore.getState().scenes).toBe(false);
  });

  it("keeps registrations immutable and supports reset", () => {
    const first = new Group();
    const second = new Group();
    useModelScenesStore.getState().register("v1", first);
    const scenesBefore = useModelScenesStore.getState().scenes;
    useModelScenesStore.getState().register("v2", second);

    expect(useModelScenesStore.getState().scenes).not.toBe(scenesBefore);
    expect(useModelScenesStore.getState().scenes.v1).toBe(first);
    expect(useModelScenesStore.getState().scenes.v2).toBe(second);
    const stateBeforeUnknownUnregister = useModelScenesStore.getState();
    expect(() => useModelScenesStore.getState().unregister("v9", first)).not.toThrow();
    expect(useModelScenesStore.getState()).toBe(stateBeforeUnknownUnregister);
    expect(useModelScenesStore.getState().scenes).toBe(stateBeforeUnknownUnregister.scenes);
    useModelScenesStore.getState().reset();
    expect(useModelScenesStore.getState().scenes).toEqual({});
  });
});
