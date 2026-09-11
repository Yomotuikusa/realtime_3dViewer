import type { ReactElement } from "react";
import { usePlaybackStore } from "../../store/playback";
import { currentDuration } from "../viewer/playback";
import { frameOfTime, lastFrameOf } from "../viewer/playback-frames";
import { TimelineRuler } from "./TimelineRuler";
import { PauseIcon, PlayIcon, SkipEndIcon, SkipStartIcon } from "./transport-icons";
import {
  CLIP_LABEL,
  FRAME_LABEL,
  FPS_LABEL,
  GO_TO_END_LABEL,
  GO_TO_START_LABEL,
  lastFrameText,
  PAUSE_LABEL,
  PLAY_LABEL,
  TIMELINE_LABEL,
  TRANSPORT_LABEL,
} from "./timeline-labels";
import { fpsOptions } from "./timeline";
import "./timeline.css";

export function PlaybackTimeline(): ReactElement | null {
  const clips = usePlaybackStore((state) => state.clips);
  const clipIndex = usePlaybackStore((state) => state.clipIndex);
  const playing = usePlaybackStore((state) => state.playing);
  const time = usePlaybackStore((state) => state.time);
  const fps = usePlaybackStore((state) => state.fps);
  const selectClip = usePlaybackStore((state) => state.selectClip);
  const toggle = usePlaybackStore((state) => state.toggle);
  const seekFrame = usePlaybackStore((state) => state.seekFrame);
  const setFps = usePlaybackStore((state) => state.setFps);
  if (clips.length === 0) return null;

  const lastFrame = lastFrameOf(currentDuration(clips, clipIndex), fps);
  const frame = frameOfTime(time, fps);
  return (
    <div className="timeline" role="region" aria-label={TIMELINE_LABEL}>
      <TimelineRuler frame={frame} lastFrame={lastFrame} onSeek={seekFrame} />
      <div className="timeline__controls">
        <select className="input timeline__clip" aria-label={CLIP_LABEL} title={CLIP_LABEL} value={clipIndex} onChange={(event) => selectClip(Number(event.target.value))}>
          {clips.map((clip, index) => <option key={index} value={index}>{clip.name}</option>)}
        </select>
        <div className="timeline__transport" role="group" aria-label={TRANSPORT_LABEL}>
          <button className="btn timeline__btn" type="button" aria-label={GO_TO_START_LABEL} title={GO_TO_START_LABEL} onClick={() => seekFrame(0)}><SkipStartIcon /></button>
          <button className="btn timeline__btn" type="button" aria-label={playing ? PAUSE_LABEL : PLAY_LABEL} title={playing ? PAUSE_LABEL : PLAY_LABEL} onClick={toggle}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
          <button className="btn timeline__btn" type="button" aria-label={GO_TO_END_LABEL} title={GO_TO_END_LABEL} onClick={() => seekFrame(lastFrame)}><SkipEndIcon /></button>
        </div>
        <label className="timeline__field">
          <span>{FRAME_LABEL}</span>
          <input className="input timeline__frame" type="number" min={0} max={lastFrame} step={1} value={frame} onChange={(event) => seekFrame(Number(event.target.value))} />
          <output className="timeline__last">{lastFrameText(lastFrame)}</output>
        </label>
        <label className="timeline__field">
          <span>{FPS_LABEL}</span>
          <select className="input timeline__fps" value={fps} onChange={(event) => setFps(Number(event.target.value))}>
            {fpsOptions(fps).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
