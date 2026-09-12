import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster } from "three";
import { useAnnotationStore } from "../../store/annotation";
import { useModelScenesStore } from "../compare/model-scenes";
import { isClick } from "../comments/compose";
import { getModelTarget } from "../viewer/model-target";
import { pickSelection } from "./pick-selection";
import { toNdc } from "../viewer/pick";
import { useSelectionStore } from "./selection";
import { jointSelectionOf, pickJoint } from "../joint/joint-pick";

/** Canvas に 1 つだけ置く描画なしの部品。通常モードの左クリックで版全体を選択する */
export function SelectionPickLayer(): null {
  const mode = useAnnotationStore((state) => state.mode);
  const { gl, camera } = useThree();
  const raycaster = useRef(new Raycaster());
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mode !== "none") {
      down.current = null;
      return;
    }

    const canvas = gl.domElement;
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button === 0 && !event.altKey) {
        down.current = { x: event.clientX, y: event.clientY };
      }
    };
    const handlePointerUp = (event: PointerEvent): void => {
      const start = down.current;
      down.current = null;
      if (event.button !== 0 || start === null || !isClick(start, event)) return;

      const rect = canvas.getBoundingClientRect();
      const ndc = toNdc(rect, event.clientX, event.clientY);
      const scenes = useModelScenesStore.getState().scenes;
      const hit = jointSelectionOf(pickJoint(camera, ndc, rect, scenes))
        ?? pickSelection(
        raycaster.current,
        camera,
        ndc,
        getModelTarget(),
        scenes,
      );
      if (hit === null) {
        useSelectionStore.getState().clear();
      } else {
        useSelectionStore.getState().select(hit);
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      down.current = null;
    };
  }, [camera, gl, mode]);

  return null;
}
