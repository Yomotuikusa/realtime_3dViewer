import { createHash } from "node:crypto";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppDeps } from "../app";
import { usesHttps } from "../config";
import { deleteSession, findSession, insertSession, insertUser } from "../db/users";
import { withTransaction, type Db } from "../db/connection";

/** セッショントークンを入れる Cookie 名 */
export const SESSION_COOKIE = "rv_session";
/** Cookie の Max-Age(秒)。400 日 = Hono の setCookie が許す上限 */
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
/** アカウントセッションの有効期間(秒)。30 日 */
export const ACCOUNT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface IdentityDeps {
  db: Db;
  now: () => number;
  /** users.id の生成。AppDeps.newId とは別系統 */
  newUserId: () => string;
  /** 生のセッショントークンの生成 */
  newSessionToken: () => string;
  /** true なら Set-Cookie に Secure を付ける */
  secureCookie?: boolean;
}

/** AppDeps の共通依存関係から匿名セッション用の依存関係を作る。 */
export function identityDepsFrom(
  deps: Pick<Required<AppDeps>, "db" | "now" | "newUserId" | "newSessionToken" | "config">,
): IdentityDeps {
  return {
    db: deps.db,
    now: deps.now,
    newUserId: deps.newUserId,
    newSessionToken: deps.newSessionToken,
    secureCookie: usesHttps(deps.config),
  };
}

/** 生トークンの SHA-256 を 16 進小文字で返す(node:crypto の createHash) */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cookie のセッションからユーザーを解決し、無ければ匿名ユーザーを発行する。 */
export function ensureUser(c: Context, deps: IdentityDeps): string {
  const resolvedUserId = resolveUserId(c, deps);
  if (resolvedUserId !== null) return resolvedUserId;

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
    secure: deps.secureCookie === true,
  });
  return userId;
}

export function resolveUserId(
  c: Context,
  deps: Pick<IdentityDeps, "db" | "now">,
): string | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (token === undefined) return null;
  const session = findSession(deps.db, hashSessionToken(token));
  if (session === null) return null;
  if (session.expiresAt !== null && session.expiresAt <= deps.now()) {
    deleteSession(deps.db, hashSessionToken(token));
    return null;
  }
  return session.userId;
}

export function rotateSession(
  c: Context,
  deps: IdentityDeps,
  userId: string,
  kind: "anonymous" | "account",
): void {
  const oldToken = getCookie(c, SESSION_COOKIE);
  const newToken = deps.newSessionToken();
  const createdAt = deps.now();
  const expiresAt = kind === "account"
    ? createdAt + ACCOUNT_SESSION_MAX_AGE_SECONDS * 1000
    : null;
  withTransaction(deps.db, () => {
    if (oldToken !== undefined) deleteSession(deps.db, hashSessionToken(oldToken));
    insertSession(deps.db, {
      tokenHash: hashSessionToken(newToken),
      userId,
      createdAt,
      expiresAt,
    });
  });
  setCookie(c, SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: kind === "account" ? ACCOUNT_SESSION_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS,
    secure: deps.secureCookie === true,
  });
}
