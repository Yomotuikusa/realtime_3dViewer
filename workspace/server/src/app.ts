import { nanoid } from "nanoid";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Hono as HonoType, MiddlewareHandler } from "hono";
import type { ServerMessage } from "@shared/protocol";
import type { Config } from "./config";
import type { Db } from "./db/connection";
import { HttpError, toErrorResponse } from "./errors";
import { commentRoutes } from "./routes/comments";
import { projectRoutes } from "./routes/projects";
import { staticRoutes } from "./routes/static";
import type { Storage } from "./storage/files";

/** JSON API(コメント投稿・更新)の本体上限 */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

/** multipart の境界・name フィールド分として maxUploadBytes に上乗せする余裕 */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export interface AppDeps {
  db: Db;
  storage: Storage;
  // Keep dependency injection compatible with fixtures created before webDistDir existed.
  config: Omit<Config, "webDistDir"> & Partial<Pick<Config, "webDistDir">>;
  publish: (projectId: string, msg: ServerMessage) => void;
  now?: () => number;
  newId?: () => string;
}

export function createApp(deps: AppDeps): HonoType {
  const resolved: Required<AppDeps> = {
    ...deps,
    now: deps.now ?? (() => Date.now()),
    newId: deps.newId ?? (() => nanoid(12)),
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
  app.route("/api/projects/:projectId/comments", commentRoutes(resolved));
  app.route("/", staticRoutes(config.webDistDir ?? "./web/dist"));

  return app;
}
