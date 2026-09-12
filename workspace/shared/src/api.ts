import { z } from "zod";
import {
  CameraStateSchema,
  CommentPlaybackSchema,
  CommentStatusSchema,
  IdSchema,
  MAX_AUTHOR_NAME_LENGTH,
  MAX_COMMENT_BODY_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  StrokeSchema,
  Vec3Schema,
} from "./types";

export const ErrorCode = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

const ErrorCodeSchema = z.enum(ErrorCode);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
  }),
}) satisfies z.ZodType<ApiError>;

export const MAX_UPLOAD_BYTES_DEFAULT = 100 * 1024 * 1024;
export const ALLOWED_MODEL_EXTENSIONS = [".glb", ".gltf", ".fbx", ".obj"] as const;

/** Accepted model format, without the leading dot. */
export type ModelFormat = "glb" | "gltf" | "fbx" | "obj";

/** Content-Type used when serving each accepted model format. */
export const MODEL_CONTENT_TYPES: Readonly<Record<ModelFormat, string>> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/octet-stream",
  obj: "text/plain; charset=utf-8",
};

/** Return the supported final filename extension, without its leading dot. */
export function modelFormat(fileName: string): ModelFormat | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return null;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return extension === "glb" || extension === "gltf" || extension === "fbx" || extension === "obj"
    ? extension
    : null;
}
export const ProjectNameSchema = z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH);

export const CreateCommentInput = z.object({
  versionId: IdSchema,
  authorName: z.string().trim().min(1).max(MAX_AUTHOR_NAME_LENGTH),
  body: z.string().trim().min(1).max(MAX_COMMENT_BODY_LENGTH),
  anchor: Vec3Schema,
  camera: CameraStateSchema,
  strokes: z.array(StrokeSchema).max(200),
  playback: CommentPlaybackSchema.nullable().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

export const UpdateCommentStatusInput = z.object({ status: CommentStatusSchema });
export type UpdateCommentStatusInput = z.infer<typeof UpdateCommentStatusInput>;

export const ListCommentsQuery = z.object({ status: CommentStatusSchema.optional() });
export type ListCommentsQuery = z.infer<typeof ListCommentsQuery>;
