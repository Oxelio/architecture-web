import {
  EmailValueObject,
  PasswordHashValueObject,
  StatusValueObject,
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

    const status = StatusValueObject.create(row.status);
    if (!status.success) {
      throw new InvalidPersistenceDataError("User", "status", row.status);
    }

    return UserEntity.rehydrate({
      identifier: identifier.value,
      email: email.value,
      password: password.value,
      status: status.value,
      isEmailVerified: row.is_email_verified,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    } as any);
  },

  toPersistence(user: UserEntity): UserRow {
    return {
      id: user.identifier.value,
      email: user.email.value,
      password_hash: user.password.value,
      status: user.status.value,
      is_email_verified: user.isEmailVerified,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  },
};
