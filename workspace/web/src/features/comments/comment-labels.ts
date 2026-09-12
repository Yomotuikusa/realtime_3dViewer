import type { CommentPlayback, CommentStatus } from "@shared/types";

export const COMMENTS_HEADING = "コメント";
export const FILTER_OPEN_ONLY = "未解決のみ";
export const COMPOSER_TITLE = "この位置にコメント";
export const COMPOSER_BODY_LABEL = "本文";
export const SUBMIT_LABEL = "投稿する";
export const CANCEL_LABEL = "キャンセル";
export const EMPTY_MESSAGE = "コメントはまだありません。「コメント」モードでモデルをクリックすると投稿できます。";
export const EMPTY_FILTERED_MESSAGE = "未解決のコメントはありません。";
export const RECORD_FRAME_LABEL = "フレームを記録";

export function recordFrameLabel(frame: number): string {
  return `フレーム ${frame} を記録`;
}

export function playbackBadge(playback: CommentPlayback): string {
  return `F ${playback.frame}`;
}

export function playbackTitle(playback: CommentPlayback): string {
  return `クリップ ${playback.clipIndex + 1} / フレーム ${playback.frame}`;
}

export function commentsHeading(count: number): string {
  return `${COMMENTS_HEADING} (${count})`;
}

export function statusLabel(status: CommentStatus): string {
  return status === "open" ? "未解決" : "解決済み";
}

export function statusTone(status: CommentStatus): "warning" | "success" {
  return status === "open" ? "warning" : "success";
}

export function toggleStatusLabel(status: CommentStatus): string {
  return status === "open" ? "解決にする" : "再開する";
}

export function pinLabel(authorName: string): string {
  return `${authorName} のコメント`;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function dateParts(value: number, timeZone?: string): DateParts {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    ...(timeZone === undefined ? {} : { timeZone }),
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = new Map(formatter.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    hour: Number(parts.get("hour")),
    minute: Number(parts.get("minute")),
  };
}

function clock(parts: DateParts): string {
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatCommentTime(createdAt: number, now: number, timeZone?: string): string {
  const created = dateParts(createdAt, timeZone);
  const current = dateParts(now, timeZone);
  if (created.year === current.year && created.month === current.month && created.day === current.day) {
    return clock(created);
  }
  if (created.year === current.year) {
    return `${created.month}/${created.day} ${clock(created)}`;
  }
  return `${created.year}/${created.month}/${created.day}`;
}
