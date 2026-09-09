import { Hono } from "hono";
import type { ServerMessage } from "@shared/protocol";
import type { ModelVersion, Project } from "@shared/types";
import { createApp, type AppDeps } from "../../src/app";
import { loadConfig, type Config } from "../../src/config";
import { openDb, type Db } from "../../src/db/connection";
import { insertModelVersion, insertProject } from "../../src/db/projects";
import { createFileStorage, type Storage } from "../../src/storage/files";
import { makeTmpDir, removeTmpDir } from "./tmp";

export interface TestApp {
  app: Hono;
  db: Db;
  storage: Storage;
  dir: string;
  published: Array<{ projectId: string; msg: ServerMessage }>;
  ids: string[];
  cleanup(): void;
}

export function makeTestApp(overrides: Partial<Config> = {}): TestApp {
  const dir = makeTmpDir("app");
  const config = { ...loadConfig({}), ...overrides, dataDir: overrides.dataDir ?? dir };
  const db = openDb(":memory:");
  const storage = createFileStorage(config.dataDir);
  const published: TestApp["published"] = [];
  let fallbackId = 1;
  const testApp = {
    app: undefined as unknown as Hono,
    db,
    storage,
    dir,
    published,
    ids: [] as string[],
    cleanup() {
      if (db.isOpen) db.close();
      removeTmpDir(dir);
    },
  } satisfies TestApp;
  const deps: AppDeps = {
    db,
    storage,
    config,
    publish: (projectId, msg) => published.push({ projectId, msg }),
    now: () => 1700000000000,
    newId: () => testApp.ids.shift() ?? `id-${fallbackId++}`,
  };
  testApp.app = createApp(deps);
  return testApp;
}

export function seedProject(
  t: TestApp,
  opts: { fileName?: string; bytes?: Uint8Array } = {},
): { project: Project; version: ModelVersion } {
  const bytes = opts.bytes ?? new Uint8Array([0, 1, 2, 3]);
  const projectId = "p1";
  const versionId = "v1";
  insertProject(t.db, { id: projectId, name: "Project", createdAt: 1700000000000 });
  const version = insertModelVersion(t.db, {
    id: versionId,
    projectId,
    fileName: opts.fileName ?? "model.glb",
    byteSize: bytes.length,
    createdAt: 1700000000000,
  });
  void t.storage.saveModelFile(versionId, bytes);
  const project: Project = {
    id: projectId,
    name: "Project",
    createdAt: 1700000000000,
    latestVersion: version,
  };
  return { project, version };
}
