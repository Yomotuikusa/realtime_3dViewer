import type { Context, Hono } from "hono";
import { Hono as HonoApp } from "hono";
import { LoginInput } from "@shared/account";
import type { AppDeps } from "../app";
import { findAccount, findCredentialsByLoginId } from "../db/accounts";
import { HttpError } from "../errors";
import { hashPassword, verifyPassword } from "../identity/password";
import { identityDepsFrom, endSession } from "../identity/session";
import { signIn } from "../identity/sign-in";
import { type AuthLimiters, tooManyRequests } from "../identity/rate-limit";

async function parseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "Request body must be valid JSON");
  }
}

export function accountLoginRoutes(deps: Required<AppDeps>, limiters: AuthLimiters): Hono {
  const routes = new HonoApp();
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => dummyHash ??= hashPassword("invalid-login-dummy", deps.passwordParams);

  routes.post("/login", async (c) => {
    const input = LoginInput.parse(await parseJson(c));
    const ip = deps.clientAddress(c);
    const idKey = `${input.loginId}|${ip}`;
    const retryAfter = [
      limiters.byIdAndIp.retryAfterSeconds(idKey),
      limiters.byIp.retryAfterSeconds(ip),
    ].reduce<number | null>((max, value) => value === null ? max : Math.max(max ?? 0, value), null);
    if (retryAfter !== null) return tooManyRequests(c, retryAfter);

    const credentials = findCredentialsByLoginId(deps.db, input.loginId);
    const valid = await verifyPassword(
      input.password,
      credentials?.passwordHash ?? await getDummyHash(),
    );
    if (!credentials || !valid) {
      limiters.byIdAndIp.record(idKey);
      limiters.byIp.record(ip);
      throw new HttpError(401, "UNAUTHORIZED", "Invalid login ID or password");
    }

    limiters.byIdAndIp.reset(idKey);
    signIn(c, identityDepsFrom(deps), credentials.userId);
    const account = findAccount(deps.db, credentials.userId);
    if (account === null) throw new HttpError(500, "INTERNAL", "Account not found");
    return c.json(account);
  });

  routes.post("/logout", (c) => {
    endSession(c, identityDepsFrom(deps));
    return c.body(null, 204);
  });

  return routes;
}
