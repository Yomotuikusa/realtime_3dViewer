export const TIMELINE_PAD_PX = 8;
export const MIN_LABEL_PX = 48;
export const MIN_TICK_PX = 5;
export const STEP_SERIES: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
export const FPS_OPTIONS: readonly number[] = [12, 15, 24, 25, 30, 48, 50, 60, 120];

export interface TimelineTicks {
  labelStep: number;
  tickStep: number;
}

export function timelineTicks(lastFrame: number, widthPx: number): TimelineTicks {
  const innerWidth = widthPx - 2 * TIMELINE_PAD_PX;
  if (!Number.isFinite(lastFrame) || lastFrame <= 0 || !Number.isFinite(innerWidth) || innerWidth <= 0) {
    return { labelStep: 1, tickStep: 1 };
  }
  const pxPerFrame = innerWidth / lastFrame;
  const labelStep = STEP_SERIES.find((step) => step * pxPerFrame >= MIN_LABEL_PX)
    ?? STEP_SERIES[STEP_SERIES.length - 1]!;
  if (labelStep < 10) return { labelStep, tickStep: 1 };
  const tickStep = [labelStep / 10, labelStep / 5, labelStep]
    .find((step) => step * pxPerFrame >= MIN_TICK_PX) ?? labelStep;
  return { labelStep, tickStep };
}

export function tickFrames(lastFrame: number, step: number): number[] {
  if (!Number.isFinite(lastFrame) || !Number.isFinite(step) || step <= 0 || lastFrame < 0) return [0];
  const frames: number[] = [];
  for (let frame = 0; frame <= lastFrame; frame += step) frames.push(frame);
  return frames;
}

export function frameToX(frame: number, lastFrame: number, widthPx: number): number {
  if (lastFrame <= 0) return TIMELINE_PAD_PX;
  return TIMELINE_PAD_PX + (frame / lastFrame) * (widthPx - 2 * TIMELINE_PAD_PX);
}

export function frameAtX(x: number, lastFrame: number, widthPx: number): number {
  const innerWidth = widthPx - 2 * TIMELINE_PAD_PX;
  if (!Number.isFinite(x) || !Number.isFinite(lastFrame) || lastFrame <= 0 || innerWidth <= 0) return 0;
  const frame = Math.round(((x - TIMELINE_PAD_PX) / innerWidth) * lastFrame);
  return Math.min(lastFrame, Math.max(0, frame));
}

export function timelineKeyFrame(key: string, frame: number, lastFrame: number): number | null {
  if (!Number.isFinite(lastFrame) || lastFrame < 0 || !Number.isFinite(frame)) return null;
  const next = key === "ArrowLeft" || key === "ArrowDown"
    ? frame - 1
    : key === "ArrowRight" || key === "ArrowUp"
      ? frame + 1
      : key === "Home"
        ? 0
        : key === "End"
          ? lastFrame
          : null;
  return next === null ? null : Math.min(lastFrame, Math.max(0, next));
}

export function fpsOptions(fps: number): number[] {
  const values = new Set(FPS_OPTIONS);
  if (Number.isFinite(fps)) values.add(fps);
  return [...values].sort((left, right) => left - right);
}
