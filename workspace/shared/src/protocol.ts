import { z } from "zod";
import {
  CameraStateSchema,
  CommentSchema,
  FocalLengthSchema,
  LightAnglesSchema,
  PresenceUserSchema,
  StrokeSchema,
  type CameraState,
  type Comment,
  type LightAngles,
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
  | { type: "stroke:clear" };

export type ServerMessage =
  | { type: "welcome"; selfId: string; users: PresenceUser[]; strokes: Stroke[]; light?: LightAngles }
  | { type: "user:joined"; user: PresenceUser }
  | { type: "user:left"; userId: string }
  | { type: "camera"; userId: string; camera: CameraState; focalLength?: number }
  | { type: "light"; userId: string; angles: LightAngles }
  | { type: "stroke:add"; stroke: Stroke }
  | { type: "stroke:remove"; strokeId: string }
  | { type: "stroke:clear"; userId: string }
  | { type: "comment:created"; comment: Comment }
  | { type: "comment:updated"; comment: Comment }
  | { type: "error"; code: string; message: string };

const IdSchema = z.string().min(1);

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), name: z.string().max(MAX_NAME_LENGTH) }),
  z.object({ type: z.literal("camera"), camera: CameraStateSchema, focalLength: FocalLengthSchema.optional() }),
  z.object({ type: z.literal("light"), angles: LightAnglesSchema }),
  z.object({ type: z.literal("stroke:add"), stroke: StrokeSchema }),
  z.object({ type: z.literal("stroke:remove"), strokeId: IdSchema }),
  z.object({ type: z.literal("stroke:clear") }),
]) satisfies z.ZodType<ClientMessage>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("welcome"),
    selfId: IdSchema,
    users: z.array(PresenceUserSchema),
    strokes: z.array(StrokeSchema),
    light: LightAnglesSchema.optional(),
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
