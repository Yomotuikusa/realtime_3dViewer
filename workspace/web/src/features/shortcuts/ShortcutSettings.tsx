import { useEffect, useId, useState, type ReactElement } from "react";
import { useShortcutsStore } from "../../store/shortcuts";
import { ACTION_ORDER, formatBinding, type ShortcutAction } from "./keymap";
import {
  ACTION_LABELS,
  CANCEL_CAPTURE_LABEL,
  CAPTURING_MESSAGE,
  CHANGE_LABEL,
  CLOSE_LABEL,
  rejectionMessage,
  RESET_KEYMAP_LABEL,
  SETTINGS_HELP,
  SETTINGS_TITLE,
  UNBIND_LABEL,
} from "./shortcut-labels";
import { captureBinding, type CaptureRejection } from "./capture";
import "./shortcuts.css";

export function ShortcutSettings({ onClose }: { onClose: () => void }): ReactElement {
  const titleId = useId();
  const keymap = useShortcutsStore((state) => state.keymap);
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  const [rejection, setRejection] = useState<CaptureRejection | null>(null);

  useEffect(() => {
    if (capturing === null) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const result = captureBinding(event);
      switch (result.status) {
        case "ignored":
          return;
        case "cancelled":
          setCapturing(null);
          setRejection(null);
          return;
        case "rejected":
          setRejection(result.reason);
          return;
        case "assigned":
          useShortcutsStore.getState().setBinding(capturing, result.binding);
          setCapturing(null);
          setRejection(null);
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [capturing]);

  const changeBinding = (action: ShortcutAction): void => {
    setCapturing(capturing === action ? null : action);
    setRejection(null);
  };

  const resetKeymap = (): void => {
    useShortcutsStore.getState().resetKeymap();
    setCapturing(null);
    setRejection(null);
  };

  return (
    <div className="review-backdrop">
      <div className="review-dialog shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{SETTINGS_TITLE}</h2>
        <p className="review-dialog__help">{SETTINGS_HELP}</p>
        {rejection !== null && <p className="alert" role="alert">{rejectionMessage(rejection)}</p>}
        <div role="group" aria-label={SETTINGS_TITLE}>
          {ACTION_ORDER.map((action) => (
            <div className="shortcut-row" key={action}>
              <span className="shortcut-row__name">{ACTION_LABELS[action]}</span>
              <span className="shortcut-row__key">
                {capturing === action ? CAPTURING_MESSAGE : formatBinding(keymap[action])}
              </span>
              <button className="btn btn--quiet" type="button" onClick={() => changeBinding(action)}>
                {capturing === action ? CANCEL_CAPTURE_LABEL : CHANGE_LABEL}
              </button>
              <button
                className="btn btn--quiet"
                type="button"
                onClick={() => useShortcutsStore.getState().setBinding(action, null)}
                disabled={keymap[action] === null}
              >
                {UNBIND_LABEL}
              </button>
            </div>
          ))}
        </div>
        <div className="shortcut-dialog__footer">
          <button className="btn btn--quiet" type="button" onClick={resetKeymap}>{RESET_KEYMAP_LABEL}</button>
          <button className="btn btn--primary" type="button" onClick={onClose} autoFocus>{CLOSE_LABEL}</button>
        </div>
      </div>
    </div>
  );
}
