import { Result } from "@architecture/foundation";

import type { AuthenticationPolicyReader } from "#authentication/authentication-policy.reader";
import type { MfaStore } from "#authentication/mfa/mfa.ports";
import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type DisableMfa,
  DisableMfaErrors,
  type DisableMfaInput,
  type DisableMfaOutput,
} from "./disable-mfa.contracts.js";

export class DisableMfaUseCase implements DisableMfa {
  constructor(
    private readonly reauthentication: Reauthentication,
    private readonly factor: FactorVerification,
    private readonly policies: AuthenticationPolicyReader,
    private readonly users: UserRepository,
    private readonly store: MfaStore,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(input: DisableMfaInput): Promise<DisableMfaOutput> {
    const authentication = await this.policies.getAuthenticationPolicy();
    const recent = await this.reauthentication.recent(
      input.userId,
      input.sessionId,
      input.password,
      authentication,
    );
    if (!recent.success) {
      return recent;
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure(DisableMfaErrors.notFound);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure(DisableMfaErrors.notFound);
    }
    if (authentication.mfaRequiredRoles.includes(user.role.value)) {
      return Result.failure(DisableMfaErrors.requiredByPolicy);
    }
    const factor = await this.factor.verify(input.userId, input.code);
    if (!factor.success) {
      return factor;
    }
    user.invalidateSessions();
    if (!(await this.store.disable(user))) {
      return Result.failure(DisableMfaErrors.concurrentModification);
    }
    await this.sessions.deleteAllForUser(user.identifier);
    return Result.success(undefined);
  }
}
