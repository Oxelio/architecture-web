import type { Result, ValueOf } from "@architecture/foundation";

export const ConfirmMfaEnrollmentErrors = {
  invalidEnrollment: { code: "mfa.invalid_enrollment" },
  invalidCode: { code: "mfa.invalid_code" },
} as const;

export interface ConfirmMfaEnrollmentInput {
  userId: string;
  code: string;
}

export type ConfirmMfaEnrollmentError = ValueOf<
  typeof ConfirmMfaEnrollmentErrors
>;

export type ConfirmMfaEnrollmentOutput = Result<
  { backupCodes: readonly string[]; confirmationId: string },
  ConfirmMfaEnrollmentError
>;

export interface ConfirmMfaEnrollment {
  execute(
    input: ConfirmMfaEnrollmentInput,
  ): Promise<ConfirmMfaEnrollmentOutput>;
}
