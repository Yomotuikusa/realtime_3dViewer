import type { MiddlewareHandler } from "hono";
import { HttpError } from "./errors";

export const HSTS_VALUE = "max-age=31536000";

/** 応答後に Strict-Transport-Security を付ける。 */
export function hsts(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header("Strict-Transport-Security", HSTS_VALUE);
  };
}

/** 状態を変える API の Origin が公開 origin と一致することを検査する。 */
export function sameOriginGuard(publicOrigin: string | null): MiddlewareHandler {
  return async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      await next();
      return;
    }

    const requestOrigin = c.req.header("Origin");
    if (requestOrigin !== undefined) {
      const allowedOrigin = publicOrigin ?? new URL(c.req.url).origin;
      if (requestOrigin !== allowedOrigin) {
        throw new HttpError(403, "FORBIDDEN", "Cross-origin request rejected");
      }
    }
    await next();
  };
}
