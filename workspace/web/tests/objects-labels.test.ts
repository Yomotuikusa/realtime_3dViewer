import { describe, expect, it } from "vitest";
import {
  ADD_FAILED,
  ADD_FILES_LABEL,
  ADDING_LABEL,
  HIDDEN_LABEL,
  OBJECTS_HEADING,
  VISIBLE_LABEL,
  objectsHeading,
  toggleAriaLabel,
  versionTag,
} from "../src/features/objects/objects-labels";

describe("objects labels", () => {
  it("exposes the fixed labels", () => {
    expect(OBJECTS_HEADING).toBe("オブジェクト");
    expect(VISIBLE_LABEL).toBe("表示中");
    expect(HIDDEN_LABEL).toBe("非表示");
    expect(ADD_FILES_LABEL).toBe("ファイルを追加");
    expect(ADDING_LABEL).toBe("追加中…");
    expect(ADD_FAILED).toBe("ファイルの追加に失敗しました。");
  });

  it("formats headings, version tags, and toggle labels", () => {
    expect(objectsHeading(2)).toBe("オブジェクト (2)");
    expect(versionTag({ number: 3 })).toBe("v3");
    expect(toggleAriaLabel({ fileName: "a.glb" })).toBe("a.glb の表示を切り替え");
  });
});
