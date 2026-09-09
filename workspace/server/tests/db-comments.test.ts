import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/db/connection";
import {
  insertComment,
  listComments,
  updateCommentStatus,
  type NewComment,
} from "../src/db/comments";
import { insertModelVersion, insertProject } from "../src/db/projects";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) {
    db.close();
  }
});

function makeDb(): Db {
  const db = openDb(":memory:");
  databases.push(db);
  return db;
}

function seedVersion(db: Db, projectId = "p1", versionId = "v1"): void {
  insertProject(db, { id: projectId, name: projectId, createdAt: 1 });
  insertModelVersion(db, {
    id: versionId,
    projectId,
    fileName: "model.glb",
    byteSize: 100,
    createdAt: 2,
  });
}

function newComment(overrides: Partial<NewComment> = {}): NewComment {
  return {
    id: "c1",
    projectId: "p1",
    versionId: "v1",
    authorName: "Aki",
    body: "Review this corner",
    anchor: [1, 2, 3],
    camera: { position: [4, 5, 6], target: [0, 1, 0] },
    strokes: [
      {
        id: "s1",
        userId: "u1",
        color: "#ff0000",
        points: [
          [0, 0, 0],
          [1, 1, 1],
          [2, 2, 2],
        ],
        createdAt: 10,
      },
      {
        id: "s2",
        userId: "u2",
        color: "#00ff00",
        points: [
          [3, 3, 3],
          [4, 4, 4],
          [5, 5, 5],
        ],
        createdAt: 11,
      },
    ],
    createdAt: 20,
    ...overrides,
  };
}

describe("comments database layer", () => {
  it("inserts a comment and round-trips its JSON fields", () => {
    const db = makeDb();
    seedVersion(db);
    const input = newComment();

    expect(insertComment(db, input)).toEqual({
      ...input,
      status: "open",
      updatedAt: input.createdAt,
    });
  });

  it("enforces project and version foreign keys", () => {
    const db = makeDb();
    seedVersion(db);

    expect(() => insertComment(db, newComment({ projectId: "missing" }))).toThrow();
    expect(() => insertComment(db, newComment({ id: "c2", versionId: "missing" }))).toThrow();
  });

  it("lists only the project comments in created and id order", () => {
    const db = makeDb();
    seedVersion(db);
    seedVersion(db, "p2", "v2");
    insertComment(db, newComment({ id: "c3", createdAt: 30 }));
    insertComment(db, newComment({ id: "c1", createdAt: 10 }));
    insertComment(db, newComment({ id: "c2", createdAt: 20 }));
    insertComment(db, newComment({ id: "other", projectId: "p2", versionId: "v2", createdAt: 1 }));

    expect(listComments(db, "p1").map((comment) => comment.id)).toEqual(["c1", "c2", "c3"]);
    expect(listComments(db, "missing")).toEqual([]);
  });

  it("uses id as the tie breaker and filters by status", () => {
    const db = makeDb();
    seedVersion(db);
    insertComment(db, newComment({ id: "c2", createdAt: 10 }));
    insertComment(db, newComment({ id: "c1", createdAt: 10 }));
    insertComment(db, newComment({ id: "c3", createdAt: 20 }));
    updateCommentStatus(db, "p1", "c2", "resolved", 99);

    expect(listComments(db, "p1").map((comment) => comment.id)).toEqual(["c1", "c2", "c3"]);
    expect(listComments(db, "p1", "open").map((comment) => comment.id)).toEqual(["c1", "c3"]);
    expect(listComments(db, "p1", "resolved").map((comment) => comment.id)).toEqual(["c2"]);
  });

  it("scopes finds and updates to the project, and toggles status", () => {
    const db = makeDb();
    seedVersion(db);
    seedVersion(db, "p2", "v2");
    insertComment(db, newComment());

    expect(updateCommentStatus(db, "p2", "c1", "resolved", 50)).toBeNull();
    expect(updateCommentStatus(db, "p1", "nope", "resolved", 50)).toBeNull();

    expect(updateCommentStatus(db, "p1", "c1", "resolved", 999)).toMatchObject({
      status: "resolved",
      updatedAt: 999,
      createdAt: 20,
    });
    expect(updateCommentStatus(db, "p1", "c1", "open", 1000)).toMatchObject({
      status: "open",
      updatedAt: 1000,
      createdAt: 20,
    });
  });
});
