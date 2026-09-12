import { Html } from "@react-three/drei";
import type { ReactElement } from "react";
import { selectVisible, useCommentsStore } from "../../store/comments";
import type { CommentStatus } from "@shared/types";
import { CommentCallout } from "./CommentCallout";
import { pinLabel } from "./comment-labels";
import "./comments.css";

function CommentPin({ id, anchor, authorName, selected, status }: {
  id: string;
  anchor: [number, number, number];
  authorName: string;
  selected: boolean;
  status: CommentStatus;
}): ReactElement {
  return (
    <Html position={anchor} center>
      <button
        type="button"
        className="comments-pin"
        aria-label={pinLabel(authorName)}
        aria-pressed={selected}
        data-status={status}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={() => useCommentsStore.getState().select(id)}
      />
    </Html>
  );
}

export function CommentPins(): ReactElement {
  const items = useCommentsStore((state) => state.items);
  const showOnlyOpen = useCommentsStore((state) => state.showOnlyOpen);
  const selectedId = useCommentsStore((state) => state.selectedId);
  const visibleItems = selectVisible(items, showOnlyOpen);
  const selected = visibleItems.find((comment) => comment.id === selectedId);

  return (
    <>
      {visibleItems.map((comment) => (
        <CommentPin
          key={comment.id}
          id={comment.id}
          anchor={comment.anchor}
          authorName={comment.authorName}
          selected={comment.id === selectedId}
          status={comment.status}
        />
      ))}
      {selected !== undefined && <CommentCallout comment={selected} />}
    </>
  );
}
