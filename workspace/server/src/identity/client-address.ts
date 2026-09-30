import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

/**
 * 接続元 IP を返す。Caddy は受信済み X-Forwarded-For の末尾へ実際の接続元を追記するため、
 * プロキシを信頼するときは最後の要素を使う。
 */
export function clientAddressFrom(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header("X-Forwarded-For");
    const address = forwarded?.split(",").at(-1)?.trim();
    if (address) return address;
  }

  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // app.request() には接続情報がなく getConnInfo が例外になるため、「接続情報なし」と扱う。
    return "unknown";
  }
}
