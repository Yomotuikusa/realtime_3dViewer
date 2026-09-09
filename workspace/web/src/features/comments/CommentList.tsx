import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import type { CommentStatus } from "@shared/types";
import { ApiClientError, listComments, updateCommentStatus } from "../../api/client";
import { selectVisible, useCommentsStore } from "../../store/comments";
import {
  commentsHeading,
  EMPTY_FILTERED_MESSAGE,
  EMPTY_MESSAGE,
  FILTER_OPEN_ONLY,
  formatCommentTime,
  statusLabel,
  statusTone,
  toggleStatusLabel,
} from "./comment-labels";
import "./comments.css";

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
  const lifecycleRef = useRef<{ projectId: string; active: boolean } | null>(null);

  useLayoutEffect(() => {
    const lifecycle = { projectId, active: true };
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.active = false;
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
    };
  }, [projectId]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle === null) {
      return;
    }
    void listComments(projectId)
      .then((comments) => {
        if (lifecycleRef.current === lifecycle && lifecycle.active) {
          const store = useCommentsStore.getState();
          store.setAll(comments);
          useCommentsStore.getState().setLastError(null);
        }
      })
      .catch((error: unknown) => {
        if (lifecycleRef.current === lifecycle && lifecycle.active) {
          useCommentsStore.getState().setLastError(errorMessage(error));
        }
      });
  }, [projectId]);

  const changeStatus = async (commentId: string, status: CommentStatus) => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle === null) {
      return;
    }
    setUpdatingIds((current) => new Set(current).add(commentId));
    try {
      const comment = await updateCommentStatus(projectId, commentId, status);
      if (lifecycleRef.current === lifecycle && lifecycle.active) {
        const store = useCommentsStore.getState();
        store.upsert(comment);
        store.setLastError(null);
      }
    } catch (error: unknown) {
      if (lifecycleRef.current === lifecycle && lifecycle.active) {
        useCommentsStore.getState().setLastError(errorMessage(error));
      }
    } finally {
      if (lifecycleRef.current === lifecycle && lifecycle.active) {
        setUpdatingIds((current) => {
          const next = new Set(current);
          next.delete(commentId);
          return next;
        });
      }
    }
  };

  return (
    <div className="comments">
      <div className="comments__head">
        <h2 className="comments__heading">{commentsHeading(visibleItems.length)}</h2>
        <label className="comments__filter">
        <input
          type="checkbox"
          checked={showOnlyOpen}
          onChange={(event) => useCommentsStore.getState().setFilter(event.target.checked)}
        />
          {FILTER_OPEN_ONLY}
        </label>
      </div>
      {lastError && <p className="alert" role="alert">{lastError}</p>}
      {visibleItems.length === 0 && (
        <p className="comments__empty">{items.length === 0 ? EMPTY_MESSAGE : EMPTY_FILTERED_MESSAGE}</p>
      )}
      <ul className="comments__list">
        {visibleItems.map((comment) => {
          const nextStatus: CommentStatus = comment.status === "open" ? "resolved" : "open";
          const isUpdating = updatingIds.has(comment.id);
          const selected = selectedId === comment.id;
          return (
            <li
              key={comment.id}
              className="comments-row"
              data-selected={selected}
              data-status={comment.status}
            >
                <button
                  type="button"
                  className="comments-row__select"
                  aria-pressed={selected}
                  onClick={() => useCommentsStore.getState().select(selected ? null : comment.id)}
                >
                  <span className="comments-row__meta">
                    <strong>{comment.authorName}</strong>
                    <time dateTime={new Date(comment.createdAt).toISOString()}>
                      {formatCommentTime(comment.createdAt, Date.now())}
                    </time>
                    <span className="badge" data-tone={statusTone(comment.status)}>{statusLabel(comment.status)}</span>
                  </span>
                  <p className="comments-row__body">{comment.body}</p>
                </button>
                <button
                  className="btn btn--quiet comments-row__toggle"
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void changeStatus(comment.id, nextStatus)}
                >
                  {toggleStatusLabel(comment.status)}
                </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
