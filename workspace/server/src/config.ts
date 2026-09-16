import { MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";

/** WEB_DIST_DIR の既定。app.ts の static の既定もこれを使う */
export const DEFAULT_WEB_DIST_DIR = "./web/dist";
/** WS_HEARTBEAT_INTERVAL_MS の既定。0 でハートビート無効 */
export const DEFAULT_WS_HEARTBEAT_INTERVAL_MS = 30_000;

export interface Config {
  port: number;
  dataDir: string;
  maxUploadBytes: number;
  /** WEB_DIST_DIR (default "./web/dist"); relative paths are resolved from cwd. */
  webDistDir: string;
  /** WS_HEARTBEAT_INTERVAL_MS。ping の間隔(ms)。0 で無効 */
  wsHeartbeatIntervalMs: number;
}

function parseNonNegativeInteger(name: string, value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }
  return parsed;
}

function parsePort(value: string): number {
  const parsed = parseNonNegativeInteger("PORT", value);
  if (parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be between 1 and 65535");
  }
  return parsed;
}

/** Load server settings from environment variables and their defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = parsePort(env.PORT ?? "3000");
  const dataDir = env.DATA_DIR ?? "./data";
  const maxUploadBytes = parseNonNegativeInteger(
    "MAX_UPLOAD_BYTES",
    env.MAX_UPLOAD_BYTES ?? String(MAX_UPLOAD_BYTES_DEFAULT),
  );
  const webDistDir = env.WEB_DIST_DIR ?? DEFAULT_WEB_DIST_DIR;
  const wsHeartbeatIntervalMs = parseNonNegativeInteger(
    "WS_HEARTBEAT_INTERVAL_MS",
    env.WS_HEARTBEAT_INTERVAL_MS ?? String(DEFAULT_WS_HEARTBEAT_INTERVAL_MS),
  );

  return { port, dataDir, maxUploadBytes, webDistDir, wsHeartbeatIntervalMs };
}
