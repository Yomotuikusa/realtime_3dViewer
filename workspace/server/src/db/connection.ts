import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

/** Apply the schema and SQLite settings to a newly opened database. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  migrate(db);
  return db;
}

/** Apply the idempotent schema bundled with this module. */
export function migrate(db: Db): void {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  db.exec(schema);
}

/** Run a callback in a SQLite transaction, rolling back failures. */
export function withTransaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
