import { z } from "zod";
import { MAX_NAME_LENGTH } from "./protocol";
import { IdSchema } from "./types";

export const LOGIN_ID_PATTERN = /^[a-z0-9_-]{3,32}$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const RECOVERY_CODE_PATTERN = /^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/;

export const LoginIdSchema = z.string().trim().toLowerCase().regex(LOGIN_ID_PATTERN);
export const NewPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);
export const PasswordInputSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);
export const DisplayNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
export const RecoveryCodeInputSchema = z.string()
  .transform((value) => value.replace(/[\s-]/g, "").toLowerCase())
  .pipe(z.string().regex(/^[0-9a-f]{32}$/));

export function passwordEqualsLoginId(password: string, loginId: string): boolean {
  return password.normalize("NFKC").toLowerCase() === loginId;
}

export const RegisterAccountInput = z.object({
  loginId: LoginIdSchema,
  password: NewPasswordSchema,
  displayName: DisplayNameSchema.optional(),
}).superRefine((value, ctx) => {
  if (passwordEqualsLoginId(value.password, value.loginId)) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Password must differ from login ID" });
  }
});
export type RegisterAccountInput = z.infer<typeof RegisterAccountInput>;

export const LoginInput = z.object({ loginId: LoginIdSchema, password: PasswordInputSchema });
export type LoginInput = z.infer<typeof LoginInput>;

export const UpdateAccountInput = z.object({ displayName: DisplayNameSchema });
export type UpdateAccountInput = z.infer<typeof UpdateAccountInput>;

export const ChangePasswordInput = z.object({
  currentPassword: PasswordInputSchema,
  newPassword: NewPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const ResetPasswordInput = z.object({
  loginId: LoginIdSchema,
  recoveryCode: RecoveryCodeInputSchema,
  newPassword: NewPasswordSchema,
}).superRefine((value, ctx) => {
  if (passwordEqualsLoginId(value.newPassword, value.loginId)) {
    ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Password must differ from login ID" });
  }
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

export const RegenerateRecoveryCodeInput = z.object({ password: PasswordInputSchema });
export type RegenerateRecoveryCodeInput = z.infer<typeof RegenerateRecoveryCodeInput>;

export interface Account {
  userId: string;
  loginId: string | null;
  displayName: string | null;
}
export const AccountSchema = z.object({
  userId: IdSchema,
  loginId: z.string().regex(LOGIN_ID_PATTERN).nullable(),
  displayName: z.string().min(1).max(MAX_NAME_LENGTH).nullable(),
}) satisfies z.ZodType<Account>;

export interface AccountWithRecoveryCode {
  account: Account;
  recoveryCode: string;
}
export const AccountWithRecoveryCodeSchema = z.object({
  account: AccountSchema,
  recoveryCode: z.string().regex(RECOVERY_CODE_PATTERN),
}) satisfies z.ZodType<AccountWithRecoveryCode>;
