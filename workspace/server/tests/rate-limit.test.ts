import { describe, expect, it } from "vitest";
import {
  AttemptLimiter,
  createAuthLimiters,
  LOGIN_LIMIT_PER_ID_AND_IP,
  LOGIN_WINDOW_MS,
} from "../src/identity/rate-limit";

describe("AttemptLimiter", () => {
  it("counts within a fixed window and reports rounded retry time", () => {
    let now = 0;
    const limiter = new AttemptLimiter({ limit: 3, windowMs: 1000, now: () => now });
    limiter.record("key");
    limiter.record("key");
    expect(limiter.retryAfterSeconds("key")).toBeNull();
    limiter.record("key");
    expect(limiter.retryAfterSeconds("key")).toBe(1);
    now = 1000;
    expect(limiter.retryAfterSeconds("key")).toBeNull();
    expect(limiter.size).toBe(0);
    limiter.record("key");
    expect(limiter.retryAfterSeconds("key")).toBeNull();
  });

  it("evicts expired and then oldest keys at capacity", () => {
    let now = 0;
    const limiter = new AttemptLimiter({ limit: 1, windowMs: 100, maxKeys: 2, now: () => now });
    limiter.record("a");
    limiter.record("b");
    now = 100;
    limiter.record("c");
    expect(limiter.size).toBe(1);
    limiter.record("a");
    limiter.record("b");
    expect(limiter.size).toBe(2);
    expect(limiter.retryAfterSeconds("a")).toBe(1);
    expect(limiter.retryAfterSeconds("b")).toBe(1);
  });

  it("resets only the requested key and creates independent auth limiters", () => {
    let now = 0;
    const limiter = new AttemptLimiter({ limit: 1, windowMs: 1000, now: () => now });
    limiter.record("a");
    limiter.record("b");
    limiter.reset("a");
    expect(limiter.retryAfterSeconds("a")).toBeNull();
    expect(limiter.retryAfterSeconds("b")).toBe(1);
    const first = createAuthLimiters(() => now);
    const second = createAuthLimiters(() => now);
    for (let i = 0; i < LOGIN_LIMIT_PER_ID_AND_IP; i += 1) first.byIdAndIp.record("id|ip");
    expect(first.byIdAndIp.retryAfterSeconds("id|ip")).toBe(Math.ceil(LOGIN_WINDOW_MS / 1000));
    expect(second.byIdAndIp.retryAfterSeconds("id|ip")).toBeNull();
  });
});
