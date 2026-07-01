import { UserEntity } from "#entities/user.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import type { Kysely } from "kysely";
import { UserMapper } from "#mappers/user.mapper";
import type { UserPort } from "#application/ports/user.port";
import type { IdentityDatabase } from "#persistence/kysely/schema";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export class KyselyUserAdaptater implements UserPort {
  constructor(private readonly db: Kysely<IdentityDatabase>) {}
  async save(user: UserEntity): Promise<void> {
    const row = UserMapper.toPersistence(user);

    await this.db.insertInto("identity_users").values(row).execute();
  }

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    const user = await this.db
      .selectFrom("identity_users")
      .selectAll()
      .where("email", "=", email.value)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    const user = await this.db
      .selectFrom("identity_users")
      .selectAll()
      .where("id", "=", id.value)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }
}
