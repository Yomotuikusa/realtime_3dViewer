/// <reference types="node" />

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Children, act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@shared/protocol";
import * as trailModule from "@shared/trail";
import { useDisplayStore } from "../src/store/display";
import { useModelScenesStore } from "../src/features/compare/model-scenes";
import { useSelectionStore } from "../src/features/outliner/selection";
import { TrailBar } from "../src/features/trail/TrailBar";
import {
  TRAIL_ARC_PATH,
  TRAIL_DOT_RADIUS,
  TRAIL_DOTS,
  TRAIL_VIEW_BOX,
  TrailIcon,
} from "../src/features/trail/trail-icons";
import { TRAIL_DISPLAY_LABEL, TRAIL_NO_BONE_HINT, TRAIL_VISIBLE_LABEL } from "../src/features/trail/trail-labels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const sourceUrl = new URL("../src", import.meta.url);
const sourcePath = sourceUrl.protocol === "file:" ? fileURLToPath(sourceUrl) : join(process.cwd(), "web", "src");

function iconProps(element: ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

function iconChildren(icon: ReactElement): ReactElement[] {
  return Children.toArray(iconProps(icon).children as ReactNode).filter(
    (child): child is ReactElement => typeof child === "object" && child !== null,
  );
}

function createScene(): { scene: Group; bone: Bone; otherBone: Bone; mesh: Mesh } {
  const scene = new Group();
  const body = new Group();
  const bone = new Bone();
  const otherBone = new Bone();
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  body.add(mesh, bone, otherBone);
  scene.add(body);
  return { scene, bone, otherBone, mesh };
}

async function renderBar(send: (message: ClientMessage) => boolean): Promise<{
  root: ReturnType<typeof createRoot>;
  host: HTMLDivElement;
}> {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(createElement(TrailBar, { send })));
  return { root, host };
}

afterEach(() => {
  useDisplayStore.getState().reset();
  useModelScenesStore.getState().reset();
  useSelectionStore.getState().reset();
  vi.restoreAllMocks();
});

describe("trail display icon", () => {
  it("renders the arc followed by one dot per frame", () => {
    const icon = TrailIcon();
    const props = iconProps(icon);
    expect(props.className).toBe("hud-display__icon");
    expect(props.viewBox).toBe(TRAIL_VIEW_BOX);
    expect(props["aria-hidden"]).toBe("true");
    expect(props.focusable).toBe("false");
    expect(props.fill).toBe("none");
    expect(props.stroke).toBe("currentColor");
    expect(props.strokeWidth).toBe("1");

    const children = iconChildren(icon);
    expect(children).toHaveLength(TRAIL_DOTS.length + 1);
    expect(iconProps(children[0] as ReactElement).d).toBe(TRAIL_ARC_PATH);
    const circles = children.slice(1);
    circles.forEach((circle, index) => {
      const circleProps = iconProps(circle);
      expect(circleProps.fill).toBe("currentColor");
      expect(circleProps.stroke).toBe("none");
      expect(circleProps.r).toBe(index === circles.length - 1 ? TRAIL_DOT_RADIUS * 1.6 : TRAIL_DOT_RADIUS);
    });
    expect(iconProps(circles.at(-1) as ReactElement).r as number).toBeGreaterThan(
      iconProps(circles[0] as ReactElement).r as number,
    );
  });
});

