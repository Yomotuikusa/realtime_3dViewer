import { z } from "zod";
import {
  CameraStateSchema,
  CommentSchema,
  FocalLengthSchema,
  LightAnglesSchema,
  ModelVersionSchema,
  PresenceUserSchema,
  StrokeSchema,
  type CameraState,
  type Comment,
  type LightAngles,
  type ModelVersion,
  type PresenceUser,
  type Stroke,
} from "./types";

export const MAX_NAME_LENGTH = 50;
export const CAMERA_SEND_INTERVAL_MS = 50;
/** ライトの向きの送信間隔(ms)。061 の送信 throttle が使う */
export const LIGHT_SEND_INTERVAL_MS = 50;

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "camera"; camera: CameraState; focalLength?: number }
  | { type: "light"; angles: LightAngles }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear" }
  /** 自分が versionId のオブジェクトの表示・非表示を切り替えた */
  | { type: "object:visibility"; versionId: string; visible: boolean };

export type ServerMessage =
  | {
      type: "welcome";
      selfId: string;
      users: PresenceUser[];
      strokes: Stroke[];
      light?: LightAngles;
      /** ルームで非表示になっているオブジェクトの versionId。空なら省略される */
      hiddenObjectIds?: string[];
    }
  | { type: "user:joined"; user: PresenceUser }
  | { type: "user:left"; userId: string }
  | { type: "camera"; userId: string; camera: CameraState; focalLength?: number }
  | { type: "light"; userId: string; angles: LightAngles }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear"; userId: string }
  | { type: "comment:created"; comment: Comment }
  | { type: "comment:updated"; comment: Comment }
  /** userId が versionId の表示・非表示を切り替えた(送信元以外へ中継) */
  | { type: "object:visibility"; userId: string; versionId: string; visible: boolean }
  /** REST でオブジェクトが追加された(ルーム全員へ配信) */
  | { type: "object:added"; version: ModelVersion }
  | { type: "error"; code: string; message: string };

const IdSchema = z.string().min(1);

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), name: z.string().max(MAX_NAME_LENGTH) }),
  z.object({ type: z.literal("camera"), camera: CameraStateSchema, focalLength: FocalLengthSchema.optional() }),
  z.object({ type: z.literal("light"), angles: LightAnglesSchema }),
  z.object({ type: z.literal("stroke:add"), stroke: StrokeSchema }),
  z.object({ type: z.literal("stroke:remove"), strokeId: IdSchema }),
  z.object({ type: z.literal("stroke:clear") }),
  z.object({ type: z.literal("object:visibility"), versionId: IdSchema, visible: z.boolean() }),
]) satisfies z.ZodType<ClientMessage>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("welcome"),
    selfId: IdSchema,
    users: z.array(PresenceUserSchema),
    strokes: z.array(StrokeSchema),
    light: LightAnglesSchema.optional(),
    hiddenObjectIds: z.array(IdSchema).optional(),
  }),
  z.object({ type: z.literal("user:joined"), user: PresenceUserSchema }),
  z.object({ type: z.literal("user:left"), userId: IdSchema }),
  z.object({
    type: z.literal("camera"),
    userId: IdSchema,
    camera: CameraStateSchema,
    focalLength: FocalLengthSchema.optional(),
  }),
  z.object({ type: z.literal("light"), userId: IdSchema, angles: LightAnglesSchema }),
  z.object({ type: z.literal("stroke:add"), stroke: StrokeSchema }),
  z.object({ type: z.literal("stroke:remove"), strokeId: IdSchema }),
  z.object({ type: z.literal("stroke:clear"), userId: IdSchema }),
  z.object({ type: z.literal("comment:created"), comment: CommentSchema }),
  z.object({ type: z.literal("comment:updated"), comment: CommentSchema }),
  z.object({ type: z.literal("object:visibility"), userId: IdSchema, versionId: IdSchema, visible: z.boolean() }),
  z.object({ type: z.literal("object:added"), version: ModelVersionSchema }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]) satisfies z.ZodType<ServerMessage>;

export type ParseResult<T> = { ok: true; msg: T } | { ok: false; error: string };

function parseMessage<T>(raw: string, schema: z.ZodType<T>): ParseResult<T> {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success
      ? { ok: true, msg: result.data }
      : { ok: false, error: result.error.message };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Parse and validate one text frame without throwing. */
export function parseClientMessage(raw: string): ParseResult<ClientMessage> {
  return parseMessage(raw, ClientMessageSchema);
}

/** Parse and validate one text frame without throwing. */
export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  return parseMessage(raw, ServerMessageSchema);
}
