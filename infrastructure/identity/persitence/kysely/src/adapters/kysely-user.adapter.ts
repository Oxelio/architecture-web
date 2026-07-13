// @file infrastructure/identity/persitence/kysely/src/adapters/kysely-user.adapter.ts

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

    await this.db
      .insertInto("identity_users")
      .values(row)
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          email: row.email,
          password_hash: row.password_hash,
          status: row.status,
          is_email_verified: row.is_email_verified,
          updated_at: row.updated_at,
        }),
      )
      .execute();
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
