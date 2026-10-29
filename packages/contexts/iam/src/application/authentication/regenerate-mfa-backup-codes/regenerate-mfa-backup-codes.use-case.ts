import { Result } from "@architecture/foundation";

import type { SecurityTokens } from "#accounts/security-effects";
import type { MfaCryptography, MfaStore } from "#authentication/mfa/mfa.ports";
import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";

import {
  type RegenerateMfaBackupCodes,
  RegenerateMfaBackupCodesErrors,
  type RegenerateMfaBackupCodesInput,
  type RegenerateMfaBackupCodesOutput,
} from "./regenerate-mfa-backup-codes.contracts.js";

export class RegenerateMfaBackupCodesUseCase implements RegenerateMfaBackupCodes {
  constructor(
    private readonly reauthentication: Reauthentication,
    private readonly factor: FactorVerification,
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(
    input: RegenerateMfaBackupCodesInput,
  ): Promise<RegenerateMfaBackupCodesOutput> {
    const recent = await this.reauthentication.recent(
      input.userId,
      input.sessionId,
      input.password,
    );
    if (!recent.success) {
      return recent;
    }
    const verified = await this.factor.verify(input.userId, input.code);
    if (!verified.success) {
      return verified;
    }
    const backupCodes = this.crypto.generateBackupCodes();
    if (
      !(await this.store.replaceBackupCodes(
        input.userId,
        backupCodes.map((code) =>
          this.tokens.hash(code.replace(/[\s-]/g, "").toUpperCase()),
        ),
        new Date(),
      ))
    ) {
      return Result.failure(RegenerateMfaBackupCodesErrors.notEnabled);
    }
    return Result.success({ backupCodes });
  }
}
