import type { ReactElement } from "react";
import { ChevronIcon } from "./review-icons";

/**
 * どちらのドックか。outliner = 左、panel = 右。
 * 値に "start" / "end" を使わないのは、`ReviewPage.tsx` の `side="start"` を
 * 1 件だけ要求する既存検査(前提に記載)を壊さないためである。
 */
export type DockSide = "outliner" | "panel";

/**
 * ドック上部に置く折りたたみバー。ボタンはビューア側の端に寄せる(CSS 側で制御)。
 * シェブロンは畳む向き: outliner は左、panel は右。
 */
export function DockCollapseBar({ side, label, onCollapse }: {
  side: DockSide;
  label: string;
  onCollapse: () => void;
}): ReactElement {
  return (
    <div className="review-dock-bar" data-side={side}>
      <button
        className="btn btn--quiet review-dock-bar__button"
        type="button"
        aria-expanded={true}
        aria-label={label}
        onClick={onCollapse}
      >
        <ChevronIcon direction={side === "outliner" ? "left" : "right"} />
      </button>
    </div>
  );
}

/** 閉じている間だけ HUD に出す再表示ボタン。シェブロンは開く向き: outliner は右、panel は左。 */
export function DockExpandButton({ side, label, onExpand }: {
  side: DockSide;
  label: string;
  onExpand: () => void;
}): ReactElement {
  return (
    <button
      className="btn review-dock-expand"
      type="button"
      data-side={side}
      aria-expanded={false}
      aria-label={label}
      onClick={onExpand}
    >
      <ChevronIcon direction={side === "outliner" ? "right" : "left"} />
    </button>
  );
}
