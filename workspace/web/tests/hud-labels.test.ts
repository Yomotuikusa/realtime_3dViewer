import { describe, expect, it } from "vitest";
import {
  CLEAR_LABEL,
  colorName,
  FIT_LABEL,
  followingLabel,
  hint,
  MODE_LABELS,
  MODE_ORDER,
  RESET_LABEL,
  UNDO_LABEL,
  UNFOLLOW_LABEL,
} from "../src/features/viewer/hud-labels";

describe("viewer HUD labels", () => {
  it("defines Japanese mode and action labels", () => {
    expect(MODE_LABELS).toEqual({ pen: "ペン", comment: "コメント" });
    expect(MODE_ORDER).toEqual(["pen", "comment"]);
    expect(RESET_LABEL).toBe("視点を戻す");
    expect(FIT_LABEL).toBe("全体を表示");
    expect(UNDO_LABEL).toBe("1本戻す");
    expect(CLEAR_LABEL).toBe("自分の線を消す");
    expect(UNFOLLOW_LABEL).toBe("追従を解除");
  });

  it("names the six stroke colors and preserves unknown colors", () => {
    expect(colorName("#ff0000")).toBe("赤");
    expect(colorName("#ff8800")).toBe("橙");
    expect(colorName("#00aa00")).toBe("緑");
    expect(colorName("#0088ff")).toBe("青");
    expect(colorName("#aa00ff")).toBe("紫");
    expect(colorName("#ff00aa")).toBe("桃");
    expect(colorName("#FF0000")).toBe("赤");
    expect(colorName("#123456")).toBe("#123456");
  });

  it("labels follow state with a fallback for a missing user", () => {
    expect(followingLabel("A")).toBe("A の視点を追従中");
    expect(followingLabel("")).toBe("他の参加者の視点を追従中");
  });

  it("prioritizes the follow hint", () => {
    expect(hint({ mode: "pen", canEdit: false, hasAnchor: true, following: true }))
      .toBe("操作すると追従が解除されます");
  });

  it("describes idle Maya-style camera controls", () => {
    expect(hint({ mode: "none", canEdit: false, hasAnchor: false, following: false }))
      .toBe("Alt+左ドラッグで回転、ホイールまたは Alt+右ドラッグで拡大縮小、Alt+中ドラッグで移動");
  });

  it("describes pen editing and disconnected pen state", () => {
    expect(hint({ mode: "pen", canEdit: true, hasAnchor: false, following: false }))
      .toBe("モデルの上をドラッグして線を描きます(Alt を押している間は視点操作になります)");
    expect(hint({ mode: "pen", canEdit: false, hasAnchor: false, following: false }))
      .toBe("接続が切れているため線を描けません");
  });

  it("describes comment placement and composition", () => {
    expect(hint({ mode: "comment", canEdit: true, hasAnchor: false, following: false }))
      .toBe("モデルをクリックしてコメントの位置を決めます");
    expect(hint({ mode: "comment", canEdit: true, hasAnchor: true, following: false }))
      .toBe("右のパネルで本文を入力してください");
  });
});
