import type { OutboxWriter } from "@architecture/messaging/application";

import { DEFAULT_SECURITY_POLICY } from "#domain/security-policy";
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
import { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import type {
  LoginIdentifierKind,
  LoginIdentifierValueObject,
} from "#value-objects/login-identifier.value-object";
import type { LoginIdentityIdentifierValueObject } from "#value-objects/login-identity-identifier.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
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

export class InMemoryIamUnitOfWork extends IamUnitOfWork {
  executeForUser<T>(
    _userId: UserIdentifierValueObject,
    work: (
      repositories: import("#transactions/iam-unit-of-work").IamTransactionalRepositories,
    ) => Promise<T>,
  ): Promise<T> {
    return this.execute<T>(work);
  }
  constructor(
    readonly users: InMemoryUserRepository,
    readonly loginIdentities: InMemoryLoginIdentityRepository,
    readonly passwordAuthenticators: InMemoryPasswordAuthenticatorRepository,
    readonly emailVerifications: InMemoryEmailVerificationRepository,
  ) {
    super();
  }

  execute<T>(work: Parameters<IamUnitOfWork["execute"]>[0]): Promise<T> {
    return work({
      users: this.users,
      loginIdentities: this.loginIdentities,
      passwordAuthenticators: this.passwordAuthenticators,
      emailVerifications: this.emailVerifications,
    }) as Promise<T>;
  }
}

export class InMemoryUserQueryRepository extends UserQueryRepository {
  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly identities: InMemoryLoginIdentityRepository,
  ) {
    super();
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

  async getAdministrationOverview() {
    const users = [...this.users.values.values()];
    return {
      total: users.length,
      active: users.filter((user) => user.status.isActive()).length,
      suspended: users.filter((user) => user.status.isSuspended()).length,
      administrators: users.filter((user) => user.role.isAdmin()).length,
    };
  }
}

export class TestPolicies {
  constructor(
    private readonly identifiers: readonly ("username" | "email")[] = [
      "username",
      "email",
    ],
    private readonly emailVerification = true,
  ) {}

  async getAccountPolicy() {
    return {
      ...DEFAULT_SECURITY_POLICY.accounts,
      allowedLoginIdentifiers: [...this.identifiers],
      emailVerification: this.emailVerification,
    };
  }

  async get() {
    return {
      level: "standard" as const,
      minLength: 8,
      maxLength: 128,
      minimumStrength: "too_weak" as const,
      checkCommonPasswords: false,
      checkCompromisedPasswords: false,
      checkUserContext: false,
      composition: {
        requireUppercase: false,
        requireLowercase: false,
        requireNumber: false,
        requireSpecialCharacter: false,
      },
      rejectCurrentPassword: false,
    };
  }

  async getSessionPolicy() {
    return { ...DEFAULT_SECURITY_POLICY.sessions, durationMinutes: 60 };
  }
  async getAuthenticationPolicy() {
    return structuredClone(DEFAULT_SECURITY_POLICY.authentication);
  }
}

export function testPasswordHash(value = "test-hash") {
  const result = PasswordHashValueObject.create(value);
  if (!result.success) {
    throw new Error("Invalid test password hash");
  }
  return result.value;
}

export const discardOutbox: OutboxWriter = {
  append: async () => undefined,
};
