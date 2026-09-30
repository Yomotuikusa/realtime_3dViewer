import type { Context } from "hono";
import { findAccount } from "../db/accounts";
import { mergeAnonymousUser } from "../db/account-merge";
import { resolveUserId, rotateSession, type IdentityDeps } from "./session";

export function signIn(c: Context, deps: IdentityDeps, accountUserId: string): void {
  const current = resolveUserId(c, deps);
  if (current !== null && current !== accountUserId) {
    const currentAccount = findAccount(deps.db, current);
    if (currentAccount?.loginId === null) mergeAnonymousUser(deps.db, current, accountUserId);
  }
  rotateSession(c, deps, accountUserId, "account");
}
