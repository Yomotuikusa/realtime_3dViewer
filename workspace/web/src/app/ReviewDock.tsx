import type { ReactElement, ReactNode } from "react";
import { ChevronIcon } from "./review-icons";
import { dockRegionLabel } from "./review-labels";
import "./review-dock.css";

/**
 * どちらのドックか。outliner = 左、panel = 右。
 * 値に "start" / "end" を使わないのは、`ReviewPage.tsx` の `side="start"` を
 * 1 件だけ要求する既存検査(前提に記載)を壊さないためである。
 */
export type DockSide = "outliner" | "panel";

/**
 * ドック 1 列。閉じている間もアンマウントせず、列幅 0 と inert で畳む。
 * 内側の `.review-dock__inner` が開いていたときの幅を保つので、
 * 幅が 0 へ縮んでも中身は潰れずスライドして見える(アニメーションは 164)。
 */
export function DockColumn({ side, open, title, label, onToggle, children }: {
  side: DockSide;
  open: boolean;
  /** バーに出す可視タイトル。`<aside>` の aria-label にも使う。 */
  title: string;
  /** 折りたたみボタンの aria-label。 */
  label: string;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}): ReactElement {
  return (
    <aside
      className={side === "outliner" ? "review-outliner" : "review-panel"}
      data-open={open}
      aria-label={dockRegionLabel(title)}
      inert={!open}
    >
      <div className="review-dock__inner">
        <DockCollapseBar
          side={side}
          title={title}
          label={label}
          onCollapse={() => onToggle(false)}
        />
        {children}
      </div>
    </aside>
  );
}

/** ドック上部に置く折りたたみバー。矢印はビューア側の端に置き、畳む向きを指す。 */
export function DockCollapseBar({ side, title, label, onCollapse }: {
  side: DockSide;
  title: string;
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
        <span className="review-dock-bar__title">{title}</span>
        <ChevronIcon direction={side === "outliner" ? "left" : "right"} />
      </button>
    </div>
  );
}

/** 閉じている間だけ HUD に出す再表示ボタン。現行のまま変更しない。 */
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
