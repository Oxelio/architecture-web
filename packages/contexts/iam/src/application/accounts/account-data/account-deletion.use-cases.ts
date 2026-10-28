import { Result } from "@architecture/foundation";

import type { AccountPolicyReader } from "#accounts/account-policy.reader";
import type {
  AccountSecurityMail,
  SecurityTokens,
} from "#accounts/security-effects";
import type { IamResult } from "#application-result";
import type { MfaStore } from "#authentication/mfa/mfa.ports";
import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  AccountAuditData,
  AccountDeletionStore,
  AccountExportStore,
} from "./account-data.ports.js";
export class RequestAccountDeletionUseCase {
  constructor(
    private readonly policies: AccountPolicyReader,
    private readonly reauthentication: Reauthentication,
    private readonly users: UserRepository,
    private readonly identities: LoginIdentityRepository,
    private readonly store: AccountDeletionStore,
    private readonly tokens: SecurityTokens,
    private readonly mail: AccountSecurityMail,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(input: {
    userId: string;
    sessionId: string;
    password: string;
    confirmation: string;
    code?: string;
  }): Promise<IamResult<{ scheduledFor: Date }>> {
    if (input.confirmation !== "DELETE") {
      return Result.failure({
        code: "DELETION_CONFIRMATION_REQUIRED",
      } as const);
    }
    const policy = await this.policies.getAccountPolicy();
    if (!policy.deletion) {
      return Result.failure({ code: "DELETION_DISABLED" } as const);
    }
    const authorized = await this.reauthentication.strong(
      input.userId,
      input.sessionId,
      input.password,
      input.code,
    );
    if (!authorized.success) {
      return authorized;
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
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
      return Result.failure({
        code:
          saved === "last_administrator"
            ? "LAST_ACTIVE_ADMIN"
            : "ACCOUNT_CONCURRENT_MODIFICATION",
      } as const);
    }
    await this.sessions.deleteAllForUser(user.identifier);
    const email = await this.identities.findForUser(user.identifier, "email");
    if (email?.verificationStatus === "verified") {
      await this.mail.sendDeletionCancellation(email.login.value, token);
    }
    return Result.success({ scheduledFor });
  }
}
export class CancelAccountDeletionUseCase {
  constructor(
    private readonly store: AccountDeletionStore,
    private readonly users: UserRepository,
    private readonly reauthentication: Reauthentication,
    private readonly mfa: MfaStore,
    private readonly factor: FactorVerification,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(input: {
    token: string;
    password: string;
    code?: string;
  }): Promise<IamResult<void>> {
    const request = await this.store.find(this.tokens.hash(input.token)),
      now = new Date();
    if (
      !request ||
      request.cancelledAt ||
      request.executedAt ||
      request.scheduledFor <= now
    ) {
      return Result.failure({ code: "DELETION_TOKEN_INVALID" } as const);
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
        return Result.failure({ code: "MFA_CODE_REQUIRED" } as const);
      }
      const factor = await this.factor.verify(request.userId, input.code);
      if (!factor.success) {
        return factor;
      }
    }
    const id = UserIdentifierValueObject.create(request.userId);
    if (!id.success) {
      return Result.failure({ code: "DELETION_TOKEN_INVALID" } as const);
    }
    const user = await this.users.findById(id.value);
    if (!user || !user.status.isPendingDeletion()) {
      return Result.failure({ code: "DELETION_TOKEN_INVALID" } as const);
    }
    user.cancelDeletion(request.previousStatus);
    if (
      !(await this.store.cancel({
        user,
        requestId: request.id,
        now: new Date(),
      }))
    ) {
      return Result.failure({ code: "DELETION_TOKEN_INVALID" } as const);
    }
    return Result.success(undefined);
  }
}
export class MaintainIamAccountsUseCase {
  constructor(
    private readonly deletions: AccountDeletionStore,
    private readonly exports: AccountExportStore,
    private readonly audit: AccountAuditData,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(): Promise<IamResult<{ deletedAccounts: number }>> {
    const now = new Date(),
      due = await this.deletions.due(now);
    let deletedAccounts = 0;
    for (const request of due) {
      const userId = await this.deletions.eraseIfDue(request.id, now, (id) =>
        this.audit.pseudonymize(id),
      );
      if (!userId) {
        continue;
      }
      deletedAccounts++;
      const id = UserIdentifierValueObject.create(userId);
      if (!id.success) {
        throw new Error("Invalid persisted account identifier");
      }
      await this.sessions.deleteAllForUser(id.value);
    }
    await this.exports.expire(now);
    return Result.success({ deletedAccounts });
  }
}
