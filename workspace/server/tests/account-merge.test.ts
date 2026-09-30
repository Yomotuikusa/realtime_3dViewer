import { afterEach, describe, expect, it } from "vitest";
import { insertUser, insertSession } from "../src/db/users";
import { insertModelVersion, insertProject } from "../src/db/projects";
import { insertComment } from "../src/db/comments";
import { hashSessionToken } from "../src/identity/session";
import { mergeAnonymousUser } from "../src/db/account-merge";
import { openDb, type Db } from "../src/db/connection";

let db: Db;
afterEach(() => db?.close());

function setup(): void {
  db = openDb(":memory:");
  insertUser(db, { id: "from", createdAt: 1 });
  insertUser(db, { id: "to", createdAt: 2 });
  db.prepare("UPDATE users SET login_id = 'to-id' WHERE id = 'to'").run();
  insertSession(db, { tokenHash: hashSessionToken("old"), userId: "from", createdAt: 1 });
  insertProject(db, { id: "p", name: "P", createdAt: 1, ownerId: "from" });
  insertProject(db, { id: "q", name: "Q", createdAt: 1, ownerId: null });
  insertModelVersion(db, { id: "v", projectId: "p", fileName: "model.glb", byteSize: 1, createdAt: 1 });
  db.prepare("INSERT INTO project_members VALUES ('p', 'from', 20, 30), ('q', 'from', 2, 3), ('p', 'to', 10, 40)").run();
  db.prepare(`INSERT INTO comments
    (id, project_id, version_id, author_name, body, anchor_json, camera_json, strokes_json,
     playback_json, status, created_at, updated_at, author_id)
    VALUES ('c', 'p', 'v', 'A', 'body', '[0,0,0]', '{}', '[]', NULL, 'open', 1, 1, 'from')`).run();
}

describe("mergeAnonymousUser", () => {
  it("moves ownership, memberships, comments, and sessions atomically", () => {
    setup();
    mergeAnonymousUser(db, "from", "to");
    expect(db.prepare("SELECT owner_id FROM projects WHERE id = 'p'").get()).toEqual({ owner_id: "to" });
    expect(db.prepare("SELECT project_id, user_id, joined_at, last_opened_at FROM project_members ORDER BY project_id").all()).toEqual([
      { project_id: "p", user_id: "to", joined_at: 10, last_opened_at: 40 },
      { project_id: "q", user_id: "to", joined_at: 2, last_opened_at: 3 },
    ]);
    expect(db.prepare("SELECT author_id FROM comments").get()).toEqual({ author_id: "to" });
    expect(db.prepare("SELECT id FROM users ORDER BY id").all()).toEqual([{ id: "to" }]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 0 });
  });

  it("rejects account, self, and missing users without changing the database", () => {
    setup();
    const before = db.prepare("SELECT * FROM users").all();
    expect(() => mergeAnonymousUser(db, "to", "from")).toThrow();
    expect(() => mergeAnonymousUser(db, "from", "from")).toThrow();
    expect(() => mergeAnonymousUser(db, "missing", "to")).toThrow();
    expect(db.prepare("SELECT * FROM users").all()).toEqual(before);
    expect(db.prepare("SELECT owner_id FROM projects").all()).toEqual([{ owner_id: "from" }, { owner_id: null }]);
  });
});
