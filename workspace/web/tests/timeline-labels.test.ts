import { describe, expect, it } from "vitest";
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
  TIMELINE_RESIZE_LABEL,
  TRANSPORT_LABEL,
  frameText,
} from "../src/features/timeline/timeline-labels";

describe("timeline labels", () => {
  it("defines the timeline controls in Japanese", () => {
    expect(TIMELINE_LABEL).toBe("タイムライン");
    expect(TRANSPORT_LABEL).toBe("再生操作");
    expect(PLAY_LABEL).toBe("再生");
    expect(PAUSE_LABEL).toBe("一時停止");
    expect(GO_TO_START_LABEL).toBe("先頭へ");
    expect(GO_TO_END_LABEL).toBe("最終へ");
    expect(CLIP_LABEL).toBe("クリップ");
    expect(FRAME_LABEL).toBe("フレーム");
    expect(FPS_LABEL).toBe("fps");
    expect(TIMELINE_RESIZE_LABEL).toBe("タイムラインの高さ");
  });

  it("formats frame values", () => {
    expect(frameText(12, 48)).toBe("12 / 48");
    expect(frameText(0, 0)).toBe("0 / 0");
    expect(lastFrameText(48)).toBe("/ 48");
  });
});
