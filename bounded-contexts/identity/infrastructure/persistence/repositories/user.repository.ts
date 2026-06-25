import type { UserPort } from "../../../application/ports/user.port.js";
import { UserEntity } from "#entities/user.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import type { Kysely } from "kysely";
import type { IdentityDatabase } from "#persistence/schema";
import { UserMapper } from "#mappers/user";

export class UserRepository implements UserPort {
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
}
