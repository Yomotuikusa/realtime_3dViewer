/// <reference types="node" />

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@shared/protocol";
import { DEFAULT_MESH_COMPARE, type MeshCompare, type ModelVersion } from "@shared/types";
import { CompareControls } from "../src/features/objects/CompareControls";
import { isHiddenByCompare } from "../src/features/compare/compare-visibility";
import { useDisplayStore } from "../src/store/display";
import { useObjectsStore } from "../src/store/objects";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const srcDir = existsSync(join(process.cwd(), "web", "src"))
  ? join(process.cwd(), "web", "src")
  : join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

const active: MeshCompare = { baseId: "v1", targetId: "v2", thresholdPermille: 5 };

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

describe("compare visibility", () => {
  it("hides only the active base while its target is visible", () => {
    expect(isHiddenByCompare(active, [], "v1")).toBe(true);
    expect(isHiddenByCompare(active, [], "v2")).toBe(false);
    expect(isHiddenByCompare(active, [], "v3")).toBe(false);
    expect(isHiddenByCompare({ ...active, baseVisible: true }, [], "v1")).toBe(false);
    expect(isHiddenByCompare({ ...active, baseVisible: false }, [], "v1")).toBe(true);
    expect(isHiddenByCompare(active, ["v2"], "v1")).toBe(false);
    expect(isHiddenByCompare(active, ["v1"], "v1")).toBe(true);
    expect(isHiddenByCompare({ ...active, targetId: null }, [], "v1")).toBe(false);
    expect(isHiddenByCompare({ ...active, targetId: "v1" }, [], "v1")).toBe(false);
    expect(isHiddenByCompare(DEFAULT_MESH_COMPARE, [], "v1")).toBe(false);
  });

  it("connects compare visibility to the canvas model visibility", () => {
    const canvas = readSource("features/viewer/ViewerCanvas.tsx");

    expect(canvas).toContain("useDisplayStore((state) => state.meshCompare)");
    expect(canvas).toContain("isObjectVisible(hiddenIds, version.id)");
    expect(canvas).toContain("!isHiddenByCompare(meshCompare, hiddenIds, version.id)");
    expect(canvas.match(/<ModelMesh\b/g)).toHaveLength(1);
  });

  it("adds the shared base visibility checkbox to compare controls", () => {
    const controls = readSource("features/objects/CompareControls.tsx");

    expect(controls.match(/type="checkbox"/g)).toHaveLength(3);
    expect(controls).toContain("checked={meshCompare.baseVisible === true}");
    expect(controls).toContain("baseVisible: event.target.checked");
    expect(controls).toContain("checked={meshCompare.colorized !== false}");
    expect(controls).toContain("colorized: event.target.checked");
    expect(controls).toContain("checked={meshCompare.differencesOnly === true}");
    expect(controls).toContain("disabled={meshCompare.colorized === false}");
    expect(controls).toContain("differencesOnly: event.target.checked");
    expect(controls.match(/<select\b/g)).toHaveLength(2);
    expect(controls.match(/type="range"/g)).toHaveLength(1);
    expect(controls.indexOf("compare__threshold")).toBeLessThan(controls.indexOf("compare__check"));
    expect(controls.lastIndexOf("COMPARE_BASE_VISIBLE_LABEL")).toBeLessThan(controls.lastIndexOf("COMPARE_DIFFERENCES_ONLY_LABEL"));
    expect(controls.lastIndexOf("COMPARE_BASE_VISIBLE_LABEL")).toBeLessThan(controls.lastIndexOf("COMPARE_COLORIZED_LABEL"));
    expect(controls.lastIndexOf("COMPARE_COLORIZED_LABEL")).toBeLessThan(controls.lastIndexOf("COMPARE_DIFFERENCES_ONLY_LABEL"));
    expect(controls.lastIndexOf("COMPARE_DIFFERENCES_ONLY_LABEL")).toBeLessThan(controls.indexOf("compare__legend"));
  });

  it("defaults colorized on and shares both colorized changes", () => {
    setup(active);
    const send = vi.fn(() => true);
    const host = renderControls(send);
    const colorized = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]!;
    const differencesOnly = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2]!;

    expect(colorized.checked).toBe(true);
    expect(differencesOnly.disabled).toBe(false);

    act(() => colorized.click());
    expect(useDisplayStore.getState().meshCompare).toEqual({ ...active, colorized: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({
      type: "mesh:compare",
      compare: { ...active, colorized: false },
    });

    send.mockClear();
    act(() => colorized.click());
    expect(useDisplayStore.getState().meshCompare).toEqual({ ...active, colorized: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({
      type: "mesh:compare",
      compare: { ...active, colorized: true },
    });
  });

  it("does not broadcast an unchanged colorized value", () => {
    setup({ ...active, colorized: true });
    const send = vi.fn(() => true);
    const host = renderControls(send);
    const colorized = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]!;

    act(() => colorized.dispatchEvent(new Event("change", { bubbles: true })));

    expect(send).not.toHaveBeenCalled();
  });

  it("disables differences-only while colorized is off", () => {
    const compare = { ...active, colorized: false };
    setup(compare);
    const send = vi.fn(() => true);
    const host = renderControls(send);
    const colorized = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]!;
    const differencesOnly = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2]!;

    expect(colorized.checked).toBe(false);
    expect(differencesOnly.disabled).toBe(true);
    act(() => differencesOnly.click());
    expect(send).not.toHaveBeenCalled();
    expect(useDisplayStore.getState().meshCompare).toEqual(compare);
  });

  it("preserves other compare fields when toggling colorized", () => {
    const compare = { ...active, baseVisible: true, differencesOnly: true };
    setup(compare);
    const send = vi.fn(() => true);
    const host = renderControls(send);
    const colorized = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]!;

    act(() => colorized.click());

    expect(useDisplayStore.getState().meshCompare).toEqual({ ...compare, colorized: false });
  });

  it("toggles and broadcasts differences-only while preserving base visibility", () => {
    const compare = { ...active, baseVisible: true };
    setup(compare);
    const send = vi.fn(() => true);
    const host = renderControls(send);
    const differencesOnly = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2]!;

    act(() => differencesOnly.click());

    expect(useDisplayStore.getState().meshCompare).toEqual({ ...compare, differencesOnly: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({
      type: "mesh:compare",
      compare: { ...compare, differencesOnly: true },
    });

    send.mockClear();
    act(() => differencesOnly.dispatchEvent(new Event("change", { bubbles: true })));
    expect(send).not.toHaveBeenCalled();

    act(() => differencesOnly.click());

    expect(useDisplayStore.getState().meshCompare).toEqual({ ...compare, differencesOnly: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith({
      type: "mesh:compare",
      compare: { ...compare, differencesOnly: false },
    });
    expect(useDisplayStore.getState().meshCompare.baseVisible).toBe(true);
  });
});
