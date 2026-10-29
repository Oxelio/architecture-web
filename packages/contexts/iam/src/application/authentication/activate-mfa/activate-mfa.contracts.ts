import type { Result, ValueOf } from "@architecture/foundation";

export const ActivateMfaErrors = {
  invalidEnrollment: { code: "mfa.invalid_enrollment" },
  backupCodesConfirmationRequired: {
    code: "mfa.backup_codes_confirmation_required",
  },
} as const;

export interface ActivateMfaInput {
  userId: string;
  confirmationId: string;
  backupCodesSaved: boolean;
}

export type ActivateMfaError = ValueOf<typeof ActivateMfaErrors>;

export type ActivateMfaOutput = Result<void, ActivateMfaError>;

export interface ActivateMfa {
  execute(input: ActivateMfaInput): Promise<ActivateMfaOutput>;
}
