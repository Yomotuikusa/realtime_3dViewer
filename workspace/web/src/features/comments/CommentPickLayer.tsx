import { useEffect, useRef } from "react";
import { Raycaster, type WebGLRenderer } from "three";
import { useThree } from "@react-three/fiber";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useCommentsStore } from "../../store/comments";
import { getModelTarget } from "../viewer/model-target";
import { pickModel, toNdc } from "../viewer/pick";
import { offsetAlongNormal } from "../annotation/stroke-build";
import { isClick } from "./compose";

function canvasFromRenderer(renderer: WebGLRenderer): HTMLCanvasElement {
  return renderer.domElement;
}

export function CommentPickLayer(): null {
  const mode = useAnnotationStore((state) => state.mode);
  const { gl, camera } = useThree();
  const raycaster = useRef(new Raycaster());
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mode !== "comment") {
      down.current = null;
      return;
    }

    const canvas = canvasFromRenderer(gl);
    const pointerPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return pickModel(
        raycaster.current,
        camera,
        toNdc(rect, event.clientX, event.clientY),
        getModelTarget(),
      );
    };
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button === 0 && !event.altKey) {
        down.current = { x: event.clientX, y: event.clientY };
      }
    };
    const handlePointerUp = (event: PointerEvent): void => {
      const start = down.current;
      down.current = null;
      if (event.button !== 0 || start === null || !isClick(start, event)) {
        return;
      }
      if (useCommentsStore.getState().composerAnchor !== null) {
        return;
      }
      const hit = pointerPoint(event);
      if (hit === null) {
        return;
      }
      const modelSize = useCameraStore.getState().modelSize;
      useCommentsStore.getState().setComposerAnchor(
        offsetAlongNormal(hit.point, hit.normal, modelSize),
      );
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
