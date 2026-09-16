import { Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOUSE_BUTTONS_ALT, MOUSE_BUTTONS_IDLE } from "../src/features/viewer/camera-input";
import {
  attachViewerPointer,
  type ViewerControlsLike,
} from "../src/features/viewer/viewer-pointer";

function pointerEvent(
  type: string,
  init: { altKey?: boolean; button?: number; clientX?: number; clientY?: number; pointerId?: number; shiftKey?: boolean } = {},
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    altKey: { value: init.altKey ?? false },
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
    pointerId: { value: init.pointerId ?? 1 },
    shiftKey: { value: init.shiftKey ?? false },
  });
  return event;
}

function mouseEvent(type: string, button?: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button });
}

function makeControls(): { controls: ViewerControlsLike; captured: Set<number> } {
  const domElement = document.createElement("canvas");
  const captured = new Set<number>();
  Object.assign(domElement, {
    setPointerCapture: vi.fn((pointerId: number) => captured.add(pointerId)),
    hasPointerCapture: vi.fn((pointerId: number) => captured.has(pointerId)),
    releasePointerCapture: vi.fn((pointerId: number) => captured.delete(pointerId)),
  });
  return {
    captured,
    controls: {
      domElement,
      mouseButtons: MOUSE_BUTTONS_IDLE,
      object: { position: new Vector3(0, 0, 10) },
      target: new Vector3(0, 0, 0),
      update: vi.fn(),
    },
  };
}

