import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type { EmailVerificationRepository } from "./email-verification.repository.js";
import type { LoginIdentityRepository } from "./login-identity.repository.js";
import type { PasswordAuthenticatorRepository } from "./password-authenticator.repository.js";
import type { UserRepository } from "./user.repository.js";
import type { UserQueryRepository } from "./user-query.repository.js";

export interface IamTransactionalRepositories {
  readonly emailVerifications: EmailVerificationRepository;
  readonly loginIdentities: LoginIdentityRepository;
  readonly passwordAuthenticators: PasswordAuthenticatorRepository;
  readonly users: UserRepository;
  readonly userQueries: UserQueryRepository;
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
