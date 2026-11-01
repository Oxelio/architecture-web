import { Result } from "@architecture/foundation";

import type { AccountDeletionStore } from "#accounts/account-data/account-data.ports";
import type { SecurityTokens } from "#accounts/security-effects";
import type { MfaStore } from "#authentication/mfa/mfa.ports";
import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type CancelAccountDeletion,
  CancelAccountDeletionErrors,
  type CancelAccountDeletionInput,
  type CancelAccountDeletionOutput,
} from "./cancel-account-deletion.contracts.js";

export class CancelAccountDeletionUseCase implements CancelAccountDeletion {
  constructor(
    private readonly store: AccountDeletionStore,
    private readonly users: UserRepository,
    private readonly reauthentication: Reauthentication,
    private readonly mfa: MfaStore,
    private readonly factor: FactorVerification,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(
    input: CancelAccountDeletionInput,
  ): Promise<CancelAccountDeletionOutput> {
    const request = await this.store.find(this.tokens.hash(input.token)),
      now = new Date();
    if (
      !request ||
      request.cancelledAt ||
      request.executedAt ||
      request.scheduledFor <= now
    ) {
      return Result.failure(CancelAccountDeletionErrors.invalidToken);
    }
    const password = await this.reauthentication.password(
      request.userId,
      input.password,
    );
    if (!password.success) {
      return password;
    }
    if ((await this.mfa.credential(request.userId))?.enabledAt) {
      if (!input.code) {
        return Result.failure(CancelAccountDeletionErrors.codeRequired);
      }
      const factor = await this.factor.verify(request.userId, input.code);
      if (!factor.success) {
        return factor;
      }
    }
    const id = UserIdentifierValueObject.create(request.userId);
    if (!id.success) {
      return Result.failure(CancelAccountDeletionErrors.invalidToken);
    }
    const user = await this.users.findById(id.value);
    if (!user?.status.isPendingDeletion()) {
      return Result.failure(CancelAccountDeletionErrors.invalidToken);
    }
    user.cancelDeletion(request.previousStatus);
    if (
      !(await this.store.cancel({
        user,
        requestId: request.id,
        now: new Date(),
      }))
    ) {
      return Result.failure(CancelAccountDeletionErrors.invalidToken);
    }
    return Result.success(undefined);
  }
}
