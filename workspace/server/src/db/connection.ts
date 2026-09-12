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

/** 既存 DB に後から増えた列を、無ければ ALTER TABLE で追加する。あれば何もしない。 */
export function addColumnIfMissing(
  db: Db,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((entry) => entry.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Apply the idempotent schema bundled with this module, then the column migrations. */
export function migrate(db: Db): void {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  db.exec(schema);
  addColumnIfMissing(db, "comments", "playback_json", "TEXT");
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
