import type { Result, ValueOf } from "@architecture/foundation";

import type { PasswordValidationError } from "#accounts/password-policy/password-validation";
import type { SecurityContext } from "#accounts/security-effects";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

export const ResetRecoveredPasswordErrors = {
  invalidToken: { code: "password_recovery.invalid_token" },
  confirmationMismatch: { code: "password.confirmation_mismatch" },
  reused: { code: "password.reused" },
} as const;

export interface ResetRecoveredPasswordInput {
  token: string;
  password: string;
  passwordConfirmation: string;
  context: SecurityContext;
}

export type ResetRecoveredPasswordError =
  | ValueOf<typeof ResetRecoveredPasswordErrors>
  | PasswordValidationError
  | PlainPasswordError;

export type ResetRecoveredPasswordOutput = Result<
  void,
  ResetRecoveredPasswordError
>;

export interface ResetRecoveredPassword {
  execute(
    input: ResetRecoveredPasswordInput,
  ): Promise<ResetRecoveredPasswordOutput>;
}
