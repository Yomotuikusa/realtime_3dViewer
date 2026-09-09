import { useState, type FormEvent } from "react";
import type React from "react";
import { ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";
import { ApiClientError, createProject } from "../api/client";
import { navigate, projectPath } from "./routes";
import {
  APP_NAME,
  MODEL_FILE_LABEL,
  PROJECT_NAME_LABEL,
  SUBMIT_LABEL,
  SUBMITTING_LABEL,
  UPLOAD_LEAD,
  fileHelp,
  fileSummary,
} from "./upload-labels";
import "./upload.css";

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
    <main className="upload">
      <header className="upload__head">
        <h1 className="upload__title">{APP_NAME}</h1>
        <p className="upload__lead">{UPLOAD_LEAD}</p>
      </header>
      <form className="upload__form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">{PROJECT_NAME_LABEL}</span>
          <input
            className="input"
            type="text"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={submitting}
          />
        </label>
        <label className="field">
          <span className="field__label">{MODEL_FILE_LABEL}</span>
          <input
            className="input"
            type="file"
            accept=".glb,.gltf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={submitting}
          />
          <span className="upload__help">
            {file ? fileSummary(file.name, file.size) : fileHelp(ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT)}
          </span>
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? SUBMITTING_LABEL : SUBMIT_LABEL}
        </button>
      </form>
    </main>
  );
}
