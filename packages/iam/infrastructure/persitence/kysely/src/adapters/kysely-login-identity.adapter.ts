import type { LoginIdentityRepository } from "@architecture/iam/application";
import { toIamIntegrationEvent } from "@architecture/iam/application";
import type {
  LoginIdentifierKind,
  LoginIdentifierValueObject,
  LoginIdentityEntity,
  LoginIdentityIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely } from "kysely";

import { LoginIdentityMapper } from "#mappers/login-identity.mapper";
import type { IamDatabase } from "#persistence/schema";

export class KyselyLoginIdentityAdapter implements LoginIdentityRepository {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox?: OutboxWriter,
  ) {}

  async save(identity: LoginIdentityEntity): Promise<void> {
    const row = LoginIdentityMapper.toPersistence(identity);
    await this.db
      .insertInto("iam_login_identities")
      .values(row)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          normalized_value: row.normalized_value,
          verification_status: row.verification_status,
          verified_at: row.verified_at,
          updated_at: row.updated_at,
        }),
      )
      .execute();
    if (this.outbox) {
      await this.outbox.append(
        identity.pullDomainEvents().map(toIamIntegrationEvent),
      );
    }
  }

  async findById(
    id: LoginIdentityIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null> {
    const row = await this.db
      .selectFrom("iam_login_identities")
      .selectAll()
      .where("id", "=", id.value)
      .executeTakeFirst();
    return row ? LoginIdentityMapper.toDomain(row) : null;
  }

  async findByLogin(
    login: LoginIdentifierValueObject,
  ): Promise<LoginIdentityEntity | null> {
    const row = await this.db
      .selectFrom("iam_login_identities")
      .selectAll()
      .where("kind", "=", login.kind)
      .where("normalized_value", "=", login.value)
      .executeTakeFirst();
    return row ? LoginIdentityMapper.toDomain(row) : null;
  }

  async findForUser(
    userId: UserIdentifierValueObject,
    kind: LoginIdentifierKind,
  ): Promise<LoginIdentityEntity | null> {
    const row = await this.db
      .selectFrom("iam_login_identities")
      .selectAll()
      .where("user_id", "=", userId.value)
      .where("kind", "=", kind)
      .executeTakeFirst();
    return row ? LoginIdentityMapper.toDomain(row) : null;
  }

  async listForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly LoginIdentityEntity[]> {
    const rows = await this.db
      .selectFrom("iam_login_identities")
      .selectAll()
      .where("user_id", "=", userId.value)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(LoginIdentityMapper.toDomain);
  }
}
