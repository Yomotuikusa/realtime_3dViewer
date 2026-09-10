import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useCommentsStore } from "../../store/comments";
import { useLightingStore } from "../../store/lighting";
import { usePresenceStore } from "../../store/presence";
import { useSessionStore } from "../../store/session";
import { useShortcutsStore } from "../../store/shortcuts";
import { AnnotationToolbar } from "../annotation/AnnotationToolbar";
import { FocalLengthSlider } from "./FocalLengthSlider";
import { HudMenu } from "./HudMenu";
import {
  menuAfterPointerDown,
  toggleHudMenu,
  type HudMenuId,
} from "./hud-menu";
import {
  FIT_LABEL,
  followingLabel,
  hint,
  LIGHT_RESET_LABEL,
  MODE_LABELS,
  MODE_ORDER,
  RESET_LABEL,
  UNFOLLOW_LABEL,
  VIEW_PRESET_LABELS,
  withShortcut,
} from "./hud-labels";
import { presetCamera, VIEW_PRESET_ORDER } from "./view-presets";
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
  const requestCamera = useCameraStore((state) => state.requestCamera);
  const resetLighting = useLightingStore((state) => state.reset);
  const keymap = useShortcutsStore((state) => state.keymap);
  const followingUser = followingUserId === null ? undefined : users[followingUserId];
  const [openMenu, setOpenMenu] = useState<HudMenuId | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenu === null) {
      return;
    }
    const handlePointerDown = (event: PointerEvent): void => {
      setOpenMenu((open) => menuAfterPointerDown(open, menusRef.current, event.target));
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenu]);

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
      <div className="hud-menus" ref={menusRef}>
        <HudMenu
          id="camera"
          open={openMenu === "camera"}
          onToggle={() => setOpenMenu((open) => toggleHudMenu(open, "camera"))}
          onClose={() => setOpenMenu(null)}
        >
          <FocalLengthSlider />
          {VIEW_PRESET_ORDER.map((preset) => (
            <button
              key={preset}
              className="btn btn--quiet hud-menu__item"
              type="button"
              onClick={() => {
                requestCamera(presetCamera(preset, useCameraStore.getState().selfCamera));
                setOpenMenu(null);
              }}
            >
              {VIEW_PRESET_LABELS[preset]}
            </button>
          ))}
          <button
            className="btn btn--quiet hud-menu__item"
            type="button"
            onClick={() => {
              requestReset();
              setOpenMenu(null);
            }}
          >
            {withShortcut(RESET_LABEL, keymap.viewReset)}
          </button>
          <button
            className="btn btn--quiet hud-menu__item"
            type="button"
            onClick={() => {
              requestFit();
              setOpenMenu(null);
            }}
          >
            {withShortcut(FIT_LABEL, keymap.viewFit)}
          </button>
        </HudMenu>
        <HudMenu
          id="light"
          open={openMenu === "light"}
          onToggle={() => setOpenMenu((open) => toggleHudMenu(open, "light"))}
          onClose={() => setOpenMenu(null)}
        >
          <button
            className="btn btn--quiet hud-menu__item"
            type="button"
            onClick={() => {
              resetLighting();
              setOpenMenu(null);
            }}
          >
            {LIGHT_RESET_LABEL}
          </button>
        </HudMenu>
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
