import type { Db } from "./connection";

/** userId が projectId を開いた記録を作成または更新する。 */
export function touchProjectMembership(
  db: Db,
  input: { projectId: string; userId: string; openedAt: number },
): void {
  db.prepare(
    `INSERT INTO project_members
      (project_id, user_id, joined_at, last_opened_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET last_opened_at = excluded.last_opened_at`,
  ).run(input.projectId, input.userId, input.openedAt, input.openedAt);
}
