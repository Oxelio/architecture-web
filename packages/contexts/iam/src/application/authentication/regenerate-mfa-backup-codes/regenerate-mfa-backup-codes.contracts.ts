import type { Result, ValueOf } from "@architecture/foundation";

import type { RecentAuthenticationError } from "#authentication/reauthentication.contracts";
import type { FactorVerificationError } from "#authentication/reauthentication.contracts";

export const RegenerateMfaBackupCodesErrors = {
  notEnabled: { code: "mfa.not_enabled" },
} as const;

export interface RegenerateMfaBackupCodesInput {
  userId: string;
  sessionId: string;
  password: string;
  code: string;
}

export type RegenerateMfaBackupCodesError =
  | ValueOf<typeof RegenerateMfaBackupCodesErrors>
  | RecentAuthenticationError
  | FactorVerificationError;

export type RegenerateMfaBackupCodesOutput = Result<
  { backupCodes: readonly string[] },
  RegenerateMfaBackupCodesError
>;

export interface RegenerateMfaBackupCodes {
  execute(
    input: RegenerateMfaBackupCodesInput,
  ): Promise<RegenerateMfaBackupCodesOutput>;
}
