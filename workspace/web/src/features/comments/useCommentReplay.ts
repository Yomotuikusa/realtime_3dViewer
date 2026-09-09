import { useEffect } from "react";
import { useCommentsStore } from "../../store/comments";
import { applyCommentReplay } from "./replay";

/** 選択中コメントの視点と線を再現し、アンマウント時に線を消す。 */
export function useCommentReplay(): void {
  const selectedId = useCommentsStore((state) => state.selectedId);

  useEffect(() => {
    const comment = selectedId === null
      ? null
      : useCommentsStore.getState().items.find((item) => item.id === selectedId) ?? null;
    applyCommentReplay(comment);
  }, [selectedId]);

  useEffect(() => () => applyCommentReplay(null), []);
}
