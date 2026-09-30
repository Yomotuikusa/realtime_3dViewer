import { nanoid } from "nanoid";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Context, Hono as HonoType, MiddlewareHandler } from "hono";
import type { ServerMessage } from "@shared/protocol";
import { DEFAULT_WEB_DIST_DIR, type Config, usesHttps } from "./config";
import type { Db } from "./db/connection";
import { HttpError, toErrorResponse } from "./errors";
import { clientAddressFrom } from "./identity/client-address";
import { hsts, sameOriginGuard } from "./http-security";
import { commentRoutes } from "./routes/comments";
import { projectRoutes } from "./routes/projects";
import { projectManageRoutes } from "./routes/project-manage";
import { staticRoutes } from "./routes/static";
import type { Storage } from "./storage/files";

/** JSON API(コメント投稿・更新)の本体上限 */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

/** multipart の境界・name フィールド分として maxUploadBytes に上乗せする余裕 */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export interface AppDeps {
  db: Db;
  storage: Storage;
  // Keep dependency injection compatible with fixtures created before these config values existed.
  config: Omit<
    Config,
    "webDistDir" | "wsHeartbeatIntervalMs" | "maxUploadFiles" | "publicOrigin" | "trustProxy" | "host"
  > & Partial<
    Pick<Config, "webDistDir" | "wsHeartbeatIntervalMs" | "maxUploadFiles" | "publicOrigin" | "trustProxy" | "host">
  >;
  publish: (projectId: string, msg: ServerMessage) => void;
  now?: () => number;
  newId?: () => string;
  /** 匿名ユーザー id の生成。newId とは独立 */
  newUserId?: () => string;
  /** セッショントークンの生成。newId とは独立 */
  newSessionToken?: () => string;
  /** 後続の認証制限で使う接続元 IP の取得口 */
  clientAddress?: (c: Context) => string;
}

export function createApp(deps: AppDeps): HonoType {
  const resolved: Required<AppDeps> = {
    ...deps,
    now: deps.now ?? (() => Date.now()),
    newId: deps.newId ?? (() => nanoid(12)),
    newUserId: deps.newUserId ?? (() => nanoid(12)),
    newSessionToken: deps.newSessionToken ?? (() => nanoid(32)),
    clientAddress: deps.clientAddress ?? ((c) => clientAddressFrom(c, deps.config.trustProxy ?? false)),
  };
  const app = new Hono();
  const config = resolved.config;
  const tooLarge = () => {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  };
  const validateContentLength: MiddlewareHandler = async (c, next) => {
    const contentLength = c.req.header("content-length");
    if (contentLength !== undefined && !/^\d+$/.test(contentLength)) {
      tooLarge();
    }
    await next();
  };

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
  });
  if (usesHttps(config)) app.use("*", hsts());
  app.use("/api/*", sameOriginGuard(config.publicOrigin ?? null));
  app.use("/api/projects", validateContentLength);
  app.use(
    "/api/projects",
    bodyLimit({
      maxSize: config.maxUploadBytes + MULTIPART_OVERHEAD_BYTES,
      onError: tooLarge,
    }),
  );
  app.use("/api/projects/:projectId/versions", validateContentLength);
  app.use(
    "/api/projects/:projectId/versions",
    bodyLimit({
      maxSize: config.maxUploadBytes + MULTIPART_OVERHEAD_BYTES,
      onError: tooLarge,
    }),
  );
  app.use("/api/projects/:projectId/comments", validateContentLength);
  app.use(
    "/api/projects/:projectId/comments",
    bodyLimit({ maxSize: MAX_JSON_BODY_BYTES, onError: tooLarge }),
  );
  app.use("/api/projects/:projectId/comments/*", validateContentLength);
  app.use(
    "/api/projects/:projectId/comments/*",
    bodyLimit({ maxSize: MAX_JSON_BODY_BYTES, onError: tooLarge }),
  );
  app.use("/api/projects/:projectId", validateContentLength);
  app.use(
    "/api/projects/:projectId",
    bodyLimit({ maxSize: MAX_JSON_BODY_BYTES, onError: tooLarge }),
  );

  app.onError((error, c) => {
    const response = toErrorResponse(error);
    if (response.status === 500) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "request_failed",
          method: c.req.method,
          path: c.req.path,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
    }
    return c.json(response.body, response.status as 500);
  });
  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Not Found" } }, 404),
  );
  app.route("/api/projects", projectRoutes(resolved));
  app.route("/api/projects", projectManageRoutes(resolved));
  app.route("/api/projects/:projectId/comments", commentRoutes(resolved));
  app.route("/", staticRoutes(config.webDistDir ?? DEFAULT_WEB_DIST_DIR));

  return app;
}
