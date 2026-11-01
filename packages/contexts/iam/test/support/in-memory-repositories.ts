import type { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import { EmailVerificationRepository } from "#ports/email-verification.repository";
import { LoginIdentityRepository } from "#ports/login-identity.repository";
import { PasswordAuthenticatorRepository } from "#ports/password-authenticator.repository";
import { UserRepository } from "#ports/user.repository";
import {
  type UserAccountView,
  UserQueryRepository,
} from "#ports/user-query.repository";
import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import type {
  LoginIdentifierKind,
  LoginIdentifierValueObject,
} from "#value-objects/login-identifier.value-object";
import type { LoginIdentityIdentifierValueObject } from "#value-objects/login-identity-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
export class InMemoryUserRepository extends UserRepository {
  readonly values = new Map<string, UserEntity>();
  save(user: UserEntity): Promise<void> {
    return new Promise((resolve) => {
      this.values.set(user.identifier.value, user);
      resolve();
    });
  }
  findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    try {
      return Promise.resolve(this.values.get(id.value) ?? null);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
export class InMemoryLoginIdentityRepository extends LoginIdentityRepository {
  readonly values = new Map<string, LoginIdentityEntity>();
  async replacePreservingAdministrativeAccess(
    identity: LoginIdentityEntity,
  ): Promise<boolean> {
    await this.save(identity);
    return true;
  }
  save(identity: LoginIdentityEntity): Promise<void> {
    return new Promise((resolve) => {
      this.values.set(identity.identifier.value, identity);
      resolve();
    });
  }
  findById(
    id: LoginIdentityIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null> {
    try {
      return Promise.resolve(this.values.get(id.value) ?? null);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  findByLogin(
    login: LoginIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null> {
    try {
      return Promise.resolve(
        [...this.values.values()].find((identity) =>
          identity.login.equals(login),
        ) ?? null,
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  findForUser(
    userId: UserIdentifierValueObject,
    kind: LoginIdentifierKind,
  ): Promise<LoginIdentityEntity | null> {
    try {
      return Promise.resolve(
        [...this.values.values()].find(
          (identity) =>
            identity.userId.equals(userId) && identity.login.kind === kind,
        ) ?? null,
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  listForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly LoginIdentityEntity[]> {
    try {
      return Promise.resolve(
        [...this.values.values()].filter((identity) =>
          identity.userId.equals(userId),
        ),
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
export class InMemoryPasswordAuthenticatorRepository extends PasswordAuthenticatorRepository {
  readonly values = new Map<string, PasswordAuthenticatorEntity>();
  recordSuccessfulUse(
    authenticator: PasswordAuthenticatorEntity,
  ): Promise<boolean> {
    try {
      const current = this.values.get(authenticator.userId.value);
      if (
        !current ||
        current.isRevoked ||
        !current.passwordHash.equals(authenticator.passwordHash)
      ) {
        return Promise.resolve(false);
      }
      current.recordSuccessfulUse();
      return Promise.resolve(true);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  save(authenticator: PasswordAuthenticatorEntity): Promise<void> {
    try {
      this.values.set(authenticator.userId.value, authenticator);
      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  findForUser(
    userId: UserIdentifierValueObject,
  ): Promise<PasswordAuthenticatorEntity | null> {
    try {
      return Promise.resolve(this.values.get(userId.value) ?? null);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
export class InMemoryEmailVerificationRepository extends EmailVerificationRepository {
  readonly values = new Map<string, EmailVerificationEntity>();
  save(verification: EmailVerificationEntity): Promise<void> {
    try {
      this.values.set(verification.tokenHash.value, verification);
      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  findByToken(
    tokenHash: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null> {
    try {
      return Promise.resolve(this.values.get(tokenHash.value) ?? null);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  consume(
    tokenHash: EmailVerificationTokenHashValueObject,
    now: Date,
  ): Promise<boolean> {
    try {
      const verification = this.values.get(tokenHash.value);
      if (!verification?.isUsableAt(now)) {
        return Promise.resolve(false);
      }
      verification.consume();
      return Promise.resolve(true);
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  invalidatePreviousFor(
    loginIdentityId: LoginIdentityIdentifierValueObject,
  ): Promise<void> {
    try {
      for (const verification of this.values.values()) {
        if (verification.loginIdentityId.equals(loginIdentityId)) {
          verification.invalidate();
        }
      }
      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
export class InMemoryUserQueryRepository extends UserQueryRepository {
  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly identities: InMemoryLoginIdentityRepository,
  ) {
    super();
  }
  hasOtherAdministrativeAccess(
    excluding: UserIdentifierValueObject,
  ): Promise<boolean> {
    try {
      return Promise.resolve(
        [...this.users.values.values()].some(
          (user) =>
            user.identifier.value !== excluding.value &&
            user.role.isAdmin() &&
            user.status.isActive(),
        ),
      );
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  findAccountById(userId: string): Promise<UserAccountView | null> {
    try {
      const user = this.users.values.get(userId);
      if (!user) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        userId,
        role: user.role.value,
        status: user.status.value,
        identifiers: [...this.identities.values.values()]
          .filter((identity) => identity.userId.value === userId)
          .map((identity) => ({
            kind: identity.login.kind,
            value: identity.login.value,
            verificationStatus: identity.verificationStatus,
          })),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
  async search(): Promise<{
    users: UserAccountView[];
    total: number;
  }> {
    const users = (
      await Promise.all(
        [...this.users.values.keys()].map((id) => this.findAccountById(id)),
      )
    ).filter((user): user is UserAccountView => user !== null);
    return { users, total: users.length };
  }
  getAdministrationOverview(): Promise<{
    total: number;
    active: number;
    suspended: number;
    administrators: number;
  }> {
    try {
      const users = [...this.users.values.values()];
      return Promise.resolve({
        total: users.length,
        active: users.filter((user) => user.status.isActive()).length,
        suspended: users.filter((user) => user.status.isSuspended()).length,
        administrators: users.filter((user) => user.role.isAdmin()).length,
      });
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
