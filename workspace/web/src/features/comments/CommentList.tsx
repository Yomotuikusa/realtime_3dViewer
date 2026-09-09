import { useEffect, useState, type ReactElement } from "react";
import type { CommentStatus } from "@shared/types";
import { ApiClientError, listComments, updateCommentStatus } from "../../api/client";
import { selectVisible, useCommentsStore } from "../../store/comments";

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "コメントの取得に失敗しました。";
}

export function CommentList({ projectId }: { projectId: string }): ReactElement {
  const items = useCommentsStore((state) => state.items);
  const showOnlyOpen = useCommentsStore((state) => state.showOnlyOpen);
  const selectedId = useCommentsStore((state) => state.selectedId);
  const lastError = useCommentsStore((state) => state.lastError);
  const visibleItems = selectVisible(items, showOnlyOpen);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    void listComments(projectId)
      .then((comments) => {
        if (!cancelled) {
          useCommentsStore.getState().setAll(comments);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          useCommentsStore.getState().setLastError(errorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const changeStatus = async (commentId: string, status: CommentStatus) => {
    setUpdatingIds((current) => new Set(current).add(commentId));
    try {
      const comment = await updateCommentStatus(projectId, commentId, status);
      useCommentsStore.getState().upsert(comment);
    } catch (error: unknown) {
      useCommentsStore.getState().setLastError(errorMessage(error));
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(commentId);
        return next;
      });
    }
  };

  return (
    <section aria-label="コメント" style={{ marginTop: "1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>コメント</h2>
      {lastError && <p role="alert" style={{ color: "#b42318" }}>{lastError}</p>}
      <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.75rem" }}>
        <input
          type="checkbox"
          checked={showOnlyOpen}
          onChange={(event) => useCommentsStore.getState().setFilter(event.target.checked)}
        />
        Open のみ
      </label>
      <ul style={{ display: "grid", gap: "0.5rem", padding: 0, margin: 0, listStyle: "none" }}>
        {visibleItems.map((comment) => {
          const nextStatus: CommentStatus = comment.status === "open" ? "resolved" : "open";
          const isUpdating = updatingIds.has(comment.id);
          return (
            <li key={comment.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => useCommentsStore.getState().select(selectedId === comment.id ? null : comment.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    useCommentsStore.getState().select(selectedId === comment.id ? null : comment.id);
                  }
                }}
                style={{
                  padding: "0.6rem",
                  border: "1px solid #d0d5dd",
                  borderRadius: "0.35rem",
                  background: selectedId === comment.id ? "#eaf2ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <strong>{comment.authorName}</strong>
                  <span>{comment.status}</span>
                </div>
                <p style={{ margin: "0.35rem 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {comment.body}
                </p>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={(event) => {
                    event.stopPropagation();
                    void changeStatus(comment.id, nextStatus);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {comment.status === "open" ? "Resolve" : "Reopen"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
