import { useEffect, useState, type ReactElement } from "react";
import type { Project } from "@shared/types";
import { ApiClientError, getProject, modelUrl } from "../api/client";
import { ErrorBoundary } from "./ErrorBoundary";
import { JoinDialog } from "./JoinDialog";
import { useRealtime } from "./useRealtime";
import { PresenceList } from "../features/presence/PresenceList";
import { CommentList } from "../features/comments/CommentList";
import { RemoteCameras } from "../features/presence/RemoteCameras";
import { RoomStrokes } from "../features/annotation/RoomStrokes";
import { AnnotationLayer } from "../features/annotation/AnnotationLayer";
import { AnnotationToolbar } from "../features/annotation/AnnotationToolbar";
import { ViewerCanvas } from "../features/viewer/ViewerCanvas";
import { useCameraBroadcast } from "../features/viewer/useCameraBroadcast";
import { useCameraStore } from "../store/camera";
import { useSessionStore } from "../store/session";

type ReviewState =
  | { status: "loading"; projectId: string }
  | { status: "error"; projectId: string; message: string }
  | { status: "ready"; projectId: string; project: Project };

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }): ReactElement {
  return (
    <div
      role="alert"
      style={{
        display: "grid",
        placeItems: "center",
        gap: "0.8rem",
        minHeight: "18rem",
        padding: "2rem",
        color: "#8a1c1c",
        background: "#fff5f5",
        border: "1px solid #f0b8b8",
        borderRadius: "0.5rem",
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      <button type="button" onClick={onRetry}>再読み込み</button>
    </div>
  );
}

export function ReviewPage({ projectId }: { projectId: string }): ReactElement {
  const [reloadSeq, setReloadSeq] = useState(0);
  const [joinName, setJoinName] = useState<string | null>(null);
  const [state, setState] = useState<ReviewState>({ status: "loading", projectId });
  const realtime = useRealtime(projectId, joinName);
  useCameraBroadcast(realtime.send);
  const connection = useSessionStore((session) => session.connection);
  const lastError = useSessionStore((session) => session.lastError);

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
            : "プロジェクトの取得に失敗しました。";
        setState({
          status: "error",
          projectId,
          message: message || "プロジェクトの取得に失敗しました。",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, reloadSeq]);

  if (state.status === "loading" || state.projectId !== projectId) {
    return <main style={pageStyle}><p>プロジェクトを読み込んでいます…</p></main>;
  }

  if (state.status === "error") {
    return (
      <main style={pageStyle}>
        <ErrorCard message={state.message} onRetry={() => setReloadSeq((seq) => seq + 1)} />
      </main>
    );
  }

  const src = modelUrl(projectId, state.project.latestVersion.id);
  const requestReset = () => useCameraStore.getState().requestReset();
  const requestFit = () => useCameraStore.getState().requestFit();
  const handleJoin = (name: string) => {
    useSessionStore.getState().setName(name);
    setJoinName(name);
  };
  const connectionLabel = connection === "connecting"
    ? "再接続中"
    : connection === "closed"
      ? "切断"
      : null;

  return (
    <main style={pageStyle}>
      <header style={{ display: "flex", alignItems: "baseline", gap: "1rem", padding: "1rem 1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>{state.project.name}</h1>
        <span style={{ color: "#667085" }}>レビュー</span>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 20rem", minHeight: "calc(100vh - 4.25rem)" }}>
        <section style={{ position: "relative", minWidth: 0, padding: "0 0 1rem 1rem" }}>
          {joinName === null && (
            <div style={{ position: "absolute", zIndex: 2, top: "1rem", left: "2rem" }}>
              <JoinDialog onJoin={handleJoin} />
            </div>
          )}
          <div style={{ position: "absolute", zIndex: 1, top: "1rem", left: "2rem", display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={requestReset}>Reset</button>
            <button type="button" onClick={requestFit}>全体表示</button>
            <AnnotationToolbar send={realtime.send} />
          </div>
          <ErrorBoundary
            key={src}
            fallback={(
              <ErrorCard
                message="モデルの読み込みに失敗しました。"
                onRetry={() => window.location.reload()}
              />
            )}
          >
            <ViewerCanvas modelSrc={src}>
              <RemoteCameras />
              <RoomStrokes />
              <AnnotationLayer send={realtime.send} />
            </ViewerCanvas>
          </ErrorBoundary>
        </section>
        <aside aria-label="サイドパネル" style={{ margin: "0 1rem 1rem 1rem", padding: "1rem", border: "1px solid #d0d5dd", borderRadius: "0.5rem" }}>
          {connectionLabel && <p style={{ margin: "0 0 0.5rem" }}>{connectionLabel}</p>}
          {lastError && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{lastError}</p>}
          <PresenceList />
          <CommentList projectId={projectId} />
        </aside>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  margin: 0,
  fontFamily: "sans-serif",
  color: "#101828",
  background: "#ffffff",
};
