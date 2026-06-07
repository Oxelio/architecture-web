import type { UserContract } from "#contracts/user";
import { User } from "#entities/user";
import { Email } from "#value-objects/email";
import type { Kysely } from "kysely";
import type { IdentityDatabase } from "#persistence/schema";

export class UserAdapter implements UserContract {
  constructor(private readonly db: Kysely<IdentityDatabase>) {}

  async save(user: User): Promise<void> {
    await this.db
      .insertInto("identity_users")
      .values({
        id: user.identifier.value,
        email: user.email.value,
        password_hash: user.password.value,
        created_at: new Date(),
      })
      .execute();
  }

  async findByEmail(email: Email): Promise<User | null> {
    const user = await this.db
      .selectFrom("identity_users")
      .where("email", "=", email.value)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    // TODO: map user to domain entity
    return null;
  }
}
