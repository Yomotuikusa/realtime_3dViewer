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
  /** 焦点距離(mm)。まだ一度も送られていなければ undefined */
  focalLength?: number;
}

export const MAX_ID_LENGTH = 64;
export const MAX_FILE_NAME_LENGTH = 255;
export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_AUTHOR_NAME_LENGTH = 50;
export const MAX_COMMENT_BODY_LENGTH = 2000;

/** 焦点距離(mm)の下限。これより広角にはしない */
export const MIN_FOCAL_LENGTH_MM = 14;
/** 焦点距離(mm)の上限 */
export const MAX_FOCAL_LENGTH_MM = 300;
/** 既定の焦点距離(mm) */
export const DEFAULT_FOCAL_LENGTH_MM = 50;

/** サーバ・クライアントが生成する識別子。nanoid の文字種に限定する。 */
export const IdSchema = z.string().min(1).max(MAX_ID_LENGTH).regex(/^[A-Za-z0-9_-]+$/);

/** アップロード元のファイル名。パス区切りと制御文字を含めない。 */
export const FileNameSchema = z.string().min(1).max(MAX_FILE_NAME_LENGTH)
  .refine((value) => !/[\\/\x00-\x1f\x7f]/.test(value));
const RequiredIdSchema = z.string().min(1);
const TimestampSchema = z.number().int().nonnegative();

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]) satisfies z.ZodType<Vec3>;

/** "#rrggbb"。16進数の大文字・小文字を受け付ける。 */
export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/) satisfies z.ZodType<string>;

export const CameraStateSchema = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
}) satisfies z.ZodType<CameraState>;

/** 焦点距離(mm)。MIN_FOCAL_LENGTH_MM 以上 MAX_FOCAL_LENGTH_MM 以下の有限数 */
export const FocalLengthSchema = z.number().min(MIN_FOCAL_LENGTH_MM).max(MAX_FOCAL_LENGTH_MM);

export const StrokeSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  color: ColorSchema,
  points: z.array(Vec3Schema).min(2).max(2000),
  createdAt: TimestampSchema,
}) satisfies z.ZodType<Stroke>;

export const CommentStatusSchema = z.enum(["open", "resolved"]) satisfies z.ZodType<CommentStatus>;

export const CommentSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  versionId: IdSchema,
  authorName: z.string().min(1).max(MAX_AUTHOR_NAME_LENGTH),
  body: z.string().min(1).max(MAX_COMMENT_BODY_LENGTH),
  anchor: Vec3Schema,
  camera: CameraStateSchema,
  strokes: z.array(StrokeSchema),
  status: CommentStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}) satisfies z.ZodType<Comment>;

export const ModelVersionSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  number: z.number().int().positive(),
  fileName: FileNameSchema,
  byteSize: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
}) satisfies z.ZodType<ModelVersion>;

export const ProjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  createdAt: TimestampSchema,
  latestVersion: ModelVersionSchema,
}) satisfies z.ZodType<Project>;

export const PresenceUserSchema = z.object({
  id: IdSchema,
  name: RequiredIdSchema,
  color: ColorSchema,
  camera: CameraStateSchema.nullable(),
  focalLength: FocalLengthSchema.optional(),
}) satisfies z.ZodType<PresenceUser>;
