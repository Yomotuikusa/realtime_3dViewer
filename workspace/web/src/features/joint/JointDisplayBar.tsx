import type { ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { jointDisplayEquals } from "@shared/joint";
import type { JointDisplay } from "@shared/types";
import { useDisplayStore } from "../../store/display";
import { JointIcon, JointXrayIcon } from "./joint-icons";
import { JOINT_DISPLAY_LABEL, JOINT_VISIBLE_LABEL, JOINT_XRAY_LABEL } from "./joint-labels";

export function JointDisplayBar({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement {
  const jointDisplay = useDisplayStore((state) => state.jointDisplay);
  const setJointDisplay = useDisplayStore((state) => state.setJointDisplay);

  function applyDisplay(next: JointDisplay): void {
    if (jointDisplayEquals(jointDisplay, next)) return;
    setJointDisplay(next);
    send({ type: "joint:display", display: next });
  }

  return (
    <div className="hud-display" role="group" aria-label={JOINT_DISPLAY_LABEL}>
      <button
        className="btn hud-display__btn"
        type="button"
        aria-pressed={jointDisplay.visible}
        aria-label={JOINT_VISIBLE_LABEL}
        title={JOINT_VISIBLE_LABEL}
        onClick={() => applyDisplay({ ...jointDisplay, visible: !jointDisplay.visible })}
      >
        <JointIcon />
      </button>
      <button
        className="btn hud-display__btn"
        type="button"
        aria-pressed={jointDisplay.xray}
        aria-label={JOINT_XRAY_LABEL}
        title={JOINT_XRAY_LABEL}
        disabled={!jointDisplay.visible}
        onClick={() => applyDisplay({ ...jointDisplay, xray: !jointDisplay.xray })}
      >
        <JointXrayIcon />
      </button>
    </div>
  );
}
