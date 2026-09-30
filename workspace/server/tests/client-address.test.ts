import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { clientAddressFrom } from "../src/identity/client-address";

describe("clientAddressFrom", () => {
  it("uses the last forwarded address only when the proxy is trusted", async () => {
    const app = new Hono();
    app.get("/", (c) => c.text(clientAddressFrom(c, true)));
    const response = await app.request("/", {
      headers: { "X-Forwarded-For": "1.1.1.1, 2.2.2.2 " },
    });
    expect(await response.text()).toBe("2.2.2.2");
  });

  it("returns unknown without connection information", async () => {
    const app = new Hono();
    app.get("/", (c) => c.text(clientAddressFrom(c, false)));
    const forwarded = await app.request("/", {
      headers: { "X-Forwarded-For": "1.1.1.1, 2.2.2.2" },
    });
    const missing = await app.request("/");
    const empty = await app.request("/", { headers: { "X-Forwarded-For": " , " } });
    expect(await forwarded.text()).toBe("unknown");
    expect(await missing.text()).toBe("unknown");
    expect(await empty.text()).toBe("unknown");
  });
});
