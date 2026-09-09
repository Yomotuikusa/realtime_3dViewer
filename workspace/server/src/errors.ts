import type { ApiError, ErrorCode } from "@shared/api";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Convert application errors into the stable REST error response shape. */
export function toErrorResponse(err: unknown): { status: number; body: ApiError } {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message } },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: { code: "VALIDATION", message: err.message || "Validation failed" } },
    };
  }

  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "Internal Server Error" } },
  };
}
