import { describe, expect, it } from "vitest";
import { ALLOWED_MODEL_EXTENSIONS } from "@shared/api";
import {
  APP_NAME,
  FILE_TOO_LARGE,
  MODEL_FILE_LABEL,
  MODEL_FILES_HELP_SUFFIX,
  NO_FILE_SELECTED,
  NOT_FOUND_HOME,
  NOT_FOUND_TITLE,
  OBJ_MATERIAL_NOTE,
  PROJECT_NAME_LABEL,
  SUBMIT_LABEL,
  SUBMITTING_LABEL,
  UNSUPPORTED_EXTENSION,
  UPLOAD_LEAD,
  fileHelp,
  fileSummary,
  filesSummary,
  validateModelFiles,
} from "../src/app/upload-labels";

describe("upload labels", () => {
  it("exposes the file size error", () => {
    expect(FILE_TOO_LARGE).toBe("ファイルサイズが上限を超えています。");
  });

  it("exposes the upload and not-found labels", () => {
    expect(APP_NAME).toBe("3D Reviewer");
    expect(UPLOAD_LEAD).toBe("glTF / GLB / FBX / OBJ をアップロードすると、共有用のレビュー URL が発行されます。");
    expect(PROJECT_NAME_LABEL).toBe("プロジェクト名");
    expect(MODEL_FILE_LABEL).toBe("モデルファイル");
    expect(MODEL_FILES_HELP_SUFFIX).toBe("複数選択できます");
    expect(SUBMIT_LABEL).toBe("レビューを開始");
    expect(SUBMITTING_LABEL).toBe("アップロード中…");
    expect(NOT_FOUND_TITLE).toBe("ページが見つかりません");
    expect(NOT_FOUND_HOME).toBe("アップロード画面へ");
  });

  it("exposes supported model formats and the OBJ material note", () => {
    expect(UNSUPPORTED_EXTENSION).toBe("対応しているモデル形式は .glb / .gltf / .fbx / .obj です。");
    expect(OBJ_MATERIAL_NOTE).toBe("OBJ は材質ファイル(.mtl)を読み込まないため、単色で表示されます。");
    expect(ALLOWED_MODEL_EXTENSIONS.join(",")).toBe(".glb,.gltf,.fbx,.obj");
    expect(fileHelp(ALLOWED_MODEL_EXTENSIONS, 100 * 1024 * 1024))
      .toBe(".glb / .gltf / .fbx / .obj、100 MB まで");
  });

  it("describes supported extensions and upload size", () => {
    expect(fileHelp([".glb", ".gltf"], 100 * 1024 * 1024)).toBe(".glb / .gltf、100 MB まで");
    expect(fileHelp([".glb"], 50 * 1024 * 1024)).toBe(".glb、50 MB まで");
  });

  it("summarizes selected files in binary units", () => {
    expect(fileSummary("a.glb", 12.3 * 1024 * 1024)).toBe("a.glb(12.3 MB)");
    expect(fileSummary("a.glb", 512 * 1024)).toBe("a.glb(512.0 KB)");
    expect(filesSummary([{ name: "a.glb", size: 1536 }])).toBe(fileSummary("a.glb", 1536));
    expect(filesSummary([
      { name: "a.glb", size: 1024 * 1024 },
      { name: "b.gltf", size: 2 * 1024 * 1024 },
    ])).toBe("2 ファイル(合計 3.0 MB)");
    expect(filesSummary([
      { name: "a.glb", size: 512 },
      { name: "b.gltf", size: 512 },
    ])).toBe("2 ファイル(合計 1.0 KB)");
  });

  it("validates selected model files in the required order", () => {
    const extensions = [".glb", ".gltf"];
    const maxBytes = 100 * 1024 * 1024;

    expect(validateModelFiles([], extensions, maxBytes)).toBe(NO_FILE_SELECTED);
    expect(validateModelFiles([{ name: "a.glb", size: 1 }, { name: "b.txt", size: 1 }], extensions, maxBytes))
      .toBe(UNSUPPORTED_EXTENSION);
    expect(validateModelFiles([{ name: "A.GLB", size: 1 }], extensions, maxBytes)).toBeNull();
    expect(validateModelFiles([
      { name: "a.glb", size: 60 * 1024 * 1024 },
      { name: "b.gltf", size: 60 * 1024 * 1024 },
    ], extensions, maxBytes)).toBe(FILE_TOO_LARGE);
    expect(validateModelFiles([{ name: "a.glb", size: 60 * 1024 * 1024 }], extensions, maxBytes)).toBeNull();
    expect(validateModelFiles([
      { name: "a.txt", size: 60 * 1024 * 1024 },
      { name: "b.glb", size: 60 * 1024 * 1024 },
    ], extensions, maxBytes)).toBe(UNSUPPORTED_EXTENSION);

    expect(validateModelFiles([{ name: "a.fbx", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)).toBeNull();
    expect(validateModelFiles([{ name: "a.OBJ", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes)).toBeNull();
    expect(validateModelFiles([
      { name: "a.glb", size: 1 },
      { name: "b.fbx", size: 1 },
    ], ALLOWED_MODEL_EXTENSIONS, maxBytes)).toBeNull();
    expect(validateModelFiles([{ name: "a.stl", size: 1 }], ALLOWED_MODEL_EXTENSIONS, maxBytes))
      .toBe(UNSUPPORTED_EXTENSION);
    expect(validateModelFiles([{ name: "a.fbx", size: 101 * 1024 * 1024 }], ALLOWED_MODEL_EXTENSIONS, maxBytes))
      .toBe(FILE_TOO_LARGE);
  });
});
