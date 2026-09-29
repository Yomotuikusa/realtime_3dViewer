import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/db/connection";
import { listProjectSummaries, touchProjectMembership } from "../src/db/project-members";
import { insertModelVersion, insertProject } from "../src/db/projects";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

function database(): Db {
  const db = openDb(":memory:");
  databases.push(db);
  return db;
}

function addProject(db: Db, id: string, createdAt: number, openedAt: number, userId: string, versions = 0): void {
  insertProject(db, { id, name: id, createdAt, ownerId: userId });
  for (let index = 0; index < versions; index += 1) {
    insertModelVersion(db, {
      id: `${id}-v${index + 1}`,
      projectId: id,
      fileName: `${id}.glb`,
      byteSize: 1,
      createdAt,
    });
  }
  touchProjectMembership(db, { projectId: id, userId, openedAt });
}

describe("listProjectSummaries", () => {
  it("uses the shared management rule for owned and legacy projects", () => {
    const db = database();
    for (const userId of ["u1", "u2"]) {
      db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run(userId, 1);
    }
    insertProject(db, { id: "owned-by-other", name: "Owned", createdAt: 1, ownerId: "u2" });
    insertProject(db, { id: "legacy", name: "Legacy", createdAt: 2 });
    touchProjectMembership(db, { projectId: "owned-by-other", userId: "u1", openedAt: 1 });
    touchProjectMembership(db, { projectId: "legacy", userId: "u1", openedAt: 2 });

    expect(listProjectSummaries(db, "u1")).toMatchObject([
      { id: "legacy", role: "member", canManage: true },
      { id: "owned-by-other", role: "member", canManage: false },
    ]);
  });

  it("sorts by last opened time descending", () => {
    const db = database();
    db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("u1", 1);
    addProject(db, "p10", 10, 10, "u1");
    addProject(db, "p30", 30, 30, "u1");
    addProject(db, "p20", 20, 20, "u1");

    expect(listProjectSummaries(db, "u1").map((project) => project.id)).toEqual(["p30", "p20", "p10"]);
  });

  it("uses created time and then ID to break equal opened times", () => {
    const db = database();
    db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run("u1", 1);
    addProject(db, "same-id", 10, 50, "u1");
    addProject(db, "newer", 20, 50, "u1", 2);
    addProject(db, "older-b", 10, 50, "u1");

    expect(listProjectSummaries(db, "u1").map((project) => project.id)).toEqual([
      "newer",
      "older-b",
      "same-id",
    ]);
    expect(listProjectSummaries(db, "u1")[0]).toMatchObject({ versionCount: 2, role: "owner", canManage: true });
  });
});
