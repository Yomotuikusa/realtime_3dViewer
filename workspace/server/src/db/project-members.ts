import type { Db } from "./connection";
import type { ProjectSummary } from "@shared/project-list";

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

interface ProjectSummaryRow {
  id: string;
  name: string;
  created_at: number;
  last_opened_at: number;
  version_count: number;
  owner_id: string | null;
}

/** userId が members に載っている project の一覧。 */
export function listProjectSummaries(db: Db, userId: string): ProjectSummary[] {
  const rows = db.prepare(
    `SELECT p.id, p.name, p.created_at, pm.last_opened_at,
            COUNT(mv.id) AS version_count, p.owner_id
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     LEFT JOIN model_versions mv ON mv.project_id = p.id
     WHERE pm.user_id = ?
     GROUP BY p.id, p.name, p.created_at, pm.last_opened_at, p.owner_id
     ORDER BY pm.last_opened_at DESC, p.created_at DESC, p.id ASC`,
  ).all(userId) as unknown as ProjectSummaryRow[];

  return rows.map((row) => {
    const isOwner = row.owner_id !== null && row.owner_id === userId;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      lastOpenedAt: row.last_opened_at,
      versionCount: row.version_count,
      role: isOwner ? "owner" : "member",
      canManage: row.owner_id === null || isOwner,
    };
  });
}
