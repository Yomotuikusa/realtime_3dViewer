import { createHash } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { findUserIdBySessionHash, insertSession, insertUser } from "../db/users";
import { withTransaction, type Db } from "../db/connection";

/** セッショントークンを入れる Cookie 名 */
export const SESSION_COOKIE = "rv_session";
/** Cookie の Max-Age(秒)。400 日 = Hono の setCookie が許す上限 */
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export interface IdentityDeps {
  db: Db;
  now: () => number;
  /** users.id の生成。AppDeps.newId とは別系統 */
  newUserId: () => string;
  /** 生のセッショントークンの生成 */
  newSessionToken: () => string;
}

/** 生トークンの SHA-256 を 16 進小文字で返す(node:crypto の createHash) */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cookie のセッションからユーザーを解決し、無ければ匿名ユーザーを発行する。 */
export function ensureUser(c: Context, deps: IdentityDeps): string {
  const token = getCookie(c, SESSION_COOKIE);
  if (token !== undefined) {
    const userId = findUserIdBySessionHash(deps.db, hashSessionToken(token));
    if (userId !== null) return userId;
  }

  const userId = deps.newUserId();
  const newToken = deps.newSessionToken();
  const createdAt = deps.now();
  withTransaction(deps.db, () => {
    insertUser(deps.db, { id: userId, createdAt });
    insertSession(deps.db, {
      tokenHash: hashSessionToken(newToken),
      userId,
      createdAt,
    });
  });
  setCookie(c, SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return userId;
}
