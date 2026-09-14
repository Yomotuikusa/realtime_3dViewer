import type { ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { switchPlaybackSource } from "../viewer/playback-source-sync";
import { usePlaybackSource } from "../viewer/usePlaybackSource";
import { SOURCE_LABEL } from "./timeline-labels";

export function PlaybackSourceSelect({ send }: { send: (msg: ClientMessage) => boolean }): ReactElement | null {
  const { sourceId, animated } = usePlaybackSource();
  if (animated.length < 2) return null;

  return (
    <select
      className="input timeline__source"
      aria-label={SOURCE_LABEL}
      title={SOURCE_LABEL}
      value={sourceId ?? ""}
      onChange={(event) => switchPlaybackSource(event.target.value, send)}
    >
      {animated.map((version) => <option key={version.id} value={version.id}>{version.fileName}</option>)}
    </select>
  );
}
