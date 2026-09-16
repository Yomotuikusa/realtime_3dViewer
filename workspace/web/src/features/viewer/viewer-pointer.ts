import type { Vector3 } from "three";
import { DOLLY_SPEED, dollyPosition, mouseButtonsFor, type ViewerMouseButtons } from "./camera-input";

/** OrbitControls インスタンスをそのまま渡せる最小構造型。 */
export interface ViewerControlsLike {
  domElement: HTMLElement;
  mouseButtons: ViewerMouseButtons;
  object: { position: Vector3 };
  target: Vector3;
  update(): void;
}

export interface ViewerPointerDeps {
  /** ユーザー操作でカメラが動き始めたとき(追従解除に使う)。 */
  onUserInteract(): void;
  /** 自前 dolly でカメラを動かした直後。 */
  onCameraChange(): void;
  /** Shift+右ドラッグの移動量(px)。ライトの向きを回す。 */
  onLightRotate(deltaX: number, deltaY: number): void;
  /** dolly の 1px あたりの係数。省略時は DOLLY_SPEED。 */
  dollySpeed?: () => number;
}

interface DollyState {
  pointerId: number;
  clientX: number;
}

interface LightState {
  pointerId: number;
  clientX: number;
  clientY: number;
}

/** controls.domElement に Maya 式の入力を取り付け、後始末をする関数を返す。 */
export function attachViewerPointer(
  controls: ViewerControlsLike,
  deps: ViewerPointerDeps,
): () => void {
  const { domElement } = controls;
  let dolly: DollyState | null = null;
  let light: LightState | null = null;

  const handlePointerDown = (event: PointerEvent): void => {
    controls.mouseButtons = mouseButtonsFor(event.altKey);
    if (event.button !== 2) {
      return;
    }
    if (event.altKey) {
      dolly = { pointerId: event.pointerId, clientX: event.clientX };
      domElement.setPointerCapture(event.pointerId);
      deps.onUserInteract();
      return;
    }
    if (!event.shiftKey) {
      return;
    }
    light = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    domElement.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (light !== null && event.pointerId === light.pointerId) {
      deps.onLightRotate(event.clientX - light.clientX, event.clientY - light.clientY);
      light.clientX = event.clientX;
      light.clientY = event.clientY;
      return;
    }
    if (dolly === null || event.pointerId !== dolly.pointerId) {
      return;
    }
    const nextPosition = dollyPosition(
      controls.object.position.toArray() as [number, number, number],
      controls.target.toArray() as [number, number, number],
      event.clientX - dolly.clientX,
      deps.dollySpeed?.() ?? DOLLY_SPEED,
    );
    controls.object.position.set(...nextPosition);
    controls.update();
    deps.onCameraChange();
    dolly.clientX = event.clientX;
  };

  const finishDolly = (event: PointerEvent): void => {
    if (dolly === null || event.pointerId !== dolly.pointerId) {
      return;
    }
    if (domElement.hasPointerCapture(event.pointerId)) {
      domElement.releasePointerCapture(event.pointerId);
    }
    dolly = null;
  };

  const finishLight = (event: PointerEvent): void => {
    if (light === null || event.pointerId !== light.pointerId) {
      return;
    }
    if (domElement.hasPointerCapture(event.pointerId)) {
      domElement.releasePointerCapture(event.pointerId);
    }
    light = null;
  };

  const preventDefault = (event: Event): void => {
    event.preventDefault();
  };
  const preventMiddleMouseDown = (event: MouseEvent): void => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  domElement.addEventListener("pointerdown", handlePointerDown, true);
  domElement.addEventListener("pointermove", handlePointerMove);
  domElement.addEventListener("pointerup", finishDolly);
  domElement.addEventListener("pointerup", finishLight);
  domElement.addEventListener("pointercancel", finishDolly);
  domElement.addEventListener("pointercancel", finishLight);
  domElement.addEventListener("contextmenu", preventDefault);
  domElement.addEventListener("mousedown", preventMiddleMouseDown);
  domElement.addEventListener("auxclick", preventDefault);

  return () => {
    domElement.removeEventListener("pointerdown", handlePointerDown, true);
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("pointerup", finishDolly);
    domElement.removeEventListener("pointerup", finishLight);
    domElement.removeEventListener("pointercancel", finishDolly);
    domElement.removeEventListener("pointercancel", finishLight);
    domElement.removeEventListener("contextmenu", preventDefault);
    domElement.removeEventListener("mousedown", preventMiddleMouseDown);
    domElement.removeEventListener("auxclick", preventDefault);
    if (dolly !== null && domElement.hasPointerCapture(dolly.pointerId)) {
      domElement.releasePointerCapture(dolly.pointerId);
    }
    if (light !== null && domElement.hasPointerCapture(light.pointerId)) {
      domElement.releasePointerCapture(light.pointerId);
    }
    dolly = null;
    light = null;
  };
}
