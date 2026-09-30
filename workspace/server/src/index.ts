import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";
import { createApp } from "./app";
import { loadConfig, usesHttps } from "./config";
import { openDb } from "./db/connection";
import { findProject } from "./db/projects";
import { createRoomDisplayStore } from "./db/room-display";
import { attachRealtime, type Realtime } from "./realtime/ws";
import { RoomHub } from "./realtime/hub";
import { createFileStorage } from "./storage/files";

const config = loadConfig(process.env);
mkdirSync(config.dataDir, { recursive: true });
const db = openDb(join(config.dataDir, "app.db"));
const storage = createFileStorage(config.dataDir);
const hub = new RoomHub({ displayStore: createRoomDisplayStore(db, () => Date.now()) });
let realtime: Realtime | null = null;
const app = createApp({
  db,
  storage,
  config,
  publish: (projectId, msg) => {
    if (msg.type === "object:removed") hub.forgetObject(projectId, msg.versionId);
    realtime?.publish(projectId, msg);
  },
});
const server = serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host ?? undefined,
});
realtime = attachRealtime(server as unknown as Server, hub, {
  projectExists: (projectId) => findProject(db, projectId) !== null,
  heartbeatIntervalMs: config.wsHeartbeatIntervalMs,
});

console.log(JSON.stringify({
  level: "info",
  msg: "server_started",
  port: config.port,
  dataDir: config.dataDir,
  publicOrigin: config.publicOrigin,
  https: usesHttps(config),
}));