describe("viewer pointer input", () => {
  let controls: ViewerControlsLike;
  let captured: Set<number>;

  beforeEach(() => {
    ({ controls, captured } = makeControls());
  });

  it("assigns mouse buttons in capture phase before OrbitControls reads the event", () => {
    const seen: unknown[] = [];
    controls.domElement.addEventListener("pointerdown", () => seen.push(controls.mouseButtons));
    const cleanup = attachViewerPointer(controls, {
      onUserInteract: vi.fn(),
      onCameraChange: vi.fn(),
      onLightRotate: vi.fn(),
    });

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", { altKey: true, pointerId: 2 }));
    expect(seen).toEqual([MOUSE_BUTTONS_ALT]);
    expect(controls.mouseButtons).toBe(MOUSE_BUTTONS_ALT);
    cleanup();
  });

  it("starts Alt-right dolly, captures the pointer, and updates in order", () => {
    const calls: string[] = [];
    controls.update = vi.fn(() => calls.push("update"));
    const onUserInteract = vi.fn(() => calls.push("interact"));
    const onCameraChange = vi.fn(() => calls.push("change"));
    const dollySpeed = vi.fn(() => 0.01);
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange, onLightRotate: vi.fn(), dollySpeed });

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      altKey: true,
      button: 2,
      clientX: 10,
      pointerId: 3,
    }));
    expect(onUserInteract).toHaveBeenCalledTimes(1);
    expect(captured.has(3)).toBe(true);

    controls.domElement.dispatchEvent(pointerEvent("pointermove", {
      altKey: false,
      clientX: 110,
      pointerId: 3,
    }));
    expect(controls.object.position.z).toBeCloseTo(10 * Math.exp(-1));
    expect(dollySpeed).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["interact", "update", "change"]);

    controls.domElement.dispatchEvent(pointerEvent("pointerup", { pointerId: 3 }));
    expect(captured.has(3)).toBe(false);
    cleanup();
  });

  it("does not start a dolly for an unmodified right press", () => {
    const onUserInteract = vi.fn();
    const onCameraChange = vi.fn();
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange, onLightRotate: vi.fn() });

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", { button: 2, clientX: 10 }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 110 }));

    expect(controls.mouseButtons).toBe(MOUSE_BUTTONS_IDLE);
    expect(controls.object.position.z).toBe(10);
    expect(onUserInteract).not.toHaveBeenCalled();
    expect(onCameraChange).not.toHaveBeenCalled();
    cleanup();
  });

  it("ends dolly on pointercancel and ignores non-dolly moves", () => {
    const onCameraChange = vi.fn();
    const cleanup = attachViewerPointer(controls, {
      onUserInteract: vi.fn(),
      onCameraChange,
      onLightRotate: vi.fn(),
    });

    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 20 }));
    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      altKey: true,
      button: 2,
      pointerId: 4,
    }));
    controls.domElement.dispatchEvent(pointerEvent("pointercancel", { pointerId: 4 }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 20, pointerId: 4 }));

    expect(onCameraChange).not.toHaveBeenCalled();
    expect(captured.has(4)).toBe(false);
    cleanup();
  });

  it("rotates the light with Shift-right drag without moving the camera", () => {
    const onUserInteract = vi.fn();
    const onCameraChange = vi.fn();
    const onLightRotate = vi.fn();
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange, onLightRotate });

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      button: 2,
      clientX: 0,
      clientY: 0,
      pointerId: 7,
      shiftKey: true,
    }));
    expect(captured.has(7)).toBe(true);
    expect(controls.mouseButtons).toBe(MOUSE_BUTTONS_IDLE);
    expect(onUserInteract).not.toHaveBeenCalled();

    controls.domElement.dispatchEvent(pointerEvent("pointermove", {
      clientX: 10,
      clientY: -4,
      pointerId: 7,
    }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", {
      clientX: 25,
      clientY: -4,
      pointerId: 7,
    }));
    expect(onLightRotate).toHaveBeenNthCalledWith(1, 10, -4);
    expect(onLightRotate).toHaveBeenNthCalledWith(2, 15, 0);
    expect(controls.update).not.toHaveBeenCalled();
    expect(onCameraChange).not.toHaveBeenCalled();

    controls.domElement.dispatchEvent(pointerEvent("pointerup", { pointerId: 7 }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 30, pointerId: 7 }));
    expect(captured.has(7)).toBe(false);
    expect(onLightRotate).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("keeps light rotation exclusive to Shift-right and cleans up every pointer", () => {
    const onUserInteract = vi.fn();
    const onCameraChange = vi.fn();
    const onLightRotate = vi.fn();
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange, onLightRotate });

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      button: 2,
      clientX: 1,
      clientY: 1,
      pointerId: 8,
      shiftKey: true,
    }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 4, clientY: 4, pointerId: 9 }));
    expect(onLightRotate).not.toHaveBeenCalled();
    controls.domElement.dispatchEvent(pointerEvent("pointercancel", { pointerId: 8 }));
    expect(captured.has(8)).toBe(false);

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", { button: 0, shiftKey: true, pointerId: 10 }));
    controls.domElement.dispatchEvent(pointerEvent("pointerdown", { button: 1, shiftKey: true, pointerId: 11 }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 20, clientY: 20, pointerId: 10 }));
    expect(onLightRotate).not.toHaveBeenCalled();

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      altKey: true,
      button: 2,
      clientX: 0,
      pointerId: 12,
      shiftKey: true,
    }));
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 10, pointerId: 12 }));
    expect(onUserInteract).toHaveBeenCalledTimes(1);
    expect(onLightRotate).not.toHaveBeenCalled();
    controls.domElement.dispatchEvent(pointerEvent("pointerup", { pointerId: 12 }));

    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      button: 2,
      pointerId: 13,
      shiftKey: true,
    }));
    cleanup();
    expect(captured.has(13)).toBe(false);
    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 10, pointerId: 13 }));
    expect(onLightRotate).not.toHaveBeenCalled();
  });

  it("prevents browser context-menu, middle-button autoscroll, and auxclick defaults", () => {
    const cleanup = attachViewerPointer(controls, {
      onUserInteract: vi.fn(),
      onCameraChange: vi.fn(),
      onLightRotate: vi.fn(),
    });

    const contextMenu = new Event("contextmenu", { cancelable: true });
    const middleDown = mouseEvent("mousedown", 1);
    const leftDown = mouseEvent("mousedown", 0);
    const auxClick = new Event("auxclick", { cancelable: true });
    controls.domElement.dispatchEvent(contextMenu);
    controls.domElement.dispatchEvent(middleDown);
    controls.domElement.dispatchEvent(leftDown);
    controls.domElement.dispatchEvent(auxClick);

    expect(contextMenu.defaultPrevented).toBe(true);
    expect(middleDown.defaultPrevented).toBe(true);
    expect(leftDown.defaultPrevented).toBe(false);
    expect(auxClick.defaultPrevented).toBe(true);
    cleanup();
  });

  it("removes every listener and discards an active dolly on cleanup", () => {
    const onUserInteract = vi.fn();
    const onCameraChange = vi.fn();
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange, onLightRotate: vi.fn() });
    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      altKey: true,
      button: 2,
      pointerId: 5,
    }));
    cleanup();
    onUserInteract.mockClear();
    onCameraChange.mockClear();

    controls.domElement.dispatchEvent(pointerEvent("pointermove", { clientX: 100, pointerId: 5 }));
    controls.domElement.dispatchEvent(pointerEvent("pointerdown", {
      altKey: true,
      button: 2,
      pointerId: 6,
    }));
    expect(onUserInteract).not.toHaveBeenCalled();
    expect(onCameraChange).not.toHaveBeenCalled();
    expect(captured.has(5)).toBe(false);
  });
});
