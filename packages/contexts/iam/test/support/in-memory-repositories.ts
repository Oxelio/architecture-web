import type { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import { EmailVerificationRepository } from "#repositories/email-verification.repository";
import { LoginIdentityRepository } from "#repositories/login-identity.repository";
import { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import { UserRepository } from "#repositories/user.repository";
import type { UserAccountView } from "#repositories/user-query.repository";
import { UserQueryRepository } from "#repositories/user-query.repository";
import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import type {
  LoginIdentifierKind,
  LoginIdentifierValueObject,
} from "#value-objects/login-identifier.value-object";
import type { LoginIdentityIdentifierValueObject } from "#value-objects/login-identity-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export class InMemoryUserRepository extends UserRepository {
  readonly values = new Map<string, UserEntity>();

  async save(user: UserEntity): Promise<void> {
    this.values.set(user.identifier.value, user);
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.values.get(id.value) ?? null;
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

  async save(identity: LoginIdentityEntity): Promise<void> {
    this.values.set(identity.identifier.value, identity);
  }

  async findById(
    id: LoginIdentityIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null> {
    return this.values.get(id.value) ?? null;
  }

  async findByLogin(
    login: LoginIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null> {
    return (
      [...this.values.values()].find((identity) =>
        identity.login.equals(login),
      ) ?? null
    );
  }

  async findForUser(
    userId: UserIdentifierValueObject,
    kind: LoginIdentifierKind,
  ): Promise<LoginIdentityEntity | null> {
    return (
      [...this.values.values()].find(
        (identity) =>
          identity.userId.equals(userId) && identity.login.kind === kind,
      ) ?? null
    );
  }

  async listForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly LoginIdentityEntity[]> {
    return [...this.values.values()].filter((identity) =>
      identity.userId.equals(userId),
    );
  }
}

export class InMemoryPasswordAuthenticatorRepository extends PasswordAuthenticatorRepository {
  readonly values = new Map<string, PasswordAuthenticatorEntity>();

  async recordSuccessfulUse(
    authenticator: PasswordAuthenticatorEntity,
  ): Promise<boolean> {
    const current = this.values.get(authenticator.userId.value);
    if (
      !current ||
      current.isRevoked ||
      !current.passwordHash.equals(authenticator.passwordHash)
    ) {
      return false;
    }
    current.recordSuccessfulUse();
    return true;
  }

  async save(authenticator: PasswordAuthenticatorEntity): Promise<void> {
    this.values.set(authenticator.userId.value, authenticator);
  }

  async findForUser(
    userId: UserIdentifierValueObject,
  ): Promise<PasswordAuthenticatorEntity | null> {
    return this.values.get(userId.value) ?? null;
  }
}

export class InMemoryEmailVerificationRepository extends EmailVerificationRepository {
  readonly values = new Map<string, EmailVerificationEntity>();

  async save(verification: EmailVerificationEntity): Promise<void> {
    this.values.set(verification.tokenHash.value, verification);
  }

  async findByToken(
    tokenHash: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null> {
    return this.values.get(tokenHash.value) ?? null;
  }

  async consume(
    tokenHash: EmailVerificationTokenHashValueObject,
    now: Date,
  ): Promise<boolean> {
    const verification = this.values.get(tokenHash.value);
    if (!verification?.isUsableAt(now)) {
      return false;
    }
    verification.consume();
    return true;
  }

  async invalidatePreviousFor(
    loginIdentityId: LoginIdentityIdentifierValueObject,
  ): Promise<void> {
    for (const verification of this.values.values()) {
      if (verification.loginIdentityId.equals(loginIdentityId)) {
        verification.invalidate();
      }
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

  async hasOtherAdministrativeAccess(
    excluding: UserIdentifierValueObject,
  ): Promise<boolean> {
    return [...this.users.values.values()].some(
      (user) =>
        user.identifier.value !== excluding.value &&
        user.role.isAdmin() &&
        user.status.isActive(),
    );
  }

  async findAccountById(userId: string): Promise<UserAccountView | null> {
    const user = this.users.values.get(userId);
    if (!user) {
      return null;
    }
    return {
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
    };
  }

  async search(): Promise<{ users: UserAccountView[]; total: number }> {
    const users = (
      await Promise.all(
        [...this.users.values.keys()].map((id) => this.findAccountById(id)),
      )
    ).filter((user): user is UserAccountView => user !== null);
    return { users, total: users.length };
  }

  async getAdministrationOverview(): Promise<{
    total: number;
    active: number;
    suspended: number;
    administrators: number;
  }> {
    const users = [...this.users.values.values()];
    return {
      total: users.length,
      active: users.filter((user) => user.status.isActive()).length,
      suspended: users.filter((user) => user.status.isSuspended()).length,
      administrators: users.filter((user) => user.role.isAdmin()).length,
    };
  }
}
