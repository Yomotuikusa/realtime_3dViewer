import type { ReactElement } from "react";
import { usePlaybackStore } from "../../store/playback";
import { currentDuration } from "./playback";
import {
  CLIP_LABEL,
  PAUSE_LABEL,
  PLAYBACK_TIME_LABEL,
  PLAY_LABEL,
  playbackTimeText,
} from "./hud-labels";

/** アニメーションのクリップ選択・再生制御・シークを描画する HUD メニュー。 */
export function PlaybackMenu(): ReactElement {
  const clips = usePlaybackStore((state) => state.clips);
  const clipIndex = usePlaybackStore((state) => state.clipIndex);
  const playing = usePlaybackStore((state) => state.playing);
  const time = usePlaybackStore((state) => state.time);
  const selectClip = usePlaybackStore((state) => state.selectClip);
  const toggle = usePlaybackStore((state) => state.toggle);
  const seek = usePlaybackStore((state) => state.seek);
  const duration = currentDuration(clips, clipIndex);

  return (
    <>
      <div className="hud-menu__section">
        <div className="hud-playback" role="group" aria-label={CLIP_LABEL}>
          <label htmlFor="hud-playback-clip">{CLIP_LABEL}</label>
          <select
            id="hud-playback-clip"
            className="input hud-playback__clip"
            value={clipIndex}
            onChange={(event) => selectClip(Number(event.target.value))}
          >
            {clips.map((clip, index) => <option key={index} value={index}>{clip.name}</option>)}
          </select>
        </div>
      </div>
      <div className="hud-menu__section">
        <div className="hud-playback" role="group" aria-label={PLAYBACK_TIME_LABEL}>
          <div className="hud-playback__head">
            <button className="btn hud-playback__toggle" type="button" onClick={toggle}>
              {playing ? PAUSE_LABEL : PLAY_LABEL}
            </button>
            <output className="hud-playback__time" htmlFor="hud-playback-time">
              {playbackTimeText(time, duration)}
            </output>
          </div>
          <input
            id="hud-playback-time"
            className="hud-playback__range"
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={time}
            aria-label={PLAYBACK_TIME_LABEL}
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>
      </div>
    </>
  );
}
