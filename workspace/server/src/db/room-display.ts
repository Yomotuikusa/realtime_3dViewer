import { DisplayStateFieldsSchema } from "@shared/protocol";
import type { DisplayWelcomeFields, RoomDisplayStore } from "../realtime/room-display";
import type { Db } from "./connection";

interface RoomDisplayRow {
  display_json: string;
}

function invalidDisplay(projectId: string): null {
  console.warn(JSON.stringify({ level: "warn", msg: "room_display_invalid", projectId }));
  return null;
}

/** 保存済みの表示状態を読み、JSON と共有スキーマを検証する。 */
export function loadRoomDisplay(db: Db, projectId: string): DisplayWelcomeFields | null {
  const row = db
    .prepare("SELECT display_json FROM project_room_state WHERE project_id = ?")
    .get(projectId) as RoomDisplayRow | undefined;
  if (!row) return null;

  let value: unknown;
  try {
    value = JSON.parse(row.display_json);
  } catch {
    return invalidDisplay(projectId);
  }
  const parsed = DisplayStateFieldsSchema.safeParse(value);
  return parsed.success ? parsed.data : invalidDisplay(projectId);
}

/** プロジェクトが存在する場合だけ表示状態を upsert する。 */
export function saveRoomDisplay(
  db: Db,
  projectId: string,
  fields: DisplayWelcomeFields,
  updatedAt: number,
): void {
  db.prepare(
    `INSERT INTO project_room_state (project_id, display_json, updated_at)
     SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?)
     ON CONFLICT(project_id) DO UPDATE SET
       display_json = excluded.display_json,
       updated_at = excluded.updated_at`,
  ).run(projectId, JSON.stringify(fields), updatedAt, projectId);
}

/** DB 失敗をログに記録し、RoomHub の処理へ再送出しないアダプタを作る。 */
export function createRoomDisplayStore(db: Db, now: () => number): RoomDisplayStore {
  return {
    load: (projectId) => loadRoomDisplay(db, projectId),
    save: (projectId, fields) => {
      try {
        saveRoomDisplay(db, projectId, fields, now());
      } catch (error) {
        console.error(JSON.stringify({
          level: "error",
          msg: "room_display_save_failed",
          projectId,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
  };
}
