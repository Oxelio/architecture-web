// @file infrastructure/iam/persitence/kysely/src/adapters/kysely-user.adapter.ts

import type { UserAdministrationRepository } from "@architecture/iam/application";
import type { UserEntity } from "@architecture/iam/domain";
import {
  EmailValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { Kysely } from "kysely";

import { UserMapper } from "#mappers/user.mapper";
import type { IamDatabase } from "#persistence/schema";

export class KyselyUserAdapter implements UserAdministrationRepository {
  constructor(private readonly db: Kysely<IamDatabase>) {}

  async save(user: UserEntity): Promise<void> {
    const row = UserMapper.toPersistence(user);

    await this.db
      .insertInto("iam_users")
      .values(row)
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          email: row.email,
          password_hash: row.password_hash,
          role: row.role,
          status: row.status,
          is_email_verified: row.is_email_verified,
          updated_at: row.updated_at,
        }),
      )
      .execute();
  }

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    const user = await this.db
      .selectFrom("iam_users")
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
      .selectFrom("iam_users")
      .selectAll()
      .where("id", "=", id.value)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findAll(): Promise<readonly UserEntity[]> {
    const users = await this.db
      .selectFrom("iam_users")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return users.map(UserMapper.toDomain);
  }
}
