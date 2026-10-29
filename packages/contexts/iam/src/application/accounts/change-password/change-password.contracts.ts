import type { Result, ValueOf } from "@architecture/foundation";

import type { PasswordValidationError } from "#accounts/password-policy/password-validation";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { ChangePasswordErrors } from "./change-password.errors.js";

export type ChangePasswordError =
  | PlainPasswordError
  | PasswordValidationError
  | ValueOf<typeof ChangePasswordErrors>;

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}

export type ChangePasswordOutput = Result<void, ChangePasswordError>;

export interface ChangePassword {
  execute(command: ChangePasswordInput): Promise<ChangePasswordOutput>;
}
