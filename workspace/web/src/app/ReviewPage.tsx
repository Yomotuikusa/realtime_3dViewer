import { useEffect, useState, type ReactElement } from "react";
import type { Project } from "@shared/types";
import { ApiClientError, getProject, modelUrl } from "../api/client";
import { AnnotationLayer } from "../features/annotation/AnnotationLayer";
import { RoomStrokes } from "../features/annotation/RoomStrokes";
import { CommentComposer } from "../features/comments/CommentComposer";
import { CommentList } from "../features/comments/CommentList";
import { CommentPickLayer } from "../features/comments/CommentPickLayer";
import { CommentPins } from "../features/comments/CommentPins";
import { ReplayStrokes } from "../features/comments/ReplayStrokes";
import { useCommentReplay } from "../features/comments/useCommentReplay";
import { PresenceList } from "../features/presence/PresenceList";
import { RemoteCameras } from "../features/presence/RemoteCameras";
import { ViewerCanvas } from "../features/viewer/ViewerCanvas";
import { ViewerHud } from "../features/viewer/ViewerHud";
import { useCameraBroadcast } from "../features/viewer/useCameraBroadcast";
import { useLightBroadcast } from "../features/viewer/useLightBroadcast";
import { ShortcutSettings } from "../features/shortcuts/ShortcutSettings";
import { useShortcuts } from "../features/shortcuts/useShortcuts";
import { useSessionStore } from "../store/session";
import { ErrorBoundary } from "./ErrorBoundary";
import { JoinDialog } from "./JoinDialog";
import { ReviewHeader } from "./ReviewHeader";
import { resetReviewStores } from "./review-stores";
import { useRealtime } from "./useRealtime";
import { LOADING_MESSAGE, MODEL_LOAD_FAILED, PROJECT_LOAD_FAILED, RELOAD_LABEL } from "./review-labels";
import "./review.css";

type ReviewState =
  | { status: "loading"; projectId: string }
  | { status: "error"; projectId: string; message: string }
  | { status: "ready"; projectId: string; project: Project };

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <div className="alert review-error" role="alert">
      <p>{message}</p>
      <button className="btn" type="button" onClick={onRetry}>{RELOAD_LABEL}</button>
    </div>
  );
}

export function ReviewPage({ projectId }: { projectId: string }): ReactElement {
  const [reloadSeq, setReloadSeq] = useState(0);
  const [joinName, setJoinName] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [state, setState] = useState<ReviewState>({ status: "loading", projectId });
  useCommentReplay();
  const realtime = useRealtime(projectId, joinName);
  useCameraBroadcast(realtime.send);
  useLightBroadcast(realtime.send);
  useShortcuts(joinName !== null && !settingsOpen);
  const lastError = useSessionStore((session) => session.lastError);

  useEffect(() => () => resetReviewStores(), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", projectId });
    void getProject(projectId)
      .then((project) => {
        if (!cancelled) {
          setState({ status: "ready", projectId, project });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : PROJECT_LOAD_FAILED;
        setState({
          status: "error",
          projectId,
          message: message || PROJECT_LOAD_FAILED,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, reloadSeq]);

  if (state.status === "loading" || state.projectId !== projectId) {
    return (
      <main className="review-page review-page--message">
        <p role="status">{LOADING_MESSAGE}</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="review-page review-page--message">
        <ErrorCard message={state.message} onRetry={() => setReloadSeq((seq) => seq + 1)} />
      </main>
    );
  }

  const src = modelUrl(projectId, state.project.latestVersion.id);
  const handleJoin = (name: string) => {
    useSessionStore.getState().setName(name);
    setJoinName(name);
  };

  return (
    <main className="review-page">
      <ReviewHeader
        projectName={state.project.name}
        joined={joinName !== null}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {lastError && <p className="alert review-page__alert" role="alert">{lastError}</p>}
      <div className="review-body">
        <section className="review-viewer" aria-label="3D ビューア">
          <div className="review-hud">
            <ViewerHud send={realtime.send} />
          </div>
          <ErrorBoundary
            key={src}
            fallback={(
              <ErrorCard
                message={MODEL_LOAD_FAILED}
                onRetry={() => window.location.reload()}
              />
            )}
          >
            <ViewerCanvas modelSrc={src}>
              <RemoteCameras />
              <RoomStrokes />
              <ReplayStrokes />
              <AnnotationLayer send={realtime.send} />
              <CommentPickLayer />
              <CommentPins />
            </ViewerCanvas>
          </ErrorBoundary>
          {joinName === null && <JoinDialog onJoin={handleJoin} />}
          {settingsOpen && <ShortcutSettings onClose={() => setSettingsOpen(false)} />}
        </section>
        <aside className="review-panel" aria-label="サイドパネル">
          <PresenceList />
          <section className="review-panel__comments" aria-label="コメント">
            <CommentComposer projectId={projectId} versionId={state.project.latestVersion.id} />
            <CommentList projectId={projectId} />
          </section>
        </aside>
      </div>
    </main>
  );
}
