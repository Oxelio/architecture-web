import type { UserEntity } from "@architecture/identity/domain";
import {
  EmailValueObject,
  UserIdentifierValueObject,
} from "@architecture/identity/domain";
import type { UserPort } from "@architecture/identity/application";
import type { Kysely } from "kysely";

import { UserMapper } from "../mappers/user.mapper.js";
import type { IdentityDatabase } from "../persistence/schema.js";

export class KyselyUserAdapter implements UserPort {
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
