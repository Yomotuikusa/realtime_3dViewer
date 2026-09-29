import { z } from "zod";
import { IdSchema, MAX_PROJECT_NAME_LENGTH } from "./types";

/** owner: 自分が所有者 / member: URL から開いて一覧に載っている */
export type ProjectRole = "owner" | "member";

/** 一覧の 1 行 */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  /** 自分が最後に開いた(または作成した)時刻 */
  lastOpenedAt: number;
  /** 版(オブジェクト)の数 */
  versionCount: number;
  /** owner_id が自分なら "owner"、それ以外(owner_id が NULL を含む)は "member" */
  role: ProjectRole;
  /** 名前変更・削除ができるか。owner_id が自分、または owner_id が NULL なら true */
  canManage: boolean;
}

export const ProjectRoleSchema = z.enum(["owner", "member"]) satisfies z.ZodType<ProjectRole>;

export const ProjectSummarySchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH),
  createdAt: z.number().int().nonnegative(),
  lastOpenedAt: z.number().int().nonnegative(),
  versionCount: z.number().int().nonnegative(),
  role: ProjectRoleSchema,
  canManage: z.boolean(),
}) satisfies z.ZodType<ProjectSummary>;
