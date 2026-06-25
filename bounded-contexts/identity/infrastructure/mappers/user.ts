import { UserEntity } from "#entities/user.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import type { IdentityDatabase } from "#persistence/schema";

type UserRow = IdentityDatabase["identity_users"];

export const UserMapper = {
  toDomain(row: UserRow): UserEntity {
    return UserEntity.rehydrate({
      identifier: UserIdentifierValueObject.of(row.id),
      email: EmailValueObject.of(row.email),
      password: PasswordHashValueObject.of(row.password_hash),
    });
  },

  toPersistence(user: UserEntity): UserRow {
    return {
      id: user.identifier.value,
      email: user.email.value,
      password_hash: user.password.value,
      created_at: new Date(),
    };
  },
};
