import {
  IamTransactionalRepositories,
  IamUnitOfWork,
} from "#ports/iam-unit-of-work";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  InMemoryEmailVerificationRepository,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserQueryRepository,
  InMemoryUserRepository,
} from "./in-memory-repositories.js";

/**
 * Test double for the IAM unit-of-work port.
 * Does not emulate transaction rollback, row locks, or concurrent isolation.
 */
export class InMemoryIamUnitOfWork extends IamUnitOfWork {
  constructor(
    readonly users: InMemoryUserRepository,
    readonly loginIdentities: InMemoryLoginIdentityRepository,
    readonly passwordAuthenticators: InMemoryPasswordAuthenticatorRepository,
    readonly emailVerifications: InMemoryEmailVerificationRepository,
  ) {
    super();
  }

  executeForUser<T>(
    _userId: UserIdentifierValueObject,
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.execute(work);
  }

  execute<T>(
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return work({
      users: this.users,
      userQueries: new InMemoryUserQueryRepository(
        this.users,
        this.loginIdentities,
      ),
      loginIdentities: this.loginIdentities,
      passwordAuthenticators: this.passwordAuthenticators,
      emailVerifications: this.emailVerifications,
    });
  }
}
