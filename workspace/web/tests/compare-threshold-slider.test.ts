import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@shared/protocol";
import type { MeshCompare, ModelVersion } from "@shared/types";
import { COMPARE_THRESHOLD_STEPS_PERMILLE } from "@shared/compare";
import { CompareControls } from "../src/features/objects/CompareControls";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const version = (id: string, number: number): ModelVersion => ({
  id,
  projectId: "project",
  number,
  fileName: `${id}.glb`,
  byteSize: 1,
  createdAt: number,
});

let mountedRoot: Root | null = null;

function renderControls(send: (message: ClientMessage) => boolean): HTMLDivElement {
  const host = document.createElement("div");
  mountedRoot = createRoot(host);
  act(() => mountedRoot?.render(createElement(CompareControls, { send })));
  return host;
}

function setRangeValue(input: HTMLInputElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("HTMLInputElement.value setter is unavailable");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function setup(compare: MeshCompare): void {
  useObjectsStore.getState().setObjects([version("v1", 1), version("v2", 2)]);
  useDisplayStore.getState().setMeshCompare(compare);
}

afterEach(() => {
  act(() => mountedRoot?.unmount());
  mountedRoot = null;
  useObjectsStore.getState().reset();
  useDisplayStore.getState().reset();
  vi.restoreAllMocks();
});

describe("compare threshold slider", () => {
  it.each([
    [5, "14", "0.50%"],
    [0.3, "3", "0.03%"],
    [50, "59", "5.00%"],
  ])("uses the step index for %s permille", (threshold, index, label) => {
    setup({ baseId: "v1", targetId: "v2", thresholdPermille: threshold });
    const host = renderControls(vi.fn(() => true));
    const input = host.querySelector("#compare-threshold") as HTMLInputElement;
    const output = host.querySelector("output.compare__value");

    expect(input.min).toBe("0");
    expect(input.max).toBe(String(COMPARE_THRESHOLD_STEPS_PERMILLE.length - 1));
    expect(input.step).toBe("1");
    expect(input.value).toBe(index);
    expect(output?.textContent).toBe(label);
  });

  it("updates the store and broadcasts the selected step", () => {
    const compare = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };
    setup(compare);
    const send = vi.fn(() => true);
    const host = renderControls(send);

    setRangeValue(host.querySelector("#compare-threshold") as HTMLInputElement, "3");

    expect(useDisplayStore.getState().meshCompare.thresholdPermille).toBe(0.3);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: "mesh:compare",
      compare: { ...compare, thresholdPermille: 0.3 },
    });
  });

  it("broadcasts the final step as 50 permille", () => {
    setup({ baseId: "v1", targetId: "v2", thresholdPermille: 5 });
    const send = vi.fn(() => true);
    const host = renderControls(send);

    setRangeValue(host.querySelector("#compare-threshold") as HTMLInputElement, "59");

    expect(useDisplayStore.getState().meshCompare.thresholdPermille).toBe(50);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      compare: expect.objectContaining({ thresholdPermille: 50 }),
    }));
  });

  it("does not broadcast when the selected step is unchanged", () => {
    setup({ baseId: "v1", targetId: "v2", thresholdPermille: 5 });
    const send = vi.fn(() => true);
    const host = renderControls(send);

    setRangeValue(host.querySelector("#compare-threshold") as HTMLInputElement, "14");

    expect(useDisplayStore.getState().meshCompare.thresholdPermille).toBe(5);
    expect(send).not.toHaveBeenCalled();
  });

  it("uses the max step when the range value is out of bounds", () => {
    setup({ baseId: "v1", targetId: "v2", thresholdPermille: 5 });
    const send = vi.fn(() => true);
    const host = renderControls(send);

    setRangeValue(host.querySelector("#compare-threshold") as HTMLInputElement, "99");

    expect((host.querySelector("#compare-threshold") as HTMLInputElement).value).toBe("59");
    expect(useDisplayStore.getState().meshCompare.thresholdPermille).toBe(50);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      compare: expect.objectContaining({ thresholdPermille: 50 }),
    }));
  });

  it("renders nothing when there is only one version", () => {
    useObjectsStore.getState().setObjects([version("v1", 1)]);
    const host = renderControls(vi.fn(() => true));

    expect(host.innerHTML).toBe("");
  });
});
