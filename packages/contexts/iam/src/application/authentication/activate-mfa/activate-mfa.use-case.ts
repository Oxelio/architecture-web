import { Result } from "@architecture/foundation";

import type { MfaStore } from "#authentication/mfa/mfa.ports";
import { isSecurityOperationId } from "#domain/security-operation-id";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type ActivateMfa,
  ActivateMfaErrors,
  type ActivateMfaInput,
  type ActivateMfaOutput,
} from "./activate-mfa.contracts.js";

export class ActivateMfaUseCase implements ActivateMfa {
  constructor(
    private readonly users: UserRepository,
    private readonly store: MfaStore,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(input: ActivateMfaInput): Promise<ActivateMfaOutput> {
    if (!isSecurityOperationId(input.confirmationId)) {
      return Result.failure(ActivateMfaErrors.invalidEnrollment);
    }

    if (!input.backupCodesSaved) {
      return Result.failure(ActivateMfaErrors.backupCodesConfirmationRequired);
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure(ActivateMfaErrors.invalidEnrollment);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure(ActivateMfaErrors.invalidEnrollment);
    }
    user.invalidateSessions();
    if (
      !(await this.store.activate({
        user,
        confirmationId: input.confirmationId,
        now: new Date(),
      }))
    ) {
      return Result.failure(ActivateMfaErrors.invalidEnrollment);
    }
    await this.sessions.deleteAllForUser(user.identifier);
    return Result.success(undefined);
  }
}
