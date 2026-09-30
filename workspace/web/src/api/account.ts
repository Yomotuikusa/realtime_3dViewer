import type { Account, AccountWithRecoveryCode } from "@shared/account";
import { AccountSchema, AccountWithRecoveryCodeSchema } from "@shared/account";
import { requestJson, requestNoContent } from "./client";

/** GET /api/account を AccountSchema で検証して返す */
export function getAccount(): Promise<Account> {
  return requestJson("/api/account", { method: "GET" }, AccountSchema);
}

/** PATCH /api/account { displayName } */
export function updateDisplayName(displayName: string): Promise<Account> {
  return requestJson(
    "/api/account",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    },
    AccountSchema,
  );
}

/** POST /api/account/register。displayName が undefined ならキーを送らない */
export function registerAccount(input: {
  loginId: string;
  password: string;
  displayName?: string;
}): Promise<AccountWithRecoveryCode> {
  return requestJson(
    "/api/account/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    AccountWithRecoveryCodeSchema,
  );
}

/** POST /api/account/login */
export function login(input: { loginId: string; password: string }): Promise<Account> {
  return requestJson(
    "/api/account/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    AccountSchema,
  );
}

/** POST /api/account/logout。成功時の本文は読まない */
export function logout(): Promise<void> {
  return requestNoContent("/api/account/logout", { method: "POST" });
}
