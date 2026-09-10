import { nanoid } from "nanoid";
import { useEffect, useRef } from "react";
import { Raycaster, Vector2, type WebGLRenderer } from "three";
import { useThree } from "@react-three/fiber";
import type { ClientMessage } from "@shared/protocol";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useSessionStore } from "../../store/session";
import { getModelTarget } from "../viewer/model-target";
import { pickModel, toNdc } from "../viewer/pick";
import { buildStroke, offsetAlongNormal } from "./stroke-build";
import { intersectPlane, type DrawPlane, type DrawRay, viewPlaneAt } from "./draw-plane";

function canvasFromRenderer(renderer: WebGLRenderer): HTMLCanvasElement {
  return renderer.domElement;
}

export function AnnotationLayer({ send }: { send: (msg: ClientMessage) => boolean }): null {
  const mode = useAnnotationStore((state) => state.mode);
  const { gl, camera } = useThree();
  const raycaster = useRef(new Raycaster());
  const drawPlane = useRef<DrawPlane | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (mode !== "pen") {
      return;
    }

    const canvas = canvasFromRenderer(gl);
    const pointerNdc = (event: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return toNdc(rect, event.clientX, event.clientY);
    };
    const pointerRay = (event: PointerEvent): DrawRay => {
      const ndc = pointerNdc(event);
      raycaster.current.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
      const { origin, direction } = raycaster.current.ray;
      return {
        origin: [origin.x, origin.y, origin.z],
        direction: [direction.x, direction.y, direction.z],
      };
    };
    const pointerPoint = (event: PointerEvent): ReturnType<typeof pickModel> => {
      const ndc = pointerNdc(event);
      return pickModel(raycaster.current, camera, ndc, getModelTarget());
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || event.altKey) {
        return;
      }
      const placement = useAnnotationStore.getState().placement;
      if (placement === "space") {
        const position = camera.position;
        drawPlane.current = viewPlaneAt(
          [position.x, position.y, position.z],
          useCameraStore.getState().selfCamera.target,
        );
        if (drawPlane.current === null) {
          return;
        }
        const point = intersectPlane(pointerRay(event), drawPlane.current);
        if (point === null) {
          drawPlane.current = null;
          return;
        }
        useAnnotationStore.getState().beginDraft(point);
      } else {
        drawPlane.current = null;
        const hit = pointerPoint(event);
        if (hit === null) {
          return;
        }
        const modelSize = useCameraStore.getState().modelSize;
        useAnnotationStore.getState().beginDraft(offsetAlongNormal(hit.point, hit.normal, modelSize));
      }
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (useAnnotationStore.getState().drafting === null) {
        return;
      }
      if (drawPlane.current !== null) {
        const point = intersectPlane(pointerRay(event), drawPlane.current);
        if (point !== null) {
          useAnnotationStore.getState().appendDraftPoint(point);
        }
        return;
      }
      const hit = pointerPoint(event);
      if (hit !== null) {
        const modelSize = useCameraStore.getState().modelSize;
        useAnnotationStore.getState().appendDraftPoint(offsetAlongNormal(hit.point, hit.normal, modelSize));
      }
    };

    const finishDraft = (event: PointerEvent): void => {
      const points = useAnnotationStore.getState().endDraft();
      drawPlane.current = null;
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
      drawPlane.current = null;
    };
  }, [camera, gl, mode]);

  return null;
}
