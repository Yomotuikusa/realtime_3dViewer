import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, openDb, type Db } from "../src/db/connection";
import {
  findAccount,
  findCredentialsByLoginId,
  findCredentialsByUserId,
  isLoginIdTaken,
  setAccountCredentials,
  setDisplayName,
} from "../src/db/accounts";
import { deleteSession, findSession, insertSession, insertUser } from "../src/db/users";

const databases: Db[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("account database layer", () => {
  it("stores nullable account fields and credentials separately", () => {
    const db = openDb(":memory:");
    databases.push(db);
    insertUser(db, { id: "u1", createdAt: 1 });
    expect(findAccount(db, "u1")).toEqual({ userId: "u1", loginId: null, displayName: null });
    expect(findAccount(db, "missing")).toBeNull();
    setDisplayName(db, "u1", "Taro");
    setAccountCredentials(db, {
      userId: "u1", loginId: "tanaka", passwordHash: "password-hash", recoveryCodeHash: "recovery-hash",
    });
    expect(findAccount(db, "u1")).toEqual({ userId: "u1", loginId: "tanaka", displayName: "Taro" });
    expect(findCredentialsByLoginId(db, "tanaka")).toEqual({
      userId: "u1", loginId: "tanaka", passwordHash: "password-hash", recoveryCodeHash: "recovery-hash",
    });
    expect(findCredentialsByUserId(db, "u1")?.loginId).toBe("tanaka");
    expect(isLoginIdTaken(db, "tanaka")).toBe(true);
  });

  it("migrates account and session columns and keeps the session helpers compatible", () => {
    const db = new DatabaseSync(":memory:");
    databases.push(db);
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL); " +
      "CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL);");
    db.exec("INSERT INTO users (id, created_at) VALUES ('legacy-user', 1); " +
      "INSERT INTO sessions (token_hash, user_id, created_at) VALUES ('legacy-token', 'legacy-user', 2);");
    migrate(db);
    migrate(db);
    expect(db.prepare("SELECT login_id, password_hash, display_name, recovery_code_hash FROM users").get()).toEqual({
      login_id: null,
      password_hash: null,
      display_name: null,
      recovery_code_hash: null,
    });
    expect(db.prepare("SELECT expires_at FROM sessions WHERE token_hash = 'legacy-token'").get()).toEqual({
      expires_at: null,
    });
    insertUser(db, { id: "u1", createdAt: 1 });
    insertSession(db, { tokenHash: "h1", userId: "u1", createdAt: 2, expiresAt: 3 });
    expect(findSession(db, "h1")).toEqual({ userId: "u1", expiresAt: 3 });
    deleteSession(db, "h1");
    expect(findSession(db, "h1")).toBeNull();
    expect(db.prepare("PRAGMA index_list(users)").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "idx_users_login_id", unique: 1 }),
    ]));
  });

  it("allows multiple anonymous rows but rejects duplicate login IDs", () => {
    const db = openDb(":memory:");
    databases.push(db);
    insertUser(db, { id: "u1", createdAt: 1 });
    insertUser(db, { id: "u2", createdAt: 2 });
    setAccountCredentials(db, { userId: "u1", loginId: "tanaka", passwordHash: "p", recoveryCodeHash: "r" });
    expect(() => setAccountCredentials(db, {
      userId: "u2", loginId: "tanaka", passwordHash: "p", recoveryCodeHash: "r",
    })).toThrow(/UNIQUE constraint failed: users.login_id/);
  });
});
