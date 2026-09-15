import { describe, expect, it } from "vitest";
import {
  ADD_FAILED,
  ADD_FILES_LABEL,
  ADDING_LABEL,
  COMPARE_BASE_LABEL,
  COMPARE_HEADING,
  COMPARE_LEGEND,
  COMPARE_NONE_LABEL,
  COMPARE_TARGET_LABEL,
  COMPARE_THRESHOLD_LABEL,
  HIDDEN_LABEL,
  OBJECTS_HEADING,
  VISIBLE_LABEL,
  compareOptionLabel,
  objectsHeading,
  thresholdPermilleText,
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
    expect(COMPARE_HEADING).toBe("比較");
    expect(COMPARE_BASE_LABEL).toBe("基準");
    expect(COMPARE_TARGET_LABEL).toBe("対象");
    expect(COMPARE_NONE_LABEL).toBe("なし");
    expect(COMPARE_THRESHOLD_LABEL).toBe("しきい値");
    expect(COMPARE_LEGEND).toBe("赤: 対象が基準から飛び出し / 青: へこみ");
  });

  it("formats headings, version tags, and toggle labels", () => {
    expect(objectsHeading(2)).toBe("オブジェクト (2)");
    expect(versionTag({ number: 3 })).toBe("v3");
    expect(toggleAriaLabel({ fileName: "a.glb" })).toBe("a.glb の表示を切り替え");
    expect(compareOptionLabel({ number: 2, fileName: "two.glb" })).toBe("v2 · two.glb");
    expect(thresholdPermilleText(5)).toBe("0.5%");
    expect(thresholdPermilleText(12)).toBe("1.2%");
    expect(thresholdPermilleText(50)).toBe("5.0%");
    expect(thresholdPermilleText(1)).toBe("0.1%");
    expect(thresholdPermilleText(0)).toBe("0.0%");
  });
});
