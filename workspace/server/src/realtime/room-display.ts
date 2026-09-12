import type { ClientMessage, ServerMessage } from "@shared/protocol";
import type { LightAngles, MeshCompare, MeshDisplayMode } from "@shared/types";

/**
 * ルームで共有する「3D ビューの見え方」の状態(設計書 §13.5)。
 * 表示に関わる共有状態はここに置き、applyDisplayMessage で更新し、displayWelcomeFields で復元する。
 */
export interface RoomDisplayState {
  /** ルームで共有するライトの向き。誰も変えていなければ null */
  light: LightAngles | null;
  /** 非表示にされた版の versionId。挿入順を保つ */
  hiddenObjects: Set<string>;
  /** ルームで共有するメッシュの表示方法。誰も切り替えていなければ null */
  meshDisplay: MeshDisplayMode | null;
  /** ルームで共有するメッシュ比較の設定。誰も変えていなければ null */
  meshCompare: MeshCompare | null;
}

/** 表示状態を変える ClientMessage */
export type DisplayClientMessage = Extract<
  ClientMessage,
  { type: "light" | "object:visibility" | "mesh:display" | "mesh:compare" }
>;

export type WelcomeMessage = Extract<ServerMessage, { type: "welcome" }>;

/** 表示状態の welcome 復元フィールド(未設定・空のキーは含まれない) */
export type DisplayWelcomeFields = Pick<WelcomeMessage, "light" | "hiddenObjectIds" | "meshDisplay" | "meshCompare">;

/** すべて未設定の初期状態を作る(Set は呼び出しごとに新しいインスタンス) */
export function createRoomDisplayState(): RoomDisplayState {
  return {
    light: null,
    hiddenObjects: new Set<string>(),
    meshDisplay: null,
    meshCompare: null,
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
    case "mesh:display":
      state.meshDisplay = msg.mode;
      return { type: "mesh:display", userId, mode: msg.mode };
    case "mesh:compare":
      state.meshCompare = { ...msg.compare };
      return { type: "mesh:compare", userId, compare: { ...state.meshCompare } };
  }
}

/** welcome に載せる表示状態の復元フィールドを、必要なキーだけ複製して返す。 */
export function displayWelcomeFields(state: RoomDisplayState): DisplayWelcomeFields {
  const fields: DisplayWelcomeFields = {};
  if (state.light !== null) fields.light = { ...state.light };
  if (state.hiddenObjects.size > 0) fields.hiddenObjectIds = [...state.hiddenObjects];
  if (state.meshDisplay !== null) fields.meshDisplay = state.meshDisplay;
  if (state.meshCompare !== null) fields.meshCompare = { ...state.meshCompare };
  return fields;
}
