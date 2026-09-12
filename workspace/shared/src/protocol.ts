import { z } from "zod";
import {
  CameraStateSchema,
  CommentSchema,
  FocalLengthSchema,
  JointDisplaySchema,
  LightAnglesSchema,
  MeshCompareSchema,
  MeshDisplayModeSchema,
  ModelVersionSchema,
  ObjectPartRefSchema,
  ObjectPathSchema,
  PresenceUserSchema,
  StrokeSchema,
  type CameraState,
  type Comment,
  type LightAngles,
  type JointDisplay,
  type MeshCompare,
  type MeshDisplayMode,
  type ModelVersion,
  type ObjectPartRef,
  type ObjectPath,
  type PresenceUser,
  type Stroke,
} from "./types";
import { MotionTrailSchema, type MotionTrail } from "./trail";

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
  | { type: "object:visibility"; versionId: string; visible: boolean }
  /** 自分が versionId の版内オブジェクト(部位)の表示・非表示を切り替えた */
  | { type: "object:part-visibility"; versionId: string; objectPath: ObjectPath; visible: boolean }
  /** 自分がメッシュの表示方法を切り替えた */
  | { type: "mesh:display"; mode: MeshDisplayMode }
  /** 自分がメッシュ比較の設定を変えた(値全体を送る) */
  | { type: "mesh:compare"; compare: MeshCompare }
  /** 自分がジョイントの表示設定を変えた(値全体を送る) */
  | { type: "joint:display"; display: JointDisplay }
  /** 自分が軌跡の表示設定を変えた(値全体を送る) */
  | { type: "trail:display"; trail: MotionTrail };

export type ServerMessage =
  | {
      type: "welcome";
      selfId: string;
      users: PresenceUser[];
      strokes: Stroke[];
      light?: LightAngles;
      /** ルームで非表示になっているオブジェクトの versionId。空なら省略される */
      hiddenObjectIds?: string[];
      /** ルームで非表示になっている部位。空なら省略される */
      hiddenObjectParts?: ObjectPartRef[];
      /** ルームのメッシュ表示方法。誰も切り替えていなければ省略される */
      meshDisplay?: MeshDisplayMode;
      /** ルームのメッシュ比較設定。誰も変えていなければ省略される */
      meshCompare?: MeshCompare;
      /** ルームのジョイント表示設定。誰も変えていなければ省略される */
      jointDisplay?: JointDisplay;
      /** ルームの軌跡表示設定。誰も変えていなければ省略される */
      motionTrail?: MotionTrail;
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
  /** userId が versionId の部位 objectPath の表示・非表示を切り替えた(送信元以外へ中継) */
  | { type: "object:part-visibility"; userId: string; versionId: string; objectPath: ObjectPath; visible: boolean }
  /** REST でオブジェクトが追加された(ルーム全員へ配信) */
  | { type: "object:added"; version: ModelVersion }
  /** userId がメッシュの表示方法を切り替えた(送信元以外へ中継) */
  | { type: "mesh:display"; userId: string; mode: MeshDisplayMode }
  /** userId がメッシュ比較の設定を変えた(送信元以外へ中継) */
  | { type: "mesh:compare"; userId: string; compare: MeshCompare }
  /** userId がジョイントの表示設定を変えた(送信元以外へ中継) */
  | { type: "joint:display"; userId: string; display: JointDisplay }
  /** userId が軌跡の表示設定を変えた(送信元以外へ中継) */
  | { type: "trail:display"; userId: string; trail: MotionTrail }
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
  z.object({ type: z.literal("object:part-visibility"), versionId: IdSchema, objectPath: ObjectPathSchema, visible: z.boolean() }),
  z.object({ type: z.literal("mesh:display"), mode: MeshDisplayModeSchema }),
  z.object({ type: z.literal("mesh:compare"), compare: MeshCompareSchema }),
  z.object({ type: z.literal("joint:display"), display: JointDisplaySchema }),
  z.object({ type: z.literal("trail:display"), trail: MotionTrailSchema }),
]) satisfies z.ZodType<ClientMessage>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("welcome"),
    selfId: IdSchema,
    users: z.array(PresenceUserSchema),
    strokes: z.array(StrokeSchema),
    light: LightAnglesSchema.optional(),
    hiddenObjectIds: z.array(IdSchema).optional(),
    hiddenObjectParts: z.array(ObjectPartRefSchema).optional(),
    meshDisplay: MeshDisplayModeSchema.optional(),
    meshCompare: MeshCompareSchema.optional(),
    jointDisplay: JointDisplaySchema.optional(),
    motionTrail: MotionTrailSchema.optional(),
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
  z.object({ type: z.literal("object:part-visibility"), userId: IdSchema, versionId: IdSchema, objectPath: ObjectPathSchema, visible: z.boolean() }),
  z.object({ type: z.literal("object:added"), version: ModelVersionSchema }),
  z.object({ type: z.literal("mesh:display"), userId: IdSchema, mode: MeshDisplayModeSchema }),
  z.object({ type: z.literal("mesh:compare"), userId: IdSchema, compare: MeshCompareSchema }),
  z.object({ type: z.literal("joint:display"), userId: IdSchema, display: JointDisplaySchema }),
  z.object({ type: z.literal("trail:display"), userId: IdSchema, trail: MotionTrailSchema }),
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
