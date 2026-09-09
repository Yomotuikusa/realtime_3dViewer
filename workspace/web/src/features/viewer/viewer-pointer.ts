import type { Vector3 } from "three";
import { dollyPosition, mouseButtonsFor, type ViewerMouseButtons } from "./camera-input";

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
}

interface DollyState {
  pointerId: number;
  clientX: number;
}

/** controls.domElement に Maya 式の入力を取り付け、後始末をする関数を返す。 */
export function attachViewerPointer(
  controls: ViewerControlsLike,
  deps: ViewerPointerDeps,
): () => void {
  const { domElement } = controls;
  let dolly: DollyState | null = null;

  const handlePointerDown = (event: PointerEvent): void => {
    controls.mouseButtons = mouseButtonsFor(event.altKey);
    if (!event.altKey || event.button !== 2) {
      return;
    }
    dolly = { pointerId: event.pointerId, clientX: event.clientX };
    domElement.setPointerCapture(event.pointerId);
    deps.onUserInteract();
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (dolly === null || event.pointerId !== dolly.pointerId) {
      return;
    }
    const nextPosition = dollyPosition(
      controls.object.position.toArray() as [number, number, number],
      controls.target.toArray() as [number, number, number],
      event.clientX - dolly.clientX,
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
  domElement.addEventListener("pointercancel", finishDolly);
  domElement.addEventListener("contextmenu", preventDefault);
  domElement.addEventListener("mousedown", preventMiddleMouseDown);
  domElement.addEventListener("auxclick", preventDefault);

  return () => {
    domElement.removeEventListener("pointerdown", handlePointerDown, true);
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("pointerup", finishDolly);
    domElement.removeEventListener("pointercancel", finishDolly);
    domElement.removeEventListener("contextmenu", preventDefault);
    domElement.removeEventListener("mousedown", preventMiddleMouseDown);
    domElement.removeEventListener("auxclick", preventDefault);
    if (dolly !== null && domElement.hasPointerCapture(dolly.pointerId)) {
      domElement.releasePointerCapture(dolly.pointerId);
    }
    dolly = null;
  };
}
