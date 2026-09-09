import { nanoid } from "nanoid";
import { Hono } from "hono";
import type { Hono as HonoType } from "hono";
import type { ServerMessage } from "@shared/protocol";
import type { Config } from "./config";
import type { Db } from "./db/connection";
import { toErrorResponse } from "./errors";
import { commentRoutes } from "./routes/comments";
import { projectRoutes } from "./routes/projects";
import { staticRoutes } from "./routes/static";
import type { Storage } from "./storage/files";

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

  app.onError((error, c) => {
    const response = toErrorResponse(error);
    return c.json(response.body, response.status as 500);
  });
  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Not Found" } }, 404),
  );
  app.route("/api/projects", projectRoutes(resolved));
  app.route("/api/projects/:projectId/comments", commentRoutes(resolved));
  app.route("/", staticRoutes(deps.config.webDistDir ?? "./web/dist"));

  return app;
}
