import type { Result, ValueOf } from "@architecture/foundation";

import type {
  FactorVerificationError,
  PasswordAuthenticationError,
} from "#authentication/reauthentication.contracts";

export const CancelAccountDeletionErrors = {
  invalidToken: { code: "account_deletion.invalid_token" },
  codeRequired: { code: "mfa.code_required" },
} as const;

export interface CancelAccountDeletionInput {
  token: string;
  password: string;
  code?: string;
}

export type CancelAccountDeletionError =
  | ValueOf<typeof CancelAccountDeletionErrors>
  | PasswordAuthenticationError
  | FactorVerificationError;

export type CancelAccountDeletionOutput = Result<
  void,
  CancelAccountDeletionError
>;

export interface CancelAccountDeletion {
  execute(
    input: CancelAccountDeletionInput,
  ): Promise<CancelAccountDeletionOutput>;
}
