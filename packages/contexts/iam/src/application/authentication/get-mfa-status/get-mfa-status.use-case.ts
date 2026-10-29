import { Result } from "@architecture/foundation";

import type { MfaStore } from "#authentication/mfa/mfa.ports";

import type {
  GetMfaStatus,
  GetMfaStatusInput,
  GetMfaStatusOutput,
} from "./get-mfa-status.contracts.js";

export class GetMfaStatusUseCase implements GetMfaStatus {
  constructor(private readonly store: MfaStore) {}
  async execute(input: GetMfaStatusInput): Promise<GetMfaStatusOutput> {
    const setting = await this.store.credential(input.userId),
      remaining = setting?.enabledAt
        ? await this.store.remainingBackupCodes(input.userId)
        : 0;
    return Result.success({
      enabled: Boolean(setting?.enabledAt),
      enabledAt: setting?.enabledAt ?? null,
      backupCodesRemaining: remaining,
      lowBackupCodes: remaining <= 2,
    });
  }
}
