import { z } from "zod";

export type Vec3 = [number, number, number];

/** OrbitControls と 1:1。fov は固定(50)なので持たない */
export interface CameraState {
  position: Vec3;
  target: Vec3;
}

export interface Stroke {
  id: string;
  userId: string;
  color: string;
  points: Vec3[];
  createdAt: number;
}

export type CommentStatus = "open" | "resolved";

export interface Comment {
  id: string;
  projectId: string;
  versionId: string;
  authorName: string;
  body: string;
  anchor: Vec3;
  camera: CameraState;
  strokes: Stroke[];
  status: CommentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ModelVersion {
  id: string;
  projectId: string;
  number: number;
  fileName: string;
  byteSize: number;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  latestVersion: ModelVersion;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  camera: CameraState | null;
}

const RequiredIdSchema = z.string().min(1);
const TimestampSchema = z.number().int().nonnegative();

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]) satisfies z.ZodType<Vec3>;

/** "#rrggbb"。16進数の大文字・小文字を受け付ける。 */
export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/) satisfies z.ZodType<string>;

export const CameraStateSchema = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
}) satisfies z.ZodType<CameraState>;

export const StrokeSchema = z.object({
  id: RequiredIdSchema,
  userId: RequiredIdSchema,
  color: ColorSchema,
  points: z.array(Vec3Schema).min(2).max(2000),
  createdAt: TimestampSchema,
}) satisfies z.ZodType<Stroke>;

export const CommentStatusSchema = z.enum(["open", "resolved"]) satisfies z.ZodType<CommentStatus>;

export const CommentSchema = z.object({
  id: RequiredIdSchema,
  projectId: RequiredIdSchema,
  versionId: RequiredIdSchema,
  authorName: RequiredIdSchema,
  body: RequiredIdSchema,
  anchor: Vec3Schema,
  camera: CameraStateSchema,
  strokes: z.array(StrokeSchema),
  status: CommentStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}) satisfies z.ZodType<Comment>;

export const ModelVersionSchema = z.object({
  id: RequiredIdSchema,
  projectId: RequiredIdSchema,
  number: z.number().int().positive(),
  fileName: RequiredIdSchema,
  byteSize: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
}) satisfies z.ZodType<ModelVersion>;

export const ProjectSchema = z.object({
  id: RequiredIdSchema,
  name: RequiredIdSchema,
  createdAt: TimestampSchema,
  latestVersion: ModelVersionSchema,
}) satisfies z.ZodType<Project>;

export const PresenceUserSchema = z.object({
  id: RequiredIdSchema,
  name: RequiredIdSchema,
  color: ColorSchema,
  camera: CameraStateSchema.nullable(),
}) satisfies z.ZodType<PresenceUser>;
