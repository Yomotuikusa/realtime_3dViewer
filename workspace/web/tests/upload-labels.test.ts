import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  FILE_TOO_LARGE,
  MODEL_FILE_LABEL,
  NOT_FOUND_HOME,
  NOT_FOUND_TITLE,
  PROJECT_NAME_LABEL,
  SUBMIT_LABEL,
  SUBMITTING_LABEL,
  UPLOAD_LEAD,
  fileHelp,
  fileSummary,
} from "../src/app/upload-labels";

describe("upload labels", () => {
  it("exposes the file size error", () => {
    expect(FILE_TOO_LARGE).toBe("ファイルサイズが上限を超えています。");
  });

  it("exposes the upload and not-found labels", () => {
    expect(APP_NAME).toBe("3D Reviewer");
    expect(UPLOAD_LEAD).toBe("glTF / GLB をアップロードすると、共有用のレビュー URL が発行されます。");
    expect(PROJECT_NAME_LABEL).toBe("プロジェクト名");
    expect(MODEL_FILE_LABEL).toBe("モデルファイル");
    expect(SUBMIT_LABEL).toBe("レビューを開始");
    expect(SUBMITTING_LABEL).toBe("アップロード中…");
    expect(NOT_FOUND_TITLE).toBe("ページが見つかりません");
    expect(NOT_FOUND_HOME).toBe("アップロード画面へ");
  });

  it("describes supported extensions and upload size", () => {
    expect(fileHelp([".glb", ".gltf"], 100 * 1024 * 1024)).toBe(".glb / .gltf、100 MB まで");
    expect(fileHelp([".glb"], 50 * 1024 * 1024)).toBe(".glb、50 MB まで");
  });

  it("summarizes selected files in binary units", () => {
    expect(fileSummary("a.glb", 12.3 * 1024 * 1024)).toBe("a.glb(12.3 MB)");
    expect(fileSummary("a.glb", 512 * 1024)).toBe("a.glb(512.0 KB)");
  });
});
