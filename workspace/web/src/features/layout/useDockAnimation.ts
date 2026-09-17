import { useCallback, useEffect, useRef, useState } from "react";

/** 列幅を補間する時間(ms)。tokens.css の --duration-medium と揃える。 */
export const DOCK_ANIMATION_MS = 200;
/** フラグを落とすまでの待ち。補間の終端で transition が外れて跳ねないよう少し長く取る。 */
export const DOCK_ANIMATION_RELEASE_MS = DOCK_ANIMATION_MS + 60;

/**
 * ドック開閉の直後だけ true を返すフック。true の間だけ列幅に transition を掛け、
 * リサイズのドラッグやキー操作では補間しない。
 * toggle は開閉フラグのセッタと次の値を受け取り、アニメーションを始めてから値を変える。
 * 続けて呼ぶと待ちは延長される。アンマウント時にタイマーを片付ける。
 */
export function useDockAnimation(): readonly [
  animating: boolean,
  toggle: (setOpen: (open: boolean) => void, open: boolean) => void,
] {
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const toggle = useCallback((setOpen: (open: boolean) => void, open: boolean): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setAnimating(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAnimating(false);
    }, DOCK_ANIMATION_RELEASE_MS);
    setOpen(open);
  }, []);

  return [animating, toggle] as const;
}
