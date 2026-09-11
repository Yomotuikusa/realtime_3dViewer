import { HttpError } from "../errors";
import {
  assertModelBytes,
  modelExtension,
} from "./upload-validation";

export interface UploadedModel {
  fileName: string;
  bytes: Uint8Array;
}

/** Validate every multipart model before any of them is persisted. */
export async function readUploadedModels(
  field: unknown,
  maxBytes: number,
): Promise<UploadedModel[]> {
  const fields = Array.isArray(field) ? field : [field];
  if (fields.length === 0 || fields.some((value) => !(value instanceof File))) {
    throw new HttpError(400, "VALIDATION", "A model file is required");
  }

  const models: UploadedModel[] = [];
  for (const value of fields) {
    const file = value as File;
    let extension;
    try {
      extension = modelExtension(file.name);
    } catch (error) {
      if (error instanceof HttpError && error.code === "UNSUPPORTED_FORMAT") {
        throw new HttpError(415, "UNSUPPORTED_FORMAT", error.message);
      }
      throw error;
    }
    if (file.size > maxBytes) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Upload is too large");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertModelBytes(extension, bytes);
    models.push({ fileName: file.name, bytes });
  }
  return models;
}
