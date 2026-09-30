import { MAX_UPLOAD_BYTES_DEFAULT } from "@shared/api";

/** WEB_DIST_DIR の既定。app.ts の static の既定もこれを使う */
export const DEFAULT_WEB_DIST_DIR = "./web/dist";
/** WS_HEARTBEAT_INTERVAL_MS の既定。0 でハートビート無効 */
export const DEFAULT_WS_HEARTBEAT_INTERVAL_MS = 30_000;
/** MAX_UPLOAD_FILES の既定 */
export const DEFAULT_MAX_UPLOAD_FILES = 20;

export interface Config {
  port: number;
  dataDir: string;
  maxUploadBytes: number;
  /** MAX_UPLOAD_FILES。1 リクエストで受け付けるモデルファイル数の上限。1 以上 */
  maxUploadFiles: number;
  /** WEB_DIST_DIR (default "./web/dist"); relative paths are resolved from cwd. */
  webDistDir: string;
  /** WS_HEARTBEAT_INTERVAL_MS。ping の間隔(ms)。0 で無効 */
  wsHeartbeatIntervalMs: number;
  /** PUBLIC_ORIGIN。ブラウザから見た公開 origin。未設定は null */
  publicOrigin: string | null;
  /** TRUST_PROXY。前段プロキシの X-Forwarded-For を信頼するか */
  trustProxy: boolean;
  /** HOST。待ち受けアドレス。未設定・空文字は null */
  host: string | null;
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

function parsePublicOrigin(value: string | undefined): string | null {
  if (value === undefined || value === "") return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== "" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new Error("unsupported URL shape");
    }
    return url.origin;
  } catch {
    throw new Error(`Invalid PUBLIC_ORIGIN: ${value}`);
  }
}

function parseTrustProxy(value: string | undefined): boolean {
  if (value === undefined || value === "0") return false;
  if (value === "1") return true;
  throw new Error(`TRUST_PROXY must be either "0" or "1"`);
}

/** Load server settings from environment variables and their defaults. */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const port = parsePort(env.PORT ?? "3000");
  const dataDir = env.DATA_DIR ?? "./data";
  const maxUploadBytes = parseNonNegativeInteger(
    "MAX_UPLOAD_BYTES",
    env.MAX_UPLOAD_BYTES ?? String(MAX_UPLOAD_BYTES_DEFAULT),
  );
  const maxUploadFiles = parseNonNegativeInteger(
    "MAX_UPLOAD_FILES",
    env.MAX_UPLOAD_FILES ?? String(DEFAULT_MAX_UPLOAD_FILES),
  );
  if (maxUploadFiles === 0) {
    throw new Error("MAX_UPLOAD_FILES must be at least 1");
  }
  const webDistDir = env.WEB_DIST_DIR ?? DEFAULT_WEB_DIST_DIR;
  const wsHeartbeatIntervalMs = parseNonNegativeInteger(
    "WS_HEARTBEAT_INTERVAL_MS",
    env.WS_HEARTBEAT_INTERVAL_MS ?? String(DEFAULT_WS_HEARTBEAT_INTERVAL_MS),
  );
  const publicOrigin = parsePublicOrigin(env.PUBLIC_ORIGIN);
  if (env.NODE_ENV === "production" && publicOrigin === null) {
    throw new Error("PUBLIC_ORIGIN is required when NODE_ENV=production");
  }
  const trustProxy = parseTrustProxy(env.TRUST_PROXY);
  const host = env.HOST === undefined || env.HOST === "" ? null : env.HOST;

  return {
    port,
    dataDir,
    maxUploadBytes,
    maxUploadFiles,
    webDistDir,
    wsHeartbeatIntervalMs,
    publicOrigin,
    trustProxy,
    host,
  };
}

/** publicOrigin が https origin なら Secure Cookie と HSTS を有効にする。 */
export function usesHttps(config: { publicOrigin?: string | null }): boolean {
  return config.publicOrigin?.startsWith("https:") === true;
}
