import { Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOUSE_BUTTONS_ALT, MOUSE_BUTTONS_IDLE } from "../src/features/viewer/camera-input";
import {
  attachViewerPointer,
  type ViewerControlsLike,
} from "../src/features/viewer/viewer-pointer";

function pointerEvent(
  type: string,
  init: { altKey?: boolean; button?: number; clientX?: number; pointerId?: number } = {},
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    altKey: { value: init.altKey ?? false },
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX ?? 0 },
    pointerId: { value: init.pointerId ?? 1 },
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
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange });

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
    expect(controls.object.position.z).toBeCloseTo(10 * Math.exp(-0.5));
    expect(calls).toEqual(["interact", "update", "change"]);

    controls.domElement.dispatchEvent(pointerEvent("pointerup", { pointerId: 3 }));
    expect(captured.has(3)).toBe(false);
    cleanup();
  });

  it("does not start a dolly for an unmodified right press", () => {
    const onUserInteract = vi.fn();
    const onCameraChange = vi.fn();
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange });

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

  it("prevents browser context-menu, middle-button autoscroll, and auxclick defaults", () => {
    const cleanup = attachViewerPointer(controls, {
      onUserInteract: vi.fn(),
      onCameraChange: vi.fn(),
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
    const cleanup = attachViewerPointer(controls, { onUserInteract, onCameraChange });
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
