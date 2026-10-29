import { Result } from "@architecture/foundation";

import type { SecurityTokens } from "#accounts/security-effects";
import type { MfaCryptography, MfaStore } from "#authentication/mfa/mfa.ports";
import { isMfaEnrollmentUsable } from "#domain/mfa";

import {
  type ConfirmMfaEnrollment,
  ConfirmMfaEnrollmentErrors,
  type ConfirmMfaEnrollmentInput,
  type ConfirmMfaEnrollmentOutput,
} from "./confirm-mfa-enrollment.contracts.js";

export class ConfirmMfaEnrollmentUseCase implements ConfirmMfaEnrollment {
  constructor(
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(
    input: ConfirmMfaEnrollmentInput,
  ): Promise<ConfirmMfaEnrollmentOutput> {
    const setting = await this.store.credential(input.userId),
      now = new Date();
    if (!setting || !isMfaEnrollmentUsable(setting, now)) {
      return Result.failure(ConfirmMfaEnrollmentErrors.invalidEnrollment);
    }
    const counter = this.crypto.verifyTotp(
      this.crypto.open(setting.sealedSecret),
      input.code,
    );
    if (counter === null) {
      return Result.failure(ConfirmMfaEnrollmentErrors.invalidCode);
    }
    const backupCodes = this.crypto.generateBackupCodes(),
      confirmationId = this.tokens.identifier();
    const updated = await this.store.confirmEnrollment({
      userId: input.userId,
      sealedSecret: setting.sealedSecret,
      counter,
      backupHashes: backupCodes.map((code) =>
        this.tokens.hash(code.replace(/[\s-]/g, "").toUpperCase()),
      ),
      confirmationId,
      now,
    });
    return updated
      ? Result.success({ backupCodes, confirmationId })
      : Result.failure(ConfirmMfaEnrollmentErrors.invalidEnrollment);
  }
}
