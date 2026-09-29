import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/db/connection";
import { findUserIdBySessionHash, insertSession, insertUser } from "../src/db/users";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("users and sessions database layer", () => {
  it("inserts users and resolves a session hash", () => {
    const db = openDb(":memory:");
    databases.push(db);

    insertUser(db, { id: "u1", createdAt: 10 });
    insertSession(db, { tokenHash: "h1", userId: "u1", createdAt: 11 });

    expect(findUserIdBySessionHash(db, "h1")).toBe("u1");
    expect(findUserIdBySessionHash(db, "missing")).toBeNull();
  });

  it("enforces the session user foreign key and cascades user deletion", () => {
    const db = openDb(":memory:");
    databases.push(db);

    expect(() => insertSession(db, { tokenHash: "h1", userId: "missing", createdAt: 1 })).toThrow();
    insertUser(db, { id: "u1", createdAt: 1 });
    insertSession(db, { tokenHash: "h1", userId: "u1", createdAt: 2 });
    db.prepare("DELETE FROM users WHERE id = ?").run("u1");

    expect(findUserIdBySessionHash(db, "h1")).toBeNull();
  });
});
