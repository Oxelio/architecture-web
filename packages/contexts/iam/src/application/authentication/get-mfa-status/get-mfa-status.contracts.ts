import type { Result } from "@architecture/foundation";

export interface GetMfaStatusInput {
  userId: string;
}

export type GetMfaStatusError = never;

export type GetMfaStatusOutput = Result<
  {
    enabled: boolean;
    enabledAt: Date | null;
    backupCodesRemaining: number;
    lowBackupCodes: boolean;
  },
  GetMfaStatusError
>;

export interface GetMfaStatus {
  execute(input: GetMfaStatusInput): Promise<GetMfaStatusOutput>;
}
