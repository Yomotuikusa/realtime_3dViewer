import { useEffect } from "react";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useShortcutsStore } from "../../store/shortcuts";
import { isTypingTarget, resolveAction } from "./keymap";

export function useShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) {
        return;
      }
      const action = resolveAction(useShortcutsStore.getState().keymap, event);
      if (action === null) {
        return;
      }
      event.preventDefault();
      switch (action) {
        case "pen":
        case "comment": {
          const annotation = useAnnotationStore.getState();
          annotation.setMode(annotation.mode === action ? "none" : action);
          break;
        }
        case "clearMode":
          useAnnotationStore.getState().setMode("none");
          break;
        case "viewReset":
          useCameraStore.getState().requestReset();
          break;
        case "viewFit":
          useCameraStore.getState().requestFit();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
