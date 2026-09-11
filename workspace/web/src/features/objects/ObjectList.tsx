import { useState, type ChangeEvent, type ReactElement } from "react";
import type { ClientMessage } from "@shared/protocol";
import { ALLOWED_MODEL_EXTENSIONS, MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";
import { ApiClientError, addModelVersion } from "../../api/client";
import { validateModelFiles } from "../../app/upload-labels";
import { isObjectVisible, useObjectsStore } from "../../store/objects";
import {
  ADD_FAILED,
  ADD_FILES_LABEL,
  ADDING_LABEL,
  HIDDEN_LABEL,
  OBJECTS_HEADING,
  VISIBLE_LABEL,
  objectsHeading,
  toggleAriaLabel,
  versionTag,
} from "./objects-labels";
import "./objects.css";

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof Error) {
    return error.message || ADD_FAILED;
  }
  return ADD_FAILED;
}

export function ObjectList({
  projectId,
  send,
}: {
  projectId: string;
  send: (msg: ClientMessage) => boolean;
}): ReactElement {
  const objects = useObjectsStore((state) => state.objects);
  const hiddenIds = useObjectsStore((state) => state.hiddenIds);
  const setVisible = useObjectsStore((state) => state.setVisible);
  const append = useObjectsStore((state) => state.append);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (versionId: string): void => {
    const visible = isObjectVisible(useObjectsStore.getState().hiddenIds, versionId);
    setVisible(versionId, !visible);
    send({ type: "object:visibility", versionId, visible: !visible });
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    const validationError = validateModelFiles(
      files,
      ALLOWED_MODEL_EXTENSIONS,
      MAX_UPLOAD_BYTES_DEFAULT,
    );
    if (validationError !== null) {
      setError(validationError);
      input.value = "";
      return;
    }

    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const version = await addModelVersion(projectId, file);
        append(version);
      }
    } catch (caught: unknown) {
      setError(uploadErrorMessage(caught));
    } finally {
      setBusy(false);
      input.value = "";
    }
  };

  return (
    <section className="objects" aria-label={OBJECTS_HEADING}>
      <h2 className="objects__heading">{objectsHeading(objects.length)}</h2>
      <ul className="objects__list">
        {objects.map((version) => {
          const visible = isObjectVisible(hiddenIds, version.id);
          return (
            <li className="objects__row" key={version.id} data-hidden={!visible}>
              <span className="badge objects__tag" data-tone="neutral">{versionTag(version)}</span>
              <span className="objects__name" title={version.fileName}>{version.fileName}</span>
              <button
                className="btn btn--quiet objects__toggle"
                type="button"
                aria-pressed={visible}
                aria-label={toggleAriaLabel(version)}
                onClick={() => handleToggle(version.id)}
              >
                {visible ? VISIBLE_LABEL : HIDDEN_LABEL}
              </button>
            </li>
          );
        })}
      </ul>
      <label className="objects__add">
        <input
          className="objects__file"
          type="file"
          multiple
          accept=".glb,.gltf"
          hidden
          disabled={busy}
          onChange={(event) => void handleFiles(event)}
        />
        <span className="btn" data-busy={busy} aria-disabled={busy}>
          {busy ? ADDING_LABEL : ADD_FILES_LABEL}
        </span>
      </label>
      {error !== null && <p className="alert" role="alert">{error}</p>}
    </section>
  );
}
