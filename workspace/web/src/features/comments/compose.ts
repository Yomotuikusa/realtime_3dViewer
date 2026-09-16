import { cloneCamera } from "@shared/camera";
import type { CreateCommentInput } from "@shared/api";
import { MAX_COMMENT_STROKES } from "@shared/types";
import type { CameraState, CommentPlayback, Stroke, Vec3 } from "@shared/types";
import { frameOfTime } from "../viewer/playback-frames";
import type { PlaybackClip } from "../viewer/playback";

/** クリック判定に使う移動量の上限(px) */
export const CLICK_MOVE_THRESHOLD_PX = 5;

/** down と up の距離が閾値以下ならクリックと判定する。 */
export function isClick(
  down: { x: number; y: number },
  up: { x: number; y: number },
): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_MOVE_THRESHOLD_PX;
}

function compareStrokes(left: Stroke, right: Stroke): number {
  return left.createdAt - right.createdAt
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

/** 自分の線を時系列順にし、コメントに含める最新 MAX_COMMENT_STROKES 本だけを返す。 */
export function ownStrokesForComment(
  strokes: Record<string, Stroke>,
  userId: string | null,
): Stroke[] {
  if (userId === null) {
    return [];
  }
  const ownStrokes = Object.values(strokes)
    .filter((stroke) => stroke.userId === userId)
    .sort(compareStrokes);
  return ownStrokes.length <= MAX_COMMENT_STROKES
    ? ownStrokes
    : ownStrokes.slice(-MAX_COMMENT_STROKES);
}

/** 投稿に載せる再生位置。スイッチ OFF またはクリップ無しなら null。 */
export function commentPlaybackOf(
  playback: {
    clips: readonly PlaybackClip[];
    clipIndex: number;
    time: number;
    fps: number;
    sourceId: string | null;
  },
  recordFrame: boolean,
): CommentPlayback | null {
  if (!recordFrame || playback.clips.length === 0) {
    return null;
  }
  const recorded: CommentPlayback = {
    clipIndex: playback.clipIndex,
    frame: frameOfTime(playback.time, playback.fps),
  };
  if (playback.sourceId !== null) {
    recorded.versionId = playback.sourceId;
  }
  return recorded;
}

/** コメント投稿用の入力を組み立てる。本文が空の場合は null を返す。 */
export function buildCommentInput(args: {
  versionId: string;
  authorName: string;
  body: string;
  anchor: Vec3;
  camera: CameraState;
  strokes: Record<string, Stroke>;
  userId: string | null;
  playback: CommentPlayback | null;
}): CreateCommentInput | null {
  const body = args.body.trim();
  if (body.length === 0) {
    return null;
  }
  return {
    versionId: args.versionId,
    authorName: args.authorName,
    body,
    anchor: [...args.anchor],
    camera: cloneCamera(args.camera),
    strokes: ownStrokesForComment(args.strokes, args.userId),
    playback: args.playback,
  };
}
