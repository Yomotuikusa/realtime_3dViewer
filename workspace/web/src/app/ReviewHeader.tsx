import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { useSessionStore } from "../store/session";
import { OutlinerDockIcon, PanelDockIcon } from "./review-icons";
import {
  connectionLabel,
  connectionTone,
  copyLabel,
  copyText,
  OUTLINER_TOGGLE_LABEL,
  PANEL_TOGGLE_LABEL,
  SETTINGS_OPEN_LABEL,
  type CopyState,
} from "./review-labels";

export function ReviewHeader({ projectName, joined, onOpenSettings, outlinerOpen, panelOpen, onToggleOutliner, onTogglePanel }: {
  projectName: string;
  joined: boolean;
  onOpenSettings: () => void;
  outlinerOpen: boolean;
  panelOpen: boolean;
  onToggleOutliner: () => void;
  onTogglePanel: () => void;
}): ReactElement {
  const connection = useSessionStore((session) => session.connection);
  const color = useSessionStore((session) => session.color);
  const name = useSessionStore((session) => session.name);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const shareUrl = window.location.href;

  useEffect(() => {
    if (copyState !== "copied") {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = (): void => {
    void copyText(shareUrl, navigator.clipboard).then(setCopyState);
  };

  return (
    <header className="review-header">
      <button
        className="btn btn--quiet review-header__dock"
        type="button"
        aria-pressed={outlinerOpen}
        aria-label={OUTLINER_TOGGLE_LABEL}
        onClick={onToggleOutliner}
      >
        <OutlinerDockIcon />
      </button>
      <h1 className="review-header__title">{projectName}</h1>
      <span className="review-header__kind">レビュー</span>
      <div className="review-header__actions">
        <span className="badge" data-tone={connectionTone(connection, joined)} role="status">
          {connectionLabel(connection, joined)}
        </span>
        {joined && (
          <span className="review-header__self">
            <i
              className="review-header__dot"
              aria-hidden="true"
              style={{ "--user-color": color ?? undefined } as CSSProperties}
            />
            {name}
          </span>
        )}
        <button className="btn btn--quiet" type="button" onClick={handleCopy}>
          {copyLabel(copyState)}
        </button>
        {joined && (
          <button className="btn btn--quiet" type="button" onClick={onOpenSettings}>
            {SETTINGS_OPEN_LABEL}
          </button>
        )}
        <button
          className="btn btn--quiet review-header__dock"
          type="button"
          aria-pressed={panelOpen}
          aria-label={PANEL_TOGGLE_LABEL}
          onClick={onTogglePanel}
        >
          <PanelDockIcon />
        </button>
        {copyState === "failed" && (
          <input
            className="input review-header__url"
            readOnly
            value={shareUrl}
            aria-label="レビュー URL"
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </div>
    </header>
  );
}
