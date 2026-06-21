import type { UserContract } from "#contracts/user";
import { User } from "#entities/user";
import { Email } from "#value-objects/email";
import type { Kysely } from "kysely";
import type { IdentityDatabase } from "#persistence/schema";
import { UserMapper } from "#mappers/user";

export class UserRepository implements UserContract {
  constructor(private readonly db: Kysely<IdentityDatabase>) {}

  async save(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user);

    await this.db.insertInto("identity_users").values(row).execute();
  }

  async findByEmail(email: Email): Promise<User | null> {
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
