import type { Context, Hono } from "hono";
import { Hono as HonoApp } from "hono";
import { RegisterAccountInput, UpdateAccountInput } from "@shared/account";
import type { AppDeps } from "../app";
import { findAccount, isLoginIdTaken, setAccountCredentials, setDisplayName } from "../db/accounts";
import { insertUser } from "../db/users";
import { withTransaction } from "../db/connection";
import { HttpError } from "../errors";
import { hashPassword } from "../identity/password";
import { hashRecoveryCode } from "../identity/recovery-code";
import { ensureUser, identityDepsFrom, resolveUserId, rotateSession } from "../identity/session";

async function parseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Request body must be valid JSON");
  }
}

function accountOrFail(deps: Required<AppDeps>, userId: string) {
  const account = findAccount(deps.db, userId);
  if (account === null) throw new HttpError(500, "INTERNAL", "Account not found");
  return account;
}

function isLoginIdConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: users.login_id");
}

export function accountRoutes(deps: Required<AppDeps>): Hono {
  const routes = new HonoApp();
  routes.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  routes.get("/", (c) => {
    const userId = ensureUser(c, identityDepsFrom(deps));
    return c.json(accountOrFail(deps, userId));
  });

  routes.patch("/", async (c) => {
    const input = UpdateAccountInput.parse(await parseJson(c));
    const userId = ensureUser(c, identityDepsFrom(deps));
    setDisplayName(deps.db, userId, input.displayName);
    return c.json(accountOrFail(deps, userId));
  });

  routes.post("/register", async (c) => {
    const input = RegisterAccountInput.parse(await parseJson(c));
    const passwordHash = await hashPassword(input.password, deps.passwordParams);
    const recoveryCode = deps.newRecoveryCode();
    const current = resolveUserId(c, deps);
    const currentAccount = current === null ? null : findAccount(deps.db, current);

    if (currentAccount !== null && currentAccount.loginId !== null) {
      throw new HttpError(409, "CONFLICT", "Already registered");
    }
    if (isLoginIdTaken(deps.db, input.loginId)) {
      throw new HttpError(409, "CONFLICT", "Login ID is already taken");
    }

    let userId = current;
    try {
      withTransaction(deps.db, () => {
        userId ??= deps.newUserId();
        if (current === null) insertUser(deps.db, { id: userId!, createdAt: deps.now() });
        setAccountCredentials(deps.db, {
          userId: userId!,
          loginId: input.loginId,
          passwordHash,
          recoveryCodeHash: hashRecoveryCode(recoveryCode),
          ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        });
      });
    } catch (error) {
      if (isLoginIdConflict(error)) {
        throw new HttpError(409, "CONFLICT", "Login ID is already taken");
      }
      throw error;
    }

    rotateSession(c, identityDepsFrom(deps), userId!, "account");
    return c.json({ account: accountOrFail(deps, userId!), recoveryCode }, 201);
  });

  return routes;
}