describe("trail display bar", () => {
  it("disables the button without a resolvable selected bone", async () => {
    const { scene, bone, mesh } = createScene();
    useModelScenesStore.getState().register("v1", scene);
    const send = vi.fn(() => true);
    const { root, host } = await renderBar(send);
    try {
      const button = () => host.querySelector("button") as HTMLButtonElement;
      expect(button().disabled).toBe(true);
      expect(button().title).toBe(TRAIL_NO_BONE_HINT);
      expect(button().getAttribute("aria-label")).toBe(TRAIL_NO_BONE_HINT);
      expect(button().getAttribute("aria-pressed")).toBe("false");

      useSelectionStore.getState().select({ versionId: "v1", objectId: mesh.uuid });
      await act(async () => undefined);
      expect(button().disabled).toBe(true);
      useSelectionStore.getState().select({ versionId: "v1", objectId: scene.uuid });
      await act(async () => undefined);
      expect(button().disabled).toBe(true);
      useSelectionStore.getState().select({ versionId: "unknown", objectId: bone.uuid });
      await act(async () => undefined);
      expect(button().disabled).toBe(true);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("converts a selected bone, updates locally before sending, and toggles targets", async () => {
    const { scene, bone, otherBone } = createScene();
    useModelScenesStore.getState().register("v1", scene);
    useSelectionStore.getState().select({ versionId: "v1", objectId: bone.uuid });
    const order: string[] = [];
    const setMotionTrail = vi.spyOn(useDisplayStore.getState(), "setMotionTrail").mockImplementation((trail) => {
      order.push("set");
      useDisplayStore.setState({ motionTrail: { visible: trail.visible, target: trail.target && { ...trail.target } } });
    });
    const send = vi.fn((message: ClientMessage) => {
      order.push("send");
      expect(useDisplayStore.getState().motionTrail).toEqual(message.type === "trail:display" ? message.trail : null);
      return true;
    });
    const { root, host } = await renderBar(send);
    try {
      const button = () => host.querySelector("button") as HTMLButtonElement;
      expect(button().disabled).toBe(false);
      expect(button().title).toBe(TRAIL_VISIBLE_LABEL);
      await act(async () => button().click());
      const target = { versionId: "v1", objectPath: "0/1" };
      expect(useDisplayStore.getState().motionTrail).toEqual({ visible: true, target });
      expect(send).toHaveBeenCalledWith({ type: "trail:display", trail: { visible: true, target } });
      expect(order).toEqual(["set", "send"]);
      expect(setMotionTrail).toHaveBeenCalledOnce();

      useSelectionStore.getState().select({ versionId: "v1", objectId: otherBone.uuid });
      await act(async () => undefined);
      await act(async () => button().click());
      expect(useDisplayStore.getState().motionTrail).toEqual({ visible: true, target: { versionId: "v1", objectPath: "0/2" } });

      useSelectionStore.getState().clear();
      await act(async () => undefined);
      await act(async () => button().click());
      expect(useDisplayStore.getState().motionTrail).toEqual({ visible: false, target: { versionId: "v1", objectPath: "0/2" } });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("turns off for the currently displayed selected bone", async () => {
    const { scene, bone } = createScene();
    const target = { versionId: "v1", objectPath: "0/1" };
    useModelScenesStore.getState().register("v1", scene);
    useSelectionStore.getState().select({ versionId: "v1", objectId: bone.uuid });
    useDisplayStore.getState().setMotionTrail({ visible: true, target });
    const send = vi.fn(() => true);
    const { root, host } = await renderBar(send);
    try {
      const button = host.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      await act(async () => button.click());
      expect(useDisplayStore.getState().motionTrail).toEqual({ visible: false, target });
      expect(send).toHaveBeenCalledWith({ type: "trail:display", trail: { visible: false, target } });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("turns off while a non-bone is selected", async () => {
    const { scene, mesh } = createScene();
    const target = { versionId: "v1", objectPath: "0/1" };
    useModelScenesStore.getState().register("v1", scene);
    useSelectionStore.getState().select({ versionId: "v1", objectId: mesh.uuid });
    useDisplayStore.getState().setMotionTrail({ visible: true, target });
    const send = vi.fn(() => true);
    const { root, host } = await renderBar(send);
    try {
      const button = host.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      await act(async () => button.click());
      expect(useDisplayStore.getState().motionTrail).toEqual({ visible: false, target });
      expect(send).toHaveBeenCalledWith({ type: "trail:display", trail: { visible: false, target } });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("keeps the local update when sending fails", async () => {
    const { scene, bone } = createScene();
    useModelScenesStore.getState().register("v1", scene);
    useSelectionStore.getState().select({ versionId: "v1", objectId: bone.uuid });
    const send = vi.fn(() => false);
    const { root, host } = await renderBar(send);
    try {
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      expect(useDisplayStore.getState().motionTrail).toEqual({
        visible: true,
        target: { versionId: "v1", objectPath: "0/1" },
      });
      expect(send).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("does not update or send when the trail is equal", async () => {
    const { scene, bone } = createScene();
    useModelScenesStore.getState().register("v1", scene);
    useSelectionStore.getState().select({ versionId: "v1", objectId: bone.uuid });
    const send = vi.fn(() => true);
    const setMotionTrail = vi.spyOn(useDisplayStore.getState(), "setMotionTrail");
    vi.spyOn(trailModule, "motionTrailEquals").mockReturnValue(true);
    const { root, host } = await renderBar(send);
    try {
      await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
      expect(setMotionTrail).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("uses the Japanese labels and is placed after the joint bar", () => {
    expect([TRAIL_DISPLAY_LABEL, TRAIL_VISIBLE_LABEL, TRAIL_NO_BONE_HINT].every((label) => /[ぁ-んァ-ン一-龯]/.test(label))).toBe(true);
    const sourceRoot = existsSync(sourcePath) ? sourcePath : join(process.cwd(), "src");
    const source = readFileSync(join(sourceRoot, "features/viewer/ViewerHud.tsx"), "utf8");
    expect(source.match(/<TrailBar send={send} \/>/g)).toHaveLength(1);
    expect(source.indexOf("<TrailBar send={send} />")).toBeGreaterThan(source.indexOf("<JointDisplayBar send={send} />"));
    expect(source).not.toContain("useDisplayStore");
  });
});
