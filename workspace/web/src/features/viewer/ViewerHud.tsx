import type { CSSProperties, ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useCommentsStore } from "../../store/comments";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { AnnotationToolbar } from "../annotation/AnnotationToolbar";
import {
  FIT_LABEL,
  followingLabel,
  hint,
  MODE_LABELS,
  MODE_ORDER,
  RESET_LABEL,
  UNFOLLOW_LABEL,
} from "./hud-labels";
import "./viewer.css";

export function ViewerHud({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const mode = useAnnotationStore((state) => state.mode);
  const placement = useAnnotationStore((state) => state.placement);
  const setMode = useAnnotationStore((state) => state.setMode);
  const users = usePresenceStore((state) => state.users);
  const followingUserId = usePresenceStore((state) => state.followingUserId);
  const unfollow = usePresenceStore((state) => state.unfollow);
  const hasAnchor = useCommentsStore((state) => state.composerAnchor !== null);
  const connection = useSessionStore((state) => state.connection);
  const requestReset = useCameraStore((state) => state.requestReset);
  const requestFit = useCameraStore((state) => state.requestFit);
  const followingUser = followingUserId === null ? undefined : users[followingUserId];

  return (
    <div className="hud">
      <div className="hud__row">
        <div className="hud-modes" role="group" aria-label="操作モード">
          {MODE_ORDER.map((modeValue) => (
            <button
              key={modeValue}
              className="btn hud-mode"
              type="button"
              aria-pressed={mode === modeValue}
              onClick={() => setMode(mode === modeValue ? "none" : modeValue)}
            >
              {MODE_LABELS[modeValue]}
            </button>
          ))}
        </div>
        {mode === "pen" && <AnnotationToolbar send={send} />}
        <div className="hud-view" role="group" aria-label="視点">
          <button className="btn btn--quiet" type="button" onClick={requestReset}>{RESET_LABEL}</button>
          <button className="btn btn--quiet" type="button" onClick={requestFit}>{FIT_LABEL}</button>
        </div>
      </div>
      {followingUserId !== null && (
        <div
          className="hud-follow"
          role="status"
          style={{ "--user-color": followingUser?.color } as CSSProperties}
        >
          <i className="hud-follow__dot" aria-hidden="true" />
          {followingLabel(followingUser?.name ?? "")}
          <button className="btn btn--quiet" type="button" onClick={unfollow}>{UNFOLLOW_LABEL}</button>
        </div>
      )}
      <p className="hud-hint" role="status" aria-live="polite">
        {hint({ mode, canEdit: connection === "open", hasAnchor, following: followingUserId !== null, placement })}
      </p>
    </div>
  );
}
