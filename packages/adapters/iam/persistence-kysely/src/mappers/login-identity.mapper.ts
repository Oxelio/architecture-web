import {
  LoginIdentifierValueObject,
  LoginIdentityEntity,
  LoginIdentityIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";

import { InvalidPersistenceDataError } from "#errors/invalid-persistence-data.error";
import type { IamLoginIdentityRow } from "#persistence/schema";

export const LoginIdentityMapper = {
  toDomain(row: Omit<IamLoginIdentityRow, "generation">): LoginIdentityEntity {
    const identifier = LoginIdentityIdentifierValueObject.create(row.id);
    const userId = UserIdentifierValueObject.create(row.user_id);
    const login = LoginIdentifierValueObject.create(
      row.kind as "username" | "email",
      row.normalized_value,
    );
    if (!identifier.success) {
      throw new InvalidPersistenceDataError("LoginIdentity", "id", row.id);
    }
    if (!userId.success) {
      throw new InvalidPersistenceDataError(
        "LoginIdentity",
        "user_id",
        row.user_id,
      );
    }
    if (!login.success) {
      throw new InvalidPersistenceDataError(
        "LoginIdentity",
        "normalized_value",
        row.normalized_value,
      );
    }
    if (
      !(["not_required", "pending", "verified"] as const).includes(
        row.verification_status as "not_required" | "pending" | "verified",
      )
    ) {
      throw new InvalidPersistenceDataError(
        "LoginIdentity",
        "verification_status",
        row.verification_status,
      );
    }
    return LoginIdentityEntity.rehydrate({
      identifier: identifier.value,
      userId: userId.value,
      login: login.value,
      verificationStatus: row.verification_status as
        "not_required" | "pending" | "verified",
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  },

  toPersistence(
    identity: LoginIdentityEntity,
  ): Omit<IamLoginIdentityRow, "generation"> {
    return {
      id: identity.identifier.value,
      user_id: identity.userId.value,
      kind: identity.login.kind,
      normalized_value: identity.login.value,
      verification_status: identity.verificationStatus,
      verified_at: identity.verifiedAt,
      created_at: identity.createdAt,
      updated_at: identity.updatedAt,
    };
  },
};
