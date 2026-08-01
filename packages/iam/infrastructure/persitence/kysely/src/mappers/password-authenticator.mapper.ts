import {
  AuthenticatorIdentifierValueObject,
  PasswordAuthenticatorEntity,
  PasswordHashValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";

import { InvalidPersistenceDataError } from "#errors/invalid-persistence-data.error";
import type { IamPasswordAuthenticatorRow } from "#persistence/schema";

export const PasswordAuthenticatorMapper = {
  toDomain(row: IamPasswordAuthenticatorRow): PasswordAuthenticatorEntity {
    const identifier = AuthenticatorIdentifierValueObject.create(row.id);
    const userId = UserIdentifierValueObject.create(row.user_id);
    const passwordHash = PasswordHashValueObject.create(row.password_hash);
    if (!identifier.success) {
      throw new InvalidPersistenceDataError(
        "PasswordAuthenticator",
        "id",
        row.id,
      );
    }
    if (!userId.success) {
      throw new InvalidPersistenceDataError(
        "PasswordAuthenticator",
        "user_id",
        row.user_id,
      );
    }
    if (!passwordHash.success) {
      throw new InvalidPersistenceDataError(
        "PasswordAuthenticator",
        "password_hash",
        row.password_hash,
      );
    }
    return PasswordAuthenticatorEntity.rehydrate({
      identifier: identifier.value,
      userId: userId.value,
      passwordHash: passwordHash.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    });
  },

  toPersistence(
    authenticator: PasswordAuthenticatorEntity,
  ): IamPasswordAuthenticatorRow {
    return {
      id: authenticator.identifier.value,
      user_id: authenticator.userId.value,
      password_hash: authenticator.passwordHash.value,
      created_at: authenticator.createdAt,
      updated_at: authenticator.updatedAt,
      last_used_at: authenticator.lastUsedAt,
      revoked_at: authenticator.revokedAt,
    };
  },
};
