import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface IamTransactionalRepositories {
  readonly emailVerifications: EmailVerificationRepository;
  readonly loginIdentities: LoginIdentityRepository;
  readonly passwordAuthenticators: PasswordAuthenticatorRepository;
  readonly users: UserRepository;
}

/**
 * Executes changes to PostgreSQL-backed IAM aggregates in one transaction.
 *
 * Redis-backed session operations are intentionally excluded: consistency
 * across PostgreSQL and Redis is handled as an idempotent cross-store workflow.
 */
export abstract class IamUnitOfWork {
  abstract executeForUser<T>(
    userId: UserIdentifierValueObject,
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T>;
  abstract execute<T>(
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T>;
}
