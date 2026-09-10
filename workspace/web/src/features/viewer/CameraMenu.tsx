import type { ReactElement } from "react";
import { useCameraStore } from "../../store/camera";
import { useShortcutsStore } from "../../store/shortcuts";
import { FocalLengthSlider } from "./FocalLengthSlider";
import {
  FIT_LABEL,
  FIT_SHORT_LABEL,
  RESET_LABEL,
  VIEW_PRESETS_LABEL,
  VIEW_PRESET_LABELS,
  withShortcut,
} from "./hud-labels";
import {
  presetCamera,
  VIEW_CROSS_CENTER,
  VIEW_PRESET_CELLS,
  VIEW_PRESET_ORDER,
} from "./view-presets";

export interface CameraMenuProps {
  /** ボタン操作後にメニューを閉じる。 */
  onClose: () => void;
}

/**
 * カメラメニューの中身。3つの .hud-menu__section を上から
 * 1. <FocalLengthSlider />
 * 2. 十字の視点ボタン(role="group" aria-label={VIEW_PRESETS_LABEL})
 * 3. 視点リセット
 * の順に描き、各 section の境界を区切り線で示す。
 */
export function CameraMenu({ onClose }: CameraMenuProps): ReactElement {
  const requestReset = useCameraStore((state) => state.requestReset);
  const requestFit = useCameraStore((state) => state.requestFit);
  const requestCamera = useCameraStore((state) => state.requestCamera);
  const keymap = useShortcutsStore((state) => state.keymap);

  return (
    <>
      <div className="hud-menu__section">
        <FocalLengthSlider />
      </div>
      <div className="hud-menu__section hud-views" role="group" aria-label={VIEW_PRESETS_LABEL}>
        {VIEW_PRESET_ORDER.map((preset) => {
          const cell = VIEW_PRESET_CELLS[preset];
          return (
            <button
              key={preset}
              className="btn btn--quiet hud-menu__item hud-view"
              type="button"
              style={{ gridRow: cell.row, gridColumn: cell.column }}
              onClick={() => {
                requestCamera(presetCamera(preset, useCameraStore.getState().selfCamera));
                onClose();
              }}
            >
              {VIEW_PRESET_LABELS[preset]}
            </button>
          );
        })}
        <button
          className="btn btn--quiet hud-menu__item hud-view"
          type="button"
          style={{ gridRow: VIEW_CROSS_CENTER.row, gridColumn: VIEW_CROSS_CENTER.column }}
          aria-label={withShortcut(FIT_LABEL, keymap.viewFit)}
          title={withShortcut(FIT_LABEL, keymap.viewFit)}
          onClick={() => {
            requestFit();
            onClose();
          }}
        >
          {FIT_SHORT_LABEL}
        </button>
      </div>
      <div className="hud-menu__section">
        <button
          className="btn btn--quiet hud-menu__item"
          type="button"
          onClick={() => {
            requestReset();
            onClose();
          }}
        >
          {withShortcut(RESET_LABEL, keymap.viewReset)}
        </button>
      </div>
    </>
  );
}
