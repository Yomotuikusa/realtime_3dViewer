import { nanoid } from "nanoid";
import { useEffect, useRef } from "react";
import { Raycaster, type WebGLRenderer } from "three";
import { useThree } from "@react-three/fiber";
import type { ClientMessage } from "@shared/protocol";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useSessionStore } from "../../store/session";
import { getModelTarget } from "../viewer/model-target";
import { pickModel, toNdc } from "../viewer/pick";
import { buildStroke, offsetAlongNormal } from "./stroke-build";

function canvasFromRenderer(renderer: WebGLRenderer): HTMLCanvasElement {
  return renderer.domElement;
}

export function AnnotationLayer({ send }: { send: (msg: ClientMessage) => boolean }): null {
  const mode = useAnnotationStore((state) => state.mode);
  const { gl, camera } = useThree();
  const raycaster = useRef(new Raycaster());
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (mode !== "pen") {
      return;
    }

    const canvas = canvasFromRenderer(gl);
    const pointerPoint = (event: PointerEvent): ReturnType<typeof pickModel> => {
      const rect = canvas.getBoundingClientRect();
      return pickModel(raycaster.current, camera, toNdc(rect, event.clientX, event.clientY), getModelTarget());
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }
      const hit = pointerPoint(event);
      if (hit === null) {
        return;
      }
      const modelSize = useCameraStore.getState().modelSize;
      useAnnotationStore.getState().beginDraft(offsetAlongNormal(hit.point, hit.normal, modelSize));
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (useAnnotationStore.getState().drafting === null) {
        return;
      }
      const hit = pointerPoint(event);
      if (hit === null) {
        return;
      }
      const modelSize = useCameraStore.getState().modelSize;
      useAnnotationStore.getState().appendDraftPoint(offsetAlongNormal(hit.point, hit.normal, modelSize));
    };

    const finishDraft = (event: PointerEvent): void => {
      const points = useAnnotationStore.getState().endDraft();
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      const session = useSessionStore.getState();
      if (session.connection !== "open" || session.selfId === null) {
        return;
      }
      const annotation = useAnnotationStore.getState();
      const stroke = buildStroke(points, {
        id: nanoid(12),
        userId: session.selfId,
        color: annotation.color,
        createdAt: Date.now(),
        modelSize: useCameraStore.getState().modelSize,
      });
      if (stroke !== null) {
        sendRef.current({ type: "stroke:add", stroke });
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishDraft);
    canvas.addEventListener("pointercancel", finishDraft);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishDraft);
      canvas.removeEventListener("pointercancel", finishDraft);
      if (useAnnotationStore.getState().drafting !== null) {
        useAnnotationStore.getState().endDraft();
      }
    };
  }, [camera, gl, mode]);

  return null;
}
