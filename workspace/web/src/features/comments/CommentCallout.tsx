import { Html } from "@react-three/drei";
import type { ReactElement } from "react";
import type { Comment } from "@shared/types";
import { useCommentsStore } from "../../store/comments";
import {
  CLOSE_CALLOUT_LABEL,
  formatCommentTime,
  pinLabel,
  playbackBadge,
  playbackTitle,
  statusLabel,
  statusTone,
} from "./comment-labels";
import "./comments.css";

/** 選択中コメントをアンカー位置の横に吹き出しで描画する。閉じるボタンで select(null)。 */
export function CommentCallout({ comment }: { comment: Comment }): ReactElement {
  const playback = comment.playback ?? null;

  return (
    <Html position={comment.anchor} zIndexRange={[16777272, 16777272]}>
      <div
        className="comments-callout"
        role="dialog"
        aria-label={pinLabel(comment.authorName)}
        data-status={comment.status}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <div className="comments-callout__head">
          <span className="comments-callout__meta">
            <strong>{comment.authorName}</strong>
            <time dateTime={new Date(comment.createdAt).toISOString()}>
              {formatCommentTime(comment.createdAt, Date.now())}
            </time>
            <span className="badge" data-tone={statusTone(comment.status)}>{statusLabel(comment.status)}</span>
            {playback !== null && (
              <span className="badge comments-row__frame" data-tone="accent" title={playbackTitle(playback)}>
                {playbackBadge(playback)}
              </span>
            )}
          </span>
          <button
            type="button"
            className="btn btn--quiet comments-callout__close"
            aria-label={CLOSE_CALLOUT_LABEL}
            title={CLOSE_CALLOUT_LABEL}
            onClick={() => useCommentsStore.getState().select(null)}
          >
            ×
          </button>
        </div>
        <p className="comments-callout__body">{comment.body}</p>
      </div>
    </Html>
  );
}
