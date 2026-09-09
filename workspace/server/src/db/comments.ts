import type {
  CameraState,
  Comment,
  CommentStatus,
  Stroke,
  Vec3,
} from "@shared/types";
import type { Db } from "./connection";

export interface NewComment {
  id: string;
  projectId: string;
  versionId: string;
  authorName: string;
  body: string;
  anchor: Vec3;
  camera: CameraState;
  strokes: Stroke[];
  createdAt: number;
}

interface CommentRow {
  id: string;
  project_id: string;
  version_id: string;
  author_name: string;
  body: string;
  anchor_json: string;
  camera_json: string;
  strokes_json: string;
  status: CommentStatus;
  created_at: number;
  updated_at: number;
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    projectId: row.project_id,
    versionId: row.version_id,
    authorName: row.author_name,
    body: row.body,
    anchor: JSON.parse(row.anchor_json) as Vec3,
    camera: JSON.parse(row.camera_json) as CameraState,
    strokes: JSON.parse(row.strokes_json) as Stroke[],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function selectComment(db: Db, projectId: string, commentId: string): Comment | null {
  const row = db
    .prepare(
      `SELECT id, project_id, version_id, author_name, body,
              anchor_json, camera_json, strokes_json, status, created_at, updated_at
       FROM comments
       WHERE project_id = ? AND id = ?`,
    )
    .get(projectId, commentId) as CommentRow | undefined;
  return row ? toComment(row) : null;
}

export function insertComment(db: Db, input: NewComment): Comment {
  db.prepare(
    `INSERT INTO comments
      (id, project_id, version_id, author_name, body, anchor_json, camera_json,
       strokes_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
  ).run(
    input.id,
    input.projectId,
    input.versionId,
    input.authorName,
    input.body,
    JSON.stringify(input.anchor),
    JSON.stringify(input.camera),
    JSON.stringify(input.strokes),
    input.createdAt,
    input.createdAt,
  );

  return selectComment(db, input.projectId, input.id) as Comment;
}

export function listComments(
  db: Db,
  projectId: string,
  status?: CommentStatus,
): Comment[] {
  const whereStatus = status === undefined ? "" : " AND status = ?";
  const rows = db
    .prepare(
      `SELECT id, project_id, version_id, author_name, body,
              anchor_json, camera_json, strokes_json, status, created_at, updated_at
       FROM comments
       WHERE project_id = ?${whereStatus}
       ORDER BY created_at ASC, id ASC`,
    )
    .all(...(status === undefined ? [projectId] : [projectId, status])) as unknown as CommentRow[];
  return rows.map(toComment);
}

export function updateCommentStatus(
  db: Db,
  projectId: string,
  commentId: string,
  status: CommentStatus,
  updatedAt: number,
): Comment | null {
  db.prepare(
    `UPDATE comments
     SET status = ?, updated_at = ?
     WHERE project_id = ? AND id = ?`,
  ).run(status, updatedAt, projectId, commentId);
  return selectComment(db, projectId, commentId);
}
