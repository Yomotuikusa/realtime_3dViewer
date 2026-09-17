import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import type { Project } from "@shared/types";
import { ApiClientError, getProject } from "../api/client";
import { AnnotationLayer } from "../features/annotation/AnnotationLayer";
import { RoomStrokes } from "../features/annotation/RoomStrokes";
import { CommentComposer } from "../features/comments/CommentComposer";
import { CommentList } from "../features/comments/CommentList";
import { CommentPickLayer } from "../features/comments/CommentPickLayer";
import { CommentPins } from "../features/comments/CommentPins";
import { ReplayStrokes } from "../features/comments/ReplayStrokes";
import { useCommentReplay } from "../features/comments/useCommentReplay";
import { Outliner } from "../features/outliner/Outliner";
import { SelectionRig } from "../features/outliner/SelectionRig";
import { SelectionPickLayer } from "../features/outliner/SelectionPickLayer";
import { VisibilityRig } from "../features/outliner/VisibilityRig";
import { JointRig } from "../features/joint/JointRig";
import { TrailRig } from "../features/trail/TrailRig";
import { OUTLINER_RESIZE_LABEL } from "../features/outliner/outliner-labels";
import { PresenceList } from "../features/presence/PresenceList";
import { ObjectList } from "../features/objects/ObjectList";
import { RemoteCameras } from "../features/presence/RemoteCameras";
import { ViewerCanvas } from "../features/viewer/ViewerCanvas";
import { ViewerHud } from "../features/viewer/ViewerHud";
import { PlaybackTimeline } from "../features/timeline/PlaybackTimeline";
import { useCameraBroadcast } from "../features/viewer/useCameraBroadcast";
import { useLightBroadcast } from "../features/viewer/useLightBroadcast";
import { useLightBrightnessBroadcast } from "../features/viewer/useLightBrightnessBroadcast";
import { useShortcuts } from "../features/shortcuts/useShortcuts";
import { ResizeHandle } from "../features/layout/ResizeHandle";
import { useElementSize } from "../features/layout/useElementSize";
import { useLayoutFlag } from "../features/layout/useLayoutFlag";
import { useLayoutSize } from "../features/layout/useLayoutSize";
import {
  clampSize,
  OUTLINER_WIDTH_DEFAULT_PX,
  OUTLINER_WIDTH_MIN_PX,
  PANEL_WIDTH_DEFAULT_PX,
  PANEL_WIDTH_MIN_PX,
  outlinerWidthMax,
  panelWidthMax,
} from "../features/layout/resize";
import { useSessionStore } from "../store/session";
import { latestObjectId, useObjectsStore } from "../store/objects";
import { ErrorBoundary } from "./ErrorBoundary";
import { JoinDialog } from "./JoinDialog";
import { ReviewHeader } from "./ReviewHeader";
import { SettingsDialog } from "./SettingsDialog";
import { resetReviewStores } from "./review-stores";
import { useRealtime } from "./useRealtime";
import {
  LOADING_MESSAGE,
  MODEL_LOAD_FAILED,
  PANEL_RESIZE_LABEL,
  PROJECT_LOAD_FAILED,
  RELOAD_LABEL,
} from "./review-labels";
import { COMPOSER_NO_OBJECTS_MESSAGE } from "../features/comments/comment-labels";
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodySize = useElementSize(bodyRef);
  const [panelWidth, setPanelWidth] = useLayoutSize("panelWidth");
  const [outlinerWidth, setOutlinerWidth] = useLayoutSize("outlinerWidth");
  const [outlinerOpen, setOutlinerOpen] = useLayoutFlag("outlinerOpen");
  const [panelOpen, setPanelOpen] = useLayoutFlag("panelOpen");
  const maxPanelWidth = panelWidthMax(bodySize.width, outlinerOpen ? OUTLINER_WIDTH_MIN_PX : 0);
  const effectivePanelWidth = clampSize(panelWidth, PANEL_WIDTH_MIN_PX, maxPanelWidth);
  const maxOutlinerWidth = outlinerWidthMax(bodySize.width, panelOpen ? effectivePanelWidth : 0);
  const effectiveOutlinerWidth = clampSize(
    outlinerWidth,
    OUTLINER_WIDTH_MIN_PX,
    maxOutlinerWidth,
  );
  const realtime = useRealtime(projectId, joinName);
  useCommentReplay(realtime.send);
  useCameraBroadcast(realtime.send);
  useLightBroadcast(realtime.send);
  useLightBrightnessBroadcast(realtime.send);
  useShortcuts(joinName !== null && !settingsOpen);
  const lastError = useSessionStore((session) => session.lastError);
  const composerVersionId = useObjectsStore((s) => latestObjectId(s.objects));

  useEffect(() => () => resetReviewStores(), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", projectId });
    void getProject(projectId)
      .then((project) => {
        if (!cancelled) {
          useObjectsStore.getState().setObjects(project.versions);
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
        outlinerOpen={outlinerOpen}
        panelOpen={panelOpen}
        onToggleOutliner={() => setOutlinerOpen(!outlinerOpen)}
        onTogglePanel={() => setPanelOpen(!panelOpen)}
      />
      {lastError && <p className="alert review-page__alert" role="alert">{lastError}</p>}
      <div
        ref={bodyRef}
        className="review-body"
        style={{
          "--outliner-width": outlinerOpen ? effectiveOutlinerWidth + "px" : "0px",
          "--panel-width": panelOpen ? effectivePanelWidth + "px" : "0px",
        } as CSSProperties}
      >
        {outlinerOpen && (
          <aside className="review-outliner" aria-label="アウトライナドック">
            <Outliner send={realtime.send} />
          </aside>
        )}
        {outlinerOpen && (
          <ResizeHandle
            axis="x"
            side="start"
            className="review-body__resize review-body__resize--outliner"
            value={effectiveOutlinerWidth}
            min={OUTLINER_WIDTH_MIN_PX}
            max={maxOutlinerWidth}
            defaultValue={OUTLINER_WIDTH_DEFAULT_PX}
            label={OUTLINER_RESIZE_LABEL}
            onChange={setOutlinerWidth}
          />
        )}
        <section className="review-viewer" aria-label="3D ビューア">
          <div className="review-stage">
            <div className="review-hud">
              <ViewerHud send={realtime.send} />
            </div>
            <ErrorBoundary
              key={projectId}
              fallback={(
                <div className="review-stage__error">
                  <ErrorCard
                    message={MODEL_LOAD_FAILED}
                    onRetry={() => window.location.reload()}
                  />
                </div>
              )}
            >
              <ViewerCanvas>
                <RemoteCameras />
                <RoomStrokes />
                <ReplayStrokes />
                <AnnotationLayer send={realtime.send} />
                <CommentPickLayer />
                <SelectionPickLayer />
                <CommentPins />
                <SelectionRig />
                <VisibilityRig />
                <JointRig />
                <TrailRig />
              </ViewerCanvas>
            </ErrorBoundary>
          </div>
          <PlaybackTimeline send={realtime.send} />
          {joinName === null && <JoinDialog onJoin={handleJoin} />}
          {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
        </section>
        {panelOpen && (
          <ResizeHandle
            axis="x"
            className="review-body__resize"
            value={effectivePanelWidth}
            min={PANEL_WIDTH_MIN_PX}
            max={maxPanelWidth}
            defaultValue={PANEL_WIDTH_DEFAULT_PX}
            label={PANEL_RESIZE_LABEL}
            onChange={setPanelWidth}
          />
        )}
        {panelOpen && (
          <aside className="review-panel" aria-label="サイドパネル">
            <PresenceList />
            <ObjectList projectId={projectId} send={realtime.send} />
            <section className="review-panel__comments" aria-label="コメント">
              {composerVersionId === null
                ? <p className="comments__empty" role="status">{COMPOSER_NO_OBJECTS_MESSAGE}</p>
                : <CommentComposer projectId={projectId} versionId={composerVersionId} />}
              <CommentList projectId={projectId} />
            </section>
          </aside>
        )}
      </div>
    </main>
  );
}
