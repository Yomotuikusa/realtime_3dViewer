import type { ClientMessage, ServerMessage } from "@shared/protocol";
import { objectPartKey } from "@shared/object-part";
import type { JointDisplay, LightAngles, MeshCompare, MeshDisplayMode } from "@shared/types";
import type { ObjectPartRef } from "@shared/types";
import { cloneMotionTrail, type MotionTrail } from "@shared/trail";

/**
 * ルームで共有する「3D ビューの見え方」の状態(設計書 §13.5)。
 * 表示に関わる共有状態はここに置き、applyDisplayMessage で更新し、displayWelcomeFields で復元する。
 */
export interface RoomDisplayState {
  /** ルームで共有するライトの向き。誰も変えていなければ null */
  light: LightAngles | null;
  /** 非表示にされた版の versionId。挿入順を保つ */
  hiddenObjects: Set<string>;
  /** 非表示にされた部位。キーは objectPartKey(part)。挿入順を保つ */
  hiddenParts: Map<string, ObjectPartRef>;
  /** ルームで共有するメッシュの表示方法。誰も切り替えていなければ null */
  meshDisplay: MeshDisplayMode | null;
  /** ルームで共有するメッシュ比較の設定。誰も変えていなければ null */
  meshCompare: MeshCompare | null;
  /** ルームで共有するジョイントの表示設定。誰も変えていなければ null */
  jointDisplay: JointDisplay | null;
  /** ルームで共有する軌跡の表示設定。誰も変えていなければ null */
  motionTrail: MotionTrail | null;
  /** ルームで共有する再生対象の versionId。誰も選んでいなければ null */
  playbackSource: string | null;
}

/** 表示状態を変える ClientMessage */
export type DisplayClientMessage = Extract<
  ClientMessage,
  { type: "light" | "object:visibility" | "object:part-visibility" | "mesh:display" | "mesh:compare" | "joint:display" | "trail:display" | "playback:source" }
>;

export type WelcomeMessage = Extract<ServerMessage, { type: "welcome" }>;

/** 表示状態の welcome 復元フィールド(未設定・空のキーは含まれない) */
export type DisplayWelcomeFields = Pick<
  WelcomeMessage,
  "light" | "hiddenObjectIds" | "hiddenObjectParts" | "meshDisplay" | "meshCompare" | "jointDisplay" | "motionTrail" | "playbackSource"
>;

/** すべて未設定の初期状態を作る(Set は呼び出しごとに新しいインスタンス) */
export function createRoomDisplayState(): RoomDisplayState {
  return {
    light: null,
    hiddenObjects: new Set<string>(),
    hiddenParts: new Map<string, ObjectPartRef>(),
    meshDisplay: null,
    meshCompare: null,
    jointDisplay: null,
    motionTrail: null,
    playbackSource: null,
  };
}

/** 表示状態を更新し、送信元以外へ中継するメッセージを作る。 */
export function applyDisplayMessage(
  state: RoomDisplayState,
  userId: string,
  msg: DisplayClientMessage,
): ServerMessage {
  switch (msg.type) {
    case "light":
      state.light = { yaw: msg.angles.yaw, pitch: msg.angles.pitch };
      return { type: "light", userId, angles: { ...state.light } };
    case "object:visibility":
      if (msg.visible) state.hiddenObjects.delete(msg.versionId);
      else state.hiddenObjects.add(msg.versionId);
      return { type: "object:visibility", userId, versionId: msg.versionId, visible: msg.visible };
    case "object:part-visibility": {
      const part = { versionId: msg.versionId, objectPath: msg.objectPath };
      const key = objectPartKey(part);
      if (msg.visible) state.hiddenParts.delete(key);
      else if (!state.hiddenParts.has(key)) state.hiddenParts.set(key, part);
      return { type: "object:part-visibility", userId, ...part, visible: msg.visible };
    }
    case "mesh:display":
      state.meshDisplay = msg.mode;
      return { type: "mesh:display", userId, mode: msg.mode };
    case "mesh:compare":
      state.meshCompare = { ...msg.compare };
      return { type: "mesh:compare", userId, compare: { ...state.meshCompare } };
    case "joint:display":
      state.jointDisplay = { ...msg.display };
      return { type: "joint:display", userId, display: { ...state.jointDisplay } };
    case "trail:display": {
      state.motionTrail = cloneMotionTrail(msg.trail);
      return { type: "trail:display", userId, trail: cloneMotionTrail(state.motionTrail) };
    }
    case "playback:source":
      state.playbackSource = msg.versionId;
      return { type: "playback:source", userId, versionId: msg.versionId };
  }
}

/** welcome に載せる表示状態の復元フィールドを、必要なキーだけ複製して返す。 */
export function displayWelcomeFields(state: RoomDisplayState): DisplayWelcomeFields {
  const fields: DisplayWelcomeFields = {};
  if (state.light !== null) fields.light = { ...state.light };
  if (state.hiddenObjects.size > 0) fields.hiddenObjectIds = [...state.hiddenObjects];
  if (state.hiddenParts.size > 0) fields.hiddenObjectParts = hiddenPartsOf(state);
  if (state.meshDisplay !== null) fields.meshDisplay = state.meshDisplay;
  if (state.meshCompare !== null) fields.meshCompare = { ...state.meshCompare };
  if (state.jointDisplay !== null) fields.jointDisplay = { ...state.jointDisplay };
  if (state.motionTrail !== null) fields.motionTrail = cloneMotionTrail(state.motionTrail);
  if (state.playbackSource !== null) fields.playbackSource = state.playbackSource;
  return fields;
}

/** hiddenParts の挿入順の複製配列を返す。各部位参照も複製する。 */
export function hiddenPartsOf(state: RoomDisplayState): ObjectPartRef[] {
  return [...state.hiddenParts.values()].map((part) => ({ ...part }));
}

/** Remove all display-state references to a deleted model version. */
export function forgetObjectInDisplay(state: RoomDisplayState, versionId: string): void {
  state.hiddenObjects.delete(versionId);
  for (const [key, part] of state.hiddenParts) {
    if (part.versionId === versionId) state.hiddenParts.delete(key);
  }
  const compare = state.meshCompare;
  if (compare !== null) {
    const baseId = compare.baseId === versionId ? null : compare.baseId;
    const targetId = compare.targetId === versionId ? null : compare.targetId;
    if (baseId !== compare.baseId || targetId !== compare.targetId) {
      state.meshCompare = { ...compare, baseId, targetId };
    }
  }
  if (state.playbackSource === versionId) state.playbackSource = null;
}
