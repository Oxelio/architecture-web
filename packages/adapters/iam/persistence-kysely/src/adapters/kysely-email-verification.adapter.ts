// @file infrastructure/iam/persitence/kysely/src/adapters/kysely-email-verification.adapter.ts

import type { EmailVerificationRepository } from "@architecture/iam/application";
import {
  EmailVerificationEntity,
  EmailVerificationTokenHashValueObject,
  LoginIdentityIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { Kysely } from "kysely";

import type { IamDatabase, IamEmailVerificationRow } from "#persistence/schema";

export class KyselyEmailVerificationAdapter implements EmailVerificationRepository {
  constructor(private readonly db: Kysely<IamDatabase>) {}

  async save(verification: EmailVerificationEntity): Promise<void> {
    const row: IamEmailVerificationRow = {
      token_hash: verification.tokenHash.value,
      user_id: verification.userId.value,
      login_identity_id: verification.loginIdentityId.value,
      expires_at: verification.expiresAt,
      used: verification.isUsed,
      invalidated: verification.isInvalidated,
      created_at: new Date(),
    };

    await this.db.insertInto("iam_email_verifications").values(row).execute();
  }

  async findByToken(
    tokenHash: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null> {
    const row = await this.db
      .selectFrom("iam_email_verifications")
      .selectAll()
      .where("token_hash", "=", tokenHash.value)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const userIdResult = UserIdentifierValueObject.create(row.user_id);
    if (!userIdResult.success) {
      return null;
    }

    const persistedTokenHash = EmailVerificationTokenHashValueObject.create(
      row.token_hash,
    );
    if (!persistedTokenHash.success) {
      return null;
    }
    const loginIdentityId = LoginIdentityIdentifierValueObject.create(
      row.login_identity_id,
    );
    if (!loginIdentityId.success) {
      return null;
    }

    return EmailVerificationEntity.rehydrate({
      tokenHash: persistedTokenHash.value,
      userId: userIdResult.value,
      loginIdentityId: loginIdentityId.value,
      expiresAt: row.expires_at,
      used: row.used,
      invalidated: row.invalidated,
    });
  }

  async consume(
    tokenHash: EmailVerificationTokenHashValueObject,
    now: Date,
  ): Promise<boolean> {
    const result = await this.db
      .updateTable("iam_email_verifications")
      .set({ used: true })
      .where("token_hash", "=", tokenHash.value)
      .where("used", "=", false)
      .where("invalidated", "=", false)
      .where("expires_at", ">=", now)
      .executeTakeFirst();

    return result.numUpdatedRows > 0n;
  }

  async invalidatePreviousFor(
    loginIdentityId: LoginIdentityIdentifierValueObject,
  ): Promise<void> {
    await this.db
      .updateTable("iam_email_verifications")
      .set({
        invalidated: true,
      })
      .where("login_identity_id", "=", loginIdentityId.value)
      .where("invalidated", "=", false)
      .execute();
  }
}
