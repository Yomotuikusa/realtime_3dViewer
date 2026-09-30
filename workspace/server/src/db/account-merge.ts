import { withTransaction, type Db } from "./connection";

export function mergeAnonymousUser(db: Db, fromUserId: string, toUserId: string): void {
  withTransaction(db, () => {
    if (fromUserId === toUserId) throw new Error("Cannot merge a user into itself");
    const from = db.prepare("SELECT login_id FROM users WHERE id = ?").get(fromUserId) as
      | { login_id: string | null }
      | undefined;
    const to = db.prepare("SELECT id FROM users WHERE id = ?").get(toUserId) as
      | { id: string }
      | undefined;
    if (!from || !to) throw new Error("Cannot merge a missing user");
    if (from.login_id !== null) throw new Error("Only anonymous users can be merged");

    db.prepare(
      `INSERT INTO project_members
        (project_id, user_id, joined_at, last_opened_at)
       SELECT project_id, ?, joined_at, last_opened_at
       FROM project_members
       WHERE user_id = ?
       ON CONFLICT(project_id, user_id) DO UPDATE SET
         joined_at = MIN(project_members.joined_at, excluded.joined_at),
         last_opened_at = MAX(project_members.last_opened_at, excluded.last_opened_at)`,
    ).run(toUserId, fromUserId);
    db.prepare("UPDATE projects SET owner_id = ? WHERE owner_id = ?").run(toUserId, fromUserId);
    db.prepare("UPDATE comments SET author_id = ? WHERE author_id = ?").run(toUserId, fromUserId);
    db.prepare("DELETE FROM users WHERE id = ?").run(fromUserId);
  });
}
