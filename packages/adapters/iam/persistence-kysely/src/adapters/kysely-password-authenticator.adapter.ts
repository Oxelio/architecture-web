import type { PasswordAuthenticatorRepository } from "@architecture/iam/application";
import { toIamIntegrationEvent } from "@architecture/iam/application";
import type {
  PasswordAuthenticatorEntity,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import { type Kysely, sql } from "kysely";

import { PasswordAuthenticatorMapper } from "#mappers/password-authenticator.mapper";
import type { IamDatabase } from "#persistence/schema";

export class KyselyPasswordAuthenticatorAdapter implements PasswordAuthenticatorRepository {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox?: OutboxWriter,
  ) {}

  async save(authenticator: PasswordAuthenticatorEntity): Promise<void> {
    const row = PasswordAuthenticatorMapper.toPersistence(authenticator);
    await this.db
      .insertInto("iam_password_authenticators")
      .values(row)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          password_hash: row.password_hash,
          updated_at: row.updated_at,
          last_used_at: row.last_used_at,
          revoked_at: row.revoked_at,
        }),
      )
      .execute();
    if (this.outbox) {
      await this.outbox.append(
        authenticator.pullDomainEvents().map(toIamIntegrationEvent),
      );
    }
  }

  async findForUser(
    userId: UserIdentifierValueObject,
  ): Promise<PasswordAuthenticatorEntity | null> {
    const row = await this.db
      .selectFrom("iam_password_authenticators")
      .selectAll()
      .where("user_id", "=", userId.value)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    return row ? PasswordAuthenticatorMapper.toDomain(row) : null;
  }

  async recordSuccessfulUse(
    authenticator: PasswordAuthenticatorEntity,
    usedAt: Date,
  ) {
    const result = await this.db
      .updateTable("iam_password_authenticators")
      .set({ last_used_at: sql<Date>`greatest(last_used_at, ${usedAt})` })
      .where("id", "=", authenticator.identifier.value)
      .where("password_hash", "=", authenticator.passwordHash.value)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }
}
