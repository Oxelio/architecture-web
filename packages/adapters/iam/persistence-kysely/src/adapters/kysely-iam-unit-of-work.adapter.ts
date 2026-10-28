import {
  type IamTransactionalRepositories,
  IamUnitOfWork,
} from "@architecture/iam/application";
import type { UserIdentifierValueObject } from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely } from "kysely";

import type { IamDatabase } from "#persistence/schema";

import { KyselyEmailVerificationAdapter } from "./kysely-email-verification.adapter.js";
import { KyselyLoginIdentityAdapter } from "./kysely-login-identity.adapter.js";
import { KyselyPasswordAuthenticatorAdapter } from "./kysely-password-authenticator.adapter.js";
import { KyselyUserAdapter } from "./kysely-user.adapter.js";

export class KyselyIamUnitOfWorkAdapter extends IamUnitOfWork {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly createOutbox?: (db: Kysely<IamDatabase>) => OutboxWriter,
  ) {
    super();
  }

  execute<T>(
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.run(work);
  }

  executeForUser<T>(
    userId: UserIdentifierValueObject,
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.run(work, userId.value);
  }

  private run<T>(
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
    userId?: string,
  ): Promise<T> {
    return this.db.transaction().execute(async (transaction) => {
      if (userId) {
        await transaction
          .selectFrom("iam_users")
          .select("id")
          .where("id", "=", userId)
          .forUpdate()
          .executeTakeFirst();
      }
      const outbox = this.createOutbox?.(transaction);
      return work({
        emailVerifications: new KyselyEmailVerificationAdapter(transaction),
        loginIdentities: new KyselyLoginIdentityAdapter(transaction, outbox),
        passwordAuthenticators: new KyselyPasswordAuthenticatorAdapter(
          transaction,
          outbox,
        ),
        users: new KyselyUserAdapter(transaction, outbox),
      });
    });
  }
}
