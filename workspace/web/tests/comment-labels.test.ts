import { describe, expect, it } from "vitest";
import {
  CANCEL_LABEL,
  commentsHeading,
  COMMENTS_HEADING,
  COMPOSER_BODY_LABEL,
  COMPOSER_TITLE,
  EMPTY_FILTERED_MESSAGE,
  EMPTY_MESSAGE,
  FILTER_OPEN_ONLY,
  formatCommentTime,
  pinLabel,
  SUBMIT_LABEL,
  statusLabel,
  statusTone,
  toggleStatusLabel,
} from "../src/features/comments/comment-labels";

describe("comment labels", () => {
  it("labels counts, status, pins, and status actions", () => {
    expect(COMMENTS_HEADING).toBe("コメント");
    expect(FILTER_OPEN_ONLY).toBe("未解決のみ");
    expect(COMPOSER_TITLE).toBe("この位置にコメント");
    expect(COMPOSER_BODY_LABEL).toBe("本文");
    expect(SUBMIT_LABEL).toBe("投稿する");
    expect(CANCEL_LABEL).toBe("キャンセル");
    expect(EMPTY_MESSAGE).toBe("コメントはまだありません。「コメント」モードでモデルをクリックすると投稿できます。");
    expect(EMPTY_FILTERED_MESSAGE).toBe("未解決のコメントはありません。");
    expect(commentsHeading(5)).toBe("コメント (5)");
    expect(statusLabel("open")).toBe("未解決");
    expect(statusLabel("resolved")).toBe("解決済み");
    expect(statusTone("open")).toBe("warning");
    expect(statusTone("resolved")).toBe("success");
    expect(toggleStatusLabel("open")).toBe("解決にする");
    expect(toggleStatusLabel("resolved")).toBe("再開する");
    expect(pinLabel("A")).toBe("A のコメント");
  });

  it("formats same-day and same-year timestamps in UTC", () => {
    const now = Date.UTC(2024, 2, 7, 10, 30);
    expect(formatCommentTime(Date.UTC(2024, 2, 7, 9, 5), now, "UTC")).toBe("09:05");
    expect(formatCommentTime(Date.UTC(2024, 2, 6, 9, 5), now, "UTC")).toBe("3/6 09:05");
    expect(formatCommentTime(Date.UTC(2023, 2, 6, 9, 5), now, "UTC")).toBe("2023/3/6");
  });

  it("formats local time without requiring a timezone", () => {
    expect(formatCommentTime(0, 60_000)).toMatch(
      /^\d{2}:\d{2}$|^\d{1,2}\/\d{1,2} \d{2}:\d{2}$|^\d{4}\/\d{1,2}\/\d{1,2}$/,
    );
  });
});
