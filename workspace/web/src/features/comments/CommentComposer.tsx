import { useState, type FormEvent, type ReactElement } from "react";
import { ApiClientError, createComment } from "../../api/client";
import { useAnnotationStore } from "../../store/annotation";
import { useCameraStore } from "../../store/camera";
import { useCommentsStore } from "../../store/comments";
import { useSessionStore } from "../../store/session";
import { buildCommentInput } from "./compose";

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
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

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
    });
    if (input === null) {
      useCommentsStore.getState().setLastError("本文を入力してください。");
      return;
    }

    setSending(true);
    try {
      const comment = await createComment(projectId, input);
      const comments = useCommentsStore.getState();
      comments.upsert(comment);
      comments.setComposerAnchor(null);
      comments.select(comment.id);
    } catch (error: unknown) {
      useCommentsStore.getState().setLastError(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} style={{ marginTop: "1rem" }}>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        コメント本文
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={4}
          disabled={sending}
          required
        />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="submit" disabled={sending}>投稿</button>
        <button
          type="button"
          disabled={sending}
          onClick={() => useCommentsStore.getState().setComposerAnchor(null)}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
