import { Result } from "@architecture/foundation";

import type { AccountDeletionStore } from "#accounts/account-data/account-data.ports";
import type { AccountSecurityPolicyReader } from "#accounts/account-policy.reader";
import type {
  AccountSecurityMail,
  SecurityTokens,
} from "#accounts/security-effects";
import type { Reauthentication } from "#authentication/reauthentication";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type RequestAccountDeletion,
  RequestAccountDeletionErrors,
  type RequestAccountDeletionInput,
  type RequestAccountDeletionOutput,
} from "./request-account-deletion.contracts.js";

export class RequestAccountDeletionUseCase implements RequestAccountDeletion {
  constructor(
    private readonly policies: AccountSecurityPolicyReader,
    private readonly reauthentication: Reauthentication,
    private readonly users: UserRepository,
    private readonly identities: LoginIdentityRepository,
    private readonly store: AccountDeletionStore,
    private readonly tokens: SecurityTokens,
    private readonly mail: AccountSecurityMail,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(
    input: RequestAccountDeletionInput,
  ): Promise<RequestAccountDeletionOutput> {
    if (input.confirmation !== "DELETE") {
      return Result.failure(RequestAccountDeletionErrors.confirmationRequired);
    }
    const captured = await this.policies.getAccountSecurityPolicy();
    const policy = captured.accounts;
    if (!policy.deletion) {
      return Result.failure(RequestAccountDeletionErrors.disabled);
    }
    const authorized = await this.reauthentication.strong(
      input.userId,
      input.sessionId,
      input.password,
      input.code,
      captured.authentication,
    );
    if (!authorized.success) {
      return authorized;
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure(RequestAccountDeletionErrors.notFound);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure(RequestAccountDeletionErrors.notFound);
    }
    const previousStatus = user.status.value,
      requireAnotherAdministrator =
        user.role.isAdmin() && user.status.isActive(),
      token = this.tokens.generate(),
      now = new Date(),
      scheduledFor = new Date(
        now.getTime() + policy.deletionGraceDays * 86400000,
      );
    user.requestDeletion();
    const saved = await this.store.request({
      user,
      previousStatus,
      requireAnotherAdministrator,
      id: this.tokens.identifier(),
      tokenHash: this.tokens.hash(token),
      now,
      scheduledFor,
    });
    if (saved !== "saved") {
      return Result.failure(
        saved === "last_administrator"
          ? RequestAccountDeletionErrors.lastActiveAccess
          : RequestAccountDeletionErrors.concurrentModification,
      );
    }
    await this.sessions.deleteAllForUser(user.identifier);
    const email = await this.identities.findForUser(user.identifier, "email");
    if (email?.verificationStatus === "verified") {
      await this.mail.sendDeletionCancellation(email.login.value, token);
    }
    return Result.success({ scheduledFor });
  }
}
