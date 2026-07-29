import {
  type IamTransactionalRepositories,
  IamUnitOfWork,
} from "@architecture/iam/application";
import type { Kysely } from "kysely";

import type { IamDatabase } from "#persistence/schema";

import { KyselyEmailVerificationAdapter } from "./kysely-email-verification.adapter.js";
import { KyselyUserAdapter } from "./kysely-user.adapter.js";

export class KyselyIamUnitOfWorkAdapter extends IamUnitOfWork {
  constructor(private readonly db: Kysely<IamDatabase>) {
    super();
  }

  execute<T>(
    work: (repositories: IamTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute((transaction) =>
      work({
        emailVerifications: new KyselyEmailVerificationAdapter(transaction),
        users: new KyselyUserAdapter(transaction),
      }),
    );
  }
}
