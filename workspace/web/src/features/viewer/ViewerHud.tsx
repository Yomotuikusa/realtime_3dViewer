import { useState, type CSSProperties, type ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { useAnnotationStore } from "../../store/annotation";
import { useCommentsStore } from "../../store/comments";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { useShortcutsStore } from "../../store/shortcuts";
import { AnnotationToolbar } from "../annotation/AnnotationToolbar";
import { CameraMenu } from "./CameraMenu";
import { DisplayModeBar } from "./DisplayModeBar";
import { HudMenu } from "./HudMenu";
import { LightGizmo } from "./LightGizmo";
import {
  HUD_MENU_INITIAL,
  toggleHudMenu,
  type HudMenuId,
} from "./hud-menu";
import {
  followingLabel,
  hint,
  MODE_LABELS,
  MODE_ORDER,
  UNFOLLOW_LABEL,
  withShortcut,
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
  const keymap = useShortcutsStore((state) => state.keymap);
  const followingUser = followingUserId === null ? undefined : users[followingUserId];
  const [openMenu, setOpenMenu] = useState<HudMenuId | null>(HUD_MENU_INITIAL);

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
              {withShortcut(MODE_LABELS[modeValue], keymap[modeValue])}
            </button>
          ))}
        </div>
        {mode === "pen" && <AnnotationToolbar send={send} />}
      </div>
      <div className="hud-menus">
        <DisplayModeBar send={send} />
        <HudMenu
          id="camera"
          open={openMenu === "camera"}
          onToggle={() => setOpenMenu((open) => toggleHudMenu(open, "camera"))}
          onClose={() => setOpenMenu(null)}
        >
          <CameraMenu />
        </HudMenu>
      </div>
      <LightGizmo />
      {followingUserId !== null && (
        <div className="hud-following" style={{ "--user-color": followingUser?.color } as CSSProperties}>
          <div className="hud-follow-frame" aria-hidden="true" />
          <div className="hud-follow" role="status">
            <i className="hud-follow__bar" aria-hidden="true" />
            {followingLabel(followingUser?.name ?? "")}
            <button className="btn hud-follow__unfollow" type="button" onClick={unfollow}>{UNFOLLOW_LABEL}</button>
          </div>
        </div>
      )}
      <p className="hud-hint" role="status" aria-live="polite">
        {hint({ mode, canEdit: connection === "open", hasAnchor, following: followingUserId !== null, placement })}
      </p>
    </div>
  );
}
