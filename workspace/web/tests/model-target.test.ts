import { beforeEach, describe, expect, it } from "vitest";
import { Object3D } from "three";
import { getModelTarget, setModelTarget } from "../src/features/viewer/model-target";

describe("model target", () => {
  beforeEach(() => {
    setModelTarget(null);
  });

  it("starts empty and stores the current model object", () => {
    expect(getModelTarget()).toBeNull();
    const model = new Object3D();
    setModelTarget(model);
    expect(getModelTarget()).toBe(model);
    setModelTarget(null);
    expect(getModelTarget()).toBeNull();
  });
});
