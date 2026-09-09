import { useState, type FormEvent } from "react";
import type React from "react";
import { ALLOWED_MODEL_EXTENSIONS } from "@shared/api";
import { ApiClientError, createProject } from "../api/client";
import { navigate, projectPath } from "./routes";

export function UploadPage(): React.ReactElement {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("プロジェクト名を入力してください。");
      return;
    }
    if (!file) {
      setError("モデルファイルを選択してください。");
      return;
    }

    const dotIndex = file.name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : "";
    if (!ALLOWED_MODEL_EXTENSIONS.some((allowed) => allowed === extension)) {
      setError("対応しているモデル形式は .glb と .gltf です。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const project = await createProject(name.trim(), file);
      navigate(projectPath(project.id));
    } catch (caught) {
      const message = caught instanceof ApiClientError
        ? caught.message
        : caught instanceof Error
          ? caught.message
          : "アップロードに失敗しました。";
      setError(message || "アップロードに失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1>3D Reviewer</h1>
      <p>モデルをアップロードしてレビューを開始します。</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          プロジェクト名
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={submitting}
          />
        </label>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          モデルファイル
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={submitting}
          />
        </label>
        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "アップロード中…" : "レビューを開始"}
        </button>
      </form>
    </main>
  );
}
