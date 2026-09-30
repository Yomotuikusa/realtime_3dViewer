import type { Context } from "hono";

export interface AttemptLimiterOptions {
  limit: number;
  windowMs: number;
  now: () => number;
  /** 保持するキー数の上限。既定 10000 */
  maxKeys?: number;
}

interface Attempt {
  count: number;
  windowStart: number;
}

export class AttemptLimiter {
  private readonly attempts = new Map<string, Attempt>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(options: AttemptLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now;
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  retryAfterSeconds(key: string): number | null {
    const attempt = this.attempts.get(key);
    if (!attempt) return null;
    const remainingMs = attempt.windowStart + this.windowMs - this.now();
    if (remainingMs <= 0) {
      this.attempts.delete(key);
      return null;
    }
    if (attempt.count < this.limit) return null;
    return Math.max(1, Math.ceil(remainingMs / 1000));
  }

  record(key: string): void {
    const now = this.now();
    const existing = this.attempts.get(key);
    if (existing && now < existing.windowStart + this.windowMs) {
      existing.count += 1;
      return;
    }
    if (existing) this.attempts.delete(key);
    if (this.attempts.size >= this.maxKeys) {
      for (const [entryKey, attempt] of this.attempts) {
        if (now >= attempt.windowStart + this.windowMs) this.attempts.delete(entryKey);
      }
    }
    if (this.attempts.size >= this.maxKeys) {
      const oldest = this.attempts.keys().next().value as string | undefined;
      if (oldest !== undefined) this.attempts.delete(oldest);
    }
    this.attempts.set(key, { count: 1, windowStart: now });
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  get size(): number {
    return this.attempts.size;
  }
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMIT_PER_ID_AND_IP = 10;
export const LOGIN_LIMIT_PER_IP = 30;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;
export const REGISTER_LIMIT_PER_IP = 10;

export interface AuthLimiters {
  byIdAndIp: AttemptLimiter;
  byIp: AttemptLimiter;
  registerByIp: AttemptLimiter;
}

export function createAuthLimiters(now: () => number): AuthLimiters {
  return {
    byIdAndIp: new AttemptLimiter({ limit: LOGIN_LIMIT_PER_ID_AND_IP, windowMs: LOGIN_WINDOW_MS, now }),
    byIp: new AttemptLimiter({ limit: LOGIN_LIMIT_PER_IP, windowMs: LOGIN_WINDOW_MS, now }),
    registerByIp: new AttemptLimiter({ limit: REGISTER_LIMIT_PER_IP, windowMs: REGISTER_WINDOW_MS, now }),
  };
}

export function tooManyRequests(c: Context, retryAfterSeconds: number): Response {
  c.header("Retry-After", String(retryAfterSeconds));
  return c.json({ error: { code: "TOO_MANY_REQUESTS", message: "Too many attempts" } }, 429);
}
