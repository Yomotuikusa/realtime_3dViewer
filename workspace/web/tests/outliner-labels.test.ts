import { describe, expect, it } from "vitest";
import {
  expandAriaLabel,
  KIND_LABELS,
  nodeLabel,
  OUTLINER_EMPTY,
  OUTLINER_HEADING,
  OUTLINER_LOADING,
  OUTLINER_RESIZE_LABEL,
  UNNAMED_LABEL,
} from "../src/features/outliner/outliner-labels";

describe("outliner labels", () => {
  it("exports the contracted labels", () => {
    expect(OUTLINER_HEADING).toBe("アウトライナ");
    expect(OUTLINER_RESIZE_LABEL).toBe("アウトライナの幅");
    expect(OUTLINER_EMPTY).toBe("オブジェクトがありません");
    expect(OUTLINER_LOADING).toBe("読み込み中…");
    expect(UNNAMED_LABEL).toBe("(名前なし)");
    expect(Object.keys(KIND_LABELS).sort()).toEqual(["bone", "camera", "curve", "group", "light", "mesh", "points"]);
    expect(KIND_LABELS).toEqual({ mesh: "メッシュ", curve: "カーブ", points: "ポイント", bone: "ボーン", light: "ライト", camera: "カメラ", group: "グループ" });
  });

  it("normalizes names and creates expand labels", () => {
    expect(nodeLabel("Body")).toBe("Body");
    expect(nodeLabel("  Body ")).toBe("Body");
    expect(nodeLabel("")).toBe(UNNAMED_LABEL);
    expect(nodeLabel("   ")).toBe(UNNAMED_LABEL);
    expect(expandAriaLabel("Body", false)).toBe("Body を展開");
    expect(expandAriaLabel("Body", true)).toBe("Body を折りたたむ");
  });
});
