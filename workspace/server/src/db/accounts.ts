import type { Account } from "@shared/account";
import type { Db } from "./connection";

export interface AccountCredentials {
  userId: string;
  loginId: string;
  passwordHash: string;
  recoveryCodeHash: string;
}

type AccountRow = { id: string; login_id: string | null; display_name: string | null };
type CredentialRow = {
  id: string;
  login_id: string;
  password_hash: string;
  recovery_code_hash: string;
};

function accountFromRow(row: AccountRow): Account {
  return { userId: row.id, loginId: row.login_id, displayName: row.display_name };
}

export function findAccount(db: Db, userId: string): Account | null {
  const row = db.prepare(
    "SELECT id, login_id, display_name FROM users WHERE id = ?",
  ).get(userId) as AccountRow | undefined;
  return row ? accountFromRow(row) : null;
}

function credentialsFromRow(row: CredentialRow): AccountCredentials {
  return {
    userId: row.id,
    loginId: row.login_id,
    passwordHash: row.password_hash,
    recoveryCodeHash: row.recovery_code_hash,
  };
}

export function findCredentialsByLoginId(db: Db, loginId: string): AccountCredentials | null {
  const row = db.prepare(
    "SELECT id, login_id, password_hash, recovery_code_hash FROM users " +
      "WHERE login_id = ?",
  ).get(loginId) as CredentialRow | undefined;
  return row ? credentialsFromRow(row) : null;
}

export function findCredentialsByUserId(db: Db, userId: string): AccountCredentials | null {
  const row = db.prepare(
    "SELECT id, login_id, password_hash, recovery_code_hash FROM users " +
      "WHERE id = ? AND login_id IS NOT NULL",
  ).get(userId) as CredentialRow | undefined;
  return row ? credentialsFromRow(row) : null;
}

export function isLoginIdTaken(db: Db, loginId: string): boolean {
  return findCredentialsByLoginId(db, loginId) !== null;
}

export function setAccountCredentials(
  db: Db,
  input: { userId: string; loginId: string; passwordHash: string; recoveryCodeHash: string; displayName?: string },
): void {
  if (input.displayName === undefined) {
    db.prepare(
      "UPDATE users SET login_id = ?, password_hash = ?, recovery_code_hash = ? WHERE id = ?",
    ).run(input.loginId, input.passwordHash, input.recoveryCodeHash, input.userId);
    return;
  }
  db.prepare(
    "UPDATE users SET login_id = ?, password_hash = ?, recovery_code_hash = ?, display_name = ? WHERE id = ?",
  ).run(input.loginId, input.passwordHash, input.recoveryCodeHash, input.displayName, input.userId);
}

export function setDisplayName(db: Db, userId: string, displayName: string): void {
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, userId);
}
