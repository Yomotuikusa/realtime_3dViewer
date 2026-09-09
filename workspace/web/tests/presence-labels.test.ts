import { describe, expect, it } from "vitest";
import {
  FOLLOW_LABEL,
  PRESENCE_HEADING,
  SELF_SUFFIX,
  UNFOLLOW_LABEL,
  presenceHeading,
} from "../src/features/presence/presence-labels";

describe("presence labels", () => {
  it("includes the participant count", () => {
    expect(PRESENCE_HEADING).toBe("参加者");
    expect(SELF_SUFFIX).toBe("あなた");
    expect(FOLLOW_LABEL).toBe("視点に入る");
    expect(UNFOLLOW_LABEL).toBe("追従を解除");
    expect(presenceHeading(0)).toBe("参加者 (0)");
    expect(presenceHeading(3)).toBe("参加者 (3)");
  });
});
