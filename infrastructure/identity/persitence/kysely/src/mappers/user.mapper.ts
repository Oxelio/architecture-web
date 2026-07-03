import {
  EmailValueObject,
  PasswordHashValueObject,
  UserEntity,
  UserIdentifierValueObject,
} from "@architecture/identity/domain";

import { InvalidPersistenceDataError } from "../errors/invalid-persistence-data.error.js";
import type { IdentityDatabase } from "../persistence/schema.js";

type UserRow = IdentityDatabase["identity_users"];

export const UserMapper = {
  toDomain(row: UserRow): UserEntity {
    const email = EmailValueObject.create(row.email);
    if (!email.success) {
      throw new InvalidPersistenceDataError("User", "email", row.email);
    }

    const password = PasswordHashValueObject.create(row.password_hash);
    if (!password.success) {
      throw new InvalidPersistenceDataError(
        "User",
        "password_hash",
        row.password_hash,
      );
    }

    const identifier = UserIdentifierValueObject.create(row.id);
    if (!identifier.success) {
      throw new InvalidPersistenceDataError("User", "id", row.id);
    }

    return UserEntity.rehydrate({
      identifier: identifier.value,
      email: email.value,
      password: password.value,
    });
  },

  toPersistence(user: UserEntity): UserRow {
    return {
      id: user.identifier.value,
      email: user.email.value,
      password_hash: user.password.value,
    };
  },
};
