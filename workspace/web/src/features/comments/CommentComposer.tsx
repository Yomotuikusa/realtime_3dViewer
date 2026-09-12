import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { ApiClientError, createComment } from "../../api/client";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useCommentsStore } from "../../store/comments";
import { useSessionStore } from "../../store/session";
import { usePlaybackStore } from "../../store/playback";
import { buildCommentInput, commentPlaybackOf } from "./compose";
import { loadRecordFrame, saveRecordFrame } from "./frame-switch";
import { frameOfTime } from "../viewer/playback-frames";
import { CANCEL_LABEL, COMPOSER_BODY_LABEL, COMPOSER_TITLE, recordFrameLabel, SUBMIT_LABEL } from "./comment-labels";
import "./comments.css";

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "コメントの投稿に失敗しました。";
}

export function CommentComposer({ projectId, versionId }: {
  projectId: string;
  versionId: string;
}): ReactElement | null {
  const anchor = useCommentsStore((state) => state.composerAnchor);
  const clips = usePlaybackStore((state) => state.clips);
  const clipIndex = usePlaybackStore((state) => state.clipIndex);
  const time = usePlaybackStore((state) => state.time);
  const fps = usePlaybackStore((state) => state.fps);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [recordFrame, setRecordFrame] = useState(loadRecordFrame);
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

  if (anchor === null) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const camera = useCameraStore.getState().selfCamera;
    const session = useSessionStore.getState();
    const annotation = useAnnotationStore.getState();
    const input = buildCommentInput({
      versionId,
      authorName: session.name,
      body,
      anchor,
      camera,
      strokes: annotation.strokes,
      userId: session.selfId,
      playback: commentPlaybackOf(usePlaybackStore.getState(), recordFrame),
    });
    if (input === null) {
      useCommentsStore.getState().setLastError("本文を入力してください。");
      return;
    }

    const lifecycle = lifecycleRef.current;
    if (lifecycle === null) {
      return;
    }
    setSending(true);
    try {
      const comment = await createComment(projectId, input);
      if (lifecycleRef.current === lifecycle && lifecycle.active) {
        const comments = useCommentsStore.getState();
        comments.upsert(comment);
        comments.setComposerAnchor(null);
        comments.select(comment.id);
        comments.setLastError(null);
      }
    } catch (error: unknown) {
      if (lifecycleRef.current === lifecycle && lifecycle.active) {
        useCommentsStore.getState().setLastError(errorMessage(error));
      }
    } finally {
      if (lifecycleRef.current === lifecycle && lifecycle.active) {
        setSending(false);
      }
    }
  };

  return (
    <form className="comments-composer" onSubmit={(event) => void submit(event)}>
      <h3 className="comments-composer__title">{COMPOSER_TITLE}</h3>
      <label className="field">
        <span className="field__label">{COMPOSER_BODY_LABEL}</span>
        <textarea
          className="input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={4}
          autoFocus
          disabled={sending}
          required
        />
      </label>
      {clips.length > 0 && (
        <label className="comments-composer__frame" data-clip-index={clipIndex}>
          <input
            type="checkbox"
            checked={recordFrame}
            disabled={sending}
            onChange={(event) => {
              setRecordFrame(event.target.checked);
              saveRecordFrame(event.target.checked);
            }}
          />
          {recordFrameLabel(frameOfTime(time, fps))}
        </label>
      )}
      <div className="comments-composer__actions">
        <button className="btn btn--primary" type="submit" disabled={sending}>
          {sending ? "投稿中…" : SUBMIT_LABEL}
        </button>
        <button
          className="btn btn--quiet"
          type="button"
          disabled={sending}
          onClick={() => useCommentsStore.getState().setComposerAnchor(null)}
        >
          {CANCEL_LABEL}
        </button>
      </div>
    </form>
  );
}
