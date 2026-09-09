import { Html } from "@react-three/drei";
import type { ReactElement } from "react";
import { selectVisible, useCommentsStore } from "../../store/comments";

function CommentPin({ id, anchor, selected, resolved }: {
  id: string;
  anchor: [number, number, number];
  selected: boolean;
  resolved: boolean;
}): ReactElement {
  return (
    <Html position={anchor} center>
      <button
        type="button"
        aria-label="コメントを選択"
        aria-pressed={selected}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={() => useCommentsStore.getState().select(id)}
        style={{
          width: selected ? "1.5rem" : "1.1rem",
          height: selected ? "1.5rem" : "1.1rem",
          padding: 0,
          border: selected ? "3px solid #175cd3" : "2px solid #ffffff",
          borderRadius: "50%",
          background: resolved ? "#98a2b3" : "#f04438",
          boxShadow: "0 1px 4px rgba(16, 24, 40, 0.35)",
          opacity: resolved ? 0.55 : 1,
          cursor: "pointer",
        }}
      />
    </Html>
  );
}

export function CommentPins(): ReactElement {
  const items = useCommentsStore((state) => state.items);
  const showOnlyOpen = useCommentsStore((state) => state.showOnlyOpen);
  const selectedId = useCommentsStore((state) => state.selectedId);
  const visibleItems = selectVisible(items, showOnlyOpen);

  return (
    <>
      {visibleItems.map((comment) => (
        <CommentPin
          key={comment.id}
          id={comment.id}
          anchor={comment.anchor}
          selected={comment.id === selectedId}
          resolved={comment.status === "resolved"}
        />
      ))}
    </>
  );
}
