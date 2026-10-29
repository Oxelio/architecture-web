// @file infrastructure/iam/persitence/kysely/src/mappers/user.mapper.ts

import {
  StatusValueObject,
  UserEntity,
  UserIdentifierValueObject,
  UserRoleValueObject,
} from "@architecture/iam/domain";

import { InvalidPersistenceDataError } from "#errors/invalid-persistence-data.error";
import type { IamDatabase } from "#persistence/schema";

type UserRow = IamDatabase["iam_users"];

export const UserMapper = {
  toDomain(row: UserRow): UserEntity {
    const identifier = UserIdentifierValueObject.create(row.id);
    if (!identifier.success) {
      throw new InvalidPersistenceDataError("User", "id", row.id);
    }

    const status = StatusValueObject.create(row.status);
    if (!status.success) {
      throw new InvalidPersistenceDataError("User", "status", row.status);
    }

    const role = UserRoleValueObject.create(row.role);
    if (!role.success) {
      throw new InvalidPersistenceDataError("User", "role", row.role);
    }

    if (!Number.isSafeInteger(row.session_version) || row.session_version < 1) {
      throw new InvalidPersistenceDataError(
        "User",
        "session_version",
        row.session_version,
      );
    }

    return UserEntity.rehydrate({
      identifier: identifier.value,
      role: role.value,
      status: status.value,
      sessionVersion: row.session_version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  },

  toPersistence(user: UserEntity): UserRow {
    return {
      id: user.identifier.value,
      role: user.role.value,
      status: user.status.value,
      session_version: user.sessionVersion,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  },
};
