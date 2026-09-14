import type { ModelVersion, Project } from "@shared/types";
import { withTransaction, type Db } from "./connection";

interface ProjectRow {
  id: string;
  name: string;
  created_at: number;
}

interface VersionRow {
  id: string;
  project_id: string;
  number: number;
  file_name: string;
  byte_size: number;
  created_at: number;
}

function toModelVersion(row: VersionRow): ModelVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    fileName: row.file_name,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  };
}

export function insertProject(
  db: Db,
  input: { id: string; name: string; createdAt: number },
): void {
  db.prepare(
    "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
  ).run(input.id, input.name, input.createdAt);
}

export function insertModelVersion(
  db: Db,
  input: {
    id: string;
    projectId: string;
    fileName: string;
    byteSize: number;
    createdAt: number;
  },
): ModelVersion {
  const row = db
    .prepare("SELECT COALESCE(MAX(number), 0) + 1 AS next_number FROM model_versions WHERE project_id = ?")
    .get(input.projectId) as { next_number: number };
  const number = row.next_number;

  db.prepare(
    `INSERT INTO model_versions
      (id, project_id, number, file_name, byte_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(input.id, input.projectId, number, input.fileName, input.byteSize, input.createdAt);

  return { ...input, number };
}

/** Return every model version for a project in ascending version-number order. */
export function listModelVersions(db: Db, projectId: string): ModelVersion[] {
  const versions = db
    .prepare(
      `SELECT id, project_id, number, file_name, byte_size, created_at
       FROM model_versions
       WHERE project_id = ?
       ORDER BY number ASC`,
    )
    .all(projectId) as unknown as VersionRow[];
  return versions.map(toModelVersion);
}

export function findProject(db: Db, projectId: string): Project | null {
  const project = db
    .prepare("SELECT id, name, created_at FROM projects WHERE id = ?")
    .get(projectId) as ProjectRow | undefined;
  if (!project) {
    return null;
  }

  const versions = listModelVersions(db, projectId);
  return {
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    latestVersion: versions[versions.length - 1] ?? null,
    versions,
  };
}

/** Delete a version and its comments atomically when it belongs to the project. */
export function deleteModelVersion(
  db: Db,
  projectId: string,
  versionId: string,
): boolean {
  return withTransaction(db, () => {
    const version = db
      .prepare("SELECT id FROM model_versions WHERE project_id = ? AND id = ?")
      .get(projectId, versionId) as { id: string } | undefined;
    if (!version) return false;

    db.prepare("DELETE FROM comments WHERE version_id = ?").run(versionId);
    db.prepare("DELETE FROM model_versions WHERE project_id = ? AND id = ?")
      .run(projectId, versionId);
    return true;
  });
}

export function findModelVersion(
  db: Db,
  projectId: string,
  versionId: string,
): ModelVersion | null {
  const version = db
    .prepare(
      `SELECT id, project_id, number, file_name, byte_size, created_at
       FROM model_versions
       WHERE project_id = ? AND id = ?`,
    )
    .get(projectId, versionId) as VersionRow | undefined;
  return version ? toModelVersion(version) : null;
}
