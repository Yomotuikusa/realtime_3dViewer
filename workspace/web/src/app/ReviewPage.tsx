import { useEffect, useState, type ReactElement } from "react";
import type { Project } from "@shared/types";
import { ApiClientError, getProject, modelUrl } from "../api/client";
import { ErrorBoundary } from "./ErrorBoundary";
import { ViewerCanvas } from "../features/viewer/ViewerCanvas";
import { useCameraStore } from "../store/camera";

type ReviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; project: Project };

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
  const [state, setState] = useState<ReviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void getProject(projectId)
      .then((project) => {
        if (!cancelled) {
          setState({ status: "ready", project });
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
        setState({ status: "error", message: message || "プロジェクトの取得に失敗しました。" });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, reloadSeq]);

  if (state.status === "loading") {
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

  return (
    <main style={pageStyle}>
      <header style={{ display: "flex", alignItems: "baseline", gap: "1rem", padding: "1rem 1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>{state.project.name}</h1>
        <span style={{ color: "#667085" }}>レビュー</span>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 20rem", minHeight: "calc(100vh - 4.25rem)" }}>
        <section style={{ position: "relative", minWidth: 0, padding: "0 0 1rem 1rem" }}>
          <div style={{ position: "absolute", zIndex: 1, top: "1rem", left: "2rem", display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={requestReset}>Reset</button>
            <button type="button" onClick={requestFit}>全体表示</button>
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
            <ViewerCanvas modelSrc={src} />
          </ErrorBoundary>
        </section>
        <aside aria-label="サイドパネル" style={{ margin: "0 1rem 1rem 1rem", padding: "1rem", border: "1px solid #d0d5dd", borderRadius: "0.5rem" }} />
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
