import { useEffect, useRef } from "react";
import type { ClientMessage } from "@shared/protocol";
import { useCommentsStore } from "../../store/comments";
import { applyCommentReplay } from "./replay";

/** 選択中コメントの視点と線を再現し、アンマウント時に線を消す。 */
export function useCommentReplay(send: (msg: ClientMessage) => boolean): void {
  const selectedId = useCommentsStore((state) => state.selectedId);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    const comment = selectedId === null
      ? null
      : useCommentsStore.getState().items.find((item) => item.id === selectedId) ?? null;
    applyCommentReplay(comment, sendRef.current);
  }, [selectedId]);

  useEffect(() => () => applyCommentReplay(null, sendRef.current), []);
}
