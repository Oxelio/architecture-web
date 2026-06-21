import { User } from "#entities/user";
import { Email } from "#value-objects/email";
import { PasswordHash } from "#value-objects/password-hash";
import { UserIdentifier } from "#value-objects/user-identifier";
import type { IdentityDatabase } from "#persistence/schema";

type UserRow = IdentityDatabase["identity_users"];

export const UserMapper = {
  toDomain(row: UserRow): User {
    return User.rehydrate({
      identifier: UserIdentifier.of(row.id),
      email: Email.of(row.email),
      password: PasswordHash.of(row.password_hash),
    });
  },

  toPersistence(user: User): UserRow {
    return {
      id: user.identifier.value,
      email: user.email.value,
      password_hash: user.password.value,
      created_at: new Date(),
    };
  },
};
