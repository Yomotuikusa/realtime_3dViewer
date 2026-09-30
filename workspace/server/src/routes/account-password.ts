import type { Context, Hono } from "hono";
import { Hono as HonoApp } from "hono";
import {
  ChangePasswordInput,
  passwordEqualsLoginId,
  RegenerateRecoveryCodeInput,
  ResetPasswordInput,
} from "@shared/account";
import type { AppDeps } from "../app";
import {
  findAccount,
  findCredentialsByLoginId,
  findCredentialsByUserId,
  setPasswordHash,
  setRecoveryCodeHash,
} from "../db/accounts";
import { withTransaction } from "../db/connection";
import { deleteSessionsOfUser } from "../db/users";
import { HttpError } from "../errors";
import { hashPassword, verifyPassword } from "../identity/password";
import { hashRecoveryCode, recoveryCodeMatches } from "../identity/recovery-code";
import { signIn } from "../identity/sign-in";
import { identityDepsFrom, resolveUserId, rotateSession } from "../identity/session";
import { type AuthLimiters, tooManyRequests } from "../identity/rate-limit";

const DUMMY_RECOVERY_CODE_HASH = "0".repeat(64);

async function parseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Request body must be valid JSON");
  }
}

function retryAfter(limiters: AuthLimiters, idKey: string, ip: string): number | null {
  return [
    limiters.byIdAndIp.retryAfterSeconds(idKey),
    limiters.byIp.retryAfterSeconds(ip),
  ].reduce<number | null>((max, value) => value === null ? max : Math.max(max ?? 0, value), null);
}

function recordFailure(limiters: AuthLimiters, idKey: string, ip: string): void {
  limiters.byIdAndIp.record(idKey);
  limiters.byIp.record(ip);
}

function requireAccountCredentials(c: Context, deps: Required<AppDeps>) {
  const userId = resolveUserId(c, deps);
  const credentials = userId === null ? null : findCredentialsByUserId(deps.db, userId);
  if (userId === null || credentials === null) {
    throw new HttpError(401, "UNAUTHORIZED", "Sign in required");
  }
  return { userId, credentials };
}

function accountOrFail(deps: Required<AppDeps>, userId: string) {
  const account = findAccount(deps.db, userId);
  if (account === null) throw new HttpError(500, "INTERNAL", "Account not found");
  return account;
}

export function accountPasswordRoutes(deps: Required<AppDeps>, limiters: AuthLimiters): Hono {
  const routes = new HonoApp();

  routes.post("/password", async (c) => {
    const input = ChangePasswordInput.parse(await parseJson(c));
    const { userId, credentials } = requireAccountCredentials(c, deps);
    if (passwordEqualsLoginId(input.newPassword, credentials.loginId)) {
      throw new HttpError(400, "VALIDATION", "Password must differ from login ID");
    }

    const ip = deps.clientAddress(c);
    const idKey = `${userId}|${ip}`;
    const blocked = retryAfter(limiters, idKey, ip);
    if (blocked !== null) return tooManyRequests(c, blocked);
    if (!await verifyPassword(input.currentPassword, credentials.passwordHash)) {
      recordFailure(limiters, idKey, ip);
      throw new HttpError(403, "FORBIDDEN", "Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.newPassword, deps.passwordParams);
    withTransaction(deps.db, () => {
      setPasswordHash(deps.db, userId, passwordHash);
      deleteSessionsOfUser(deps.db, userId);
    });
    rotateSession(c, identityDepsFrom(deps), userId, "account");
    limiters.byIdAndIp.reset(idKey);
    return c.json(accountOrFail(deps, userId));
  });

  routes.post("/password-reset", async (c) => {
    const input = ResetPasswordInput.parse(await parseJson(c));
    const ip = deps.clientAddress(c);
    const idKey = `${input.loginId}|${ip}`;
    const blocked = retryAfter(limiters, idKey, ip);
    if (blocked !== null) return tooManyRequests(c, blocked);

    const credentials = findCredentialsByLoginId(deps.db, input.loginId);
    const valid = recoveryCodeMatches(
      input.recoveryCode,
      credentials?.recoveryCodeHash ?? DUMMY_RECOVERY_CODE_HASH,
    );
    if (credentials === null || !valid) {
      recordFailure(limiters, idKey, ip);
      throw new HttpError(401, "UNAUTHORIZED", "Invalid login ID or recovery code");
    }

    const passwordHash = await hashPassword(input.newPassword, deps.passwordParams);
    const recoveryCode = deps.newRecoveryCode();
    const updated = withTransaction(deps.db, () => {
      const current = findCredentialsByLoginId(deps.db, input.loginId);
      if (current === null || !recoveryCodeMatches(input.recoveryCode, current.recoveryCodeHash)) {
        return false;
      }
      setPasswordHash(deps.db, current.userId, passwordHash);
      setRecoveryCodeHash(deps.db, current.userId, hashRecoveryCode(recoveryCode));
      deleteSessionsOfUser(deps.db, current.userId);
      return true;
    });
    if (!updated) {
      recordFailure(limiters, idKey, ip);
      throw new HttpError(401, "UNAUTHORIZED", "Invalid login ID or recovery code");
    }
    limiters.byIdAndIp.reset(idKey);
    signIn(c, identityDepsFrom(deps), credentials.userId);
    return c.json({ account: accountOrFail(deps, credentials.userId), recoveryCode });
  });

  routes.post("/recovery-code", async (c) => {
    const input = RegenerateRecoveryCodeInput.parse(await parseJson(c));
    const { userId, credentials } = requireAccountCredentials(c, deps);
    const ip = deps.clientAddress(c);
    const idKey = `${userId}|${ip}`;
    const blocked = retryAfter(limiters, idKey, ip);
    if (blocked !== null) return tooManyRequests(c, blocked);
    if (!await verifyPassword(input.password, credentials.passwordHash)) {
      recordFailure(limiters, idKey, ip);
      throw new HttpError(403, "FORBIDDEN", "Current password is incorrect");
    }

    const recoveryCode = deps.newRecoveryCode();
    setRecoveryCodeHash(deps.db, userId, hashRecoveryCode(recoveryCode));
    limiters.byIdAndIp.reset(idKey);
    return c.json({ account: accountOrFail(deps, userId), recoveryCode });
  });

  return routes;
}
