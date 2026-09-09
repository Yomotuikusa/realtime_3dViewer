import { afterEach, describe, expect, it } from "vitest";
import { MAX_JSON_BODY_BYTES, MULTIPART_OVERHEAD_BYTES } from "../src/app";
import { makeTestApp, seedProject, type TestApp } from "./helpers/app";

const apps: TestApp[] = [];

afterEach(() => {
  for (const testApp of apps.splice(0)) testApp.cleanup();
});

function testApp(overrides: Partial<Parameters<typeof makeTestApp>[0]> = {}): TestApp {
  const value = makeTestApp(overrides);
  apps.push(value);
  return value;
}

function tooLargeResponse(response: Response): Promise<void> {
  return expect(response.json()).resolves.toMatchObject({
    error: { code: "PAYLOAD_TOO_LARGE" },
  });
}

describe("request body limits", () => {
  it("rejects an oversized advertised multipart body before parsing", async () => {
    const t = testApp({ maxUploadBytes: 100 });
    const response = await t.app.request("/api/projects", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        "content-length": String(100 + MULTIPART_OVERHEAD_BYTES + 1),
      },
      body: "--test\r\n",
    });

    expect(response.status).toBe(413);
    await tooLargeResponse(response);
  });

  it.each(["abc", "1e9"])(
    "rejects an invalid advertised multipart Content-Length: %s",
    async (contentLength) => {
      const t = testApp({ maxUploadBytes: 100 });
      const response = await t.app.request("/api/projects", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          "content-length": contentLength,
        },
        body: "--test\r\n",
      });

      expect(response.status).toBe(413);
      await tooLargeResponse(response);
    },
  );

  it("rejects an oversized chunked multipart body while reading it", async () => {
    const t = testApp({ maxUploadBytes: 100 });
    const response = await t.app.request("/api/projects", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        "transfer-encoding": "chunked",
      },
      body: "x".repeat(100 + MULTIPART_OVERHEAD_BYTES + 1),
    });

    expect(response.status).toBe(413);
    await tooLargeResponse(response);
  });

  it.each([
    ["POST", "/api/projects/p1/comments"],
    ["PATCH", "/api/projects/p1/comments/c1"],
  ])("rejects an oversized advertised JSON body for %s %s", async (method, path) => {
    const t = testApp();
    const response = await t.app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_JSON_BODY_BYTES + 1),
      },
      body: "{}",
    });

    expect(response.status).toBe(413);
    await tooLargeResponse(response);
  });

  it("rejects an oversized chunked JSON body", async () => {
    const t = testApp();
    const response = await t.app.request("/api/projects/p1/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "transfer-encoding": "chunked",
      },
      body: "x".repeat(MAX_JSON_BODY_BYTES + 1),
    });

    expect(response.status).toBe(413);
    await tooLargeResponse(response);
  });

  it("does not limit a bodyless comments list request", async () => {
    const t = testApp();
    seedProject(t);
    const response = await t.app.request("/api/projects/p1/comments");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.json()).toEqual([]);
  });
});
