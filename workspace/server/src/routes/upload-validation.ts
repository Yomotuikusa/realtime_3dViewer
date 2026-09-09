import {
  ALLOWED_MODEL_EXTENSIONS,
  type ErrorCode,
} from "@shared/api";
import { extname } from "node:path";
import { HttpError } from "../errors";

export type ModelExt = ".glb" | ".gltf";

const UNSUPPORTED_FORMAT: ErrorCode = "UNSUPPORTED_FORMAT";

function unsupportedFormat(): never {
  throw new HttpError(400, UNSUPPORTED_FORMAT, "Unsupported model format");
}

/** Return the supported final extension after case-insensitive validation. */
export function modelExtension(fileName: string): ModelExt {
  const extension = extname(fileName).toLowerCase();
  if (!(ALLOWED_MODEL_EXTENSIONS as readonly string[]).includes(extension)) {
    unsupportedFormat();
  }
  return extension as ModelExt;
}

/** Validate the format-specific bytes before they are persisted. */
export function assertModelBytes(ext: ModelExt, bytes: Uint8Array): void {
  if (bytes.length === 0) {
    unsupportedFormat();
  }

  if (ext === ".glb") {
    if (
      bytes.length < 4 ||
      bytes[0] !== 0x67 ||
      bytes[1] !== 0x6c ||
      bytes[2] !== 0x54 ||
      bytes[3] !== 0x46
    ) {
      unsupportedFormat();
    }
    return;
  }

  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !Object.prototype.hasOwnProperty.call(parsed, "asset")
    ) {
      unsupportedFormat();
    }
  } catch {
    unsupportedFormat();
  }
}
