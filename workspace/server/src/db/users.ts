import type { Db } from "./connection";

/** 匿名ユーザーの行を作る。将来のアカウントも同じ users 行を使う */
export function insertUser(db: Db, input: { id: string; createdAt: number }): void {
  db.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").run(input.id, input.createdAt);
}

/** セッションを作る。tokenHash は生トークンの SHA-256(16進小文字 64 文字) */
export function insertSession(
  db: Db,
  input: { tokenHash: string; userId: string; createdAt: number },
): void {
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)",
  ).run(input.tokenHash, input.userId, input.createdAt);
}

/** tokenHash に対応する user id。無ければ null */
export function findUserIdBySessionHash(db: Db, tokenHash: string): string | null {
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE token_hash = ?")
    .get(tokenHash) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}
