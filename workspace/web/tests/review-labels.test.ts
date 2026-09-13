import { describe, expect, it, vi } from "vitest";
import {
  connectionLabel,
  connectionTone,
  copyLabel,
  copyText,
  LOADING_MESSAGE,
  MODEL_LOAD_FAILED,
  PANEL_RESIZE_LABEL,
  PROJECT_LOAD_FAILED,
  RELOAD_LABEL,
  CLOSE_LABEL,
  SETTINGS_DIALOG_TITLE,
  SETTINGS_OPEN_LABEL,
  SETTINGS_TAB_ORDER,
  SETTINGS_TABS_LABEL,
} from "../src/app/review-labels";

describe("review labels", () => {
  it("labels an unjoined session independently of connection status", () => {
    expect(connectionLabel("closed", false)).toBe("未入室");
    expect(connectionLabel("open", false)).toBe("未入室");
    expect(connectionLabel("connecting", false)).toBe("未入室");
    expect(connectionTone("closed", false)).toBe("neutral");
    expect(connectionTone("open", false)).toBe("neutral");
    expect(connectionTone("connecting", false)).toBe("neutral");
  });

  it("labels joined connection states", () => {
    expect(connectionLabel("open", true)).toBe("接続中");
    expect(connectionLabel("connecting", true)).toBe("再接続中…");
    expect(connectionLabel("closed", true)).toBe("切断");
    expect(connectionTone("open", true)).toBe("success");
    expect(connectionTone("connecting", true)).toBe("warning");
    expect(connectionTone("closed", true)).toBe("danger");
  });

  it("labels copy states", () => {
    expect(copyLabel("idle")).toBe("URL をコピー");
    expect(copyLabel("copied")).toBe("コピーしました");
    expect(copyLabel("failed")).toBe("コピーできません。下の URL を選択してください");
  });

  it("copies text and converts unavailable or rejected clipboard APIs to failure", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    expect(await copyText("u", { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("u");
    expect(await copyText("u", {
      writeText: async () => {
        throw new Error("denied");
      },
    })).toBe("failed");
    expect(await copyText("u", undefined)).toBe("failed");
  });

  it("exposes review loading and error copy", () => {
    expect(LOADING_MESSAGE).toBe("プロジェクトを読み込んでいます…");
    expect(PROJECT_LOAD_FAILED).toBe("プロジェクトの取得に失敗しました。");
    expect(MODEL_LOAD_FAILED).toBe("モデルの読み込みに失敗しました。");
    expect(RELOAD_LABEL).toBe("再読み込み");
    expect(PANEL_RESIZE_LABEL).toBe("サイドパネルの幅");
  });

  it("exposes settings dialog labels and tab order", () => {
    expect(SETTINGS_OPEN_LABEL).toBe("設定");
    expect(CLOSE_LABEL).not.toBe("");
    expect(SETTINGS_DIALOG_TITLE).not.toBe("");
    expect(SETTINGS_TABS_LABEL).not.toBe("");
    expect(SETTINGS_TAB_ORDER).toEqual(["shortcuts", "theme"]);
  });
});
