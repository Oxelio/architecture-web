// @file bounded-contexts/identity/application/use-cases/change-password/change-password.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { PasswordValidationError } from "#services/password-policy-validator.service";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { ChangePasswordErrorsCodes } from "./change-password.codes.js";

export type ChangePasswordError =
  | PlainPasswordError
  | PasswordValidationError
  | ValueOf<typeof ChangePasswordErrorsCodes>;

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}

export type ChangePasswordOutput = Result<undefined, ChangePasswordError>;

export interface ChangePassword {
  execute(command: ChangePasswordInput): Promise<ChangePasswordOutput>;
}
