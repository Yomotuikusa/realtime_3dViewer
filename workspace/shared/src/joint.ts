import type { JointDisplay } from "./types";

/** 2フィールドすべて === で等しいとき true */
export function jointDisplayEquals(a: JointDisplay, b: JointDisplay): boolean {
  return a.visible === b.visible && a.xray === b.xray;
}

/** 浅い複製(フィールドはプリミティブなので浅くてよい) */
export function cloneJointDisplay(display: JointDisplay): JointDisplay {
  return { ...display };
}
