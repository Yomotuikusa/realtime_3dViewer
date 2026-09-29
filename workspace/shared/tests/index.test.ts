import { describe, expect, it } from "vitest";
import * as shared from "../src";

describe("shared public exports", () => {
  it("removes the scaffold export", () => {
    const scaffoldExport = ["SHARED", "SCAFFOLD"].join("_");
    expect(scaffoldExport in shared).toBe(false);
  });

  it("re-exports the shared public API", () => {
    const exportedNames = [
      "CameraStateSchema",
      "StrokeSchema",
      "CommentSchema",
      "ProjectSchema",
      "PresenceUserSchema",
      "ErrorCode",
      "CreateCommentInput",
      "ApiErrorSchema",
      "ClientMessageSchema",
      "ServerMessageSchema",
      "parseClientMessage",
      "parseServerMessage",
      "CAMERA_SEND_INTERVAL_MS",
      "DEFAULT_CAMERA",
      "lerpCamera",
      "cameraEquals",
      "cloneCamera",
      "simplify",
      "simplifyTolerance",
      "isSendableStroke",
    ] as const;

    for (const name of exportedNames) {
      expect(shared[name], `${name} should be exported`).not.toBeUndefined();
    }
  });
});
