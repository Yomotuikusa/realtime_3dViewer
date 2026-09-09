import type React from "react";

export function ReviewPage({ projectId }: { projectId: string }): React.ReactElement {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>レビュー</h1>
      <p>プロジェクト: {projectId}</p>
    </main>
  );
}
